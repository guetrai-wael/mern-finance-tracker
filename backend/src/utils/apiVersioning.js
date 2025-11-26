/* API versioning system for future compatibility and deprecation management */
const express = require('express');
const enhancedLogger = require('../utils/enhancedLogger');

/**
 * API Version Configuration
 */
const API_VERSIONS = {
    'v1': {
        version: '1.0.0',
        status: 'stable',
        releaseDate: '2024-01-01',
        deprecationDate: null,
        supportEndDate: null,
        description: 'Initial stable API version'
    },
    'v2': {
        version: '2.0.0',
        status: 'development',
        releaseDate: null,
        deprecationDate: null,
        supportEndDate: null,
        description: 'Next generation API with enhanced features'
    }
};

/**
 * Version detection middleware
 */
const detectApiVersion = (req, res, next) => {
    let version = 'v1'; // Default version

    // Check URL path for version
    const pathMatch = req.path.match(/^\/api\/(v\d+)/);
    if (pathMatch) {
        version = pathMatch[1];
    }

    // Check Accept header for version preference
    const acceptHeader = req.get('Accept');
    if (acceptHeader && acceptHeader.includes('application/vnd.finance-app.')) {
        const versionMatch = acceptHeader.match(/application\/vnd\.finance-app\.(v\d+)/);
        if (versionMatch) {
            version = versionMatch[1];
        }
    }

    // Check custom version header
    const versionHeader = req.get('API-Version');
    if (versionHeader && API_VERSIONS[versionHeader]) {
        version = versionHeader;
    }

    // Validate version exists
    if (!API_VERSIONS[version]) {
        const contextLogger = req.logger || enhancedLogger;
        contextLogger.warn('Unsupported API version requested', {
            requestedVersion: version,
            supportedVersions: Object.keys(API_VERSIONS),
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        return res.status(400).json({
            success: false,
            message: `Unsupported API version: ${version}`,
            supportedVersions: Object.keys(API_VERSIONS),
            errorType: 'unsupported_version'
        });
    }

    // Attach version info to request
    req.apiVersion = version;
    req.versionInfo = API_VERSIONS[version];

    // Add version headers to response
    res.set('API-Version', version);
    res.set('API-Version-Status', API_VERSIONS[version].status);

    // Log version usage for analytics
    const contextLogger = req.logger || enhancedLogger;
    contextLogger.debug('API version detected', {
        version,
        status: API_VERSIONS[version].status,
        userAgent: req.get('User-Agent')
    });

    next();
};

/**
 * Version deprecation warning middleware
 */
const checkDeprecation = (req, res, next) => {
    const versionInfo = req.versionInfo;

    if (versionInfo.status === 'deprecated') {
        const contextLogger = req.logger || enhancedLogger;
        contextLogger.warn('Deprecated API version used', {
            version: req.apiVersion,
            deprecationDate: versionInfo.deprecationDate,
            supportEndDate: versionInfo.supportEndDate,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Add deprecation headers
        res.set('Deprecation', versionInfo.deprecationDate);
        if (versionInfo.supportEndDate) {
            res.set('Sunset', versionInfo.supportEndDate);
        }
        res.set('Warning', `299 - \"API version ${req.apiVersion} is deprecated\"`);
    }

    next();
};

/**
 * Version-specific route factory
 */
const createVersionedRouter = (version) => {
    const router = express.Router();

    // Add version-specific middleware
    router.use((req, res, next) => {
        req.apiVersion = version;
        req.versionInfo = API_VERSIONS[version];
        res.set('API-Version', version);
        next();
    });

    return router;
};

/**
 * Version compatibility checker
 */
const checkVersionCompatibility = (requiredVersion, features = []) => {
    return (req, res, next) => {
        const currentVersion = req.apiVersion;
        const contextLogger = req.logger || enhancedLogger;

        // Simple version comparison (assuming semantic versioning)
        const parseVersion = (v) => {
            const match = v.match(/v(\d+)\.?(\d+)?\.?(\d+)?/);
            return match ? [
                parseInt(match[1]) || 0,
                parseInt(match[2]) || 0,
                parseInt(match[3]) || 0
            ] : [0, 0, 0];
        };

        const [reqMajor, reqMinor, reqPatch] = parseVersion(requiredVersion);
        const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);

        const isCompatible =
            curMajor > reqMajor ||
            (curMajor === reqMajor && curMinor > reqMinor) ||
            (curMajor === reqMajor && curMinor === reqMinor && curPatch >= reqPatch);

        if (!isCompatible) {
            contextLogger.warn('Version compatibility check failed', {
                requiredVersion,
                currentVersion,
                features,
                userAgent: req.get('User-Agent')
            });

            return res.status(400).json({
                success: false,
                message: `This feature requires API version ${requiredVersion} or higher`,
                currentVersion,
                requiredVersion,
                features,
                errorType: 'version_compatibility_error'
            });
        }

        next();
    };
};

/**
 * Feature flag middleware for gradual rollouts
 */
const featureFlag = (featureName, enabledVersions = ['v1']) => {
    return (req, res, next) => {
        const currentVersion = req.apiVersion;
        const contextLogger = req.logger || enhancedLogger;

        if (!enabledVersions.includes(currentVersion)) {
            contextLogger.info('Feature not available in current version', {
                featureName,
                currentVersion,
                enabledVersions,
                userAgent: req.get('User-Agent')
            });

            return res.status(404).json({
                success: false,
                message: `Feature '${featureName}' is not available in API version ${currentVersion}`,
                availableInVersions: enabledVersions,
                errorType: 'feature_not_available'
            });
        }

        next();
    };
};

/**
 * Version migration helper
 */
const migrateResponse = (req, res, data) => {
    const version = req.apiVersion;

    // Apply version-specific transformations
    switch (version) {
        case 'v1':
            return migrateToV1(data);
        case 'v2':
            return migrateToV2(data);
        default:
            return data;
    }
};

/**
 * V1 response format (current)
 */
const migrateToV1 = (data) => {
    // V1 format is the baseline
    return data;
};

/**
 * V2 response format (future)
 */
const migrateToV2 = (data) => {
    // Future V2 enhancements could include:
    // - Standardized metadata
    // - Enhanced error details
    // - Additional response fields

    if (data && typeof data === 'object') {
        return {
            ...data,
            metadata: {
                version: 'v2',
                timestamp: new Date().toISOString(),
                format: 'enhanced'
            }
        };
    }

    return data;
};

/**
 * API documentation endpoint
 */
const getApiInfo = (req, res) => {
    const currentVersion = req.apiVersion || 'v1';
    const versionInfo = API_VERSIONS[currentVersion];

    res.json({
        success: true,
        data: {
            currentVersion,
            versionInfo,
            allVersions: API_VERSIONS,
            endpoints: {
                auth: '/api/' + currentVersion + '/auth',
                transactions: '/api/' + currentVersion + '/transactions',
                categories: '/api/' + currentVersion + '/categories',
                budgets: '/api/' + currentVersion + '/budgets',
                goals: '/api/' + currentVersion + '/goals',
                users: '/api/' + currentVersion + '/users'
            },
            documentation: 'https://api-docs.finance-app.com/' + currentVersion,
            contact: 'support@finance-app.com'
        },
        message: 'API information retrieved successfully'
    });
};

/**
 * Health check with version info
 */
const getVersionedHealth = (req, res) => {
    const version = req.apiVersion || 'v1';
    const versionInfo = API_VERSIONS[version];

    res.json({
        success: true,
        data: {
            status: 'healthy',
            version,
            versionStatus: versionInfo.status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        },
        message: `Personal Finance App API ${version} is running`
    });
};

module.exports = {
    API_VERSIONS,
    detectApiVersion,
    checkDeprecation,
    createVersionedRouter,
    checkVersionCompatibility,
    featureFlag,
    migrateResponse,
    getApiInfo,
    getVersionedHealth
};