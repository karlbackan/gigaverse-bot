import { gigaApi } from './api.mjs';
import { config } from './config.mjs';
import { DecisionEngine } from './decision-engine.mjs';
import { sleep } from './utils.mjs';
import { sendDungeonAction } from './dungeon-api-direct.mjs';
import { sendDirectAction, sendDirectLootAction, sendUnderhaulAction, sendUnderhaulLootAction, getDirectDungeonState, getDirectEnergy, getDirectInventory } from './direct-api.mjs';
import { getEquippedGearIds } from './direct-api-gear.mjs';
import { getNoobIdFromJWT } from './jwt-utils.mjs';
import axios from 'axios';

export class DungeonPlayer {
  constructor(walletAddress = null) {
    this.decisionEngine = new DecisionEngine();
    this.currentDungeon = null;
    this.isPlaying = false;
    this.consecutiveErrors = 0;
    this.currentDungeonType = config.dungeonType; // Initialize from config
    this.walletAddress = walletAddress; // Store wallet address for this player
    
    // Log the initial dungeon type for clarity
    const dungeonName = this.currentDungeonType === 1 ? 'Dungetron 5000' : 'Dungetron Underhaul';
    console.log(`Initialized with dungeon type: ${this.currentDungeonType} (${dungeonName})`)
    
    // Set noobId in decision engine
    const noobId = getNoobIdFromJWT(config.jwtToken);
    if (noobId) {
      this.decisionEngine.setNoobId(noobId);
      if (!config.minimalOutput) {
        console.log(`Initialized with noobId: ${noobId}`);
      }
    }
    
    // Set initial dungeon type in decision engine
    this.decisionEngine.setDungeonType(this.currentDungeonType);
  }

