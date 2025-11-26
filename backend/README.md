# Personal Finance App - Backend

## Architecture Overview

This is a Node.js/Express backend with MongoDB for a personal finance application. It provides:

- **Authentication**: JWT-based auth with access/refresh tokens
- **User Management**: Admin can manage users, export data
- **Transactions**: Income/expense tracking with categories
- **Budgets**: Monthly and category-specific budget management
- **Categories**: User-defined custom categories
- **Export**: CSV/JSON export for admin users

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT tokens, bcrypt password hashing
- **Validation**: Joi schema validation
- **Export**: CSV-writer for data export

## File Structure

```
backend/
├── src/
│   ├── config/           # Environment configuration
│   ├── controllers/      # Route handlers
│   ├── middlewares/      # Auth, validation, error handling
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routes
│   ├── seed/            # Database seeding
│   ├── utils/           # JWT, password, DB helpers
│   ├── validation/      # Joi schemas
│   ├── app.js           # Express app setup
│   └── index.js         # Server entry point
├── package.json
├── .env.example
└── README.md
```

## MongoDB Schema Design

### User

- `name`, `email`, `password` (hashed)
- `role`: "user" | "admin"
- `isActive`: boolean
- `refreshToken`: for JWT refresh flow

### Transaction

- `user`: ref to User
- `amount`: number
- `category`: ref to Category (optional)
- `type`: "income" | "expense"
- `date`: Date
- `description`: string

### Budget

- `user`: ref to User
- `month`: string (YYYY-MM)
- `totalBudget`: number
- `categoryBudgets`: array of { category, amount }

### Category

- `user`: ref to User
- `name`: string (unique per user)
- `description`: optional string

## API Routes

### Auth (`/api/auth`)

- `POST /signup` - Create new user
- `POST /login` - Login with email/password
- `POST /refresh` - Refresh access token
- `POST /logout` - Logout (clear refresh token)
- `GET /me` - Get current user profile

### Users (`/api/users`) - Admin only

- `GET /` - List all users
- `GET /:id` - Get user by ID
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user

### Transactions (`/api/transactions`)

- `GET /` - List user transactions (with filters)
- `POST /` - Create transaction
- `GET /:id` - Get transaction
- `PUT /:id` - Update transaction
- `DELETE /:id` - Delete transaction

### Categories (`/api/categories`)

- `GET /` - List user categories
- `POST /` - Create category
- `PUT /:id` - Update category
- `DELETE /:id` - Delete category

### Budgets (`/api/budgets`)

- `GET /?month=YYYY-MM` - Get budget for month
- `POST /` - Create/update budget

### Export (`/api/export`) - Admin only

- `GET /users?format=csv|json` - Export users

## Setup Instructions

### Prerequisites

- Node.js 16+
- MongoDB running locally or MongoDB Atlas connection string

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Create environment file**:

   ```bash
   cp .env.example .env
   ```

3. **Configure `.env`**:

   ```
   PORT=4000
   MONGO_URI=mongodb://localhost:27017/finance_app
   JWT_ACCESS_SECRET=your_access_token_secret
   JWT_REFRESH_SECRET=your_refresh_token_secret
   ACCESS_TOKEN_EXPIRES_IN=15m
   REFRESH_TOKEN_EXPIRES_IN=7d
   ```

4. **Seed database** (optional):

   ```bash
   npm run seed
   ```

   This creates:

   - Admin user: `admin@finance.com` / `admin123`
   - Test user: `user@finance.com` / `user123`
   - Sample categories, transactions, and budgets

5. **Start development server**:
   ```bash
   npm run dev
   ```
   Server runs on http://localhost:4000

### Production

```bash
npm start
```

## Middleware

- **auth**: Verifies JWT access token, attaches user to req
- **admin**: Ensures user has admin role
- **validate**: Joi schema validation for request bodies
- **errorHandler**: Global error handling

## Features

### Authentication Flow

1. User signs up with email/password
2. Login returns access + refresh tokens
3. Access token (15min) for protected routes
4. Refresh token (7d) to get new access tokens
5. Logout clears refresh token

### Budget Warnings

When transactions are created/updated, the system checks:

- Total monthly spending vs total budget
- Category spending vs category budget
- Logs warnings when 90% or 100% thresholds are reached

### Admin Features

- View/edit/delete any user
- Activate/deactivate user accounts
- Export all users as CSV or JSON

### Export Service

Admins can export user data in two formats:

- **CSV**: Structured table format
- **JSON**: Raw JSON data

## Error Handling

- Validation errors: 400 with details
- Auth errors: 401 Unauthorized
- Admin-only routes: 403 Forbidden
- Not found: 404
- Server errors: 500 with message

## Security Configuration

### JWT Secrets Generation

**⚠️ CRITICAL SECURITY REQUIREMENT:**

Before deploying to production, you MUST generate cryptographically secure JWT secrets:

```bash
# Generate secure JWT secrets (Node.js method)
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Or using OpenSSL:

```bash
openssl rand -hex 32  # For JWT_ACCESS_SECRET
openssl rand -hex 32  # For JWT_REFRESH_SECRET
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Replace the JWT secret placeholders with generated values
3. Update `FRONTEND_URL` to match your deployment domain
4. Set `NODE_ENV=production` for production deployments

**Never commit real secrets to version control!**

## Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with secure secrets
- Route protection with middleware
- Role-based access control
- Input validation on all routes
