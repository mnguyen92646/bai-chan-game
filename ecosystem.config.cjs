module.exports = {
  apps: [
    {
      name: 'bai-chan-server',
      cwd: '/Users/michaelnguyen/.openclaw/workspace/bai-chan-web/apps/server',
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
      cwd: '/Users/michaelnguyen/.openclaw/workspace/bai-chan-web/apps/web',
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
