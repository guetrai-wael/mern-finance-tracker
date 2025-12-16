/**
 * PM2 Ecosystem Configuration for Chahrity Backend
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *   pm2 stop chahrity-api
 *   pm2 logs chahrity-api
 * 
 * Enable startup on reboot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
    apps: [{
        name: "chahrity-api",
        script: "./src/index.js",
        instances: 1, // Use 'max' for cluster mode (all CPU cores)
        exec_mode: "fork", // Use 'cluster' for multi-instance
        autorestart: true,
        watch: false, // Don't watch in production
        max_memory_restart: '500M',

        // Environment variables
        env: {
            NODE_ENV: "development",
            PORT: 4000,
        },
        env_production: {
            NODE_ENV: "production",
            PORT: 4000,
        },

        // Logging
        log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        error_file: "./logs/pm2-error.log",
        out_file: "./logs/pm2-out.log",
        merge_logs: true,

        // Graceful shutdown
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000,
    }]
};
