/* MongoDB connection helper using mongoose with logging and optimization */
const mongoose = require('mongoose');
const logger = require('./logger');
const { ConnectionOptimizer } = require('./dbOptimization');

module.exports = async function connectDB(mongoUri) {
    try {
        // Use optimized connection settings
        const connectionOptions = ConnectionOptimizer.getOptimizedConnectionOptions();
        
        await mongoose.connect(mongoUri, connectionOptions);
        logger.info('Connected to MongoDB successfully with optimized settings');
        
        // Set up comprehensive connection monitoring
        ConnectionOptimizer.setupConnectionMonitoring(mongoose);
        
        // Additional performance monitoring
        if (process.env.NODE_ENV === 'development') {
            mongoose.set('debug', true);
        }
        
    } catch (err) {
        logger.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
};
