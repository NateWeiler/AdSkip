// content.js
// Content scripts can't run Python directly, so this injects the PyScript
// runtime (CSS + JS core) plus our Python logic file into the page.
//
// It also reads the user's custom filters from chrome.storage.sync, scopes
// them to the current domain, and exposes them to the page as
// window.__adSkipperFilters so skipper.py can read them each scan cycle.

// --- Custom filters: load + inject into page context ---

function filtersForThisDomain(filters) {
  const host = location.hostname;
  return filters.filter((f) => {
    if (!f.enabled) return false;
    if (!f.domain) return true; // no domain set = applies everywhere
    return host === f.domain || host.endsWith('.' + f.domain) || host.includes(f.domain);
  });
}

function injectFilters(filters) {
  // content.js and the page run in different JS worlds, so we can't just
  // set window.X from here — we inject a small script tag to bridge it.
  const script = document.createElement('script');
  script.textContent = `window.__adSkipperFilters = ${JSON.stringify(filters)};`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

async function syncFilters() {
  const { customFilters = [] } = await chrome.storage.sync.get('customFilters');
  injectFilters(filtersForThisDomain(customFilters));
}

// Initial load
syncFilters();

// Keep filters live if the user edits them in the popup while this tab is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.customFilters) {
    syncFilters();
  }
});

// --- PyScript runtime injection ---

// 1. PyScript CSS
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = 'https://pyscript.net/releases/2024.1.1/core.css';
document.head.appendChild(css);

// 2. PyScript Core JS module
const script = document.createElement('script');
script.type = 'module';
script.src = 'https://pyscript.net/releases/2024.1.1/core.js';
document.head.appendChild(script);

// 3. Our Python logic, loaded from the extension's own files
const pyScript = document.createElement('script');
pyScript.type = 'py';
pyScript.src = chrome.runtime.getURL('skipper.py');
document.body.appendChild(pyScript);
