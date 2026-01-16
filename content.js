// Mystery Hunt Spoiler Hider - Content Script

let config = {
  enabled: true,
  domains: [],
  selectors: []
};

let hiddenElements = new Map(); // element -> overlay

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
  if (element.closest('.mhsh-overlay')) return; // Don't hide our own overlays
  
  // Store original styles
  element.dataset.mhshOriginalVisibility = element.style.visibility || '';
  element.dataset.mhshOriginalPosition = element.style.position || '';
  
  // Create wrapper if element isn't already relatively positioned
  const computedStyle = window.getComputedStyle(element);
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

// Reveal a hidden element
function revealElement(element) {
  const overlay = hiddenElements.get(element);
  if (overlay) {
    overlay.remove();
    element.classList.remove('mhsh-hidden');
    element.style.visibility = element.dataset.mhshOriginalVisibility || '';
    element.style.position = element.dataset.mhshOriginalPosition || '';
    hiddenElements.delete(element);
  }
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

// Re-hide all (re-process)
function hideAll() {
  processElements();
}

// Load config and initialize
function init() {
  chrome.storage.local.get(['enabled', 'domains', 'selectors'], (result) => {
    config.enabled = result.enabled !== false; // default true
    config.domains = result.domains || [];
    config.selectors = result.selectors || [];
    
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
