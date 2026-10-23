// ecosystem.config-example.js
// copy to ecosystem.config.js and adjust values
// Start:   pm2 start ecosystem.config.js
// Reload:  pm2 restart ecosystem.config.js --update-env
// Persist: pm2 save

const path = require('path');

// Load .env from this directory (built into Node 20.12+, no dotenv needed).
const envFile = path.join(__dirname, '.env.local');
try {
  process.loadEnvFile(envFile);
} catch (err) {
  throw new Error(`Could not load ${envFile}: ${err.message}`);
}

if (!process.env.PORT) {
  throw new Error(`PORT is not set in ${envFile}`);
}

module.exports = {
  apps: [
    {
      name: 'APP_NAME',
      namespace: 'PM2_NAMESPACE',

      // Resolve yarn from PATH so Node upgrades don't break the process.
      script: 'yarn',
      args: 'start',
      interpreter: 'none',
      cwd: __dirname,

      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,

      // Back off instead of crash-looping when startup fails.
      exp_backoff_restart_delay: 200,
      min_uptime: '10s',
      kill_timeout: 5000,

      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT,
      },
    },
  ],
};