import axios from 'axios';

// Server configuration
const SERVER_URL = process.env.BOT_SERVER_URL || 'http://localhost:3001';
const ADMIN_KEY = process.env.ADMIN_KEY; // Optional authentication

// Create axios instance
const api = axios.create({
    baseURL: SERVER_URL,
    headers: ADMIN_KEY ? { 'Authorization': `Bearer ${ADMIN_KEY}` } : {}
});

// Client functions
export async function startBot(accountId, jwtToken) {
    try {
        const response = await api.post('/api/bot/start', {
            accountId,
            jwtToken
        });
        console.log(`✅ Bot started for ${accountId}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Failed to start bot:`, error.response?.data || error.message);
        throw error;
    }
}

export async function stopBot(accountId) {
    try {
        const response = await api.post('/api/bot/stop', {
            accountId
        });
        console.log(`⏹️  Bot stopped for ${accountId}`);
        console.log(`   Final stats:`, response.data.stats);
        return response.data;
    } catch (error) {
        console.error(`❌ Failed to stop bot:`, error.response?.data || error.message);
        throw error;
    }
}

export async function getBotStatus(accountId) {
    try {
        const response = await api.get(`/api/bot/status/${accountId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null; // Bot not found
        }
        throw error;
    }
}

export async function listBots() {
    try {
        const response = await api.get('/api/bots');
        return response.data.bots;
    } catch (error) {
        console.error(`❌ Failed to list bots:`, error.response?.data || error.message);
        throw error;
    }
}

// CLI interface if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    async function main() {
        try {
            switch (command) {
                case 'start':
                    if (args.length < 2) {
                        console.log('Usage: node client.mjs start <accountId> <jwtToken>');
                        break;
                    }
                    await startBot(args[0], args[1]);
                    break;
                    
                case 'stop':
                    if (args.length < 1) {
                        console.log('Usage: node client.mjs stop <accountId>');
                        break;
                    }
                    await stopBot(args[0]);
                    break;
                    
                case 'status':
                    if (args.length < 1) {
                        console.log('Usage: node client.mjs status <accountId>');
                        break;
                    }
                    const status = await getBotStatus(args[0]);
                    if (status) {
                        console.log('Bot Status:', JSON.stringify(status, null, 2));
                    } else {
                        console.log('Bot not found');
                    }
                    break;
                    
                case 'list':
                    const bots = await listBots();
                    console.log(`Active bots (${bots.length}):`);
                    bots.forEach(bot => {
                        console.log(`- ${bot.accountId}`);
                        console.log(`  Stats: ${bot.stats.runs} runs, ${bot.stats.wins} wins`);
                    });
                    break;
                    
                default:
                    console.log('Commands:');
                    console.log('  start <accountId> <jwtToken> - Start a bot');
                    console.log('  stop <accountId>             - Stop a bot');
                    console.log('  status <accountId>           - Get bot status');
                    console.log('  list                         - List all bots');
                    console.log('\nEnvironment variables:');
                    console.log('  BOT_SERVER_URL - Server URL (default: http://localhost:3000)');
                    console.log('  ADMIN_KEY      - Admin authentication key (optional)');
            }
        } catch (error) {
            process.exit(1);
        }
    }
    
    main();
}