const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

class DashboardServer {
    constructor(port = 3000, wsPort = 3001) {
        this.port = port;
        this.wsPort = wsPort;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wsServer = null;
        this.clients = new Set();
        
        this.setupExpress();
        this.setupWebSocket();
        this.setupDataRoutes();
    }
    
    setupExpress() {
        // Serve static files from dashboard directory
        this.app.use(express.static(__dirname));
        this.app.use(express.json());
        
        // CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        
        // Main dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                clients: this.clients.size 
            });
        });
        
        console.log(`🌐 Dashboard server configured on port ${this.port}`);
    }
    
    setupWebSocket() {
        this.wsServer = new WebSocket.Server({ port: this.wsPort });
        
        this.wsServer.on('connection', (ws, req) => {
            console.log(`📡 New WebSocket client connected from ${req.socket.remoteAddress}`);
            this.clients.add(ws);
            
            // Send initial data to new client
            ws.send(JSON.stringify({
                type: 'init',
                data: this.getMockData()
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('📡 WebSocket client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log(`📡 WebSocket server running on port ${this.wsPort}`);
        
        // Start sending periodic updates
        this.startPeriodicUpdates();
    }
    
    setupDataRoutes() {
        // API endpoint for account data
        this.app.get('/api/accounts', (req, res) => {
            res.json(this.getMockAccountData());
        });
        
        // API endpoint for battle statistics
        this.app.get('/api/statistics', (req, res) => {
            res.json(this.getMockStatistics());
        });
        
        // API endpoint for gear status
        this.app.get('/api/gear', (req, res) => {
            res.json(this.getMockGearData());
        });
        
        // API endpoint for activity feed
        this.app.get('/api/activities', (req, res) => {
            res.json(this.getRecentActivities());
        });
        
        // Control endpoints
        this.app.post('/api/repair-all', (req, res) => {
            console.log('🔧 Repair all gear request received');
            this.broadcastToClients({
                type: 'repairAll',
                timestamp: Date.now()
            });
            res.json({ success: true, message: 'Repair initiated' });
        });
        
        this.app.post('/api/emergency-stop', (req, res) => {
            console.log('⛔ Emergency stop request received');
            this.broadcastToClients({
                type: 'emergencyStop',
                timestamp: Date.now()
            });
            res.json({ success: true, message: 'Emergency stop activated' });
        });
    }
    
    handleClientMessage(ws, data) {
        switch (data.type) {
            case 'requestData':
                ws.send(JSON.stringify({
                    type: 'dataUpdate',
                    data: this.getMockData()
                }));
                break;
                
            case 'repairGear':
                console.log('🔧 Gear repair requested via WebSocket');
                this.broadcastToClients({
                    type: 'gearRepair',
                    gearId: data.gearId,
                    timestamp: Date.now()
                });
                break;
                
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }
    
    startPeriodicUpdates() {
        // Send account updates every 5 seconds
        setInterval(() => {
            this.broadcastToClients({
                type: 'accountUpdate',
                accounts: this.getMockAccountData(),
                timestamp: Date.now()
            });
        }, 5000);
        
        // Send battle results every 10 seconds
        setInterval(() => {
            const battleResult = this.generateRandomBattleResult();
            this.broadcastToClients({
                type: 'battleResult',
                activity: battleResult,
                timestamp: Date.now()
            });
        }, 10000);
        
        // Send statistics updates every 15 seconds
        setInterval(() => {
            this.broadcastToClients({
                type: 'statistics',
                stats: this.getMockStatistics(),
                timestamp: Date.now()
            });
        }, 15000);
    }
    
    broadcastToClients(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
    
    getMockData() {
        return {
            accounts: this.getMockAccountData(),
            statistics: this.getMockStatistics(),
            gear: this.getMockGearData(),
            activities: this.getRecentActivities()
        };
    }
    
    getMockAccountData() {
        const baseAccounts = [
            { id: 1, name: 'Main Account (loki)', address: '0xBC68...59F0' },
            { id: 2, name: 'Account 2', address: '0x9eA5...5816' },
            { id: 3, name: 'Account 3', address: '0xAa2F...6963' },
            { id: 4, name: 'Account 4', address: '0x2153...046b' },
            { id: 5, name: 'Account 5', address: '0x7E42...9a81' }
        ];
        
        return baseAccounts.map(account => ({
            ...account,
            status: ['active', 'ready', 'warning', 'danger'][Math.floor(Math.random() * 4)],
            energy: Math.floor(Math.random() * 120) + 1,
            maxEnergy: 120,
            dungeon: ['Underhaul', 'Dungetron5000', 'Ready', 'Cooldown'][Math.floor(Math.random() * 4)],
            wins: Math.floor(Math.random() * 50) + 10,
            losses: Math.floor(Math.random() * 30) + 5,
            lastActivity: Date.now() - Math.random() * 300000 // Last 5 minutes
        }));
    }
    
    getMockStatistics() {
        return {
            totalBattles: Math.floor(Math.random() * 500) + 200,
            globalWinRate: Math.round((Math.random() * 30 + 55) * 10) / 10,
            activeAccounts: Math.floor(Math.random() * 3) + 2,
            predictionAccuracy: Math.round((Math.random() * 20 + 65) * 10) / 10,
            avgBattleTime: Math.round((Math.random() * 30 + 45) * 10) / 10,
            totalUptime: '2d 14h 32m'
        };
    }
    
    getMockGearData() {
        const gearTypes = ['Sword', 'Shield', 'Helmet', 'Boots', 'Charm', 'Amulet'];
        const prefixes = ['Legendary', 'Epic', 'Rare', 'Magic', 'Dragon', 'Fire', 'Ice', 'Shadow'];
        
        return Array.from({ length: 8 }, (_, i) => {
            const durability = Math.floor(Math.random() * 100);
            return {
                id: i + 1,
                name: `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${gearTypes[Math.floor(Math.random() * gearTypes.length)]}`,
                type: Math.random() > 0.7 ? 'charm' : 'gear',
                durability,
                maxDurability: 100,
                account: Math.floor(Math.random() * 5) + 1,
                equipped: Math.random() > 0.3,
                rarity: Math.floor(Math.random() * 4)
            };
        });
    }
    
    getRecentActivities() {
        const activities = [
            '⚔️ Battle started against Goblin Warrior',
            '🎉 Victory! +25 XP gained',
            '🔧 Gear repaired successfully',
            '⚡ Energy recharged to maximum',
            '⚠️ Low energy warning',
            '🏆 New win streak achieved',
            '📊 Statistics updated',
            '💎 Rare loot acquired',
            '🛡️ Shield durability low',
            '⭐ Level up!'
        ];
        
        return Array.from({ length: 10 }, (_, i) => ({
            id: i,
            text: activities[Math.floor(Math.random() * activities.length)],
            type: ['success', 'info', 'warning', 'error'][Math.floor(Math.random() * 4)],
            timestamp: Date.now() - (i * 30000),
            account: Math.floor(Math.random() * 5) + 1
        }));
    }
    
    generateRandomBattleResult() {
        const results = [
            { text: '⚔️ Account 1: Battle started against Orc Warrior', type: 'info' },
            { text: '🎉 Account 2: Victory! Defeated Dragon (+50 XP)', type: 'success' },
            { text: '💀 Account 3: Defeated by Shadow Beast', type: 'error' },
            { text: '⚡ Account 4: Critical hit! Massive damage dealt', type: 'success' },
            { text: '🔧 Account 5: Sword durability reached 0% - repair needed', type: 'warning' },
            { text: '🏆 Account 1: Win streak extended to 7 battles', type: 'success' },
            { text: '💎 Account 2: Legendary drop: Fire Crystal Charm', type: 'success' }
        ];
        
        return results[Math.floor(Math.random() * results.length)];
    }
    
    async loadRealData() {
        // In a real implementation, this would connect to your bot's data sources
        try {
            // Example: Load data from your statistics engine
            const statsPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
            if (fs.existsSync(statsPath)) {
                const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                console.log('📊 Loaded real battle statistics');
                return statsData;
            }
        } catch (error) {
            console.log('📊 Could not load real data, using mock data');
        }
        return null;
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Dashboard server started!`);
            console.log(`🌐 Dashboard URL: http://localhost:${this.port}`);
            console.log(`📡 WebSocket URL: ws://localhost:${this.wsPort}`);
            console.log(`📊 API endpoints available at /api/*`);
        });
    }
    
    stop() {
        if (this.server) {
            this.server.close();
        }
        if (this.wsServer) {
            this.wsServer.close();
        }
        console.log('🛑 Dashboard server stopped');
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new DashboardServer();
    server.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down dashboard server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = DashboardServer;