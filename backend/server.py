from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from bs4 import BeautifulSoup
import csv
import io
from passlib.context import CryptContext
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are required")

db: Client = create_client(supabase_url, supabase_key)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
REQUIRED_TABLES = ("users", "user_sessions", "transactions", "budgets", "alerts")


class DatabaseAccessError(RuntimeError):
    """Raised when a Supabase operation fails."""

# ============== MODELS ==============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # income, expense, transfer
    category: str
    amount: float
    description: str
    recipient: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    type: str
    category: str
    amount: float
    description: str
    recipient: Optional[str] = None
    date: Optional[str] = None

class Budget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    budget_id: str = Field(default_factory=lambda: f"bgt_{uuid.uuid4().hex[:12]}")
    user_id: str
    category: str
    limit: float
    spent: float = 0
    period: str = "monthly"  # monthly, weekly
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BudgetCreate(BaseModel):
    category: str
    limit: float
    period: str = "monthly"

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    alert_id: str = Field(default_factory=lambda: f"alt_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # budget_exceeded, large_transaction, low_balance
    message: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockData(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    volume: Optional[str] = None

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

def parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

def apply_eq_filters(query, filters: Optional[dict] = None):
    if not filters:
        return query

    for field, value in filters.items():
        query = query.eq(field, value)
    return query


def run_db_query(table: str, action: str, operation):
    try:
        return operation()
    except Exception as exc:
        logger.exception("Database %s failed for table '%s'", action, table)
        raise DatabaseAccessError(
            "Database is unavailable. Check Supabase configuration and run the required schema migrations."
        ) from exc

def fetch_rows(
    table: str,
    filters: Optional[dict] = None,
    order_by: Optional[str] = None,
    desc: bool = False,
    limit: Optional[int] = None,
    gte: Optional[dict] = None,
    lte: Optional[dict] = None,
):
    query = db.table(table).select("*")
    query = apply_eq_filters(query, filters)

    if gte:
        for field, value in gte.items():
            query = query.gte(field, value)
    if lte:
        for field, value in lte.items():
            query = query.lte(field, value)
    if order_by:
        query = query.order(order_by, desc=desc)
    if limit:
        query = query.limit(limit)

    response = run_db_query(table, "select", query.execute)
    return response.data or []

def fetch_one(table: str, filters: dict):
    rows = fetch_rows(table, filters=filters, limit=1)
    return rows[0] if rows else None

def insert_row(table: str, row: dict):
    response = run_db_query(table, "insert", lambda: db.table(table).insert(row).execute())
    return response.data[0] if response.data else row

def update_rows(table: str, values: dict, filters: dict):
    query = db.table(table).update(values)
    query = apply_eq_filters(query, filters)
    response = run_db_query(table, "update", query.execute)
    return response.data or []

def delete_rows(table: str, filters: dict):
    query = db.table(table).delete()
    query = apply_eq_filters(query, filters)
    response = run_db_query(table, "delete", query.execute)
    return response.data or []


def assert_required_tables_ready(tables: tuple[str, ...] = REQUIRED_TABLES):
    """Ensure the hosted Supabase project has the schema this app expects."""
    for table in tables:
        fetch_rows(table, limit=1)

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    session_token = get_session_token_from_request(request)
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = fetch_one("user_sessions", {"session_token": session_token})
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = parse_datetime(session_doc["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = fetch_one("users", {"user_id": session_doc["user_id"]})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

def get_session_token_from_request(request: Request) -> Optional[str]:
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]

    return None

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

async def create_user_session(user_id: str) -> str:
    session_token = f"session_{uuid.uuid4().hex}"
    insert_row("user_sessions", {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return session_token

def set_session_cookie(response: Response, request: Request, session_token: str):
    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_secure,
        samesite="none" if is_secure else "lax",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

def build_auth_response(user_doc: dict) -> dict:
    return {
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture"),
    }

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register")
async def register(auth: RegisterRequest, request: Request, response: Response):
    """Create a local account and session"""
    assert_required_tables_ready()
    email = auth.email.lower().strip()
    existing_user = fetch_one("users", {"email": email})

    if existing_user and existing_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    if existing_user:
        password_hash = hash_password(auth.password)
        update_rows(
            "users",
            {"name": auth.name.strip(), "password_hash": password_hash},
            {"user_id": existing_user["user_id"]},
        )
        user_doc = fetch_one("users", {"user_id": existing_user["user_id"]})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": auth.name.strip(),
            "picture": None,
            "password_hash": hash_password(auth.password),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        insert_row("users", user_doc)
        await create_sample_data(user_id)

    session_token = await create_user_session(user_doc["user_id"])
    set_session_cookie(response, request, session_token)
    payload = build_auth_response(user_doc)
    payload["session_token"] = session_token
    return payload

@api_router.post("/auth/login")
async def login(auth: LoginRequest, request: Request, response: Response):
    """Authenticate an existing local account"""
    email = auth.email.lower().strip()
    user_doc = fetch_one("users", {"email": email})

    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(auth.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token = await create_user_session(user_doc["user_id"])
    set_session_cookie(response, request, session_token)
    payload = build_auth_response(user_doc)
    payload["session_token"] = session_token
    return payload

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return build_auth_response(user.model_dump())

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = get_session_token_from_request(request)
    if session_token:
        delete_rows("user_sessions", {"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== SAMPLE DATA ==============

async def create_sample_data(user_id: str):
    """Create sample transactions and budgets for new users"""
    categories = ["Food & Dining", "Shopping", "Transport", "Bills", "Entertainment", "Salary", "Freelance"]
    
    # Sample transactions
    transactions = [
        {"type": "income", "category": "Salary", "amount": 75000, "description": "Monthly Salary", "date": datetime.now(timezone.utc) - timedelta(days=1)},
        {"type": "expense", "category": "Food & Dining", "amount": 2500, "description": "Restaurant dinner", "date": datetime.now(timezone.utc) - timedelta(days=2)},
        {"type": "expense", "category": "Shopping", "amount": 5000, "description": "Online shopping", "date": datetime.now(timezone.utc) - timedelta(days=3)},
        {"type": "expense", "category": "Transport", "amount": 1500, "description": "Uber rides", "date": datetime.now(timezone.utc) - timedelta(days=4)},
        {"type": "expense", "category": "Bills", "amount": 3000, "description": "Electricity bill", "date": datetime.now(timezone.utc) - timedelta(days=5)},
        {"type": "income", "category": "Freelance", "amount": 15000, "description": "Freelance project", "date": datetime.now(timezone.utc) - timedelta(days=7)},
        {"type": "expense", "category": "Entertainment", "amount": 1200, "description": "Movie tickets", "date": datetime.now(timezone.utc) - timedelta(days=8)},
        {"type": "transfer", "category": "Transfer", "amount": 10000, "description": "Savings transfer", "recipient": "Savings Account", "date": datetime.now(timezone.utc) - timedelta(days=10)},
    ]
    
    for txn in transactions:
        txn_doc = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": txn["type"],
            "category": txn["category"],
            "amount": txn["amount"],
            "description": txn["description"],
            "recipient": txn.get("recipient"),
            "date": txn["date"].isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        insert_row("transactions", txn_doc)
    
    # Sample budgets
    budgets = [
        {"category": "Food & Dining", "limit": 10000, "spent": 2500},
        {"category": "Shopping", "limit": 8000, "spent": 5000},
        {"category": "Transport", "limit": 5000, "spent": 1500},
        {"category": "Entertainment", "limit": 3000, "spent": 1200},
    ]
    
    for budget in budgets:
        budget_doc = {
            "budget_id": f"bgt_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "category": budget["category"],
            "limit": budget["limit"],
            "spent": budget["spent"],
            "period": "monthly",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        insert_row("budgets", budget_doc)

# ============== TRANSACTION ENDPOINTS ==============

@api_router.get("/transactions")
async def get_transactions(
    request: Request,
    type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    """Get user transactions with filters"""
    user = await get_current_user(request)
    
    query = {"user_id": user.user_id}
    
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    range_gte = {}
    range_lte = {}
    if start_date:
        range_gte["date"] = start_date
    if end_date:
        range_lte["date"] = end_date

    transactions = fetch_rows(
        "transactions",
        filters=query,
        order_by="date",
        desc=True,
        limit=limit,
        gte=range_gte or None,
        lte=range_lte or None,
    )
    return transactions

@api_router.post("/transactions")
async def create_transaction(request: Request, txn: TransactionCreate):
    """Create a new transaction"""
    user = await get_current_user(request)
    
    txn_date = datetime.now(timezone.utc)
    if txn.date:
        txn_date = datetime.fromisoformat(txn.date.replace('Z', '+00:00'))
    
    txn_doc = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "type": txn.type,
        "category": txn.category,
        "amount": txn.amount,
        "description": txn.description,
        "recipient": txn.recipient,
        "date": txn_date.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    insert_row("transactions", txn_doc)
    
    # Update budget spent if expense
    if txn.type == "expense":
        budget = fetch_one("budgets", {"user_id": user.user_id, "category": txn.category})
        if budget:
            update_rows(
                "budgets",
                {"spent": float(budget.get("spent", 0)) + txn.amount},
                {"budget_id": budget["budget_id"]},
            )
        
        # Check if budget exceeded and create alert
        budget = fetch_one("budgets", {"user_id": user.user_id, "category": txn.category})
        if budget and budget.get("spent", 0) > budget.get("limit", 0):
            alert_doc = {
                "alert_id": f"alt_{uuid.uuid4().hex[:12]}",
                "user_id": user.user_id,
                "type": "budget_exceeded",
                "message": f"Budget exceeded for {txn.category}! Spent ₹{budget['spent']} of ₹{budget['limit']}",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            insert_row("alerts", alert_doc)
    
    # Create alert for large transactions
    if txn.amount >= 50000:
        alert_doc = {
            "alert_id": f"alt_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "type": "large_transaction",
            "message": f"Large {txn.type} of ₹{txn.amount:,.2f} recorded",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        insert_row("alerts", alert_doc)

    return txn_doc

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(request: Request, transaction_id: str):
    """Delete a transaction"""
    user = await get_current_user(request)
    
    deleted = delete_rows("transactions", {
        "transaction_id": transaction_id,
        "user_id": user.user_id
    })
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {"message": "Transaction deleted"}

# ============== BUDGET ENDPOINTS ==============

@api_router.get("/budgets")
async def get_budgets(request: Request):
    """Get user budgets"""
    user = await get_current_user(request)
    budgets = fetch_rows("budgets", filters={"user_id": user.user_id}, limit=100)
    return budgets

@api_router.post("/budgets")
async def create_budget(request: Request, budget: BudgetCreate):
    """Create a new budget"""
    user = await get_current_user(request)
    
    # Check if budget for category exists
    existing = fetch_one("budgets", {
        "user_id": user.user_id,
        "category": budget.category
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Budget for this category already exists")
    
    budget_doc = {
        "budget_id": f"bgt_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "category": budget.category,
        "limit": budget.limit,
        "spent": 0,
        "period": budget.period,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    insert_row("budgets", budget_doc)
    return budget_doc

@api_router.put("/budgets/{budget_id}")
async def update_budget(request: Request, budget_id: str, budget: BudgetCreate):
    """Update a budget"""
    user = await get_current_user(request)
    
    updated = update_rows(
        "budgets",
        {"limit": budget.limit, "period": budget.period},
        {"budget_id": budget_id, "user_id": user.user_id},
    )
    
    if not updated:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    return {"message": "Budget updated"}

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(request: Request, budget_id: str):
    """Delete a budget"""
    user = await get_current_user(request)
    
    deleted = delete_rows("budgets", {
        "budget_id": budget_id,
        "user_id": user.user_id
    })
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    return {"message": "Budget deleted"}

# ============== ALERTS ENDPOINTS ==============

@api_router.get("/alerts")
async def get_alerts(request: Request):
    """Get user alerts"""
    user = await get_current_user(request)
    alerts = fetch_rows(
        "alerts",
        filters={"user_id": user.user_id},
        order_by="created_at",
        desc=True,
        limit=50,
    )
    return alerts

@api_router.put("/alerts/{alert_id}/read")
async def mark_alert_read(request: Request, alert_id: str):
    """Mark alert as read"""
    user = await get_current_user(request)
    
    update_rows("alerts", {"read": True}, {"alert_id": alert_id, "user_id": user.user_id})
    
    return {"message": "Alert marked as read"}

@api_router.put("/alerts/read-all")
async def mark_all_alerts_read(request: Request):
    """Mark all alerts as read"""
    user = await get_current_user(request)
    
    update_rows("alerts", {"read": True}, {"user_id": user.user_id})
    
    return {"message": "All alerts marked as read"}

# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    """Get dashboard statistics"""
    user = await get_current_user(request)
    
    # Get all transactions
    transactions = fetch_rows("transactions", filters={"user_id": user.user_id}, limit=1000)
    
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
    total_transfer = sum(t["amount"] for t in transactions if t["type"] == "transfer")
    balance = total_income - total_expense - total_transfer
    
    # Get this month's data
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    monthly_income = 0
    monthly_expense = 0
    expense_by_category = {}
    
    for t in transactions:
        t_date = datetime.fromisoformat(t["date"].replace('Z', '+00:00')) if isinstance(t["date"], str) else t["date"]
        if t_date.tzinfo is None:
            t_date = t_date.replace(tzinfo=timezone.utc)
        
        if t_date >= month_start:
            if t["type"] == "income":
                monthly_income += t["amount"]
            elif t["type"] == "expense":
                monthly_expense += t["amount"]
                cat = t["category"]
                expense_by_category[cat] = expense_by_category.get(cat, 0) + t["amount"]
    
    # Get spending trend (last 7 days)
    spending_trend = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        daily_expense = 0
        for t in transactions:
            t_date = datetime.fromisoformat(t["date"].replace('Z', '+00:00')) if isinstance(t["date"], str) else t["date"]
            if t_date.tzinfo is None:
                t_date = t_date.replace(tzinfo=timezone.utc)
            
            if day_start <= t_date < day_end and t["type"] == "expense":
                daily_expense += t["amount"]
        
        spending_trend.append({
            "date": day_start.strftime("%a"),
            "amount": daily_expense
        })
    
    # Get unread alerts count
    unread_alert_rows = fetch_rows("alerts", filters={
        "user_id": user.user_id,
        "read": False
    }, limit=1000)
    unread_alerts = len(unread_alert_rows)
    
    return {
        "balance": balance,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_transfer": total_transfer,
        "monthly_income": monthly_income,
        "monthly_expense": monthly_expense,
        "expense_by_category": expense_by_category,
        "spending_trend": spending_trend,
        "unread_alerts": unread_alerts
    }

# ============== STOCK DATA (Web Scraping) ==============

@api_router.get("/stocks")
async def get_stock_data():
    """Get stock data from NSE/BSE via web scraping"""
    stocks = []
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            # Scrape from Google Finance for Indian stocks
            symbols = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN", "BHARTIARTL"]
            
            for symbol in symbols:
                try:
                    url = f"https://www.google.com/finance/quote/{symbol}:NSE"
                    response = await client_http.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })
                    
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, 'html.parser')
                        
                        # Get price
                        price_elem = soup.find('div', {'class': 'YMlKec fxKbKc'})
                        price = 0
                        if price_elem:
                            price_text = price_elem.text.replace('₹', '').replace(',', '').strip()
                            try:
                                price = float(price_text)
                            except:
                                price = 0
                        
                        # Get change
                        change_elem = soup.find('div', {'class': 'JwB6zf'})
                        change = 0
                        change_percent = 0
                        if change_elem:
                            change_text = change_elem.text
                            parts = change_text.split()
                            if len(parts) >= 1:
                                try:
                                    change = float(parts[0].replace('₹', '').replace(',', '').replace('+', ''))
                                except:
                                    change = 0
                            if len(parts) >= 2:
                                try:
                                    change_percent = float(parts[1].replace('%', '').replace('(', '').replace(')', '').replace('+', ''))
                                except:
                                    change_percent = 0
                        
                        # Get company name
                        name_elem = soup.find('div', {'class': 'zzDege'})
                        name = name_elem.text if name_elem else symbol
                        
                        stocks.append({
                            "symbol": symbol,
                            "name": name,
                            "price": price,
                            "change": change,
                            "change_percent": change_percent
                        })
                except Exception as e:
                    logger.error(f"Error scraping {symbol}: {e}")
                    continue
    except Exception as e:
        logger.error(f"Error fetching stock data: {e}")
    
    # Return fallback data if scraping fails
    if not stocks:
        stocks = [
            {"symbol": "RELIANCE", "name": "Reliance Industries", "price": 2456.75, "change": 23.45, "change_percent": 0.96},
            {"symbol": "TCS", "name": "Tata Consultancy Services", "price": 3789.50, "change": -15.30, "change_percent": -0.40},
            {"symbol": "HDFCBANK", "name": "HDFC Bank", "price": 1623.25, "change": 12.80, "change_percent": 0.79},
            {"symbol": "INFY", "name": "Infosys", "price": 1456.90, "change": 8.25, "change_percent": 0.57},
            {"symbol": "ICICIBANK", "name": "ICICI Bank", "price": 1089.45, "change": -5.60, "change_percent": -0.51},
            {"symbol": "HINDUNILVR", "name": "Hindustan Unilever", "price": 2345.60, "change": 18.90, "change_percent": 0.81},
            {"symbol": "SBIN", "name": "State Bank of India", "price": 623.40, "change": 7.25, "change_percent": 1.18},
            {"symbol": "BHARTIARTL", "name": "Bharti Airtel", "price": 1567.80, "change": -12.45, "change_percent": -0.79},
        ]
    
    return stocks

# ============== EXPORT ENDPOINTS ==============

@api_router.get("/export/transactions")
async def export_transactions(request: Request, format: str = "csv"):
    """Export transactions as CSV"""
    user = await get_current_user(request)
    
    transactions = fetch_rows(
        "transactions",
        filters={"user_id": user.user_id},
        order_by="date",
        desc=True,
        limit=1000,
    )
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Type", "Category", "Amount", "Description", "Recipient"])
        
        for txn in transactions:
            date_str = txn["date"][:10] if isinstance(txn["date"], str) else txn["date"].strftime("%Y-%m-%d")
            writer.writerow([
                date_str,
                txn["type"],
                txn["category"],
                txn["amount"],
                txn["description"],
                txn.get("recipient", "")
            ])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transactions.csv"}
        )
    
    return transactions

@api_router.get("/export/report")
async def export_report(request: Request):
    """Export monthly report"""
    user = await get_current_user(request)
    stats = await get_dashboard_stats(request)
    
    budgets = fetch_rows("budgets", filters={"user_id": user.user_id}, limit=100)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Monthly Financial Report"])
    writer.writerow([])
    writer.writerow(["Summary"])
    writer.writerow(["Current Balance", f"₹{stats['balance']:,.2f}"])
    writer.writerow(["Total Income", f"₹{stats['total_income']:,.2f}"])
    writer.writerow(["Total Expenses", f"₹{stats['total_expense']:,.2f}"])
    writer.writerow(["Monthly Income", f"₹{stats['monthly_income']:,.2f}"])
    writer.writerow(["Monthly Expenses", f"₹{stats['monthly_expense']:,.2f}"])
    writer.writerow([])
    writer.writerow(["Expense by Category"])
    for cat, amount in stats['expense_by_category'].items():
        writer.writerow([cat, f"₹{amount:,.2f}"])
    writer.writerow([])
    writer.writerow(["Budget Status"])
    writer.writerow(["Category", "Limit", "Spent", "Remaining"])
    for budget in budgets:
        remaining = budget["limit"] - budget["spent"]
        writer.writerow([
            budget["category"],
            f"₹{budget['limit']:,.2f}",
            f"₹{budget['spent']:,.2f}",
            f"₹{remaining:,.2f}"
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=monthly_report.csv"}
    )

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Fintech Dashboard API", "status": "running"}

@api_router.get("/health")
async def health_check():
    assert_required_tables_ready()
    return {"status": "healthy", "database": "ok", "tables": list(REQUIRED_TABLES)}

# Include the router in the main app
app.include_router(api_router)


@app.exception_handler(DatabaseAccessError)
async def database_access_error_handler(request: Request, exc: DatabaseAccessError):
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)},
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled request failure for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Unexpected server error. Check the backend logs for the full traceback."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
