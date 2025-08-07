import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BotWrapper } from './bot-wrapper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Store active bot instances
const activeBots = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bots: activeBots.size });
});

// Start bot for an account
app.post('/api/bot/start', async (req, res) => {
  try {
    const { accountId, jwtToken } = req.body;
    
    if (!accountId || !jwtToken) {
      return res.status(400).json({ error: 'Missing accountId or jwtToken' });
    }
    
    // Check if bot already running
    if (activeBots.has(accountId)) {
      return res.status(409).json({ error: 'Bot already running for this account' });
    }
    
    // Create bot wrapper instance
    const bot = new BotWrapper(accountId, jwtToken);
    await bot.initialize();
    
    // Store bot instance
    activeBots.set(accountId, {
      bot,
      startTime: new Date(),
      stats: {
        runs: 0,
        wins: 0,
        failures: 0
      }
    });
    
    // Start bot loop in background
    runBotLoop(accountId);
    
    res.json({ 
      message: 'Bot started',
      accountId,
      startTime: new Date()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop bot
app.post('/api/bot/stop', (req, res) => {
  const { accountId } = req.body;
  
  const botData = activeBots.get(accountId);
  if (!botData) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  botData.bot.stop();
  activeBots.delete(accountId);
  
  res.json({ 
    message: 'Bot stopped',
    stats: botData.stats
  });
});

// Get bot status
app.get('/api/bot/status/:accountId', (req, res) => {
  const { accountId } = req.params;
  
  const botData = activeBots.get(accountId);
  if (!botData) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  res.json({
    accountId,
    running: true,
    startTime: botData.startTime,
    stats: botData.stats
  });
});

// List all active bots
app.get('/api/bots', (req, res) => {
  const bots = Array.from(activeBots.entries()).map(([accountId, data]) => ({
    accountId,
    startTime: data.startTime,
    stats: data.stats
  }));
  
  res.json({ bots });
});

// Bot loop function
async function runBotLoop(accountId) {
  const botData = activeBots.get(accountId);
  if (!botData) return;
  
  const { bot, stats } = botData;
  
  while (bot.isRunning && activeBots.has(accountId)) {
    try {
      const result = await bot.playDungeon();
      
      // Update stats
      stats.runs++;
      if (result === 'completed') {
        stats.wins++;
      } else if (result === 'failed') {
        stats.failures++;
      }
      
      // Wait based on result
      if (result === 'wait') {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
      }
      
    } catch (error) {
      console.error(`Bot error for ${accountId}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds on error
    }
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/bot/start - Start a bot`);
  console.log(`  POST /api/bot/stop - Stop a bot`);
  console.log(`  GET  /api/bot/status/:accountId - Get bot status`);
  console.log(`  GET  /api/bots - List all active bots`);
});