import { DungeonPlayer } from '../src/dungeon-player.mjs';
import { config as globalConfig } from '../src/config.mjs';

// Wrapper class to isolate bot configuration
export class BotWrapper {
  constructor(accountId, jwtToken) {
    this.accountId = accountId;
    this.jwtToken = jwtToken;
    this.isRunning = false;
    
    // Store original values
    this.originalJwtToken = globalConfig.jwtToken;
    this.originalWalletAddress = globalConfig.walletAddress;
  }
  
  // Set this bot's configuration before API calls
  setConfig() {
    globalConfig.jwtToken = this.jwtToken;
    globalConfig.walletAddress = this.accountId;
  }
  
  // Restore original configuration
  restoreConfig() {
    globalConfig.jwtToken = this.originalJwtToken;
    globalConfig.walletAddress = this.originalWalletAddress;
  }
  
  // Create and initialize the bot
  async initialize() {
    this.setConfig();
    try {
      this.dungeonPlayer = new DungeonPlayer(this.accountId);
      this.isRunning = true;
    } finally {
      this.restoreConfig();
    }
  }
  
  // Play dungeon with proper config isolation
  async playDungeon() {
    this.setConfig();
    try {
      return await this.dungeonPlayer.playDungeon();
    } finally {
      this.restoreConfig();
    }
  }
  
  // Get status with proper config isolation
  getStatus() {
    this.setConfig();
    try {
      return this.dungeonPlayer.getStatus();
    } finally {
      this.restoreConfig();
    }
  }
  
  // Stop the bot
  stop() {
    this.isRunning = false;
  }
}