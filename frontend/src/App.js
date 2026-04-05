import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  ArrowUpDown,
  PiggyBank,
  Bell,
  FileText,
  TrendingUp,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Download,
  Search,
  Filter,
  X,
  Check,
  ChevronDown,
  Menu,
  TrendingDown,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { Calendar } from "./components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ScrollArea } from "./components/ui/scroll-area";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true,
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth Callback Component
const AuthCallback = () => {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);

      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(
            `${API}/auth/session`,
            { session_id: sessionId },
            { withCredentials: true }
          );
          setUser(response.data);
          toast.success(`Welcome, ${response.data.name}!`);
          navigate("/dashboard", { replace: true, state: { user: response.data } });
        } catch (error) {
          console.error("Auth error:", error);
          toast.error("Authentication failed. Please try again.");
          navigate("/", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    };

    processAuth();
  }, [location, navigate, setUser]);

  return (
    <div className="loading-spinner" style={{ minHeight: "100vh" }}>
      <div className="spinner"></div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !location.state?.user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate, location]);

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user && !location.state?.user) {
    return null;
  }

  return children;
};

// Landing Page
const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Wallet size={20} />
          </div>
          <span className="sidebar-logo-text">MoneyHub</span>
        </div>
        <Button
          data-testid="login-btn"
          onClick={handleLogin}
          className="btn-google"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </Button>
      </nav>

      <div className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Your finances,
            <br />
            <span>simplified.</span>
          </h1>
          <p className="hero-subtitle">
            Track transactions, manage budgets, monitor markets, and take control
            of your financial future with our powerful yet simple dashboard.
          </p>
          <div className="hero-features">
            <div className="feature-badge">
              <Check size={16} /> Transaction Tracking
            </div>
            <div className="feature-badge">
              <Check size={16} /> Budget Management
            </div>
            <div className="feature-badge">
              <Check size={16} /> Stock Market Data
            </div>
            <div className="feature-badge">
              <Check size={16} /> Export Reports
            </div>
          </div>
          <Button
            data-testid="get-started-btn"
            onClick={handleLogin}
            className="btn-primary"
            style={{ padding: "1rem 2rem", fontSize: "1rem" }}
          >
            Get Started Free
            <ArrowUpRight size={18} />
          </Button>
        </div>
        <div
          style={{
            width: "500px",
            height: "400px",
            background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ textAlign: "center", color: "#4F46E5" }}>
            <TrendingUp size={80} strokeWidth={1.5} />
            <p
              style={{
                marginTop: "1rem",
                fontWeight: 600,
                fontSize: "1.125rem",
              }}
            >
              Financial Dashboard Preview
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "transactions", icon: ArrowUpDown, label: "Transactions" },
    { id: "budgets", icon: PiggyBank, label: "Budgets" },
    { id: "stocks", icon: TrendingUp, label: "Market" },
    { id: "alerts", icon: Bell, label: "Alerts" },
    { id: "reports", icon: FileText, label: "Reports" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Wallet size={20} />
        </div>
        <span className="sidebar-logo-text">MoneyHub</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            data-testid={`nav-${item.id}`}
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <item.icon size={20} />
            {item.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="user-profile" data-testid="user-profile-dropdown">
              <img
                src={user?.picture || "https://images.unsplash.com/photo-1634162635368-004f5fb27427?w=100"}
                alt="Avatar"
                className="user-avatar"
              />
              <div className="user-info">
                <div className="user-name">{user?.name || "User"}</div>
                <div className="user-email">{user?.email || ""}</div>
              </div>
              <ChevronDown size={16} style={{ color: "#6B7280" }} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dropdown-content">
            <DropdownMenuItem
              data-testid="logout-btn"
              onClick={handleLogout}
              style={{ color: "#F43F5E" }}
            >
              <LogOut size={16} />
              <span style={{ marginLeft: "0.5rem" }}>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

// Dashboard Overview
const DashboardOverview = ({ stats, transactions, stocks, onRefresh }) => {
  const CHART_COLORS = ["#4F46E5", "#0EA5E9", "#EC4899", "#F97316", "#10B981"];

  const expenseData = Object.entries(stats?.expense_by_category || {}).map(
    ([name, value], index) => ({
      name,
      value,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    })
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your financial overview.</p>
        </div>
        <Button
          data-testid="refresh-dashboard-btn"
          variant="outline"
          onClick={onRefresh}
          className="btn-secondary"
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" data-testid="balance-card">
          <div className="stat-header">
            <div className="stat-icon blue">
              <Wallet size={20} />
            </div>
            <span className="stat-label">Balance</span>
          </div>
          <div className="stat-value">{formatCurrency(stats?.balance || 0)}</div>
        </div>

        <div className="stat-card" data-testid="income-card">
          <div className="stat-header">
            <div className="stat-icon green">
              <ArrowDownRight size={20} />
            </div>
            <span className="stat-label">Income</span>
          </div>
          <div className="stat-value">{formatCurrency(stats?.monthly_income || 0)}</div>
          <div className="stat-change positive">
            <TrendingUp size={14} />
            This month
          </div>
        </div>

        <div className="stat-card" data-testid="expense-card">
          <div className="stat-header">
            <div className="stat-icon red">
              <ArrowUpRight size={20} />
            </div>
            <span className="stat-label">Expenses</span>
          </div>
          <div className="stat-value">{formatCurrency(stats?.monthly_expense || 0)}</div>
          <div className="stat-change negative">
            <TrendingDown size={14} />
            This month
          </div>
        </div>

        <div className="stat-card" data-testid="alerts-card">
          <div className="stat-header">
            <div className="stat-icon orange">
              <Bell size={20} />
            </div>
            <span className="stat-label">Alerts</span>
          </div>
          <div className="stat-value">{stats?.unread_alerts || 0}</div>
          <div className="stat-change">Unread</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="content-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Spending Trend (Last 7 Days)</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.spending_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), "Spent"]}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="amount" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Expenses by Category</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Stocks */}
      <div className="content-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Transactions</h3>
          </div>
          <div className="transaction-list">
            {transactions.slice(0, 5).map((txn) => (
              <div key={txn.transaction_id} className="transaction-item" data-testid={`txn-${txn.transaction_id}`}>
                <div className={`transaction-icon ${txn.type}`}>
                  {txn.type === "income" ? (
                    <ArrowDownRight size={18} />
                  ) : txn.type === "expense" ? (
                    <ArrowUpRight size={18} />
                  ) : (
                    <ArrowUpDown size={18} />
                  )}
                </div>
                <div className="transaction-details">
                  <div className="transaction-name">{txn.description}</div>
                  <div className="transaction-category">{txn.category}</div>
                </div>
                <div>
                  <div className={`transaction-amount ${txn.type}`}>
                    {txn.type === "income" ? "+" : "-"}
                    {formatCurrency(txn.amount)}
                  </div>
                  <div className="transaction-date">
                    {format(new Date(txn.date), "MMM d")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Market Watch</h3>
          </div>
          <div className="stock-list">
            {stocks.slice(0, 6).map((stock) => (
              <div key={stock.symbol} className="stock-item" data-testid={`stock-${stock.symbol}`}>
                <div className="stock-info">
                  <div className="stock-symbol">{stock.symbol}</div>
                  <div className="stock-name">{stock.name}</div>
                </div>
                <div className="stock-price">
                  <div className="stock-current">₹{stock.price.toLocaleString()}</div>
                  <div className={`stock-change ${stock.change >= 0 ? "positive" : "negative"}`}>
                    {stock.change >= 0 ? "+" : ""}
                    {stock.change_percent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Transactions Page
const TransactionsPage = ({ transactions, onAddTransaction, onDeleteTransaction, onRefresh }) => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: "expense",
    category: "",
    amount: "",
    description: "",
    recipient: "",
    date: new Date(),
  });

  const categories = {
    income: ["Salary", "Freelance", "Investment", "Other Income"],
    expense: ["Food & Dining", "Shopping", "Transport", "Bills", "Entertainment", "Healthcare", "Other"],
    transfer: ["Transfer"],
  };

  const filteredTransactions = transactions.filter((txn) => {
    if (typeFilter !== "all" && txn.type !== typeFilter) return false;
    if (searchQuery && !txn.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSubmit = async () => {
    if (!newTransaction.category || !newTransaction.amount || !newTransaction.description) {
      toast.error("Please fill all required fields");
      return;
    }

    await onAddTransaction({
      ...newTransaction,
      amount: parseFloat(newTransaction.amount),
      date: newTransaction.date.toISOString(),
    });

    setShowAddDialog(false);
    setNewTransaction({
      type: "expense",
      category: "",
      amount: "",
      description: "",
      recipient: "",
      date: new Date(),
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Track all your income, expenses, and transfers</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="outline" onClick={onRefresh} className="btn-secondary" data-testid="refresh-transactions-btn">
            <RefreshCw size={16} />
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-transaction-btn">
                <Plus size={16} />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
              </DialogHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
                <div className="form-group">
                  <Label className="form-label">Type</Label>
                  <Select
                    value={newTransaction.type}
                    onValueChange={(value) => setNewTransaction({ ...newTransaction, type: value, category: "" })}
                  >
                    <SelectTrigger data-testid="transaction-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Category</Label>
                  <Select
                    value={newTransaction.category}
                    onValueChange={(value) => setNewTransaction({ ...newTransaction, category: value })}
                  >
                    <SelectTrigger data-testid="transaction-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[newTransaction.type].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    data-testid="transaction-amount-input"
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Description</Label>
                  <Input
                    placeholder="Enter description"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    data-testid="transaction-description-input"
                  />
                </div>

                {newTransaction.type === "transfer" && (
                  <div className="form-group">
                    <Label className="form-label">Recipient</Label>
                    <Input
                      placeholder="Enter recipient"
                      value={newTransaction.recipient}
                      onChange={(e) => setNewTransaction({ ...newTransaction, recipient: e.target.value })}
                      data-testid="transaction-recipient-input"
                    />
                  </div>
                )}

                <div className="form-group">
                  <Label className="form-label">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="transaction-date-btn">
                        {format(newTransaction.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newTransaction.date}
                        onSelect={(date) => date && setNewTransaction({ ...newTransaction, date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit} className="btn-primary" data-testid="submit-transaction-btn">
                  Add Transaction
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="transaction-search-input"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger style={{ width: "150px" }} data-testid="transaction-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((txn) => (
              <tr key={txn.transaction_id} data-testid={`transaction-row-${txn.transaction_id}`}>
                <td>{format(new Date(txn.date), "MMM d, yyyy")}</td>
                <td style={{ fontWeight: 500 }}>{txn.description}</td>
                <td>{txn.category}</td>
                <td>
                  <Badge
                    variant={txn.type === "income" ? "default" : txn.type === "expense" ? "destructive" : "secondary"}
                    style={{
                      background: txn.type === "income" ? "#ECFDF5" : txn.type === "expense" ? "#FEF2F2" : "#EEF2FF",
                      color: txn.type === "income" ? "#10B981" : txn.type === "expense" ? "#F43F5E" : "#4F46E5",
                    }}
                  >
                    {txn.type}
                  </Badge>
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: txn.type === "income" ? "#10B981" : "#111827",
                  }}
                >
                  {txn.type === "income" ? "+" : "-"}
                  {formatCurrency(txn.amount)}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteTransaction(txn.transaction_id)}
                    data-testid={`delete-txn-${txn.transaction_id}`}
                  >
                    <Trash2 size={14} style={{ color: "#F43F5E" }} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTransactions.length === 0 && (
          <div className="empty-state">
            <ArrowUpDown size={48} className="empty-state-icon" />
            <p className="empty-state-title">No transactions found</p>
            <p className="empty-state-text">Add your first transaction to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Budgets Page
const BudgetsPage = ({ budgets, onAddBudget, onDeleteBudget, onRefresh }) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newBudget, setNewBudget] = useState({
    category: "",
    limit: "",
    period: "monthly",
  });

  const categories = ["Food & Dining", "Shopping", "Transport", "Bills", "Entertainment", "Healthcare", "Other"];

  const handleSubmit = async () => {
    if (!newBudget.category || !newBudget.limit) {
      toast.error("Please fill all required fields");
      return;
    }

    await onAddBudget({
      ...newBudget,
      limit: parseFloat(newBudget.limit),
    });

    setShowAddDialog(false);
    setNewBudget({ category: "", limit: "", period: "monthly" });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercent = (spent, limit) => Math.min((spent / limit) * 100, 100);
  const getProgressColor = (spent, limit) => {
    const percent = (spent / limit) * 100;
    if (percent >= 100) return "danger";
    if (percent >= 75) return "warning";
    return "safe";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">Set spending limits and track your progress</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="outline" onClick={onRefresh} className="btn-secondary" data-testid="refresh-budgets-btn">
            <RefreshCw size={16} />
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="add-budget-btn">
                <Plus size={16} />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Budget</DialogTitle>
              </DialogHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
                <div className="form-group">
                  <Label className="form-label">Category</Label>
                  <Select
                    value={newBudget.category}
                    onValueChange={(value) => setNewBudget({ ...newBudget, category: value })}
                  >
                    <SelectTrigger data-testid="budget-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group">
                  <Label className="form-label">Budget Limit (₹)</Label>
                  <Input
                    type="number"
                    placeholder="Enter limit"
                    value={newBudget.limit}
                    onChange={(e) => setNewBudget({ ...newBudget, limit: e.target.value })}
                    data-testid="budget-limit-input"
                  />
                </div>

                <div className="form-group">
                  <Label className="form-label">Period</Label>
                  <Select
                    value={newBudget.period}
                    onValueChange={(value) => setNewBudget({ ...newBudget, period: value })}
                  >
                    <SelectTrigger data-testid="budget-period-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit} className="btn-primary" data-testid="submit-budget-btn">
                  Create Budget
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Budget Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {budgets.map((budget) => (
          <div key={budget.budget_id} className="card" data-testid={`budget-${budget.budget_id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: "1rem", color: "#111827" }}>{budget.category}</h3>
                <p style={{ fontSize: "0.75rem", color: "#6B7280", textTransform: "capitalize" }}>{budget.period}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteBudget(budget.budget_id)}
                data-testid={`delete-budget-${budget.budget_id}`}
              >
                <Trash2 size={14} style={{ color: "#F43F5E" }} />
              </Button>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {formatCurrency(budget.spent)}
                </span>
                <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                  of {formatCurrency(budget.limit)}
                </span>
              </div>
              <div className="budget-progress">
                <div
                  className={`budget-progress-bar ${getProgressColor(budget.spent, budget.limit)}`}
                  style={{ width: `${getProgressPercent(budget.spent, budget.limit)}%` }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                {formatCurrency(Math.max(budget.limit - budget.spent, 0))} remaining
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: getProgressColor(budget.spent, budget.limit) === "safe" ? "#10B981" : 
                         getProgressColor(budget.spent, budget.limit) === "warning" ? "#F59E0B" : "#F43F5E",
                }}
              >
                {Math.round((budget.spent / budget.limit) * 100)}%
              </span>
            </div>
          </div>
        ))}

        {budgets.length === 0 && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="empty-state">
              <PiggyBank size={48} className="empty-state-icon" />
              <p className="empty-state-title">No budgets set</p>
              <p className="empty-state-text">Create your first budget to start tracking spending</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stocks Page
const StocksPage = ({ stocks, onRefresh, loading }) => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Market Watch</h1>
          <p className="page-subtitle">Live stock prices from NSE/BSE</p>
        </div>
        <Button variant="outline" onClick={onRefresh} className="btn-secondary" data-testid="refresh-stocks-btn">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Change</th>
              <th style={{ textAlign: "right" }}>% Change</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.symbol} data-testid={`stock-row-${stock.symbol}`}>
                <td style={{ fontWeight: 700 }}>{stock.symbol}</td>
                <td>{stock.name}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>₹{stock.price.toLocaleString()}</td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: stock.change >= 0 ? "#10B981" : "#F43F5E",
                  }}
                >
                  {stock.change >= 0 ? "+" : ""}
                  {stock.change.toFixed(2)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: stock.change_percent >= 0 ? "#10B981" : "#F43F5E",
                  }}
                >
                  {stock.change_percent >= 0 ? "+" : ""}
                  {stock.change_percent.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Alerts Page
const AlertsPage = ({ alerts, onMarkRead, onMarkAllRead, onRefresh }) => {
  const unreadCount = alerts.filter((a) => !a.read).length;

  const getAlertIcon = (type) => {
    switch (type) {
      case "budget_exceeded":
        return <PiggyBank size={18} />;
      case "large_transaction":
        return <CreditCard size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case "budget_exceeded":
        return "#F43F5E";
      case "large_transaction":
        return "#F59E0B";
      default:
        return "#4F46E5";
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">{unreadCount} unread notifications</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="outline" onClick={onRefresh} className="btn-secondary" data-testid="refresh-alerts-btn">
            <RefreshCw size={16} />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={onMarkAllRead} className="btn-secondary" data-testid="mark-all-read-btn">
              <Check size={16} />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="card">
        {alerts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                data-testid={`alert-${alert.alert_id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: "8px",
                  background: alert.read ? "transparent" : "#F9FAFB",
                  border: alert.read ? "none" : "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    background: `${getAlertColor(alert.type)}15`,
                    color: getAlertColor(alert.type),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {getAlertIcon(alert.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: alert.read ? 400 : 600, fontSize: "0.875rem", color: "#111827" }}>
                    {alert.message}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.25rem" }}>
                    {format(new Date(alert.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {!alert.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkRead(alert.alert_id)}
                    data-testid={`mark-read-${alert.alert_id}`}
                  >
                    <Check size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Bell size={48} className="empty-state-icon" />
            <p className="empty-state-title">No alerts yet</p>
            <p className="empty-state-text">You'll see alerts for budget limits and large transactions here</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Reports Page
const ReportsPage = () => {
  const handleExportTransactions = () => {
    window.open(`${API}/export/transactions?format=csv`, "_blank");
  };

  const handleExportReport = () => {
    window.open(`${API}/export/report`, "_blank");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Export your financial data</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                background: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUpDown size={24} />
            </div>
            <div>
              <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>Transaction History</h3>
              <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>Export all transactions as CSV</p>
            </div>
          </div>
          <Button onClick={handleExportTransactions} className="btn-primary w-full" data-testid="export-transactions-btn">
            <Download size={16} />
            Export CSV
          </Button>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "8px",
                background: "#ECFDF5",
                color: "#10B981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={24} />
            </div>
            <div>
              <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>Monthly Report</h3>
              <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>Summary with budgets & categories</p>
            </div>
          </div>
          <Button onClick={handleExportReport} className="btn-primary w-full" data-testid="export-report-btn">
            <Download size={16} />
            Export Report
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, txnRes, budgetRes, alertRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { withCredentials: true }),
        axios.get(`${API}/transactions`, { withCredentials: true }),
        axios.get(`${API}/budgets`, { withCredentials: true }),
        axios.get(`${API}/alerts`, { withCredentials: true }),
      ]);

      setStats(statsRes.data);
      setTransactions(txnRes.data);
      setBudgets(budgetRes.data);
      setAlerts(alertRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        window.location.href = "/";
      }
    }
  }, []);

  const fetchStocks = useCallback(async () => {
    setStocksLoading(true);
    try {
      const res = await axios.get(`${API}/stocks`);
      setStocks(res.data);
    } catch (error) {
      console.error("Error fetching stocks:", error);
    } finally {
      setStocksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchStocks();
  }, [fetchData, fetchStocks]);

  const handleAddTransaction = async (data) => {
    try {
      await axios.post(`${API}/transactions`, data, { withCredentials: true });
      toast.success("Transaction added successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to add transaction");
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await axios.delete(`${API}/transactions/${id}`, { withCredentials: true });
      toast.success("Transaction deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
  };

  const handleAddBudget = async (data) => {
    try {
      await axios.post(`${API}/budgets`, data, { withCredentials: true });
      toast.success("Budget created successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create budget");
    }
  };

  const handleDeleteBudget = async (id) => {
    try {
      await axios.delete(`${API}/budgets/${id}`, { withCredentials: true });
      toast.success("Budget deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete budget");
    }
  };

  const handleMarkAlertRead = async (id) => {
    try {
      await axios.put(`${API}/alerts/${id}/read`, {}, { withCredentials: true });
      fetchData();
    } catch (error) {
      console.error("Error marking alert read:", error);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      await axios.put(`${API}/alerts/read-all`, {}, { withCredentials: true });
      toast.success("All alerts marked as read");
      fetchData();
    } catch (error) {
      toast.error("Failed to mark alerts as read");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardOverview
            stats={stats}
            transactions={transactions}
            stocks={stocks}
            onRefresh={fetchData}
          />
        );
      case "transactions":
        return (
          <TransactionsPage
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onRefresh={fetchData}
          />
        );
      case "budgets":
        return (
          <BudgetsPage
            budgets={budgets}
            onAddBudget={handleAddBudget}
            onDeleteBudget={handleDeleteBudget}
            onRefresh={fetchData}
          />
        );
      case "stocks":
        return (
          <StocksPage
            stocks={stocks}
            onRefresh={fetchStocks}
            loading={stocksLoading}
          />
        );
      case "alerts":
        return (
          <AlertsPage
            alerts={alerts}
            onMarkRead={handleMarkAlertRead}
            onMarkAllRead={handleMarkAllAlertsRead}
            onRefresh={fetchData}
          />
        );
      case "reports":
        return <ReportsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">{renderContent()}</main>
    </div>
  );
};

// App Router
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id (OAuth callback)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="app-container">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
