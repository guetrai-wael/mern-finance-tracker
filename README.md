# 💰 Personal Finance Management Application

A comprehensive full-stack web application for managing personal finances, tracking expenses, setting budgets, achieving financial goals, and monitoring financial health.

## 🌟 Features Overview

### 📊 **Core Financial Management**

- **Transaction Management**: Track income and expenses with categories
- **Budget Planning**: Set and monitor spending limits by category
- **Category Organization**: Organize transactions into meaningful groups
- **Financial Goals**: Track savings objectives with progress monitoring
- **Advanced Analytics**: Comprehensive financial health scoring and insights

### 👥 **User Management**

- **Authentication**: Secure login/registration system
- **Role-based Access**: User and Admin roles
- **Admin Panel**: User management and system administration

### 📈 **Analytics & Insights**

- **Financial Health Score**: 0-100 rating based on 4 key factors
- **Budget Analysis**: Track spending vs budget performance
- **Spending Trends**: Historical analysis and patterns
- **Smart Recommendations**: Rule-based financial advice

## 🏗️ Technical Architecture

### **Backend Stack**

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi schema validation
- **Security**: bcrypt password hashing, CORS protection

### **Frontend Stack**

- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS with custom components
- **Forms**: React Hook Form with Zod validation
- **Icons**: React Icons
- **Build Tool**: Vite

### **Database Schema**

```
Users → Transactions → Categories
Users → Budgets → Categories
Users → Goals
Users → Admin Management
```

## 📁 Project Structure

```
finance-app/
├── backend/
│   ├── src/
│   │   ├── controllers/        # Business logic
│   │   │   ├── auth.controller.js
│   │   │   ├── transaction.controller.js
│   │   │   ├── category.controller.js
│   │   │   ├── budget.controller.js
│   │   │   ├── goals.controller.js
│   │   │   ├── analytics.controller.js
│   │   │   └── admin.controller.js
│   │   ├── models/             # Database schemas
│   │   │   ├── user.model.js
│   │   │   ├── transaction.model.js
│   │   │   ├── category.model.js
│   │   │   ├── budget.model.js
│   │   │   ├── goal.model.js
│   │   │   └── recurringTransaction.model.js
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Custom middleware
│   │   ├── validation/         # Joi schemas
│   │   └── index.js           # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/         # Generic components
│   │   │   └── layout/         # Layout components
│   │   ├── pages/              # Route components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── CategoriesPage.tsx
│   │   │   ├── BudgetsPage.tsx
│   │   │   ├── GoalsPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   ├── services/           # API services
│   │   ├── types/              # TypeScript definitions
│   │   └── App.tsx            # Main app component
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn package manager

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd finance-app
```

2. **Install Backend Dependencies**

```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**

```bash
cd ../frontend
npm install
```

4. **Environment Configuration**

Create `.env` file in the backend directory:

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/finance-app
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
```

5. **Start MongoDB**

```bash
# If using local MongoDB
mongod

# Or ensure MongoDB Atlas connection is configured
```

6. **Run the Application**

**Backend Server:**

```bash
cd backend
npm run dev
```

**Frontend Development Server:**

```bash
cd frontend
npm run dev
```

7. **Access the Application**

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## 📋 Feature Documentation

### 🏠 **Dashboard Page** (`/dashboard`)

**Overview Cards:**

- **Total Balance**: Current account balance (Income - Expenses)
- **Monthly Income**: Total income for current month
- **Monthly Expenses**: Total expenses for current month
- **Budget Status**: Percentage of monthly budget utilized

**Visual Elements:**

- Monthly spending trends chart
- Category breakdown pie chart
- Budget vs actual comparison
- Recent transactions list

### 💳 **Transactions Page** (`/transactions`)

**Functionality:**

- Add new income/expense transactions
- Edit existing transactions
- Delete transactions
- Filter by date range, category, or type
- Export transactions data

**Transaction Fields:**

- Description (what the transaction was for)
- Amount (positive for income, negative for expenses)
- Category (organizational grouping)
- Date (when transaction occurred)
- Type (income or expense)

### 🏷️ **Categories Page** (`/categories`)

**Purpose:** Organize transactions into meaningful groups

**Features:**

- Create custom categories
- Edit category details (name, description, color)
- Delete unused categories
- View transaction count and spending per category

**Default Categories:**

- Food & Dining, Transportation, Shopping
- Entertainment, Utilities, Healthcare
- Education, Travel, and more

### 🎯 **Budgets Page** (`/budgets`)

**Budget Management:**

- Set spending limits by category
- Track actual vs budgeted amounts
- Visual progress indicators
- Budget utilization analysis

**Budget Status Indicators:**

- 🟢 Green: Under 80% of budget used
- 🟡 Yellow: 80-95% of budget used
- 🔴 Red: Over 95% of budget used (over budget)

### 🎯 **Goals Page** (`/goals`) - Advanced Feature

**Goal Tracking:**

- Create financial savings goals
- Track progress toward targets
- Add contributions to goals
- Set target dates and priorities

**Goal Categories:**

- 🚨 Emergency Fund
- ✈️ Vacation
- 🏠 House/Property
- 🚗 Car/Vehicle
- 👴 Retirement
- 🎓 Education
- 🎯 Other

