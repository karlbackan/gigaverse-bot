# Gigaverse Bot

An automated dungeon crawler bot for Gigaverse.io that plays the Dungetron 5000 dungeon.

## ⚠️ Disclaimer

**IMPORTANT: This bot is for educational purposes only.**

- Make sure you have permission to use automation with Gigaverse
- Using bots may violate the game's Terms of Service
- Use at your own risk

## Features

- **Automated Dungeon Crawling**: Plays Dungetron 5000 automatically
- **Smart Decision Making**: Strategic weapon selection based on stats
- **Charge Management**: Handles weapon charge regeneration mechanics
- **Loot Optimization**: Selects best upgrades based on weighted scoring
- **Energy Management**: Automatically starts dungeons when energy is available
- **Error Recovery**: Resilient error handling with automatic retry
- **Statistics Tracking**: Monitors win rate and performance

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
```env
JWT_TOKEN=your_jwt_token_here
```

## Getting Your JWT Token

1. Open Gigaverse.io in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Perform any game action
5. Look for API requests to `gigaverse.io/api`
6. Find the `Authorization` header and copy the Bearer token

## Usage

Start the bot:
```bash
npm start
```

Or run in development mode with auto-restart:
```bash
npm run dev
```

## Configuration

Edit `src/config.mjs` to customize:
- Dungeon type (default: Dungetron 5000)
- Check interval (default: 60 seconds)
- Repair threshold (default: 30%)

## How It Works

The bot:
1. Checks energy levels periodically
2. Starts a dungeon run when enough energy is available
3. Makes strategic decisions based on weapon stats and enemy patterns
4. Selects optimal loot upgrades
5. Handles charge regeneration (1 per turn, 2-turn delay when depleted)
6. Continues until victory or defeat

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

The bot uses direct API calls instead of the SDK due to parameter naming issues:
- Uses `dungeonType` instead of `dungeonId`
- Implements proper action token chaining
- Handles token errors with automatic retry

## Development

The codebase is organized as:
- `src/bot.mjs` - Main bot loop
- `src/dungeon-player.mjs` - Dungeon playing logic
- `src/decision-engine.mjs` - Combat decision making
- `src/direct-api.mjs` - Direct API implementation
- `src/config.mjs` - Configuration settings

## Troubleshooting

1. **"JWT_TOKEN is required"**: Make sure you've created `.env` file with your token
2. **"Failed to connect to API"**: Check your JWT token is valid and not expired
3. **Token errors**: The bot automatically retries without token on first action

## Contributing

Feel free to submit issues and pull requests.

## License

MIT

## Disclaimer

This project is not affiliated with Gigaverse.io. Use at your own risk.