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

function render(filters) {
  list.innerHTML = '';
  emptyMsg.style.display = filters.length === 0 ? 'block' : 'none';

  filters.forEach((f, i) => {
    const li = document.createElement('li');

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.innerHTML = `<b>${f.domain || '*'}</b> — <code>${escapeHtml(f.selector)}</code> → ${f.action}`;

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
    enabled: true,
  });
  await saveFilters(filters);
  form.reset();
  render(filters);
});

getFilters().then(render);
