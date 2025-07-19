// Utility functions

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function calculateEnergyRegenTime(currentEnergy, targetEnergy, regenRate) {
  const energyNeeded = targetEnergy - currentEnergy;
  if (energyNeeded <= 0) return 0;
  
  const secondsNeeded = energyNeeded / regenRate;
  return secondsNeeded * 1000; // Return in milliseconds
}