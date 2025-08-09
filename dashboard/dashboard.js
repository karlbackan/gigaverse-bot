// Gigaverse Bot Dashboard JavaScript
class DashboardApp {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.settings = {
            autoRefresh: true,
            refreshInterval: 2000,
            soundNotifications: true
        };
        
        this.mockData = {
            accounts: [
                { id: 1, name: 'Main Account (loki)', address: '0xBC68...59F0', status: 'active', energy: 85, maxEnergy: 120, dungeon: 'Underhaul', wins: 34, losses: 12 },
                { id: 2, name: 'Account 2', address: '0x9eA5...5816', status: 'ready', energy: 120, maxEnergy: 120, dungeon: 'Ready', wins: 28, losses: 15 },
                { id: 3, name: 'Account 3', address: '0xAa2F...6963', status: 'warning', energy: 25, maxEnergy: 120, dungeon: 'Cooldown', wins: 22, losses: 18 },
                { id: 4, name: 'Account 4', address: '0x2153...046b', status: 'ready', energy: 95, maxEnergy: 120, dungeon: 'Ready', wins: 31, losses: 14 },
                { id: 5, name: 'Account 5', address: '0x7E42...9a81', status: 'danger', energy: 60, maxEnergy: 120, dungeon: 'Gear Repair Needed', wins: 19, losses: 21 }
            ],
            activities: [],
            gear: [
                { name: 'Legendary Sword', type: 'gear', durability: 95, maxDurability: 100, account: 1, equipped: true },
                { name: 'Dragon Shield', type: 'gear', durability: 78, maxDurability: 100, account: 1, equipped: true },
                { name: 'Fire Charm', type: 'charm', durability: 0, maxDurability: 100, account: 5, equipped: true },
                { name: 'Speed Boots', type: 'gear', durability: 45, maxDurability: 100, account: 3, equipped: true },
                { name: 'Mana Crystal', type: 'charm', durability: 89, maxDurability: 100, account: 2, equipped: true }
            ],
            statistics: {
                totalBattles: 245,
                globalWinRate: 67.8,
                activeAccounts: 2,
                predictionAccuracy: 72.5
            }
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeCharts();
        this.renderAccountCards();
        this.renderGearStatus();
        this.updateStatistics();
        this.startActivitySimulation();
        
        // Try to connect to WebSocket
        this.connectWebSocket();
        
        // Start auto-refresh if enabled
        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        }
        
