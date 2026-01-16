// Mystery Hunt Spoiler Hider - Popup Script

let config = {
  enabled: true,
  domains: [],
  selectors: []
};

// Load config from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['enabled', 'domains', 'selectors'], (result) => {
      config.enabled = result.enabled !== false;
      config.domains = result.domains || [];
      config.selectors = result.selectors || [];
      resolve(config);
    });
  });
}

// Save config to storage
async function saveConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      enabled: config.enabled,
      domains: config.domains,
      selectors: config.selectors
    }, resolve);
  });
}

// Get status from content script
async function getStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
    return response;
  } catch (e) {
    return null;
  }
}

// Send action to content script
async function sendAction(action) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (e) {
    console.warn('Could not send action to content script', e);
  }
}

// Render domain list
function renderDomains() {
  const list = document.getElementById('domainList');
  const count = document.getElementById('domainCount');
  
  count.textContent = config.domains.length;
  
  if (config.domains.length === 0) {
    list.innerHTML = '<div class="empty-state">No domains configured</div>';
    return;
  }
  
  list.innerHTML = config.domains.map((domain, i) => `
    <div class="item">
      <span class="item-text" title="${domain}">${domain}</span>
      <button class="item-delete" data-type="domain" data-index="${i}">×</button>
    </div>
  `).join('');
}

// Render selector list
function renderSelectors() {
  const list = document.getElementById('selectorList');
  const count = document.getElementById('selectorCount');
  
  count.textContent = config.selectors.length;
  
  if (config.selectors.length === 0) {
    list.innerHTML = '<div class="empty-state">No selectors configured</div>';
    return;
  }
  
  list.innerHTML = config.selectors.map((selector, i) => `
    <div class="item">
      <span class="item-text" title="${selector}">${selector}</span>
      <button class="item-delete" data-type="selector" data-index="${i}">×</button>
    </div>
  `).join('');
}

// Update status display
async function updateStatus() {
  const matchEl = document.getElementById('domainMatch');
  const countEl = document.getElementById('hiddenCount');
  const domainEl = document.getElementById('currentDomain');
  
  const status = await getStatus();
  
  if (status) {
    matchEl.textContent = status.isMatch ? 'Yes ✓' : 'No';
    matchEl.className = 'status-value ' + (status.isMatch ? 'active' : 'inactive');
    countEl.textContent = status.hiddenCount;
    domainEl.textContent = `Current: ${status.currentHost}`;
  } else {
    matchEl.textContent = 'N/A';
    matchEl.className = 'status-value inactive';
    countEl.textContent = '-';
    domainEl.textContent = 'Cannot access page';
  }
}

// Add domain
async function addDomain() {
  const input = document.getElementById('domainInput');
  const value = input.value.trim();
  
  if (!value) return;
  if (config.domains.includes(value)) {
    input.value = '';
    return;
  }
  
  config.domains.push(value);
  await saveConfig();
  renderDomains();
  input.value = '';
  
  setTimeout(updateStatus, 100);
}

// Add selector
async function addSelector() {
  const input = document.getElementById('selectorInput');
  const value = input.value.trim();
  
  if (!value) return;
  if (config.selectors.includes(value)) {
    input.value = '';
    return;
  }
  
  // Validate selector
  try {
    document.querySelector(value);
  } catch (e) {
    alert('Invalid CSS selector: ' + value);
    return;
  }
  
  config.selectors.push(value);
  await saveConfig();
  renderSelectors();
  input.value = '';
  
  setTimeout(updateStatus, 100);
}

// Delete item
async function deleteItem(type, index) {
  if (type === 'domain') {
    config.domains.splice(index, 1);
    renderDomains();
  } else if (type === 'selector') {
    config.selectors.splice(index, 1);
    renderSelectors();
  }
  
  await saveConfig();
  setTimeout(updateStatus, 100);
}

// Initialize popup
async function init() {
  await loadConfig();
  
  // Set up toggle
  const toggle = document.getElementById('enabledToggle');
  toggle.checked = config.enabled;
  toggle.addEventListener('change', async () => {
    config.enabled = toggle.checked;
    await saveConfig();
    setTimeout(updateStatus, 100);
  });
  
  // Render lists
  renderDomains();
  renderSelectors();
  
  // Set up add buttons
  document.getElementById('addDomain').addEventListener('click', addDomain);
  document.getElementById('addSelector').addEventListener('click', addSelector);
  
  // Enter key support
  document.getElementById('domainInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomain();
  });
  document.getElementById('selectorInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSelector();
  });
  
  // Delete button delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('item-delete')) {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      deleteItem(type, index);
    }
  });
  
  // Action buttons
  document.getElementById('revealAll').addEventListener('click', () => sendAction('revealAll'));
  document.getElementById('hideAll').addEventListener('click', () => sendAction('hideAll'));
  
  // Update status
  updateStatus();
  
  // Refresh status periodically
  setInterval(updateStatus, 2000);
}

init();
