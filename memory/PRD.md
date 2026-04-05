# MoneyHub - Fintech Dashboard PRD

## Original Problem Statement
Create a fintech dashboard application with:
- Banking/payments dashboard (transactions, transfers)
- Stock prices from NSE/BSE via web scraping
- Google social login (Emergent-managed)
- Charts & data visualizations
- Transaction history
- Budget tracking
- Alerts/notifications
- Export reports
- White color theme with pop colours

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn UI components, Recharts
- **Backend**: FastAPI with MongoDB
- **Auth**: Google OAuth via Emergent Auth service
- **Stock Data**: Web scraping from Google Finance (NSE stocks) with fallback mock data

## User Personas
1. **Personal Finance User**: Tracks daily expenses, manages budgets, monitors account balance
2. **Investment Enthusiast**: Monitors NSE/BSE stock prices alongside personal finances
3. **Budget-Conscious User**: Sets spending limits by category and tracks progress

## Core Requirements (Static)
- [x] User authentication via Google OAuth
- [x] Dashboard with financial overview (balance, income, expenses)
- [x] Transaction management (CRUD operations)
- [x] Budget tracking with categories
- [x] Stock market data display
- [x] Alerts for budget limits and large transactions
- [x] Export functionality (CSV reports)
- [x] Responsive design with Swiss & High-Contrast theme

## What's Been Implemented (Jan 5, 2026)

### Backend APIs
- `/api/auth/session` - OAuth session exchange
- `/api/auth/me` - Get current user
- `/api/auth/logout` - Logout user
- `/api/transactions` - CRUD transactions
- `/api/budgets` - CRUD budgets
- `/api/alerts` - Get/mark alerts
- `/api/dashboard/stats` - Dashboard statistics
- `/api/stocks` - NSE/BSE stock data via scraping
- `/api/export/transactions` - Export transactions CSV
- `/api/export/report` - Export monthly report CSV

### Frontend Pages
- Landing page with Google Sign-in
- Dashboard overview with charts
- Transactions page with filters
- Budgets page with progress tracking
- Market Watch page (NSE/BSE stocks)
- Alerts page
- Reports export page

### Features
- Auto-alerts for budget exceeded and large transactions
- 7-day spending trend chart
- Expense breakdown pie chart
- Transaction filtering by type/category/search
- Budget progress visualization
- Sample data generation for new users

## Prioritized Backlog

### P0 (Critical)
- ✅ Core authentication
- ✅ Transaction management
- ✅ Dashboard stats

### P1 (Important)
- [ ] Mobile responsive sidebar (hamburger menu)
- [ ] Date range filtering for transactions
- [ ] Budget reset functionality (monthly/weekly)

### P2 (Nice to have)
- [ ] PDF export option
- [ ] Transaction categories customization
- [ ] Real-time stock price updates (WebSocket)
- [ ] Multi-currency support
- [ ] Dark mode toggle

## Technical Notes
- Stock data uses web scraping with fallback mock data when scraping fails
- Session tokens expire after 7 days
- All MongoDB queries exclude `_id` field
- Uses timezone-aware datetimes (UTC)

## Next Tasks
1. Add mobile responsive navigation
2. Implement date range filter for transactions
3. Add budget reset on new period
4. Consider WebSocket for live stock updates
