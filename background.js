// Mystery Hunt Spoiler Hider - Background Service Worker

// Initialize default config on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['domains', 'selectors', 'enabled'], (result) => {
    // Only set defaults if not already configured
    const updates = {};
    
    if (result.enabled === undefined) {
      updates.enabled = true;
    }
    if (result.domains === undefined) {
      updates.domains = [];
    }
    if (result.selectors === undefined) {
      updates.selectors = [];
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// Log extension activity for debugging
console.log('Mystery Hunt Spoiler Hider background script loaded');
