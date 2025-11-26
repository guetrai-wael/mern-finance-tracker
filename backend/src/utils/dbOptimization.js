/* Database optimization utilities */
const logger = require('./logger');

/**
 * Query optimization patterns and utilities
 */

/**
 * Optimized transaction queries with proper field selection and indexing hints
 */
const TransactionQueries = {
  /**
   * Get user transactions with date filtering and category population
   */
  getUserTransactions: (userId, filters = {}) => {
    const { start, end, type, category, limit = 50, skip = 0 } = filters;
    
    const query = { user: userId };
    
    // Date range optimization
    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lte = new Date(end);
    }
    
    // Type filter
    if (type) query.type = type;
    
    // Category filter
    if (category) query.category = category;
    
    return {
      filter: query,
      options: {
        sort: { date: -1 }, // Use compound index (user, date)
        limit: Math.min(limit, 100), // Cap limit for performance
        skip,
        lean: true // Return plain objects for better performance
      },
      populate: 'category'
    };
  },

  /**
   * Optimized monthly spending aggregation
   */
  getMonthlySpending: (userId, year) => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    
    return [
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            category: '$category'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.month': 1 }
      }
    ];
  },

  /**
   * Optimized category spending aggregation
   */
  getCategorySpending: (userId, startDate, endDate) => {
    return [
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { total: -1 }
      }
    ];
  }
};

/**
 * Budget query optimizations
 */
const BudgetQueries = {
  /**
   * Get budget with category details efficiently
   */
  getBudgetWithCategories: (userId, month) => {
    return {
      filter: { user: userId, month },
      populate: {
        path: 'categoryBudgets.category',
        select: 'name description'
      },
      lean: true
    };
  },

  /**
   * Bulk budget operations for multiple months
   */
  getBudgetsInRange: (userId, startMonth, endMonth) => {
    return {
      filter: {
        user: userId,
        month: { $gte: startMonth, $lte: endMonth }
      },
      sort: { month: 1 },
      lean: true
    };
  }
};

/**
 * Goal query optimizations
 */
const GoalQueries = {
  /**
   * Get user goals with completion status filtering
   */
  getUserGoals: (userId, filters = {}) => {
    const { isCompleted, category, priority } = filters;
    
    const query = { user: userId };
    
    if (typeof isCompleted === 'boolean') query.isCompleted = isCompleted;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    return {
      filter: query,
      sort: { 
        priority: -1, // High priority first
        targetDate: 1, // Nearest deadline first
        createdAt: -1 // Newest first
      },
      lean: true
    };
  },

  /**
   * Goals progress aggregation
   */
  getGoalsProgress: (userId) => {
    return [
      {
        $match: { user: userId }
      },
      {
        $group: {
          _id: null,
          totalGoals: { $sum: 1 },
          completedGoals: {
            $sum: { $cond: ['$isCompleted', 1, 0] }
          },
          totalTarget: { $sum: '$targetAmount' },
          totalSaved: { $sum: '$currentAmount' },
          avgProgress: {
            $avg: {
              $cond: [
                { $gt: ['$targetAmount', 0] },
                { $divide: ['$currentAmount', '$targetAmount'] },
                0
              ]
            }
          }
        }
      }
    ];
  }
};

/**
 * Performance monitoring for queries
 */
const QueryMonitor = {
  /**
   * Wrap query execution with performance monitoring
   */
  async executeWithTiming(queryName, queryPromise, requestId = null) {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await queryPromise;
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      // Use enhanced logger and performance monitor
      const enhancedLogger = require('./enhancedLogger');
      const { performanceMonitor } = require('./performanceMonitor');
      const contextLogger = requestId ? enhancedLogger.child(requestId) : enhancedLogger;
      
      // Record performance metrics
      performanceMonitor.recordDatabaseQuery(queryName, Math.round(executionTime * 100) / 100, true);
      
      // Log database query performance
      contextLogger.dbQuery(queryName, Math.round(executionTime * 100) / 100, {
        resultCount: Array.isArray(result) ? result.length : 1,
        memoryUsage: process.memoryUsage()
      });
      
      // Alert on slow queries
      if (executionTime > 100) { // Log slow queries (>100ms)
        contextLogger.warn('Slow query detected', {
          queryName,
          executionTime: Math.round(executionTime * 100) / 100,
          resultCount: Array.isArray(result) ? result.length : 1,
          alert: true
        });
      }
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;
      
      const enhancedLogger = require('./enhancedLogger');
      const { performanceMonitor } = require('./performanceMonitor');
      const contextLogger = requestId ? enhancedLogger.child(requestId) : enhancedLogger;
      
      // Record failed query metrics
      performanceMonitor.recordDatabaseQuery(queryName, Math.round(executionTime * 100) / 100, false);
      
      contextLogger.error('Database query failed', {
        queryName,
        executionTime: Math.round(executionTime * 100) / 100,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  },

  /**
   * Add explain plan logging for query optimization
   */
  async explainQuery(model, query) {
    try {
      const explanation = await model.find(query.filter).explain('executionStats');
      
      logger.info('Query explanation', {
        collection: model.collection.name,
        query: query.filter,
        executionStats: {
          totalDocsExamined: explanation.executionStats.totalDocsExamined,
          totalDocsReturned: explanation.executionStats.totalDocsReturned,
          executionTimeMillis: explanation.executionStats.executionTimeMillis,
          indexesUsed: explanation.executionStats.indexesUsed
        }
      });
    } catch (error) {
      logger.error('Query explanation failed', { error: error.message });
    }
  }
};

/**
 * Database connection optimization
 */
const ConnectionOptimizer = {
  /**
   * Optimize mongoose connection settings
   */
  getOptimizedConnectionOptions: () => ({
    maxPoolSize: 10, // Maximum number of connections
    serverSelectionTimeoutMS: 5000, // Timeout for server selection
    socketTimeoutMS: 45000, // Socket timeout
    family: 4, // Use IPv4, skip trying IPv6
    // Connection pooling optimizations
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    waitQueueTimeoutMS: 5000, // Timeout for waiting for connection from pool
  }),

  /**
   * Set up connection event handlers for monitoring
   */
  setupConnectionMonitoring: (mongoose) => {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Monitor connection pool
    mongoose.connection.on('fullsetup', () => {
      logger.info('MongoDB replica set connection established');
    });
  }
};

module.exports = {
  TransactionQueries,
  BudgetQueries,
  GoalQueries,
  QueryMonitor,
  ConnectionOptimizer
};