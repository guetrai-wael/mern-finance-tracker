/* Comprehensive performance monitoring and metrics collection system */
const os = require('os');
const process = require('process');
const enhancedLogger = require('./enhancedLogger');

/**
 * Performance metrics collector
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byEndpoint: new Map(),
                byStatusCode: new Map()
            },
            response_times: {
                total: 0,
                count: 0,
                min: Infinity,
                max: 0,
                p95: 0,
                p99: 0,
                recent: [] // Store recent response times for percentile calculations
            },
            database: {
                queries: 0,
                totalTime: 0,
                slowQueries: 0,
                errors: 0,
                byType: new Map()
            },
            system: {
                memory: {
                    used: 0,
                    free: 0,
                    total: 0,
                    heapUsed: 0,
                    heapTotal: 0
                },
                cpu: {
                    usage: 0,
                    loadAverage: []
                },
                uptime: 0
            },
            errors: {
                total: 0,
                byType: new Map(),
                recent: []
            }
        };
        
        this.startTime = Date.now();
        this.maxRecentResponseTimes = 1000; // Keep last 1000 response times for percentiles
        
        // Start system monitoring
        this.startSystemMonitoring();
        
        // Start periodic reporting
        this.startPeriodicReporting();
    }
    
    /**
     * Record HTTP request metrics
     */
    recordRequest(req, res, responseTime) {
        this.metrics.requests.total++;
        
        // Success/failure tracking
        if (res.statusCode >= 200 && res.statusCode < 400) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }
        
        // By endpoint tracking
        const endpoint = `${req.method} ${req.route?.path || req.path}`;
        const endpointStats = this.metrics.requests.byEndpoint.get(endpoint) || { count: 0, totalTime: 0 };
        endpointStats.count++;
        endpointStats.totalTime += responseTime;
        this.metrics.requests.byEndpoint.set(endpoint, endpointStats);
        
        // By status code tracking
        const statusCode = res.statusCode;
        const statusStats = this.metrics.requests.byStatusCode.get(statusCode) || 0;
        this.metrics.requests.byStatusCode.set(statusCode, statusStats + 1);
        
        // Response time metrics
        this.recordResponseTime(responseTime);
        
        // Log slow requests
        if (responseTime > 1000) {
            enhancedLogger.performance('Slow request detected', {
                endpoint,
                responseTime,
                statusCode,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
        }
    }
    
    /**
     * Record response time
     */
    recordResponseTime(responseTime) {
        this.metrics.response_times.total += responseTime;
        this.metrics.response_times.count++;
        this.metrics.response_times.min = Math.min(this.metrics.response_times.min, responseTime);
        this.metrics.response_times.max = Math.max(this.metrics.response_times.max, responseTime);
        
        // Store for percentile calculations
        this.metrics.response_times.recent.push(responseTime);
        if (this.metrics.response_times.recent.length > this.maxRecentResponseTimes) {
            this.metrics.response_times.recent.shift();
        }
        
        // Calculate percentiles
        this.calculatePercentiles();
    }
    
    /**
     * Calculate response time percentiles
     */
    calculatePercentiles() {
        const recent = [...this.metrics.response_times.recent].sort((a, b) => a - b);
        const count = recent.length;
        
        if (count > 0) {
            this.metrics.response_times.p95 = recent[Math.floor(count * 0.95)] || 0;
            this.metrics.response_times.p99 = recent[Math.floor(count * 0.99)] || 0;
        }
    }
    
    /**
     * Record database query metrics
     */
    recordDatabaseQuery(queryName, duration, success = true) {
        this.metrics.database.queries++;
        this.metrics.database.totalTime += duration;
        
        if (!success) {
            this.metrics.database.errors++;
        }
        
        if (duration > 100) { // Slow query threshold: 100ms
            this.metrics.database.slowQueries++;
        }
        
        // By query type tracking
        const queryStats = this.metrics.database.byType.get(queryName) || { count: 0, totalTime: 0, errors: 0 };
        queryStats.count++;
        queryStats.totalTime += duration;
        if (!success) queryStats.errors++;
        this.metrics.database.byType.set(queryName, queryStats);
    }
    
    /**
     * Record error metrics
     */
    recordError(error, context = {}) {
        this.metrics.errors.total++;
        
        const errorType = error.name || 'UnknownError';
        const errorCount = this.metrics.errors.byType.get(errorType) || 0;
        this.metrics.errors.byType.set(errorType, errorCount + 1);
        
        // Store recent errors for analysis
        this.metrics.errors.recent.push({
            type: errorType,
            message: error.message,
            timestamp: Date.now(),
            context
        });
        
        // Keep only last 100 errors
        if (this.metrics.errors.recent.length > 100) {
            this.metrics.errors.recent.shift();
        }
    }
    
    /**
     * Update system metrics
     */
    updateSystemMetrics() {
        const memUsage = process.memoryUsage();
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        
        this.metrics.system.memory = {
            used: totalMem - freeMem,
            free: freeMem,
            total: totalMem,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        };
        
        this.metrics.system.cpu = {
            loadAverage: os.loadavg(),
            usage: process.cpuUsage()
        };
        
        this.metrics.system.uptime = process.uptime();
        
        // Memory usage alerts
        const memoryUsagePercent = (this.metrics.system.memory.used / this.metrics.system.memory.total) * 100;
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (memoryUsagePercent > 80) {
            enhancedLogger.warn('High system memory usage', {
                memoryUsagePercent: memoryUsagePercent.toFixed(2),
                usedMemory: Math.round(this.metrics.system.memory.used / 1024 / 1024),
                totalMemory: Math.round(this.metrics.system.memory.total / 1024 / 1024)
            });
        }
        
        if (heapUsagePercent > 80) {
            enhancedLogger.warn('High heap memory usage', {
                heapUsagePercent: heapUsagePercent.toFixed(2),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
            });
        }
    }
    
    /**
     * Get current metrics snapshot
     */
    getMetrics() {
        this.updateSystemMetrics();
        
        const avgResponseTime = this.metrics.response_times.count > 0 
            ? this.metrics.response_times.total / this.metrics.response_times.count 
            : 0;
            
        const avgDbQueryTime = this.metrics.database.queries > 0
            ? this.metrics.database.totalTime / this.metrics.database.queries
            : 0;
        
        return {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            requests: {
                ...this.metrics.requests,
                successRate: this.metrics.requests.total > 0 
                    ? (this.metrics.requests.successful / this.metrics.requests.total * 100).toFixed(2)
                    : 100,
                requestsPerSecond: this.metrics.requests.total / (this.metrics.system.uptime || 1),
                topEndpoints: this.getTopEndpoints()
            },
            response_times: {
                ...this.metrics.response_times,
                average: Math.round(avgResponseTime * 100) / 100,
                min: this.metrics.response_times.min === Infinity ? 0 : this.metrics.response_times.min
            },
            database: {
                ...this.metrics.database,
                averageQueryTime: Math.round(avgDbQueryTime * 100) / 100,
                slowQueryRate: this.metrics.database.queries > 0
                    ? (this.metrics.database.slowQueries / this.metrics.database.queries * 100).toFixed(2)
                    : 0,
                errorRate: this.metrics.database.queries > 0
                    ? (this.metrics.database.errors / this.metrics.database.queries * 100).toFixed(2)
                    : 0,
                topQueries: this.getTopQueries()
            },
            system: {
                ...this.metrics.system,
                memory: {
                    ...this.metrics.system.memory,
                    usagePercent: ((this.metrics.system.memory.used / this.metrics.system.memory.total) * 100).toFixed(2),
                    heapUsagePercent: ((this.metrics.system.memory.heapUsed / this.metrics.system.memory.heapTotal) * 100).toFixed(2)
                }
            },
            errors: {
                ...this.metrics.errors,
                errorRate: this.metrics.requests.total > 0
                    ? (this.metrics.errors.total / this.metrics.requests.total * 100).toFixed(2)
                    : 0,
                topErrors: this.getTopErrors()
            }
        };
    }
    
    /**
     * Get top endpoints by request count
     */
    getTopEndpoints(limit = 10) {
        return Array.from(this.metrics.requests.byEndpoint.entries())
            .map(([endpoint, stats]) => ({
                endpoint,
                count: stats.count,
                avgResponseTime: stats.totalTime / stats.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * Get top database queries by execution time
     */
    getTopQueries(limit = 10) {
        return Array.from(this.metrics.database.byType.entries())
            .map(([queryName, stats]) => ({
                queryName,
                count: stats.count,
                totalTime: stats.totalTime,
                avgTime: stats.totalTime / stats.count,
                errors: stats.errors
            }))
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, limit);
    }
    
    /**
     * Get top errors by frequency
     */
    getTopErrors(limit = 10) {
        return Array.from(this.metrics.errors.byType.entries())
            .map(([errorType, count]) => ({ errorType, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * Start system monitoring interval
     */
    startSystemMonitoring() {
        // Update system metrics every 30 seconds
        setInterval(() => {
            this.updateSystemMetrics();
        }, 30000);
    }
    
    /**
     * Start periodic reporting
     */
    startPeriodicReporting() {
        // Report metrics every 5 minutes
        setInterval(() => {
            const metrics = this.getMetrics();
            
            enhancedLogger.performance('Performance metrics report', {
                requestCount: metrics.requests.total,
                successRate: metrics.requests.successRate,
                avgResponseTime: metrics.response_times.average,
                p95ResponseTime: metrics.response_times.p95,
                dbQueries: metrics.database.queries,
                avgDbTime: metrics.database.averageQueryTime,
                memoryUsage: metrics.system.memory.usagePercent,
                errorCount: metrics.errors.total,
                errorRate: metrics.errors.errorRate
            });
        }, 5 * 60 * 1000);
        
        // Detailed report every hour
        setInterval(() => {
            const metrics = this.getMetrics();
            
            enhancedLogger.info('Detailed performance report', {
                category: 'performance_report',
                metrics: {
                    requests: metrics.requests,
                    response_times: metrics.response_times,
                    database: metrics.database,
                    system: metrics.system,
                    errors: metrics.errors,
                    topEndpoints: metrics.requests.topEndpoints,
                    topQueries: metrics.database.topQueries,
                    topErrors: metrics.errors.topErrors
                }
            });
        }, 60 * 60 * 1000);
    }
    
    /**
     * Reset metrics (useful for testing or periodic resets)
     */
    resetMetrics() {
        this.metrics.requests = {
            total: 0,
            successful: 0,
            failed: 0,
            byEndpoint: new Map(),
            byStatusCode: new Map()
        };
        
        this.metrics.response_times = {
            total: 0,
            count: 0,
            min: Infinity,
            max: 0,
            p95: 0,
            p99: 0,
            recent: []
        };
        
        this.metrics.database = {
            queries: 0,
            totalTime: 0,
            slowQueries: 0,
            errors: 0,
            byType: new Map()
        };
        
        this.metrics.errors = {
            total: 0,
            byType: new Map(),
            recent: []
        };
        
        this.startTime = Date.now();
    }
}

// Create global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware for performance monitoring
 */
const performanceMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Record request metrics
        performanceMonitor.recordRequest(req, res, responseTime);
        
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

/**
 * Database query performance wrapper
 */
const monitorDatabaseQuery = (queryName, queryPromise) => {
    const startTime = process.hrtime.bigint();
    
    return queryPromise
        .then(result => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            performanceMonitor.recordDatabaseQuery(queryName, duration, true);
            return result;
        })
        .catch(error => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            performanceMonitor.recordDatabaseQuery(queryName, duration, false);
            throw error;
        });
};

/**
 * Error monitoring wrapper
 */
const monitorError = (error, context = {}) => {
    performanceMonitor.recordError(error, context);
};

module.exports = {
    PerformanceMonitor,
    performanceMonitor,
    performanceMiddleware,
    monitorDatabaseQuery,
    monitorError
};