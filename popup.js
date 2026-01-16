// Mystery Hunt Spoiler Hider - Popup Script

let config = {
  enabled: true,
  domains: [],      // [{value: string, enabled: boolean}]
  selectors: []     // [{value: string, enabled: boolean}]
};

// Migrate old format (string[]) to new format ({value, enabled}[])
function migrateToNewFormat(arr) {
  if (!arr || arr.length === 0) return [];
  if (typeof arr[0] === 'string') {
    return arr.map(value => ({ value, enabled: true }));
  }
  return arr;
}

// Load config from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['enabled', 'domains', 'selectors'], (result) => {
      config.enabled = result.enabled !== false;
      config.domains = migrateToNewFormat(result.domains || []);
      config.selectors = migrateToNewFormat(result.selectors || []);
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
  
  const enabledCount = config.domains.filter(d => d.enabled).length;
  count.textContent = `${enabledCount}/${config.domains.length}`;
  
  if (config.domains.length === 0) {
    list.innerHTML = '<div class="empty-state">No domains configured</div>';
    return;
  }
  
  list.innerHTML = config.domains.map((domain, i) => `
    <div class="item ${domain.enabled ? '' : 'disabled'}">
      <button class="item-toggle" data-type="domain" data-index="${i}" title="${domain.enabled ? 'Disable' : 'Enable'}">${domain.enabled ? '✓' : '○'}</button>
      <span class="item-text" title="${domain.value}">${domain.value}</span>
      <button class="item-delete" data-type="domain" data-index="${i}">×</button>
    </div>
  `).join('');
}

// Render selector list
function renderSelectors() {
  const list = document.getElementById('selectorList');
  const count = document.getElementById('selectorCount');
  
  const enabledCount = config.selectors.filter(s => s.enabled).length;
  count.textContent = `${enabledCount}/${config.selectors.length}`;
  
  if (config.selectors.length === 0) {
    list.innerHTML = '<div class="empty-state">No selectors configured</div>';
    return;
  }
  
  list.innerHTML = config.selectors.map((selector, i) => `
    <div class="item ${selector.enabled ? '' : 'disabled'}">
      <button class="item-toggle" data-type="selector" data-index="${i}" title="${selector.enabled ? 'Disable' : 'Enable'}">${selector.enabled ? '✓' : '○'}</button>
      <span class="item-text" title="${selector.value}">${selector.value}</span>
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
  if (config.domains.some(d => d.value === value)) {
    input.value = '';
    return;
  }
  
  config.domains.push({ value, enabled: true });
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
  if (config.selectors.some(s => s.value === value)) {
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
  
  config.selectors.push({ value, enabled: true });
  await saveConfig();
  renderSelectors();
  input.value = '';
  
  setTimeout(updateStatus, 100);
}

// Toggle item
async function toggleItem(type, index) {
  if (type === 'domain') {
    config.domains[index].enabled = !config.domains[index].enabled;
    renderDomains();
  } else if (type === 'selector') {
    config.selectors[index].enabled = !config.selectors[index].enabled;
    renderSelectors();
  }
  
  await saveConfig();
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
  
  // Button delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('item-delete')) {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      deleteItem(type, index);
    } else if (e.target.classList.contains('item-toggle')) {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      toggleItem(type, index);
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
