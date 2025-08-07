# Server-Side Bot Deployment

## Local Development

1. Install dependencies:
```bash
npm install express cors
```

2. Run the server:
```bash
node server/server.mjs
```

3. Open browser to http://localhost:3000

## Production Deployment Options

### Option 1: VPS (DigitalOcean, Linode, etc.)

1. Set up Ubuntu server
2. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Clone your bot:
```bash
git clone https://github.com/yourusername/gigaverse-bot.git
cd gigaverse-bot
npm install
```

4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server/server.mjs --name gigabot
pm2 save
pm2 startup
```

5. Set up Nginx reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Heroku (Free tier available)

1. Create `Procfile`:
```
web: node server/server.mjs
```

2. Deploy:
```bash
heroku create your-bot-name
git push heroku main
```

### Option 3: Railway.app (Simple deployment)

1. Connect GitHub repo
2. Set start command: `node server/server.mjs`
3. Deploy automatically

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Authentication**: Add proper authentication to API endpoints
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Environment Variables**: Never commit JWT tokens

Example with authentication:
```javascript
// Add to server.mjs
const ADMIN_KEY = process.env.ADMIN_KEY || 'your-secret-key';

// Middleware to check admin key
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Protect endpoints
app.post('/api/bot/start', requireAuth, async (req, res) => {
    // ... existing code
});
```

## Monitoring

Add logging and monitoring:
```javascript
// Log all bot actions
console.log(`[${new Date().toISOString()}] Bot ${accountId} - ${action}`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bots: activeBots.size
    });
});
```

## Scaling

For multiple accounts:
1. Use Redis for shared state
2. Deploy multiple instances
3. Use load balancer
4. Consider microservices architecture

## Important Notes

1. **This doesn't bypass Underhaul restrictions** - The server still uses the same API
2. **Respect rate limits** - Don't run too many bots simultaneously
3. **Monitor costs** - Server hosting isn't free
4. **Backup data** - Keep logs and statistics

The main advantage is centralized control and always-on operation, not bypassing API limitations.