# Gigaverse Bot

An automated dungeon crawler bot for Gigaverse.io that plays the Dungetron 5000 dungeon.

## ⚠️ Disclaimer

**IMPORTANT: This bot is for educational purposes only.**

- Make sure you have permission to use automation with Gigaverse
- Using bots may violate the game's Terms of Service
- Use at your own risk

## Features

- **Auto-Switch Strategy**: Prioritizes Underhaul (9 runs/day) → automatically switches to Dungetron 5000 when full
- **Active Dungeon Detection**: Automatically detects and continues existing dungeons with proper type identification
- **Dual Statistics Tracking**: Separate enemy pattern analysis for Underhaul vs Dungetron 5000
- **Advanced Pattern Recognition**: Tracks enemy move sequences and predicts with high accuracy
- **Smart Decision Making**: Uses multi-factor analysis including move patterns, turn behavior, and stat correlations
- **Statistics System**: Records all battles and analyzes enemy-specific patterns
- **Minimal Output Mode**: Clean output focused on statistics indicators
- **Charge Management**: Handles weapon charge regeneration mechanics
- **Loot Optimization**: Selects best upgrades based on weighted scoring
- **Energy Management**: Automatically starts dungeons when energy is available
- **Error Recovery**: Resilient error handling with automatic retry
- **Performance Tracking**: Real-time win rate and prediction confidence

## Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/gigaverse-bot.git
cd gigaverse-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:

For single account:
```env
JWT_TOKEN=your_jwt_token_here
```

For multiple accounts:
```env
JWT_TOKEN_1=first_account_token_here
JWT_TOKEN_2=second_account_token_here
JWT_TOKEN_3=third_account_token_here
JWT_TOKEN_4=fourth_account_token_here
JWT_TOKEN_5=fifth_account_token_here

# Optional: Custom names
ACCOUNT_NAME_1=Main Account
ACCOUNT_NAME_2=Alt Account 1
ACCOUNT_NAME_3=Alt Account 2
ACCOUNT_NAME_4=Alt Account 3
ACCOUNT_NAME_5=Alt Account 4
```

## Getting Your JWT Token

1. Open Gigaverse.io in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Perform any game action
5. Look for API requests to `gigaverse.io/api`
6. Find the `Authorization` header and copy the Bearer token

## Usage

### Single Account Mode

Start the bot with a single account:
```bash
npm start
```

### Multi-Account Mode

Run the interactive menu for multiple accounts:
```bash
npm run menu
```

The menu provides options to:
- Check all accounts status (validate JWT tokens)
- Run a single selected account
- Run all valid accounts sequentially
- Continuous mode (cycle through accounts)

### Development Mode

Run in development mode with auto-restart:
```bash
npm run dev
```

## Configuration

The bot automatically prioritizes **Dungetron Underhaul** (9 runs/day) and switches to **Dungetron 5000** when Underhaul is full. Configure with environment variables:

- Auto-switch behavior (AUTO_SWITCH_TO_DUNGETRON: default true)
- Energy threshold (ENERGY_THRESHOLD: default 40)
- Check interval (CHECK_INTERVAL: default 60000ms)
- Repair threshold (REPAIR_THRESHOLD: default 30%)
- Minimal output mode (MINIMAL_OUTPUT: default true)

Add to `.env` file:
```env
# Bot Settings
DUNGEON_TYPE=JUICED             # Enable juiced mode for Dungetron 5000 
AUTO_SWITCH_TO_DUNGETRON=true   # Auto-switch when Underhaul is 9/9
ENERGY_THRESHOLD=40             # Energy required to start
MINIMAL_OUTPUT=true             # Clean output for statistics
```

## How It Works

The bot:
1. **Auto-detects active dungeons** and continues with proper dungeon type detection
2. **Smart dungeon selection**: Prioritizes Underhaul (9/day) → Auto-switches to Dungetron 5000 when full
3. **Checks energy levels** and daily limits periodically
4. **Starts optimal dungeon** based on availability and energy
5. **Analyzes enemy patterns** using advanced statistics (tracked separately by dungeon type):
   - **Move Sequences** (40% weight) - Tracks patterns like "rock-paper→scissor"
   - **Turn-Specific** (20% weight) - Different behavior on different turns
   - **Stat Correlations** (15% weight) - Changes based on health/shield levels
   - **Time-Based Shifts** (15% weight) - Patterns change over days (noobId tracking)
   - **Overall Distribution** (10% weight) - General move preferences
6. **Makes predictions** when confidence exceeds 60%
7. **Selects optimal loot upgrades** using weighted scoring
8. **Handles charge regeneration** (1 per turn, 2-turn delay when depleted)
9. **Continues until victory or defeat** with unified API compatibility

### Statistics Analysis

View detailed analysis report:
```bash
node src/statistics-analyzer.mjs report
```

Export raw data:
```bash
node src/statistics-analyzer.mjs export data.json
```

### Game Mechanics

**Charge Regeneration:**
- Each weapon regenerates 1 charge per turn (max 3)
- Depleted weapons (0 charges) take 2 turns before regeneration starts
- Enemies in Dungetron always regenerate (no 2-turn penalty)

**Combat:**
- Rock beats Scissors
- Scissors beats Paper  
- Paper beats Rock
- Draw deals reduced damage to both

**Structure:**
- 4 floors with 4 rooms each (16 total rooms)
- Each room has one enemy to defeat
- Loot selection after each enemy defeat

## API Implementation

The bot uses direct API calls with maximum compatibility:
- **Unified Endpoint**: Uses `/api/game/dungeon/action` for all dungeon types (including Underhaul)
- **Dual Parameter Support**: Sends both `dungeonType` AND `dungeonId` for maximum API compatibility
- Implements proper action token chaining across all dungeon types
- Handles token errors with automatic retry
- **Complete Underhaul Support**: Confirmed working with dungeonType/dungeonId: 3

### API Endpoints Used:
- `POST /api/game/dungeon/action` - All dungeon types (dungeonType/dungeonId: 1=Dungetron5000, 3=Underhaul)
- `GET /api/game/dungeon/state` - Current dungeon state (all types)
- `GET /api/gear/instances/{address}` - Equipment data for Underhaul

## Development

The codebase is organized as:
- `src/bot.mjs` - Main bot loop
- `src/dungeon-player.mjs` - Dungeon playing logic
- `src/decision-engine.mjs` - Combat decision making with prediction
- `src/statistics-engine.mjs` - Pattern tracking and analysis
- `src/statistics-analyzer.mjs` - Analysis and reporting tool
- `src/direct-api.mjs` - Direct API implementation
- `src/config.mjs` - Configuration settings
- `data/battle-statistics.json` - Persistent statistics storage

## Troubleshooting

1. **"JWT_TOKEN is required"**: Make sure you've created `.env` file with your token
2. **"Failed to connect to API"**: Check your JWT token is valid and not expired
3. **Token errors**: The bot automatically retries without token on first action
4. **Too much output**: Enable minimal mode with `MINIMAL_OUTPUT=true` (default)
5. **Low prediction confidence**: Play more games to gather enemy pattern data

### Output Modes

**Minimal Mode** (default):
```
Goblin_5 T1: rock→paper lose
Conf:75% R20/P65/S15
```

**Verbose Mode** (MINIMAL_OUTPUT=false):
Full combat details, weapon stats, and health/shield values

## Contributing

Feel free to submit issues and pull requests.

## License

MIT

## Disclaimer

This project is not affiliated with Gigaverse.io. Use at your own risk.