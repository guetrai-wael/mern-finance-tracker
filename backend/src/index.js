/* Entry point for the Express server */
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { registerJobs, scheduler } = require('./jobs');

const PORT = config.port;

// Connect to MongoDB before starting the server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✔ Connected to MongoDB Atlas");
        logger.info('Connected to MongoDB Atlas');

        // Start server after successful DB connection
        app.listen(PORT, '0.0.0.0', () => {
            logger.info('Server started successfully', { port: PORT, host: '0.0.0.0', environment: config.nodeEnv });
            console.log(`🚀 Server running on http://localhost:${PORT}`);

            // Background jobs run in-process. Skipped under test so the suite
            // never spawns timers or posts transactions behind a test's back.
            if (config.nodeEnv !== 'test') {
                registerJobs();
                scheduler.start();
            }
        }).on('error', (err) => {
            logger.error('Failed to start server', { error: err.message, port: PORT });
            console.error('❌ Server failed to start:', err.message);
        });
    })
    .catch(err => {
        console.error("❗ MongoDB error:", err);
        logger.error('MongoDB connection failed', { error: err.message });
        process.exit(1);
    });
