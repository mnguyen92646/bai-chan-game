module.exports = {
  apps: [
    {
      name: 'bai-chan-server',
      cwd: require('node:path').join(__dirname, 'apps/server'),
      script: 'npm',
      args: 'run dev',
      env: {
        PORT: '3001',
        JWT_SECRET: 'dev-secret-change-me'
      },
      autorestart: true,
      max_restarts: 20
    },
    {
      name: 'bai-chan-web',
      cwd: require('node:path').join(__dirname, 'apps/web'),
      script: 'npm',
      args: 'run dev',
      env: {
        // optional; web will infer server url from hostname
        NEXT_TELEMETRY_DISABLED: '1'
      },
      autorestart: true,
      max_restarts: 20
    }
  ]
};
