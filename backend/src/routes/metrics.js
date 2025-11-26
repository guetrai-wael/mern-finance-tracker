/* Performance metrics API endpoints */
const express = require('express');
const router = express.Router();
const { performanceMonitor } = require('../utils/performanceMonitor');
const auth = require('../middlewares/auth');
const { checkVersionCompatibility } = require('../utils/apiVersioning');

/**
 * Get current performance metrics (admin only)
 */
const getMetrics = async (req, res) => {
    try {
        const metrics = performanceMonitor.getMetrics();
        
        res.json({
            success: true,
            data: metrics,
            message: 'Performance metrics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve performance metrics',
            error: error.message
        });
    }
};

/**
 * Get performance summary (admin only)
 */
const getMetricsSummary = async (req, res) => {
    try {
        const metrics = performanceMonitor.getMetrics();
        
        const summary = {
            overview: {
                uptime: metrics.uptime,
                totalRequests: metrics.requests.total,
                successRate: metrics.requests.successRate + '%',
                averageResponseTime: metrics.response_times.average + 'ms',
                databaseQueries: metrics.database.queries,
                errorRate: metrics.errors.errorRate + '%'
            },
            performance: {
                p95ResponseTime: metrics.response_times.p95 + 'ms',
                p99ResponseTime: metrics.response_times.p99 + 'ms',
                slowQueries: metrics.database.slowQueries,
                slowQueryRate: metrics.database.slowQueryRate + '%'
            },
            system: {
                memoryUsage: metrics.system.memory.usagePercent + '%',
                heapUsage: metrics.system.memory.heapUsagePercent + '%',
                loadAverage: metrics.system.cpu.loadAverage
            },
            alerts: generateAlerts(metrics)
        };
        
        res.json({
            success: true,
            data: summary,
            message: 'Performance summary retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve performance summary',
            error: error.message
        });
    }
};

/**
 * Get endpoint performance statistics
 */
const getEndpointStats = async (req, res) => {
    try {
        const metrics = performanceMonitor.getMetrics();
        const { limit = 20 } = req.query;
        
        const endpointStats = metrics.requests.topEndpoints.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                endpoints: endpointStats,
                totalEndpoints: endpointStats.length
            },
            message: 'Endpoint statistics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve endpoint statistics',
            error: error.message
        });
    }
};

/**
 * Get database performance statistics
 */
const getDatabaseStats = async (req, res) => {
    try {
        const metrics = performanceMonitor.getMetrics();
        const { limit = 20 } = req.query;
        
        const dbStats = {
            overview: {
                totalQueries: metrics.database.queries,
                averageQueryTime: metrics.database.averageQueryTime + 'ms',
                slowQueries: metrics.database.slowQueries,
                slowQueryRate: metrics.database.slowQueryRate + '%',
                errorRate: metrics.database.errorRate + '%'
            },
            topQueries: metrics.database.topQueries.slice(0, parseInt(limit))
        };
        
        res.json({
            success: true,
            data: dbStats,
            message: 'Database statistics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve database statistics',
            error: error.message
        });
    }
};

/**
 * Generate performance alerts
 */
const generateAlerts = (metrics) => {
    const alerts = [];
    
    // High response time alert
    if (metrics.response_times.p95 > 2000) {
        alerts.push({
            type: 'warning',
            category: 'performance',
            message: `High response time: P95 is ${metrics.response_times.p95}ms`,
            threshold: '2000ms',
            current: metrics.response_times.p95 + 'ms'
        });
    }
    
    // High error rate alert
    if (parseFloat(metrics.errors.errorRate) > 5) {
        alerts.push({
            type: 'error',
            category: 'reliability',
            message: `High error rate: ${metrics.errors.errorRate}%`,
            threshold: '5%',
            current: metrics.errors.errorRate + '%'
        });
    }
    
    // High memory usage alert
    if (parseFloat(metrics.system.memory.usagePercent) > 80) {
        alerts.push({
            type: 'warning',
            category: 'system',
            message: `High memory usage: ${metrics.system.memory.usagePercent}%`,
            threshold: '80%',
            current: metrics.system.memory.usagePercent + '%'
        });
    }
    
    // High database query time alert
    if (metrics.database.averageQueryTime > 500) {
        alerts.push({
            type: 'warning',
            category: 'database',
            message: `Slow database queries: Average ${metrics.database.averageQueryTime}ms`,
            threshold: '500ms',
            current: metrics.database.averageQueryTime + 'ms'
        });
    }
    
    return alerts;
};

/**
 * Health check with performance indicators
 */
const healthCheck = async (req, res) => {
    try {
        const metrics = performanceMonitor.getMetrics();
        const alerts = generateAlerts(metrics);
        
        const health = {
            status: alerts.some(alert => alert.type === 'error') ? 'unhealthy' : 'healthy',
            timestamp: new Date().toISOString(),
            uptime: metrics.uptime,
            version: req.apiVersion || 'v1',
            performance: {
                responseTime: metrics.response_times.average,
                successRate: metrics.requests.successRate,
                memoryUsage: metrics.system.memory.usagePercent
            },
            alerts: alerts.length,
            criticalAlerts: alerts.filter(alert => alert.type === 'error').length
        };
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            success: health.status === 'healthy',
            data: health,
            message: `System is ${health.status}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    
    res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorType: 'authorization_error'
    });
};

// Routes
router.get('/health', healthCheck);
router.get('/metrics', auth, adminOnly, getMetrics);
router.get('/metrics/summary', auth, adminOnly, getMetricsSummary);
router.get('/metrics/endpoints', auth, adminOnly, getEndpointStats);
router.get('/metrics/database', auth, adminOnly, getDatabaseStats);

module.exports = router;