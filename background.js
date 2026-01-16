// No Spoilers - Background Service Worker

// Default configuration for MIT Mystery Hunt 2025
const DEFAULT_DOMAINS = [
  { value: 'puzzmon.world', enabled: true },
  { value: '*.puzzmon.world', enabled: true }
];

const DEFAULT_SELECTORS = [
  { value: '[class*="copy-ribbon"] button', enabled: true },
  { value: '#guess-history tr td:nth-child(1)', enabled: true }
];

// Initialize default config on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['domains', 'selectors', 'enabled'], (result) => {
    // Only set defaults if not already configured
    const updates = {};
    
    if (result.enabled === undefined) {
      updates.enabled = true;
    }
    if (result.domains === undefined) {
      updates.domains = DEFAULT_DOMAINS;
    }
    if (result.selectors === undefined) {
      updates.selectors = DEFAULT_SELECTORS;
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

console.log('No Spoilers background script loaded');
