// No Spoilers - Content Script
// Uses floating overlays to avoid modifying React's DOM

const DEFAULT_DOMAINS = ['puzzmon.world', '*.puzzmon.world'];
const DEFAULT_SELECTORS = [
  '[class*="copy-ribbon"] button',
  '#guess-history tr td:nth-child(1)',
  '.ml-2',
  '.font-mono.text-base.text-green-600'
];

// Hide page immediately on matching domains
(function() {
  const host = window.location.hostname;
  const dominated = DEFAULT_DOMAINS.some(d => {
    if (d.startsWith('*.')) {
      const suffix = d.slice(1);
      return host.endsWith(suffix) || host === d.slice(2);
    }
    return host === d || host.endsWith('.' + d);
  });
  if (dominated) {
    document.documentElement.classList.add('mhsh-loading');
  }
})();

// Check domain match
function checkDomainMatch(domains) {
  const currentHost = window.location.hostname;
  return domains.some(d => {
    const domain = typeof d === 'string' ? d : d.value;
    const enabled = typeof d === 'string' ? true : d.enabled;
    if (!enabled) return false;
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1);
      return currentHost.endsWith(suffix) || currentHost === domain.slice(2);
    }
    return currentHost === domain || currentHost.endsWith('.' + domain);
  });
}

// Get enabled selectors as strings
function getEnabledSelectors(selectors) {
  return selectors
    .filter(s => typeof s === 'string' ? true : s.enabled)
    .map(s => typeof s === 'string' ? s : s.value);
}

// === State ===
let config = {
  enabled: true,
  domains: DEFAULT_DOMAINS,
  selectors: DEFAULT_SELECTORS
};

let overlayContainer = null;
let overlays = new Map(); // element -> overlay div
let revealedElements = new Set(); // Store selectors of revealed elements, not the elements themselves

function isDomainMatch() {
  return checkDomainMatch(config.domains);
}

// Create the floating overlay container (outside React's DOM)
function ensureOverlayContainer() {
  if (overlayContainer && document.body.contains(overlayContainer)) return;
  
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'mhsh-overlay-container';
  overlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 999999; pointer-events: none;';
  document.body.appendChild(overlayContainer);
}

// Create floating overlay for an element
function createOverlay(element) {
  const overlay = document.createElement('div');
  overlay.className = 'mhsh-floating-overlay';
  overlay.style.cssText = 'position: fixed; display: flex; align-items: center; justify-content: center; background: #d0d0d0; border-radius: 4px; pointer-events: auto;';
  
  const button = document.createElement('button');
  button.className = 'mhsh-reveal-btn';
  button.textContent = 'Reveal';
  button.style.cssText = 'background: #1a1a1a; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 500; white-space: nowrap;';
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    revealElement(element);
  });
  
  button.addEventListener('mouseenter', () => { button.style.background = '#333'; });
  button.addEventListener('mouseleave', () => { button.style.background = '#1a1a1a'; });
  
  overlay.appendChild(button);
  return overlay;
}

// Position overlay to match element
function positionOverlay(element, overlay) {
  const rect = element.getBoundingClientRect();
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = Math.max(rect.width, 60) + 'px';
  overlay.style.height = Math.max(rect.height, 24) + 'px';
}

// Update all overlay positions
function updateOverlayPositions() {
  overlays.forEach((overlay, element) => {
    if (!document.body.contains(element)) {
      overlay.remove();
      overlays.delete(element);
      return;
    }
    positionOverlay(element, overlay);
  });
}

// Hide an element (just track it + add overlay)
function hideElement(element) {
  if (overlays.has(element)) return;
  if (revealedElements.has(element)) return;
  
  ensureOverlayContainer();
  
  const overlay = createOverlay(element);
  positionOverlay(element, overlay);
  overlayContainer.appendChild(overlay);
  overlays.set(element, overlay);
}

// Reveal an element
function revealElement(element) {
  const overlay = overlays.get(element);
  if (overlay) {
    overlay.remove();
    overlays.delete(element);
  }
  // Track by reference, don't touch the element at all
  revealedElements.add(element);
}

// No-op - we don't use dynamic CSS hiding anymore
// The overlay itself visually hides the content
function updateHideCSS() {}

// Process elements - find and hide matching ones
function processElements() {
  if (!config.enabled || !isDomainMatch()) {
    // Remove all overlays
    overlays.forEach((overlay) => overlay.remove());
    overlays.clear();
    updateHideCSS();
    return;
  }
  
  updateHideCSS();
  
  const enabledSelectors = getEnabledSelectors(config.selectors);
  if (enabledSelectors.length === 0) return;
  
  const selectorString = enabledSelectors.join(', ');
  
  try {
    const elements = document.querySelectorAll(selectorString);
    elements.forEach(el => hideElement(el));
  } catch (e) {
    console.warn('No Spoilers: Invalid selector', e);
  }
}

function revealAll() {
  overlays.forEach((overlay, element) => {
    overlay.remove();
    revealedElements.add(element);
  });
  overlays.clear();
}

function hideAll() {
  revealedElements.clear();
  processElements();
}

// MutationObserver for dynamic content - must be fast to avoid flicker
let observer = null;
function setupObserver() {
  if (observer) observer.disconnect();
  
  const selectors = getEnabledSelectors(config.selectors);
  const selectorString = selectors.length > 0 ? selectors.join(', ') : null;
  
  observer = new MutationObserver((mutations) => {
    if (!config.enabled || !isDomainMatch() || !selectorString) return;
    
    // Check new nodes immediately (no debounce) to prevent flicker
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue; // skip text nodes
        
        // Check if node itself matches
        if (node.matches && node.matches(selectorString)) {
          hideElement(node);
        }
        
        // Check descendants
        if (node.querySelectorAll) {
          const matches = node.querySelectorAll(selectorString);
          matches.forEach(el => hideElement(el));
        }
      }
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

// Update positions on scroll/resize
function setupPositionUpdates() {
  let ticking = false;
  const update = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateOverlayPositions();
        ticking = false;
      });
      ticking = true;
    }
  };
  
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

// Listen for config changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  
  if (changes.enabled !== undefined) {
    config.enabled = changes.enabled.newValue;
  }
  if (changes.domains !== undefined) {
    config.domains = changes.domains.newValue || [];
  }
  if (changes.selectors !== undefined) {
    config.selectors = changes.selectors.newValue || [];
  }
  
  // Clear and reprocess
  overlays.forEach((overlay) => overlay.remove());
  overlays.clear();
  revealedElements = new WeakSet();
  processElements();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'revealAll') {
    revealAll();
    sendResponse({ success: true });
  } else if (message.action === 'hideAll') {
    hideAll();
    sendResponse({ success: true });
  } else if (message.action === 'getStatus') {
    sendResponse({
      isMatch: isDomainMatch(),
      hiddenCount: overlays.size,
      currentHost: window.location.hostname
    });
  }
  return true;
});

// Initialize
function init() {
  chrome.storage.local.get(['enabled', 'domains', 'selectors'], (result) => {
    config.enabled = result.enabled !== false;
    config.domains = result.domains || DEFAULT_DOMAINS;
    config.selectors = result.selectors || DEFAULT_SELECTORS;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        processElements();
        setupObserver();
        setupPositionUpdates();
        document.documentElement.classList.remove('mhsh-loading');
      });
    } else {
      processElements();
      setupObserver();
      setupPositionUpdates();
      document.documentElement.classList.remove('mhsh-loading');
    }
  });
}

init();