**Goal Features:**

- Progress visualization
- Contribution tracking (creates expense transactions)
- Priority levels (High/Medium/Low)
- Target date monitoring
- Completion status

### 📊 **Analytics Page** (`/analytics`) - Advanced Feature

**Financial Health Score (0-100):**
Calculated from 4 weighted factors:

1. **Savings Rate** (40% weight)

   - Target: 20% of income saved
   - Formula: (Income - Expenses) / Income × 100

2. **Budget Adherence** (30% weight)

   - Target: Stay within 90% of budgets
   - Measures spending discipline

3. **Goals Progress** (20% weight)

   - Target: 100% goal completion
   - Tracks financial objective achievement

4. **Transaction Consistency** (10% weight)
   - Target: Regular expense tracking
   - Measures financial awareness

**Health Score Ranges:**

- 🟢 80-100: Excellent
- 🟡 60-79: Good
- 🟠 40-59: Fair
- 🔴 0-39: Needs Improvement

**Analytics Features:**

- Time range filtering (Month/Quarter/Year)
- Budget analysis with over/under budget alerts
- Expense category breakdowns
- Monthly trends with savings rate
- Rule-based recommendations

**Smart Recommendations:**
Rule-based advice system providing:

- Savings rate improvement suggestions
- Budget management tips
- Goal-setting guidance
- Expense tracking encouragement

### 👥 **Admin Page** (`/admin`) - Admin Only

**User Management:**

- View all registered users
- Edit user details (name, email, role)
- Activate/deactivate user accounts
- Delete user accounts
- Create new user accounts

**Admin Features:**

- Role management (User/Admin)
- Account status control
- User activity monitoring

## 🔐 Authentication & Security

### **Authentication Flow:**

1. User registration with email/password
2. JWT token generation on login
3. Protected routes require valid JWT
4. Role-based access control (User/Admin)

### **Security Features:**

- Password hashing with bcrypt
- JWT token validation
- Protected API endpoints
- CORS configuration
- Input validation with Joi
- XSS protection

## 📊 Data Models

### **User Model**

```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: 'user' | 'admin',
  isActive: Boolean,
  createdAt: Date
}
```

### **Transaction Model**

```javascript
{
  user: ObjectId,
  description: String,
  amount: Number,
  type: 'income' | 'expense',
  category: ObjectId,
  date: Date,
  createdAt: Date
}
```

### **Category Model**

```javascript
{
  user: ObjectId,
  name: String,
  description: String,
  color: String,
  createdAt: Date
}
```

### **Budget Model**

```javascript
{
  user: ObjectId,
  category: ObjectId,
  amount: Number,
  period: 'monthly' | 'yearly',
  createdAt: Date
}
```

### **Goal Model**

```javascript
{
  user: ObjectId,
  name: String,
  description: String,
  targetAmount: Number,
  currentAmount: Number,
  targetDate: Date,
  category: 'emergency' | 'vacation' | 'house' | 'car' | 'retirement' | 'education' | 'other',
  priority: 'low' | 'medium' | 'high',
  isCompleted: Boolean,
  createdAt: Date
}
```

## 🔧 API Endpoints

### **Authentication**

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### **Transactions**

- `GET /api/transactions` - Get user transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### **Categories**

- `GET /api/categories` - Get user categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### **Budgets**

- `GET /api/budgets` - Get user budgets
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### **Goals**

- `GET /api/goals` - Get user goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `POST /api/goals/:id/contribute` - Add contribution to goal

### **Analytics**

- `GET /api/analytics/summary` - Financial summary
- `GET /api/analytics/budget-analysis` - Budget analysis
- `GET /api/analytics/health` - Financial health score

### **Admin**

- `GET /api/admin/users` - Get all users (admin only)
- `PUT /api/admin/users/:id` - Update user (admin only)
- `DELETE /api/admin/users/:id` - Delete user (admin only)

## 🎨 UI/UX Features

### **Responsive Design**

- Mobile-first approach
- Adaptive layouts for all screen sizes
- Touch-friendly interface
- Collapsible navigation on mobile

### **Visual Feedback**

- Toast notifications for user actions
- Loading states and spinners
- Color-coded status indicators
- Progress bars and charts

### **Accessibility**

- Keyboard navigation support
- Screen reader compatible
- High contrast color scheme
- Clear visual hierarchy

## 🧪 Testing & Development

### **Development Commands**

**Backend:**

```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
```

**Frontend:**

```bash
npm run dev      # Start Vite development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### **Code Quality**

- ESLint configuration for code consistency
- TypeScript for type safety
- Prettier for code formatting
- Error boundaries for error handling

## 🚀 Deployment

### **Production Considerations**

- Environment variables configuration
- MongoDB Atlas for production database
- SSL/HTTPS implementation
- API rate limiting
- Error logging and monitoring

### **Build Process**

1. Backend: Node.js server deployment
2. Frontend: Static file generation with Vite
3. Database: MongoDB connection configuration
4. Environment: Production environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please create an issue in the repository or contact the development team.

---

**Built with ❤️ for better financial management**
