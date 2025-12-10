/* Express app setup and route mounting with security middleware */
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const config = require('./config/index');
const connectDB = require('./utils/db');
const logger = require('./utils/logger');
const enhancedLogger = require('./utils/enhancedLogger');
const {
    requestTracking,
    requestLogging,
    errorLogging,
    performanceMonitoring,
    securityLogging
} = require('./middleware/logging');
const {
    detectApiVersion,
    checkDeprecation,
    getApiInfo,
    getVersionedHealth
} = require('./utils/apiVersioning');
const { performanceMiddleware } = require('./utils/performanceMonitor');
const metricsRoutes = require('./routes/metrics');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const categoryRoutes = require('./routes/categories');
const exportRoutes = require('./routes/export');
const goalsRoutes = require('./routes/goals');
const { errorHandler } = require('./middlewares/error');

const app = express();

// connect to DB
// connect to DB
// connectDB(config.mongoUri); // REMOVED: Managed in index.js to prevent double connection

// Enhanced logging middleware (before other middleware)
app.use(requestTracking);
app.use(performanceMonitoring);
app.use(performanceMiddleware); // Add performance metrics collection
app.use(requestLogging);
app.use(securityLogging);

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting - DISABLED for development
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth rate limiting - DISABLED for development
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes (longer window)
    max: 500, // limit each IP to 500 auth requests per 5 minutes
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter); // Enabled for Rate Limiting

// CORS configuration - Allow all origins
// CORS configuration - Allow specific frontend origin
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Allow Netlify/Localhost
    credentials: true,
    methods: "GET,POST,PUT,DELETE,PATCH",
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser middleware
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Logging middleware
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// API versioning middleware
app.use('/api', detectApiVersion);
app.use('/api', checkDeprecation);

// API info and health endpoints
app.get('/', getVersionedHealth);
app.get('/api', getApiInfo);
app.get('/api/info', getApiInfo);
app.get('/api/health', getVersionedHealth);
app.get('/api/:version/info', getApiInfo);
app.get('/api/:version/health', getVersionedHealth);

// Apply stricter rate limiting to auth routes - DISABLED for development
app.use('/api/v1/auth', authLimiter, authRoutes); // Apply specific auth limiter
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/goals', goalsRoutes);
app.use('/api/v1/metrics', metricsRoutes);

// Enhanced error logging before error handler
app.use(errorLogging);
app.use(errorHandler);

module.exports = app;
