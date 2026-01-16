// Mystery Hunt Spoiler Hider - Content Script

let config = {
  enabled: true,
  domains: [],
  selectors: []
};

let hiddenElements = new Map(); // element -> overlay
let revealedElements = new Set(); // elements user has revealed (don't re-hide)

// Check if current domain matches any configured domain pattern
function isDomainMatch() {
  const currentHost = window.location.hostname;
  return config.domains.some(domain => {
    // Support wildcards like *.example.com
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1); // .example.com
      return currentHost.endsWith(suffix) || currentHost === domain.slice(2);
    }
    return currentHost === domain || currentHost.endsWith('.' + domain);
  });
}

// Create reveal overlay for a hidden element
function createOverlay(element) {
  const overlay = document.createElement('div');
  overlay.className = 'mhsh-overlay';
  
  const button = document.createElement('button');
  button.className = 'mhsh-reveal-btn';
  button.textContent = 'Reveal';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    revealElement(element);
  });
  
  overlay.appendChild(button);
  return overlay;
}

// Hide an element and add overlay
function hideElement(element) {
  if (hiddenElements.has(element)) return;
  if (revealedElements.has(element)) return; // User already revealed this
  if (element.closest('.mhsh-overlay')) return; // Don't hide our own overlays
  
  // Store original styles
  element.dataset.mhshOriginalPosition = element.style.position || '';
  
  const computedStyle = window.getComputedStyle(element);
  
  // Create wrapper if element isn't already relatively positioned
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  
  // Hide content but maintain layout
  element.classList.add('mhsh-hidden');
  
  // Create and position overlay
  const overlay = createOverlay(element);
  element.appendChild(overlay);
  
  hiddenElements.set(element, overlay);
}

// Reveal a hidden element (permanently until page reload)
function revealElement(element) {
  const overlay = hiddenElements.get(element);
  if (overlay) {
    overlay.remove();
  }
  element.classList.remove('mhsh-hidden');
  element.style.position = element.dataset.mhshOriginalPosition || '';
  hiddenElements.delete(element);
  revealedElements.add(element); // Remember this was revealed
}

// Re-hide a revealed element
function rehideElement(element) {
  hideElement(element);
}

// Process all elements matching current selectors
function processElements() {
  if (!config.enabled || !isDomainMatch()) {
    // Remove all overlays if disabled or wrong domain
    hiddenElements.forEach((overlay, element) => {
      revealElement(element);
    });
    return;
  }
  
  const selectorString = config.selectors.join(', ');
  if (!selectorString) return;
  
  try {
    const elements = document.querySelectorAll(selectorString);
    elements.forEach(el => hideElement(el));
  } catch (e) {
    console.warn('MHSH: Invalid selector', e);
  }
}

// Set up MutationObserver for dynamic content
let observer = null;
function setupObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    if (!config.enabled || !isDomainMatch()) return;
    
    // Debounce processing
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

// Reveal all elements (for toggle)
function revealAll() {
  hiddenElements.forEach((overlay, element) => {
    revealElement(element);
  });
}

// Clear revealed set (allow re-hiding)
function resetRevealed() {
  revealedElements.clear();
}

// Re-hide all (re-process)
function hideAll() {
  processElements();
}

// Inject early-hide CSS to prevent flash of spoilers
function injectEarlyHideCSS() {
  if (!config.enabled || !isDomainMatch() || config.selectors.length === 0) return;
  
  const style = document.createElement('style');
  style.id = 'mhsh-early-hide';
  style.textContent = config.selectors.map(s => {
    try {
      document.querySelector(s); // validate selector
      return `${s} { visibility: hidden !important; }`;
    } catch (e) {
      return '';
    }
  }).join('\n');
  
  (document.head || document.documentElement).appendChild(style);
}

// Remove early-hide CSS (elements now have proper overlays)
function removeEarlyHideCSS() {
  const style = document.getElementById('mhsh-early-hide');
  if (style) style.remove();
}

// Load config and initialize
function init() {
  chrome.storage.local.get(['enabled', 'domains', 'selectors'], (result) => {
    config.enabled = result.enabled !== false; // default true
    config.domains = result.domains || [];
    config.selectors = result.selectors || [];
    
    // Inject CSS immediately to hide spoilers before they render
    injectEarlyHideCSS();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        processElements();
        removeEarlyHideCSS();
        setupObserver();
      });
    } else {
      processElements();
      removeEarlyHideCSS();
      setupObserver();
    }
  });
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
  
  // Re-process: first reveal all, then re-hide with new config
  revealAll();
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

init();
