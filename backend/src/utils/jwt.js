/* JWT helper: sign and verify access/refresh tokens */
const jwt = require('jsonwebtoken');
const config = require('../config/index');

function signAccess(payload) {
    return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenExpiresIn });
}

function signRefresh(payload) {
    return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenExpiresIn });
}

function verifyAccess(token) {
    return jwt.verify(token, config.jwtAccessSecret);
}

function verifyRefresh(token) {
    return jwt.verify(token, config.jwtRefreshSecret);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
