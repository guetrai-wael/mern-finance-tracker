/* Express app setup and route mounting with security middleware */
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
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
const recurringRoutes = require('./routes/recurring');
const notificationRoutes = require('./routes/notifications');
const accountRoutes = require('./routes/accounts');
const { errorHandler } = require('./middlewares/error');

const app = express();
app.set("trust proxy", 1);

// DB connection is managed in index.js to prevent a double connection.

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

// Resolve the true client IP behind Cloudflare before falling back to req.ip,
// then normalize it. ipKeyGenerator collapses IPv6 addresses to their /56
// subnet — without it a single IPv6 client can rotate through addresses it
// already controls and reset its own rate-limit budget at will.
const clientIp = (req) => ipKeyGenerator(req.headers['cf-connecting-ip'] || req.ip);

// Rate limits are counted per-IP in memory. Disable them under test so the
// suite isn't throttled by its own repeated requests from 127.0.0.1.
//
// Held as module state rather than read from process.env per request: tests that
// need the limiter live can flip app.locals.rateLimits.enabled without mutating a
// process-wide variable that concurrently-running test files also observe.
const rateLimits = { enabled: process.env.NODE_ENV !== 'test' };
const skipInTest = () => !rateLimits.enabled;

// Exposed so tests can exercise the real rate-limiting path. Never toggled at runtime.
app.locals.rateLimits = rateLimits;

// General API limiter: generous, catches runaway clients and crude scraping.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: skipInTest,
});

// Session-maintenance limiter for /refresh, /me, /logout. These fire on normal
// app usage (a refresh every 15 minutes per active session), so they need
// meaningful headroom — they are not credential-guessing surface.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: 'Too many authentication requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: skipInTest,
});

// Credential limiter for /login and /signup — the actual brute-force surface.
// skipSuccessfulRequests means only FAILED attempts consume budget, so a
// legitimate user is never locked out by their own successful logins.
const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many failed authentication attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skipSuccessfulRequests: true,
    skip: skipInTest,
});

app.use(limiter); // Enabled for Rate Limiting

// CORS configuration - Allow specific frontend origins
const allowedOrigins = [
    "http://localhost:5173",
    "https://chahrity.netlify.app",
    "https://chahrity.com",
    "https://www.chahrity.com"
];

app.use(cors({
    origin: function (origin, callback) {
        // In dev, allow no-origin requests (curl, Postman, server-to-server tests).
        // In production, requests without an Origin header are usually server-side
        // and have no business calling a credentialed API — reject them.
        if (!origin) {
            return callback(null, process.env.NODE_ENV !== 'production');
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Reject by returning false (not throwing). Throwing turns every blocked
        // request into a stack-trace logged at error level — easy log-spam vector.
        // false yields a clean 200/204 with no Access-Control-Allow-Origin header,
        // which the browser correctly blocks.
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
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

// Credential endpoints get the strict limiter first; these paths then fall
// through to the auth router below.
app.use('/api/v1/auth/login', credentialLimiter);
app.use('/api/v1/auth/signup', credentialLimiter);

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);

// Business routes. Subscription enforcement lives in each router via
// middlewares/checkSubscription, not here.
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/goals', goalsRoutes);
app.use('/api/v1/recurring', recurringRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/metrics', metricsRoutes);

// Enhanced error logging before error handler
app.use(errorLogging);
app.use(errorHandler);

module.exports = app;
