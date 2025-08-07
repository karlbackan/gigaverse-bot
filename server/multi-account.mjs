import { config } from '../src/config.mjs';
import { startBot, stopBot, listBots } from './client.mjs';

// Account configurations
const ACCOUNTS = [
    { id: 1, address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0', envKey: 'JWT_TOKEN' },
    { id: 2, address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816', envKey: 'JWT_TOKEN_2' },
    { id: 3, address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963', envKey: 'JWT_TOKEN_3' },
    { id: 4, address: '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b', envKey: 'JWT_TOKEN_4' },
    { id: 5, address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81', envKey: 'JWT_TOKEN_5' }
];

async function startAllBots() {
    console.log('Starting all bots...\n');
    
    for (const account of ACCOUNTS) {
        const jwtToken = process.env[account.envKey];
        
        if (!jwtToken) {
            console.log(`⚠️  Account ${account.id}: No JWT token found (${account.envKey})`);
            continue;
        }
        
        try {
            await startBot(account.address, jwtToken);
            console.log(`✅ Account ${account.id} started`);
            
            // Wait a bit between starts to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.log(`❌ Account ${account.id} failed to start`);
        }
    }
    
    console.log('\nAll bots started!');
}

async function stopAllBots() {
    console.log('Stopping all bots...\n');
    
    const activeBots = await listBots();
    
    for (const bot of activeBots) {
        try {
            await stopBot(bot.accountId);
            console.log(`✅ Stopped ${bot.accountId}`);
        } catch (error) {
            console.log(`❌ Failed to stop ${bot.accountId}`);
        }
    }
    
    console.log('\nAll bots stopped!');
}

async function showStatus() {
    const bots = await listBots();
    
    console.log('\n=== Bot Status Dashboard ===\n');
    
    if (bots.length === 0) {
        console.log('No active bots');
        return;
    }
    
    let totalRuns = 0;
    let totalWins = 0;
    let totalFailures = 0;
    
    for (const bot of bots) {
        const account = ACCOUNTS.find(a => a.address.toLowerCase() === bot.accountId.toLowerCase());
        const accountName = account ? `Account ${account.id}` : 'Unknown';
        
        console.log(`${accountName} (${bot.accountId.substring(0, 10)}...)`);
        console.log(`  Runs: ${bot.stats.runs} | Wins: ${bot.stats.wins} | Failures: ${bot.stats.failures}`);
        console.log(`  Win Rate: ${bot.stats.runs > 0 ? ((bot.stats.wins / bot.stats.runs) * 100).toFixed(1) : 0}%`);
        console.log(`  Started: ${new Date(bot.startTime).toLocaleString()}`);
        console.log('');
        
        totalRuns += bot.stats.runs;
        totalWins += bot.stats.wins;
        totalFailures += bot.stats.failures;
    }
    
    console.log('=== Total Stats ===');
    console.log(`Active Bots: ${bots.length}`);
    console.log(`Total Runs: ${totalRuns}`);
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Total Failures: ${totalFailures}`);
    console.log(`Overall Win Rate: ${totalRuns > 0 ? ((totalWins / totalRuns) * 100).toFixed(1) : 0}%`);
}

// CLI interface
const command = process.argv[2];

async function main() {
    try {
        switch (command) {
            case 'start-all':
                await startAllBots();
                break;
                
            case 'stop-all':
                await stopAllBots();
                break;
                
            case 'status':
                await showStatus();
                break;
                
            case 'start':
                const accountId = parseInt(process.argv[3]);
                if (!accountId || accountId < 1 || accountId > 5) {
                    console.log('Usage: node multi-account.mjs start <1-5>');
                    break;
                }
                const account = ACCOUNTS[accountId - 1];
                const token = process.env[account.envKey];
                if (!token) {
                    console.log(`No JWT token found for account ${accountId}`);
                    break;
                }
                await startBot(account.address, token);
                break;
                
            default:
                console.log('Multi-Account Bot Manager\n');
                console.log('Commands:');
                console.log('  start-all  - Start all configured bots');
                console.log('  stop-all   - Stop all running bots');
                console.log('  status     - Show status of all bots');
                console.log('  start <id> - Start specific account (1-5)');
                console.log('\nMake sure JWT tokens are set in .env file');
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();