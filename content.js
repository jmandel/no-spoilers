// No Spoilers - Content Script

// Hardcoded defaults for immediate injection (before async storage load)
const DEFAULT_DOMAINS = ['puzzmon.world', '*.puzzmon.world'];
const DEFAULT_SELECTORS = [
  '[class*="copy-ribbon"] button',
  '#guess-history tr td:nth-child(1)',
  '.ml-2'
];

// Check domain match synchronously
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

// IMMEDIATE: Inject early-hide CSS before page renders
(function() {
  if (!checkDomainMatch(DEFAULT_DOMAINS)) return;
  
  const style = document.createElement('style');
  style.id = 'mhsh-early-hide';
  style.textContent = DEFAULT_SELECTORS.map(s => 
    `${s} { opacity: 0 !important; }`
  ).join('\n');
  
  // Inject into documentElement (exists even before head/body)
  document.documentElement.appendChild(style);
})();

// === Main extension logic (runs after DOM ready) ===

let config = {
  enabled: true,
  domains: DEFAULT_DOMAINS,
  selectors: DEFAULT_SELECTORS
};

let hiddenElements = new Map();
let revealedElements = new Set();

function isDomainMatch() {
  return checkDomainMatch(config.domains);
}

function createOverlay(element) {
  const overlay = document.createElement('div');
  overlay.className = 'mhsh-overlay';
  
  const button = document.createElement('button');
  button.className = 'mhsh-reveal-btn';
  button.textContent = 'Reveal';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    revealElement(element);
  });
  
  overlay.appendChild(button);
  return overlay;
}

function hideElement(element) {
  if (hiddenElements.has(element)) return;
  if (revealedElements.has(element)) return;
  if (element.closest('.mhsh-overlay')) return;
  
  element.dataset.mhshOriginalPosition = element.style.position || '';
  
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  
  element.classList.add('mhsh-spoiler');
  
  const overlay = createOverlay(element);
  element.appendChild(overlay);
  
  hiddenElements.set(element, overlay);
}

function revealElement(element) {
  const overlay = hiddenElements.get(element);
  if (overlay) {
    overlay.remove();
  }
  element.classList.remove('mhsh-spoiler');
  element.classList.add('mhsh-revealed'); // Override early-hide.css
  element.style.position = element.dataset.mhshOriginalPosition || '';
  hiddenElements.delete(element);
  revealedElements.add(element);
}

function processElements() {
  // Remove early-hide CSS now that we're taking over
  const earlyStyle = document.getElementById('mhsh-early-hide');
  if (earlyStyle) earlyStyle.remove();
  
  if (!config.enabled || !isDomainMatch()) {
    hiddenElements.forEach((overlay, element) => {
      revealElement(element);
    });
    return;
  }
  
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
  hiddenElements.forEach((overlay, element) => {
    revealElement(element);
  });
}

function resetRevealed() {
  revealedElements.clear();
}

function hideAll() {
  processElements();
}

// MutationObserver for dynamic content
let observer = null;
function setupObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    if (!config.enabled || !isDomainMatch()) return;
    
    clearTimeout(observer.timeout);
    observer.timeout = setTimeout(() => {
      processElements();
    }, 100);
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

// Update dynamic hide CSS when selectors change
function updateDynamicHideCSS() {
  let style = document.getElementById('mhsh-dynamic-hide');
  
  if (!config.enabled || !isDomainMatch()) {
    if (style) style.remove();
    return;
  }
  
  const selectors = getEnabledSelectors(config.selectors);
  if (selectors.length === 0) {
    if (style) style.remove();
    return;
  }
  
  if (!style) {
    style = document.createElement('style');
    style.id = 'mhsh-dynamic-hide';
    document.head.appendChild(style);
  }
  
  // Hide all matching elements until JS processes them
  style.textContent = selectors.map(s => 
    `${s}:not(.mhsh-spoiler):not(.mhsh-revealed) { opacity: 0 !important; }`
  ).join('\n');
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
  
  // Update CSS immediately for new selectors
  updateDynamicHideCSS();
  
  revealAll();
  revealedElements.clear();
  processElements();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'revealAll') {
    revealAll();
    sendResponse({ success: true });
  } else if (message.action === 'hideAll') {
    resetRevealed();
    hideAll();
    sendResponse({ success: true });
  } else if (message.action === 'getStatus') {
    sendResponse({
      isMatch: isDomainMatch(),
      hiddenCount: hiddenElements.size,
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
    
    // Inject dynamic CSS for user selectors
    updateDynamicHideCSS();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        processElements();
        setupObserver();
      });
    } else {
      processElements();
      setupObserver();
    }
  });
}

init();
