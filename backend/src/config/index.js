/* Centralized configuration from environment variables */
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Minimum entropy for a signing secret. Anything shorter is brute-forceable
// offline once an attacker holds a single issued token.
const MIN_SECRET_LENGTH = 32;

/**
 * Resolve a JWT signing secret.
 *
 * Never falls back to a hardcoded constant: a known secret lets anyone forge an
 * admin token. In production a missing or weak secret is fatal. In development
 * we mint a random ephemeral secret so `npm run dev` still works without a .env
 * — tokens simply stop validating across restarts, which is the correct and
 * obvious failure mode.
 */
function requireSecret(name) {
    const value = process.env[name];

    if (!value) {
        if (isProduction) {
            throw new Error(
                `${name} is not set. Refusing to start: a missing signing secret would ` +
                `otherwise fall back to a predictable value and allow token forgery.`
            );
        }
        console.warn(
            `⚠ ${name} is not set — generating a random ephemeral secret for ${nodeEnv}. ` +
            `Sessions will not survive a restart. Set ${name} in .env to persist them.`
        );
        return crypto.randomBytes(48).toString('hex');
    }

    if (isProduction && value.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `${name} must be at least ${MIN_SECRET_LENGTH} characters in production ` +
            `(got ${value.length}).`
        );
    }

    return value;
}

const jwtAccessSecret = requireSecret('JWT_ACCESS_SECRET');
const jwtRefreshSecret = requireSecret('JWT_REFRESH_SECRET');

// Distinct secrets keep the two token types in separate trust domains. Sharing
// one means a leaked 15-minute access token is also a valid 7-day refresh token.
if (jwtAccessSecret === jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}

module.exports = {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/finance_app',
    jwtAccessSecret,
    jwtRefreshSecret,
    accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
    nodeEnv
};
