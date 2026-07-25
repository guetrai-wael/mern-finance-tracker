/* JWT helper: sign and verify access/refresh tokens */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/index');

function signAccess(payload) {
    return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenExpiresIn });
}

/**
 * Sign a refresh token.
 *
 * A unique `jti` is required for correctness, not just hygiene: `iat` has
 * one-second resolution, so signing twice for the same user within the same
 * second would otherwise produce a byte-identical token. Rotation on password
 * change compares the stored token to detect stale sessions — an identical
 * token would silently leave every other session valid.
 */
function signRefresh(payload) {
    return jwt.sign(
        { ...payload, jti: crypto.randomUUID() },
        config.jwtRefreshSecret,
        { expiresIn: config.refreshTokenExpiresIn }
    );
}

function verifyAccess(token) {
    return jwt.verify(token, config.jwtAccessSecret);
}

function verifyRefresh(token) {
    return jwt.verify(token, config.jwtRefreshSecret);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
