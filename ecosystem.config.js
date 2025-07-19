module.exports = {
  apps: [
    {
      name: 'it-equipment-tracker',
      script: './server.js',
      cwd: '/path/to/it-equipment-tracker',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      log_file: './logs/app.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'database'],
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};