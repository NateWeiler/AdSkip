// popup.js

const form = document.getElementById('filter-form');
const selectorInput = document.getElementById('selector');
const domainInput = document.getElementById('domain');
const actionSelect = document.getElementById('action');
const list = document.getElementById('filter-list');
const emptyMsg = document.getElementById('empty-msg');
const fillDomainBtn = document.getElementById('fill-domain');

async function getFilters() {
  const { customFilters = [] } = await chrome.storage.sync.get('customFilters');
  return customFilters;
}

async function saveFilters(filters) {
  await chrome.storage.sync.set({ customFilters: filters });
}

function actionLabel(f) {
  return f.action === 'remove' ? 'Exit/Close box' : 'Skip button';
}

function render(filters) {
  list.innerHTML = '';
  emptyMsg.style.display = filters.length === 0 ? 'block' : 'none';

  filters.forEach((f, i) => {
    const li = document.createElement('li');

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.innerHTML = `<b>${f.domain || '*'}</b> — <code>${escapeHtml(f.selector)}</code> → ${actionLabel(f)}`;

    const del = document.createElement('button');
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      const current = await getFilters();
      current.splice(i, 1);
      await saveFilters(current);
      render(current);
    });

    li.appendChild(meta);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

fillDomainBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try {
      domainInput.value = new URL(tab.url).hostname;
    } catch (e) {
      // ignore (e.g. chrome:// pages with no valid hostname)
    }
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selector = selectorInput.value.trim();
  if (!selector) return;

  const filters = await getFilters();
  filters.push({
    selector,
    domain: domainInput.value.trim(),
    action: actionSelect.value,
    type: actionSelect.value === 'remove' ? 'exit' : 'skip',
    enabled: true,
  });
  await saveFilters(filters);
  form.reset();
  render(filters);
});

getFilters().then(render);

// --- Element picker trigger ---
document.getElementById('start-picker').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKER' });
  } catch (e) {
    // Content script may not be injected on special pages (chrome://, store, etc.)
    console.error('Could not start picker on this tab:', e);
  }
  window.close(); // get the popup out of the way so the page is interactive
});

// --- Export filters for sharing back to Claude ---
const exportBtn = document.getElementById('export-filters');
const exportOutput = document.getElementById('export-output');
const copyBtn = document.getElementById('copy-export');

exportBtn.addEventListener('click', async () => {
  const filters = await getFilters();
  if (filters.length === 0) {
    exportOutput.value = '(no filters saved yet)';
  } else {
    const lines = filters.map((f) => {
      const domain = f.domain || '*';
      const label = actionLabel(f);
      return `${domain} | ${label} | ${f.selector}`;
    });
    exportOutput.value =
      'domain | type | selector\n' + '---\n' + lines.join('\n');
  }
  exportOutput.style.display = 'block';
  copyBtn.style.display = 'block';
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportOutput.value);
    copyBtn.textContent = 'Copied ✓';
  } catch (e) {
    // fallback for environments without clipboard permission
    exportOutput.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied ✓';
  }
  setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 1500);
});