  // Check if we can play (energy, juice status, etc.)
  async canPlay() {
    try {
      // FIRST check if we're already in a dungeon - if so, continue regardless of energy
      try {
        const dungeonState = await getDirectDungeonState();
        if (dungeonState?.data?.run) {
          // Detect which dungeon type we're in
          // The entity should have DUNGEON_TYPE_CID or we can infer from the enemy types
          const entity = dungeonState.data.entity;
          
          // Try to detect dungeon type from entity data
          if (entity?.DUNGEON_TYPE_CID) {
            this.currentDungeonType = entity.DUNGEON_TYPE_CID;
            this.decisionEngine.setDungeonType(this.currentDungeonType);
          } else if (dungeonState.data.run?.runEntityId) {
            // Try to infer from run ID - Underhaul runs might have different ID patterns
            const runId = dungeonState.data.run.runEntityId;
            // Log the run ID to help us understand the pattern
            console.log(`Active run ID: ${runId}`);
            
            // For now, check if we can get dungeon type from the run structure
            // The actual logic will depend on how the API structures the data
            if (dungeonState.data.run.dungeonType) {
              this.currentDungeonType = dungeonState.data.run.dungeonType;
              this.decisionEngine.setDungeonType(this.currentDungeonType);
            } else {
              // Keep current dungeon type as fallback
              console.log(`Warning: Could not detect dungeon type from active run. Using default: ${this.currentDungeonType}`);
            }
          }
          
          if (!config.minimalOutput) {
            const dungeonName = this.currentDungeonType === 1 ? 'Dungetron 5000' : 'Underhaul';
            console.log(`Already in an active ${dungeonName} dungeon - will continue playing`);
            if (dungeonState.data.run.lootPhase) {
              console.log('(Currently in loot phase)');
            }
          }
          return 'continue_existing';
        }
      } catch (error) {
        // If we get a 401, the token is invalid for game endpoints
        if (error.response?.status === 401) {
          console.error('Token is invalid for game endpoints (401)');
          throw error; // Re-throw to be handled by the caller
        }
        // For other errors, log but continue
        console.error('Error checking dungeon state:', error.message);
      }
      
      // ONLY check energy if NOT in an active dungeon
      const energyData = await getDirectEnergy(this.walletAddress || config.walletAddress);
      const energy = energyData?.entities?.[0]?.parsedData?.energyValue || 0;
      const isJuiced = energyData?.entities?.[0]?.parsedData?.isPlayerJuiced || false;
      
      // Check if we have enough energy to start a NEW dungeon
      if (energy < config.energyThreshold) {
        if (!config.minimalOutput) {
          console.log(`Not enough energy to start new dungeon: ${energy}/${config.energyThreshold}`);
        }
        return false;
      }
      
      // Check daily runs limit
      try {
        const api = axios.create({
          baseURL: 'https://gigaverse.io/api',
          headers: {
            'Authorization': `Bearer ${config.jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        const todayResponse = await api.get('/game/dungeon/today');
        const todayData = todayResponse.data;
        
        // Check Underhaul first (ID 3) - PRIMARY GAME MODE
        const underhaulProgress = todayData?.dayProgressEntities?.find(e => e.ID_CID === "3");
        const underhaulInfo = todayData?.dungeonDataEntities?.find(d => d.ID_CID === 3);
        
        if (underhaulInfo) {
          const underhaulRunsToday = underhaulProgress?.UINT256_CID || 0;
          const underhaulMaxRuns = 9; // Underhaul always has 9 attempts
          
          if (underhaulRunsToday < underhaulMaxRuns) {
            console.log(`Dungetron Underhaul runs today: ${underhaulRunsToday}/${underhaulMaxRuns}`);
            this.currentDungeonType = 3; // Use Underhaul
            this.decisionEngine.setDungeonType(this.currentDungeonType);
            return true;
          } else {
            console.log(`⚠️  Dungetron Underhaul daily limit reached: ${underhaulRunsToday}/${underhaulMaxRuns}`);
          }
        }
        
        // Check if we should try Dungetron 5000 when Underhaul is full
        if (config.autoSwitchToDungetron) {
          // Check Dungetron 5000 if Underhaul is full (ID 1)
          const dungetron5000Progress = todayData?.dayProgressEntities?.find(e => e.ID_CID === "1");
          const dungetron5000Info = todayData?.dungeonDataEntities?.find(d => d.ID_CID === 1);
          
          if (dungetron5000Progress && dungetron5000Info) {
            const runsToday = dungetron5000Progress.UINT256_CID || 0;
            const maxRuns = isJuiced ? dungetron5000Info.juicedMaxRunsPerDay : dungetron5000Info.UINT256_CID;
            
            if (runsToday < maxRuns) {
              console.log(`✅ Switching to Dungetron 5000: ${runsToday}/${maxRuns} runs today`);
              this.currentDungeonType = 1; // Switch to Dungetron 5000
              this.decisionEngine.setDungeonType(this.currentDungeonType);
              return true;
            } else {
              console.log(`⚠️  Dungetron 5000 also at daily limit: ${runsToday}/${maxRuns}`);
            }
          }
        } else {
          console.log('ℹ️  Auto-switch to Dungetron 5000 is disabled');
        }
        
        // Both dungeons are at their limits
        console.log(`\n🛑 Daily limits reached for all dungeon types.`);
        return 'daily_limit';
        
      } catch (error) {
        console.log('Could not check daily limits:', error.message);
        // Continue with default dungeon type if we can't check limits
        return true;
      }

      return true;
    } catch (error) {
      console.error('Error checking play eligibility:', error);
      
      // Re-throw 401 errors so they can be handled by the account manager
      if (error.response?.status === 401) {
        throw error;
      }
      
      return false;
    }
  }

  // Start a new dungeon run
  async startDungeon() {
    try {
      const dungeonName = this.currentDungeonType === 1 ? 'Dungetron 5000' : 'Dungetron Underhaul';
      const modeText = config.isJuiced ? ' (Juiced Mode)' : ' (Regular Mode)';
      if (!config.minimalOutput) {
        console.log(`Starting new ${dungeonName}${modeText} dungeon run...`);
      }
      
      // Get current inventory for consumables
      const inventoryResponse = await getDirectInventory();
      const inventory = inventoryResponse?.entities || [];
      const consumables = inventory.filter(item => 
        item.type === 'Consumable' && item.quantity > 0
      );

      // Get equipped gear IDs if starting Underhaul
      let gearInstanceIds = [];
      if (this.currentDungeonType === 3) {
        console.log('Fetching equipped gear for Underhaul...');
        gearInstanceIds = await getEquippedGearIds();
        console.log(`Found ${gearInstanceIds.length} equipped gear items: ${gearInstanceIds.join(', ')}`);
      }

      // Prepare dungeon start data
      const data = {
        // IMPORTANT: Underhaul doesn't use juiced mode parameter!
        isJuiced: config.isJuiced || false, // Always use config setting
        consumables: [], // Simplified for now
        itemId: 0, // No specific item
        index: 0,
        gearInstanceIds: gearInstanceIds // Pass equipped gear IDs for Underhaul
      };

      // Use correct API endpoint based on dungeon type
      let response;
      if (this.currentDungeonType === 3) {
        // Use Underhaul-specific endpoint
        response = await sendUnderhaulAction('start_run', data);
      } else {
        // Use regular dungeon endpoint
        response = await sendDirectAction('start_run', this.currentDungeonType, data);
      }
      
      if (response && response.success) {
        this.currentDungeon = response.data;
        if (!config.minimalOutput) {
          console.log('Dungeon started successfully!');
          const room = response.data.entity.ROOM_NUM_CID;
          const floor = Math.floor((room - 1) / 4) + 1;
          const roomInFloor = ((room - 1) % 4) + 1;
          console.log(`Floor ${floor}, Room ${roomInFloor}/4 (Total: ${room}/16)`);
        } else {
          console.log('\n=== NEW DUNGEON ===');
        }
        return true;
      } else {
        console.error('Failed to start dungeon:', response);
        
        // Check for specific error handling action error
        if (response?.message === 'Error handling action' || response?.data?.message === 'Error handling action') {
          console.log('\n⚠️  API rejected dungeon start');
          
          if (this.currentDungeonType === 3) {
            console.log('❗ Dungetron Underhaul is NOT UNLOCKED on this account!');
            console.log('   You need to reach checkpoint 2 in Dungetron 5000 first.');
            console.log('   The account has only completed basic runs, not enough for Underhaul.');
            
            // Check if we're trying to run Underhaul but it's not unlocked
            if (config.dungeonType === 3) {
              // DISABLED: Automatic fallback to dungeon 1
              console.log('\n   ❌ Underhaul start failed. NOT falling back to Dungetron 5000.');
              console.log('   To start Underhaul, you must do it manually in the browser.');
              // Don't retry - just fail
              return false;
            }
          } else {
            console.log('   Possible cooldown, daily limit, or state issue');
          }
          
          console.log('Will wait before trying again...');
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error starting dungeon:', error);
      
      // Check if this is an Underhaul unlock error
      if (error.response?.status === 400 && 
          error.response?.data?.message === 'Error handling action' &&
          this.currentDungeonType === 3) {
        console.log('\n⚠️  API rejected Underhaul start');
        console.log('❗ Dungetron Underhaul may not be unlocked on this account!');
        console.log('   You need to reach checkpoint 2 in Dungetron 5000 first.');
        
        // DISABLED: Automatic fallback to dungeon 1
        console.log('\n   ❌ Underhaul start failed. NOT falling back to Dungetron 5000.');
        console.log('   The API blocks Underhaul starts. Start it manually in browser.');
        // Don't retry - just fail
        return false;
      }
      
      return false;
    }
  }

  // Play a single turn in the dungeon
  async playTurn() {
    try {
      // Get current dungeon state
      const dungeonStateResponse = await getDirectDungeonState();
      
      if (!dungeonStateResponse?.data?.run) {
        console.log('No active dungeon found');
        return null;
      }

      const run = dungeonStateResponse.data.run;
      const entity = dungeonStateResponse.data.entity;
      
      // Double-check we have the right dungeon type set
      if (entity?.DUNGEON_TYPE_CID && entity.DUNGEON_TYPE_CID !== this.currentDungeonType) {
        console.log(`Dungeon type mismatch detected! Updating from ${this.currentDungeonType} to ${entity.DUNGEON_TYPE_CID}`);
        this.currentDungeonType = entity.DUNGEON_TYPE_CID;
        this.decisionEngine.setDungeonType(this.currentDungeonType);
      }
      
      const player = run.players[0];
      
      if (run.lootPhase) {
        console.log('Dungeon is in loot phase');
        return await this.handleLootPhase(run);
      }

      // Extract game state from the run data
      // player already declared above
      const enemy = run.players[1];
      const enemyId = entity.ENEMY_CID;
      const room = entity.ROOM_NUM_CID;
      // Room structure may vary by dungeon type
      const totalRooms = this.currentDungeonType === 1 ? 16 : 16; // Both have 16 rooms (4 floors × 4 rooms)
      const floor = Math.floor((room - 1) / 4) + 1;
      const roomInFloor = ((room - 1) % 4) + 1;
      // Count turns based on total charges used (handle negative charges)
      const rockUsed = Math.max(0, 3 - Math.max(0, player.rock.currentCharges));
      const paperUsed = Math.max(0, 3 - Math.max(0, player.paper.currentCharges));
      const scissorUsed = Math.max(0, 3 - Math.max(0, player.scissor.currentCharges));
      const totalChargesUsed = rockUsed + paperUsed + scissorUsed;
      const turn = totalChargesUsed + 1;
      const playerHealth = player.health.current;
      const enemyHealth = enemy.health.current;
      
      // Minimal output for statistics focus
      if (!config.minimalOutput) {
        console.log(`\n--- Floor ${floor}, Room ${roomInFloor}/4 (Total: ${room}/${totalRooms}), Turn ${turn} ---`);
        console.log(`Enemy: ${enemyId}`);
        console.log(`Player: HP ${playerHealth}/${player.health.currentMax} | Shield ${player.shield.current}/${player.shield.currentMax}`);
        console.log(`Enemy: HP ${enemyHealth}/${enemy.health.currentMax} | Shield ${enemy.shield.current}/${enemy.shield.currentMax}`);
      }
      
      // Check if enemy is already dead (shouldn't happen but API might be in weird state)
      if (enemyHealth <= 0) {
        if (!config.minimalOutput) {
          console.log('⚠️  Enemy is already dead! This is likely a game state issue.');
          console.log('The game should have transitioned to loot phase or next room.');
        }
        return 'continue'; // Let the main loop handle the transition
      }
      
      // Show weapon stats only in verbose mode
      if (!config.minimalOutput) {
        console.log(`\nWeapon Stats:`);
        console.log(`  Rock: ${player.rock.currentATK} ATK / ${player.rock.currentDEF} DEF (${player.rock.currentCharges}/${player.rock.maxCharges} charges)`);
        console.log(`  Paper: ${player.paper.currentATK} ATK / ${player.paper.currentDEF} DEF (${player.paper.currentCharges}/${player.paper.maxCharges} charges)`);
        console.log(`  Scissors: ${player.scissor.currentATK} ATK / ${player.scissor.currentDEF} DEF (${player.scissor.currentCharges}/${player.scissor.maxCharges} charges)`);
      }

      // Check for invalid charges and warn
      let hasNegativeCharges = false;
      if (player.rock.currentCharges < 0) {
        if (!config.minimalOutput) {
          console.warn(`⚠️  WARNING: Rock has negative charges (${player.rock.currentCharges})`);
        }
        hasNegativeCharges = true;
      }
      if (player.paper.currentCharges < 0) {
        if (!config.minimalOutput) {
          console.warn(`⚠️  WARNING: Paper has negative charges (${player.paper.currentCharges})`);
        }
        hasNegativeCharges = true;
      }
      if (player.scissor.currentCharges < 0) {
        if (!config.minimalOutput) {
          console.warn(`⚠️  WARNING: Scissors has negative charges (${player.scissor.currentCharges})`);
        }
        hasNegativeCharges = true;
      }
      
      if (hasNegativeCharges && !config.minimalOutput) {
        console.warn('This is a known game API bug. Continuing with valid weapons...');
      }

      // Make decision using our engine - but ensure we only pick weapons with charges
      const availableWeapons = [];
      // In Underhaul: negative charges = recharging (can't use), 0+ = can use
      const isUnderhaul = this.currentDungeonType === 3;
      if (isUnderhaul) {
        if (player.rock.currentCharges >= 0) availableWeapons.push('rock');
        if (player.paper.currentCharges >= 0) availableWeapons.push('paper'); 
        if (player.scissor.currentCharges >= 0) availableWeapons.push('scissor');
      } else {
        // Dungetron 5000: only positive charges can be used
        if (player.rock.currentCharges > 0) availableWeapons.push('rock');
        if (player.paper.currentCharges > 0) availableWeapons.push('paper'); 
        if (player.scissor.currentCharges > 0) availableWeapons.push('scissor');
      }
      
      if (availableWeapons.length === 0) {
        console.error('ERROR: No weapons have charges available!');
        return 'failed';
      }

      // Pass weapon charges to decision engine
      const weaponCharges = {
        rock: player.rock.currentCharges,
        paper: player.paper.currentCharges,
        scissor: player.scissor.currentCharges
      };
      
      // Prepare full stats for decision engine
      const playerStats = {
        health: playerHealth,
        maxHealth: player.health.currentMax,
        healthPercent: (playerHealth / player.health.currentMax) * 100,
        shield: player.shield.current,
        maxShield: player.shield.currentMax,
        shieldPercent: player.shield.currentMax > 0 ? (player.shield.current / player.shield.currentMax) * 100 : 0,
        weapons: {
          rock: { attack: player.rock.currentATK, defense: player.rock.currentDEF },
          paper: { attack: player.paper.currentATK, defense: player.paper.currentDEF },
          scissor: { attack: player.scissor.currentATK, defense: player.scissor.currentDEF }
        }
      };
      
      // Check if enemy has weapon charge data
      let enemyCharges = null;
      if (enemy.rock && enemy.paper && enemy.scissor) {
        // In Underhaul, negative charges (-1/3) mean the weapon is recharging
        // We need to preserve these negative values for proper tracking
        enemyCharges = {
          rock: enemy.rock.currentCharges ?? 0,
          paper: enemy.paper.currentCharges ?? 0,
          scissor: enemy.scissor.currentCharges ?? 0
        };
        
        // Log first time we see enemy charges
        if (!this.enemyChargesLogged) {
          console.log('✓ Enemy charge tracking available!');
          console.log(`  Enemy charges: Rock=${enemyCharges.rock}, Paper=${enemyCharges.paper}, Scissor=${enemyCharges.scissor}`);
          this.enemyChargesLogged = true;
        }
      }
      
      const enemyStatsFull = {
        health: enemyHealth,
        maxHealth: enemy.health.currentMax,
        healthPercent: (enemyHealth / enemy.health.currentMax) * 100,
        shield: enemy.shield.current,
        maxShield: enemy.shield.currentMax,
        shieldPercent: enemy.shield.currentMax > 0 ? (enemy.shield.current / enemy.shield.currentMax) * 100 : 0,
        charges: enemyCharges  // NEW: Include charge state
      };
      
      const action = await this.decisionEngine.makeDecision(
        enemyId,
        turn,
        playerHealth,
        enemyHealth,
        availableWeapons,
        weaponCharges,
        playerStats,
        enemyStatsFull
      );

      if (!config.minimalOutput) {
        console.log(`Available weapons with charges: ${availableWeapons.join(', ')}`);
        console.log(`Playing: ${action}`);
      }

      // Send action using direct API (bypassing SDK issues)
      let response;
      try {
        // Use correct API endpoint based on dungeon type
        const actionData = {
          consumables: [],
          itemId: 0,
          index: 0,
          isJuiced: false,
          gearInstanceIds: []
        };
        
        if (this.currentDungeonType === 3) {
          // Use Underhaul-specific endpoint
          response = await sendUnderhaulAction(action, actionData);
        } else {
          // Use regular dungeon endpoint
          response = await sendDirectAction(action, this.currentDungeonType, actionData);
        }
      } catch (error) {
        console.error('First attempt failed:', error.message);
        
        // If we had negative charges, the game state might be corrupted
        // Try to get fresh state and retry once
        if (hasNegativeCharges) {
          console.log('Negative charges detected earlier. Fetching fresh game state...');
          await sleep(1000);
          
          try {
            // Get fresh state
            const freshState = await getDirectDungeonState();
            if (freshState?.data?.run) {
              console.log('Retrying with fresh state...');
              const retryActionData = {
                consumables: [],
                itemId: 0,
                index: 0,
                isJuiced: false,
                gearInstanceIds: []
              };
              
              if (this.currentDungeonType === 3) {
                // Use Underhaul-specific endpoint for retry
                response = await sendUnderhaulAction(action, retryActionData);
              } else {
                // Use regular dungeon endpoint for retry
                response = await sendDirectAction(action, this.currentDungeonType, retryActionData);
              }
            } else {
              throw new Error('Could not get fresh game state');
            }
          } catch (retryError) {
            console.error('Retry also failed:', retryError.message);
            throw error; // Throw original error
          }
        } else {
          throw error;
        }
      }

      // Reset consecutive error counter on success
      this.consecutiveErrors = 0;

      if (response && response.data) {
        // Extract enemy action from the response events
        const enemyMove = response.data.run.players[1].lastMove;
        const newEnemyHealth = response.data.run.players[1].health.current;
        const newPlayerHealth = response.data.run.players[0].health.current;
        
        // Determine result based on the actions
        let result = 'draw';
        if (action === 'rock' && enemyMove === 'scissor') result = 'win';
        else if (action === 'scissor' && enemyMove === 'paper') result = 'win';
        else if (action === 'paper' && enemyMove === 'rock') result = 'win';
        else if (action === enemyMove) result = 'draw';
        else result = 'lose';
        
        // Record the result with full stats
        const weaponStats = {
          rock: { attack: player.rock.currentATK, defense: player.rock.currentDEF, charges: player.rock.currentCharges },
          paper: { attack: player.paper.currentATK, defense: player.paper.currentDEF, charges: player.paper.currentCharges },
          scissor: { attack: player.scissor.currentATK, defense: player.scissor.currentDEF, charges: player.scissor.currentCharges }
        };
        
        this.decisionEngine.recordTurn(
          enemyId,
          turn,
          action,
          enemyMove,
          result,
          playerStats,
          enemyStatsFull,
          weaponStats
        );

        // Minimal output: show only key stats
        if (config.minimalOutput) {
          // Format: Enemy Turn Player→Enemy Result
          console.log(`${enemyId} T${turn}: ${action}→${enemyMove} ${result}`);
        } else {
          // Log result
          console.log(`Enemy played: ${enemyMove} | Result: ${result}`);
          
          // Show new health/shield values
          const newPlayerShield = response.data.run.players[0].shield.current;
          const newEnemyShield = response.data.run.players[1].shield.current;
          
          console.log(`Player: HP ${newPlayerHealth} | Shield ${newPlayerShield}`);
          console.log(`Enemy: HP ${newEnemyHealth} | Shield ${newEnemyShield}`);
        }

        // Check if enemy is defeated
        if (newEnemyHealth <= 0) {
          if (!config.minimalOutput) {
            console.log('Enemy defeated!');
          }
          // The next API call should reveal if we're entering loot phase
          // Let's check the response for loot phase indicator
          if (response.data.run.lootPhase) {
            if (!config.minimalOutput) {
              console.log('Entering loot phase...');
            }
            return await this.handleLootPhase(response.data.run);
          } else if (entity.COMPLETE_CID) {
            if (!config.minimalOutput) {
              console.log('\n🎉 Dungeon completed successfully!');
            }
            return 'completed';
          } else {
            if (!config.minimalOutput) {
              console.log('Moving to next room...');
            }
            return 'next_room';
          }
        }
        
        // Check if player is defeated
        if (newPlayerHealth <= 0) {
          if (!config.minimalOutput) {
            console.log('\n💀 Dungeon failed!');
          }
          return 'failed';
        }

        return 'continue';
      }

      return null;
    } catch (error) {
      console.error('Error playing turn:', error);
      
      // Track consecutive errors
      this.consecutiveErrors++;
      console.log(`Consecutive errors: ${this.consecutiveErrors}`);
      
      // If we've had too many errors in a row, abandon this dungeon
      if (this.consecutiveErrors >= 3) {
        console.error('\n🚨 Too many consecutive errors (3+). Abandoning corrupted dungeon.\n');
        this.consecutiveErrors = 0;
        this.previousCharges = null;
        return 'corrupted';
      }
      
      return null;
    }
  }

  // Play through an entire dungeon
  async playDungeon() {
    if (this.isPlaying) {
      console.log('Already playing a dungeon');
      return 'wait';
    }

    this.isPlaying = true;
    
    // Reset error tracking for new dungeon session
    this.consecutiveErrors = 0;
    let finalStatus = 'wait'; // Default to wait

    try {
      // Check if we can play
      const canPlayResult = await this.canPlay();
      if (!canPlayResult) {
        return 'no_energy';  // Specific status for no energy
      }
      
      // Handle daily limit
      if (canPlayResult === 'daily_limit') {
        return 'daily_limit';
      }

      // If we're continuing an existing dungeon, skip starting a new one
      if (canPlayResult !== 'continue_existing') {
        // Start a new dungeon
        if (!(await this.startDungeon())) {
          return 'wait';
        }
      } else {
        console.log('Continuing existing dungeon...');
        // Make sure decision engine knows which dungeon type we're in
        this.decisionEngine.setDungeonType(this.currentDungeonType);
      }

      // Play through the dungeon continuously until completion or failure
      let continuePlay = true;
      let loopCount = 0;
      
      while (continuePlay) {
        loopCount++;
        console.log(`\n[Loop ${loopCount}] Playing turn...`);
        const result = await this.playTurn();
        console.log(`[Loop ${loopCount}] Turn result: ${result}`);
        
        if (!result) {
          console.log('Error during turn - stopping');
          continuePlay = false;
          finalStatus = 'wait';
        } else if (result === 'completed') {
          if (!config.minimalOutput) {
            console.log('Dungeon completed!');
          }
          continuePlay = false;
          finalStatus = 'wait'; // Wait after completion
        } else if (result === 'failed') {
          if (!config.minimalOutput) {
            console.log('Dungeon failed!');
          }
          continuePlay = false;
          finalStatus = 'wait'; // Wait after failure
        } else if (result === 'corrupted') {
          console.log('Game state corrupted - abandoning dungeon');
          continuePlay = false;
          finalStatus = 'wait'; // Wait and hope next dungeon works
        } else if (result === 'next_room') {
          console.log('Moving to next room - continuing immediately...');
          // Add a small delay before continuing to next room
          await sleep(2000);
          // Continue playing - continuePlay remains true
          console.log('Continuing to next room...');
        } else if (result === 'loot_phase') {
          console.log('More loot to select - continuing...');
          // Continue immediately for more loot
        } else if (result === 'continue') {
          // Need to continue playing next cycle
          continuePlay = false;
          finalStatus = 'continue_playing'; // Don't wait, continue immediately
        }
      }

      // Only log final stats if dungeon is actually done
      if (finalStatus === 'wait') {
        const stats = this.decisionEngine.getStatsSummary();
        if (!config.minimalOutput) {
          console.log('\nDungeon run session complete!');
          console.log('Stats:', stats);
        } else {
          // Minimal completion message
          const result = this.currentDungeon?.entity?.COMPLETE_CID ? 'WIN' : 'LOSS';
          console.log(`\n=== DUNGEON ${result} ===`);
        }
        finalStatus = 'completed';  // Change to 'completed' to distinguish from no energy
      }

      return finalStatus;

    } catch (error) {
      console.error('Error during dungeon play:', error);
      
      // Re-throw 401 errors so they can be handled by the account manager
      if (error.response?.status === 401) {
        throw error;
      }
      
      return 'wait';
    } finally {
      this.isPlaying = false;
    }
  }

  // Handle loot phase
  async handleLootPhase(run) {
    try {
      const lootOptions = run.lootOptions || [];
      if (!config.minimalOutput) {
        console.log(`\n🎁 LOOT PHASE - ${lootOptions.length} upgrade options:`);
      }
      
      // Display all loot options
      lootOptions.forEach((option, index) => {
        const actionMap = {
          'loot_one': 1,
          'loot_two': 2, 
          'loot_three': 3,
          'loot_four': 4
        };
        
        console.log(`\nOption ${index + 1}: ${option.boonTypeString}`);
        console.log(`  Rarity: ${['Common', 'Uncommon', 'Rare', 'Epic'][option.RARITY_CID] || 'Unknown'}`);
        
        // Decode upgrade type
        switch(option.boonTypeString) {
          case 'UpgradeRock':
            console.log(`  Effect: +${option.selectedVal1} Rock ATK, +${option.selectedVal2} Rock DEF`);
            break;
          case 'UpgradePaper':
            console.log(`  Effect: +${option.selectedVal1} Paper ATK, +${option.selectedVal2} Paper DEF`);
            break;
          case 'UpgradeScissor':
            console.log(`  Effect: +${option.selectedVal1} Scissors ATK, +${option.selectedVal2} Scissors DEF`);
            break;
          case 'AddMaxHealth':
            console.log(`  Effect: +${option.selectedVal1} Max Health`);
            break;
          case 'AddMaxArmor':
            console.log(`  Effect: +${option.selectedVal1} Max Shield`);
            break;
          case 'Heal':
            console.log(`  Effect: Heal ${option.selectedVal1} HP`);
            break;
          default:
            console.log(`  Effect: ${JSON.stringify(option.UINT256_CID_array)}`);
        }
      });
      
      // Calculate scores for each upgrade option
      const upgradeScores = lootOptions.map((option, index) => {
        let score = 0;
        let weight = 1.0;
        
        // Get current player health percentage
        const player = run.players[0];
        const healthPercent = player.health.current / player.health.currentMax;
        
        switch(option.boonTypeString) {
          case 'AddMaxArmor':
            weight = config.upgradeWeights.maxArmor;
            score = option.selectedVal1 * weight;
            break;
            
          case 'UpgradeRock':
          case 'UpgradePaper':
          case 'UpgradeScissor':
            // Attack upgrades weighted at 1.1, defense at 1.0
            const attackValue = option.selectedVal1 || 0;
            const defenseValue = option.selectedVal2 || 0;
            score = (attackValue * config.upgradeWeights.attack) + (defenseValue * config.upgradeWeights.defense);
            break;
            
          case 'AddMaxHealth':
            weight = config.upgradeWeights.maxHealth;
            score = option.selectedVal1 * weight;
            break;
            
          case 'Heal':
            // Only consider healing if below threshold (30%)
            if (healthPercent < config.upgradeWeights.healThreshold) {
              // Give heal a high priority when low health, but don't multiply
              score = 100; // High fixed score to prioritize healing when needed
            } else {
              score = 0; // Don't pick heal when healthy
            }
            break;
            
          default:
            // Unknown upgrade type, give it a base score
            score = (option.selectedVal1 || 0) + (option.selectedVal2 || 0);
        }
        
        return { index, score, option };
      });
      
      // Sort by score and pick the highest
      upgradeScores.sort((a, b) => b.score - a.score);
      const bestUpgrade = upgradeScores[0];
      
      console.log('\nUpgrade scores:');
      upgradeScores.forEach(({ index, score, option }) => {
        console.log(`  Option ${index + 1} (${option.boonTypeString}): ${score.toFixed(2)}`);
      });
      
      const selectedIndex = bestUpgrade.index;
      const lootAction = ['loot_one', 'loot_two', 'loot_three', 'loot_four'][selectedIndex];
      const selectedOption = bestUpgrade.option;
      
      if (config.minimalOutput) {
        console.log(`Loot: ${selectedOption.boonTypeString}`);
      } else {
        console.log(`\n➡️  Selecting Option ${selectedIndex + 1}: ${selectedOption.boonTypeString} (Best score: ${bestUpgrade.score.toFixed(2)})`);
        console.log(`  (Array index ${selectedIndex} -> action ${lootAction})`);
      }
      
      // Send loot selection using direct API
      console.log(`\nSending loot action: ${lootAction}`);
      let response;
      try {
        // Use correct API endpoint based on dungeon type
        if (this.currentDungeonType === 3) {
          // Use Underhaul-specific endpoint for loot
          response = await sendUnderhaulLootAction(lootAction);
        } else {
          // Use regular dungeon endpoint for loot
          response = await sendDirectLootAction(lootAction, this.currentDungeonType);
        }
      } catch (error) {
        console.error('Loot selection error:', error.message);
        throw error;
      }
      
      if (response && response.success) {
        console.log('✅ Upgrade selected!');
        console.log('Response message:', response.message);
        
        // Show player stats after upgrade
        if (response.data?.run?.players?.[0]) {
          const player = response.data.run.players[0];
          console.log('\nPlayer stats after upgrade:');
          console.log(`  Rock: ${player.rock.currentATK} ATK / ${player.rock.currentDEF} DEF`);
          console.log(`  Paper: ${player.paper.currentATK} ATK / ${player.paper.currentDEF} DEF`);
          console.log(`  Scissors: ${player.scissor.currentATK} ATK / ${player.scissor.currentDEF} DEF`);
          console.log(`  Health: ${player.health.current}/${player.health.currentMax}`);
          console.log(`  Shield: ${player.shield.current}/${player.shield.currentMax}`);
        }
        
        // Check new game state after loot selection
        if (response.data?.run?.lootPhase) {
          console.log('Still in loot phase - more upgrades to choose');
          return 'loot_phase';
        } else if (response.data?.entity?.COMPLETE_CID) {
          console.log('Dungeon completed after loot!');
          return 'completed';
        } else {
          console.log('Moving to next room after loot selection');
          console.log(`New room: ${response.data?.entity?.ROOM_NUM_CID || 'unknown'}`);
          return 'next_room';
        }
      } else {
        console.error('Failed to select loot:', response);
        return null;
      }
    } catch (error) {
      console.error('Error handling loot phase:', error);
      return null;
    }
  }

  // Get current status
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      stats: this.decisionEngine.getStatsSummary()
    };
  }
}