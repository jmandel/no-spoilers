// No Spoilers - Background Service Worker

// Default configuration for MIT Mystery Hunt 2025
const DEFAULT_DOMAINS = [
  'puzzmon.world',
  '*.puzzmon.world'
];

const DEFAULT_SELECTORS = [
  '[class*="copy-ribbon"] button',
  '#guess-history tr td:nth-child(1)'
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