        console.log('🎮 Gigaverse Dashboard initialized!');
    }
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Control buttons
        document.getElementById('repairAllBtn').addEventListener('click', () => this.repairAllGear());
        document.getElementById('emergencyStopBtn').addEventListener('click', () => this.emergencyStop());
        document.getElementById('refreshDataBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        
        // Modal handling
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('settingsModal')) {
                this.closeModal();
            }
        });
        
        // Settings form
        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            this.settings.autoRefresh = e.target.checked;
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
        
        document.getElementById('refreshInterval').addEventListener('change', (e) => {
            this.settings.refreshInterval = parseInt(e.target.value);
            if (this.settings.autoRefresh) {
                this.stopAutoRefresh();
                this.startAutoRefresh();
            }
        });
    }
    
    connectWebSocket() {
        try {
            this.ws = new WebSocket('ws://localhost:3001');
            
            this.ws.onopen = () => {
                console.log('📡 WebSocket connected!');
                this.updateConnectionStatus(true);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('📡 WebSocket disconnected');
                this.updateConnectionStatus(false);
                // Try to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('📡 WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.log('📡 WebSocket not available, using mock data');
            this.updateConnectionStatus(false, 'Mock Data Mode');
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'accountUpdate':
                if (data.accounts) {
                    this.mockData.accounts = data.accounts;
                    this.renderAccountCards();
                }
                break;
            case 'battleResult':
                this.addActivity(data.activity);
                break;
            case 'gearUpdate':
                if (data.gear) {
                    this.mockData.gear = data.gear;
                    this.renderGearStatus();
                }
                break;
            case 'statistics':
                this.updateStatistics(data.stats);
                break;
        }
    }
    
    updateConnectionStatus(connected, customText = null) {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('.status-text');
        
        if (connected) {
            dot.classList.add('connected');
            text.textContent = customText || 'Connected';
        } else {
            dot.classList.remove('connected');
            text.textContent = customText || 'Disconnected';
        }
    }
    
    renderAccountCards() {
        const container = document.getElementById('accountsGrid');
        container.innerHTML = this.mockData.accounts.map(account => `
            <div class="account-card ${account.status}">
                <div class="account-header">
                    <div class="account-name">${account.name}</div>
                    <div class="account-status">${account.status.toUpperCase()}</div>
                </div>
                <div class="account-stats">
                    <div class="account-stat">
                        <span class="account-stat-label">Energy</span>
                        <span class="account-stat-value">${account.energy}/${account.maxEnergy}</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Win Rate</span>
                        <span class="account-stat-value">${Math.round((account.wins / (account.wins + account.losses)) * 100)}%</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Status</span>
                        <span class="account-stat-value">${account.dungeon}</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Battles</span>
                        <span class="account-stat-value">${account.wins + account.losses}</span>
                    </div>
                </div>
                <div class="energy-bar">
                    <div class="energy-fill" style="width: ${(account.energy / account.maxEnergy) * 100}%"></div>
                </div>
            </div>
        `).join('');
    }
    
    renderGearStatus() {
        const container = document.getElementById('gearGrid');
        container.innerHTML = this.mockData.gear.map(item => {
            const durabilityPercent = (item.durability / item.maxDurability) * 100;
            let statusClass = 'healthy';
            if (durabilityPercent === 0) statusClass = 'broken';
            else if (durabilityPercent < 30) statusClass = 'low-durability';
            
            let durabilityClass = 'high';
            if (durabilityPercent < 30) durabilityClass = 'low';
            else if (durabilityPercent < 60) durabilityClass = 'medium';
            
            return `
                <div class="gear-item ${statusClass}">
                    <div class="gear-name">${item.name}</div>
                    <div>Type: ${item.type}</div>
                    <div>Account: ${item.account}</div>
                    <div>Status: ${item.equipped ? 'Equipped' : 'Unequipped'}</div>
                    <div>Durability: ${item.durability}/${item.maxDurability}</div>
                    <div class="durability-bar">
                        <div class="durability-fill ${durabilityClass}" style="width: ${durabilityPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    updateStatistics(stats = null) {
        const data = stats || this.mockData.statistics;
        
        document.getElementById('totalBattles').textContent = data.totalBattles;
        document.getElementById('globalWinRate').textContent = `${data.globalWinRate}%`;
        document.getElementById('activeAccounts').textContent = data.activeAccounts;
        
        if (document.getElementById('predictionAccuracy')) {
            document.getElementById('predictionAccuracy').textContent = `${data.predictionAccuracy}%`;
        }
    }
    
    initializeCharts() {
        // Win Rate Chart
        const winRateCtx = document.getElementById('winRateChart');
        if (winRateCtx) {
            this.charts.winRate = new Chart(winRateCtx, {
                type: 'line',
                data: {
                    labels: ['1h ago', '45m', '30m', '15m', 'Now'],
                    datasets: [{
                        label: 'Win Rate %',
                        data: [65, 68, 72, 70, 68],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 50,
                            max: 80
                        }
                    }
                }
            });
        }
        
        // Enemy Encounters Chart
        const enemyCtx = document.getElementById('enemyChart');
        if (enemyCtx) {
            this.charts.enemy = new Chart(enemyCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Goblin', 'Orc', 'Dragon', 'Skeleton', 'Others'],
                    datasets: [{
                        data: [25, 20, 10, 15, 30],
                        backgroundColor: [
                            '#ff6b6b',
                            '#4ecdc4',
                            '#45b7d1',
                            '#96ceb4',
                            '#feca57'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // Initialize other charts
        this.initializePredictionChart();
        this.initializeSequenceChart();
        this.initializeTurnChart();
        this.initializeHealthChart();
        this.initializeChargeChart();
    }
    
    initializePredictionChart() {
        const ctx = document.getElementById('predictionChart');
        if (ctx) {
            this.charts.prediction = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Correct', 'Incorrect'],
                    datasets: [{
                        data: [72, 28],
                        backgroundColor: ['#28a745', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }
    
    initializeSequenceChart() {
        const ctx = document.getElementById('sequenceChart');
        if (ctx) {
            this.charts.sequence = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Rock-Rock', 'Paper-Paper', 'Scissor-Scissor', 'Rock-Paper', 'Paper-Scissor', 'Scissor-Rock'],
                    datasets: [{
                        label: 'Sequence Frequency',
                        data: [15, 20, 18, 25, 22, 30],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.2)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }
    
    initializeTurnChart() {
        const ctx = document.getElementById('turnChart');
        if (ctx) {
            this.charts.turn = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Turn 1', 'Turn 2', 'Turn 3', 'Turn 4', 'Turn 5'],
                    datasets: [{
                        label: 'Win Rate by Turn',
                        data: [65, 72, 68, 75, 70],
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }
    
    initializeHealthChart() {
        const ctx = document.getElementById('healthChart');
        if (ctx) {
            this.charts.health = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['100%', '75%', '50%', '25%', '0%'],
                    datasets: [{
                        label: 'Win Rate by Health',
                        data: [85, 75, 60, 45, 20],
                        backgroundColor: [
                            '#28a745',
                            '#ffc107',
                            '#fd7e14',
                            '#dc3545',
                            '#6c757d'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }
    
    initializeChargeChart() {
        const ctx = document.getElementById('chargeChart');
        if (ctx) {
            this.charts.charge = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['High Charges', 'Medium Charges', 'Low Charges'],
                    datasets: [{
                        data: [40, 35, 25],
                        backgroundColor: [
                            '#28a745',
                            '#ffc107',
                            '#dc3545'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }
    
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Remove active class from all buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Show selected tab content
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Add active class to selected button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }
    
    addActivity(activity) {
        const feed = document.getElementById('activityFeed');
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour12: false });
        
        const activityHtml = `
            <div class="activity-item ${activity.type || 'info'}">
                <span class="activity-time">${timeString}</span>
                <span class="activity-text">${activity.text}</span>
            </div>
        `;
        
        feed.insertAdjacentHTML('afterbegin', activityHtml);
        
        // Keep only last 50 activities
        const items = feed.querySelectorAll('.activity-item');
        if (items.length > 50) {
            items[items.length - 1].remove();
        }
        
        // Play notification sound if enabled
        if (this.settings.soundNotifications && activity.type === 'success') {
            this.playNotificationSound();
        }
    }
    
    startActivitySimulation() {
        // Simulate real-time activities for demo
        const activities = [
            { text: '⚔️ Account 1: Battle started against Goblin Warrior', type: 'info' },
            { text: '🎉 Account 1: Victory! +25 XP', type: 'success' },
            { text: '🔧 Account 5: Fire Charm repaired (0% → 100%)', type: 'success' },
            { text: '⚡ Account 2: Energy recharged to 120/120', type: 'info' },
            { text: '⚠️ Account 3: Low energy warning (25/120)', type: 'warning' },
            { text: '🏆 Account 4: New win streak: 5 battles', type: 'success' },
            { text: '📊 Statistics updated: Global win rate now 68.2%', type: 'info' },
            { text: '⚔️ Account 1: Entering Underhaul dungeon', type: 'info' },
            { text: '💎 Account 2: Rare loot acquired: Dragon Scale', type: 'success' }
        ];
        
        let index = 0;
        setInterval(() => {
            if (index < activities.length) {
                this.addActivity(activities[index]);
                index++;
            } else {
                // Reset and continue with random activities
                index = 0;
                const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                this.addActivity(randomActivity);
            }
        }, 3000);
    }
    
    repairAllGear() {
        this.addActivity({ text: '🔧 Initiating repair for all broken gear...', type: 'info' });
        
        // Simulate repair process
        setTimeout(() => {
            this.addActivity({ text: '✅ All gear repaired successfully!', type: 'success' });
            
            // Update gear data
            this.mockData.gear.forEach(item => {
                if (item.durability === 0) {
                    item.durability = item.maxDurability;
                }
            });
            
            this.renderGearStatus();
        }, 2000);
    }
    
    emergencyStop() {
        if (confirm('Are you sure you want to stop all bot activities?')) {
            this.addActivity({ text: '⛔ Emergency stop activated - all bots stopped', type: 'error' });
            
            // Update account statuses
            this.mockData.accounts.forEach(account => {
                account.status = 'stopped';
                account.dungeon = 'Stopped';
            });
            
            this.renderAccountCards();
        }
    }
    
    refreshData() {
        this.addActivity({ text: '🔄 Refreshing dashboard data...', type: 'info' });
        
        // Simulate data refresh
        setTimeout(() => {
            this.renderAccountCards();
            this.renderGearStatus();
            this.updateStatistics();
            this.addActivity({ text: '✅ Dashboard data refreshed', type: 'success' });
        }, 1000);
    }
    
    openSettings() {
        document.getElementById('settingsModal').style.display = 'block';
    }
    
    closeModal() {
        document.getElementById('settingsModal').style.display = 'none';
    }
    
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            this.simulateDataUpdates();
        }, this.settings.refreshInterval);
    }
    
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    
    simulateDataUpdates() {
        // Simulate small changes in data
        this.mockData.accounts.forEach(account => {
            // Randomly adjust energy
            if (Math.random() < 0.3) {
                account.energy = Math.max(0, Math.min(account.maxEnergy, 
                    account.energy + Math.floor(Math.random() * 10) - 5));
            }
        });
        
        // Update charts with new data
        if (this.charts.winRate) {
            const newData = this.charts.winRate.data.datasets[0].data;
            newData.shift();
            newData.push(Math.floor(Math.random() * 20) + 60);
            this.charts.winRate.update();
        }
        
        this.renderAccountCards();
    }
    
    playNotificationSound() {
        // Simple notification sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gain.gain.setValueAtTime(0, audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio notification not available');
        }
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardApp = new DashboardApp();
});

// Add some utility functions
window.dashboardUtils = {
    formatTime: (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });
    },
    
    formatDuration: (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    },
    
    getStatusColor: (status) => {
        const colors = {
            'active': '#28a745',
            'ready': '#17a2b8',
            'warning': '#ffc107',
            'danger': '#dc3545',
            'stopped': '#6c757d'
        };
        return colors[status] || '#6c757d';
    }
};