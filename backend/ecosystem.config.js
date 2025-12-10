module.exports = {
    apps: [{
        name: "finance-backend",
        script: "./src/index.js",
        instances: 1, // Single instance for now
        autorestart: true,
        watch: false, // Don't watch in production
        max_memory_restart: '500M',
        env: {
            NODE_ENV: "development",
        },
        env_production: {
            NODE_ENV: "production",
        },
        log_date_format: "YYYY-MM-DD HH:mm Z",
        error_file: "./logs/pm2-error.log",
        out_file: "./logs/pm2-out.log",
        merge_logs: true,
    }]
};
