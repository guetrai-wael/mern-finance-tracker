/* Centralized configuration from environment variables */
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/finance_app',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
    nodeEnv: process.env.NODE_ENV || 'development'
};
