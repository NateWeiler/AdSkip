// picker.js
// Visual element picker: hover to highlight, right-click to choose what to
// do with an element, confirm before it's saved as a custom filter.

(function () {
  const UI_ID_PREFIX = 'adskipper-';
  let picking = false;
  let hoveredEl = null;

  // ---------- one-time style injection ----------
  function ensureStyles() {
    if (document.getElementById(UI_ID_PREFIX + 'styles')) return;
    const style = document.createElement('style');
    style.id = UI_ID_PREFIX + 'styles';
    style.textContent = `
      #${UI_ID_PREFIX}highlight-box {
        position: fixed; pointer-events: none; z-index: 2147483647;
        border: 2px solid #2563eb; background: rgba(37,99,235,0.15);
        display: none; box-sizing: border-box;
      }
      #${UI_ID_PREFIX}ctx-menu, #${UI_ID_PREFIX}confirm-panel {
        position: fixed; z-index: 2147483647; background: #fff; color: #111;
        border: 1px solid #d0d0d0; border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px; padding: 6px; width: 240px;
      }
      #${UI_ID_PREFIX}ctx-menu button, #${UI_ID_PREFIX}confirm-panel button {
        display: block; width: 100%; text-align: left; padding: 8px 10px;
        border: none; background: none; cursor: pointer; border-radius: 5px;
        font-size: 13px; color: #111;
      }
      #${UI_ID_PREFIX}ctx-menu button:hover { background: #f0f4ff; }
      #${UI_ID_PREFIX}confirm-panel label {
        display:block; font-size: 11px; color:#555; margin-top: 6px;
      }
      #${UI_ID_PREFIX}confirm-panel input {
        width: 100%; box-sizing: border-box; margin: 3px 0 6px; padding: 6px;
        font-size: 12px; border: 1px solid #ccc; border-radius: 4px;
      }
      #${UI_ID_PREFIX}confirm-panel .actions {
        display: flex; gap: 6px; margin-top: 8px;
      }
      #${UI_ID_PREFIX}confirm-panel .actions button {
        flex: 1; text-align: center; border: 1px solid #ccc;
      }
      #${UI_ID_PREFIX}confirm-panel .save-btn {
        background: #2563eb; color: white; border-color: #2563eb;
      }
      #${UI_ID_PREFIX}toast {
        position: fixed; bottom: 20px; right: 20px; background: #16a34a;
        color: white; padding: 10px 14px; border-radius: 6px;
        z-index: 2147483647; font-family: sans-serif; font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,.2);
      }
      #${UI_ID_PREFIX}banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        background: #111827; color: white; text-align: center;
        font-family: sans-serif; font-size: 12px; padding: 6px;
      }
      #${UI_ID_PREFIX}banner b { color: #93c5fd; }
    `;
    document.head.appendChild(style);
  }

  function isOwnUiElement(el) {
    return !!(el && el.closest && el.closest(`[id^="${UI_ID_PREFIX}"]`));
  }

  // ---------- highlight box ----------
  let highlightBox;
  function ensureHighlightBox() {
    if (highlightBox) return highlightBox;
    highlightBox = document.createElement('div');
    highlightBox.id = UI_ID_PREFIX + 'highlight-box';
    document.body.appendChild(highlightBox);
    return highlightBox;
  }

  function highlight(el) {
    const box = ensureHighlightBox();
    if (!el) {
      box.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  // ---------- selector generation ----------
  function getUniqueSelector(el) {
    if (el.id) {
      const sel = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    if (typeof el.className === 'string' && el.className.trim()) {
      const classes = el.className.trim().split(/\s+/).map((c) => CSS.escape(c));
      const sel = el.tagName.toLowerCase() + '.' + classes.join('.');
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    // fallback: build a path using nth-of-type up to a reasonably short chain
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && depth < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  // ---------- context menu ----------
  let ctxMenu;
  function showContextMenu(x, y, el) {
    closeContextMenu();
    ensureStyles();
    ctxMenu = document.createElement('div');
    ctxMenu.id = UI_ID_PREFIX + 'ctx-menu';
    ctxMenu.style.left = Math.min(x, window.innerWidth - 250) + 'px';
    ctxMenu.style.top = Math.min(y, window.innerHeight - 180) + 'px';
    ctxMenu.innerHTML = `
      <button data-action="remove">🚫 Remove / hide this element</button>
      <button data-action="click">👆 Click this (treat as skip/next)</button>
      <button data-action="reselect">↺ Choose a different element</button>
      <button data-action="exit">✕ Exit picker mode</button>
    `;
    document.body.appendChild(ctxMenu);

    ctxMenu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closeContextMenu();
        if (action === 'remove' || action === 'click') {
          showConfirmPanel(el, action, x, y);
        } else if (action === 'reselect') {
          // stay in picking mode, just keep hovering
        } else if (action === 'exit') {
          stopPicker();
        }
      });
    });
  }

  function closeContextMenu() {
    if (ctxMenu) {
      ctxMenu.remove();
      ctxMenu = null;
    }
  }

  // ---------- confirm panel ----------
  let confirmPanel;
  function showConfirmPanel(el, action, x, y) {
    closeConfirmPanel();
    ensureStyles();
    const selector = getUniqueSelector(el);
    const domain = location.hostname;

    confirmPanel = document.createElement('div');
    confirmPanel.id = UI_ID_PREFIX + 'confirm-panel';
    confirmPanel.style.left = Math.min(x, window.innerWidth - 260) + 'px';
    confirmPanel.style.top = Math.min(y, window.innerHeight - 220) + 'px';
    confirmPanel.innerHTML = `
      <div style="font-weight:600;">Add filter — ${action === 'remove' ? 'Remove/Hide' : 'Click'}</div>
      <label>CSS selector</label>
      <input id="${UI_ID_PREFIX}sel-input" value="${selector.replace(/"/g, '&quot;')}" />
      <label>Domain (blank = all sites)</label>
      <input id="${UI_ID_PREFIX}domain-input" value="${domain}" />
      <div class="actions">
        <button data-action="cancel">Not this one</button>
        <button data-action="save" class="save-btn">Add filter</button>
      </div>
    `;
    document.body.appendChild(confirmPanel);

    confirmPanel.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      closeConfirmPanel(); // back to picking mode, hover continues
    });
    confirmPanel.querySelector('[data-action="save"]').addEventListener('click', async () => {
      const sel = document.getElementById(UI_ID_PREFIX + 'sel-input').value.trim();
      const dom = document.getElementById(UI_ID_PREFIX + 'domain-input').value.trim();
      if (!sel) return;
      await saveFilter(sel, dom, action);
      closeConfirmPanel();
      showToast('Filter added ✓');
      stopPicker();
    });
  }

  function closeConfirmPanel() {
    if (confirmPanel) {
      confirmPanel.remove();
      confirmPanel = null;
    }
  }

  // ---------- storage ----------
  async function saveFilter(selector, domain, action) {
    const { customFilters = [] } = await chrome.storage.sync.get('customFilters');
    customFilters.push({ selector, domain, action, enabled: true });
    await chrome.storage.sync.set({ customFilters });
  }

  // ---------- toast ----------
  function showToast(text) {
    ensureStyles();
    const toast = document.createElement('div');
    toast.id = UI_ID_PREFIX + 'toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  // ---------- banner ----------
  let banner;
  function showBanner() {
    banner = document.createElement('div');
    banner.id = UI_ID_PREFIX + 'banner';
    banner.innerHTML = 'Ad-Skipper picker active — hover an element, then <b>right-click</b> it to choose an action. Press <b>Esc</b> to exit.';
    document.body.appendChild(banner);
  }
  function hideBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  // ---------- event handlers ----------
  function onMouseMove(e) {
    if (isOwnUiElement(e.target)) {
      highlight(null);
      return;
    }
    hoveredEl = e.target;
    highlight(hoveredEl);
  }

  function onContextMenu(e) {
    if (isOwnUiElement(e.target)) return; // let real right-clicks on our UI behave normally
    e.preventDefault();
    e.stopPropagation();
    if (hoveredEl) {
      showContextMenu(e.clientX, e.clientY, hoveredEl);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      stopPicker();
    }
  }

  function onClickCapture(e) {
    // Suppress accidental left-clicks on the page while picking (avoids
    // triggering the very ad/skip buttons you're trying to select)
    if (!isOwnUiElement(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ---------- start/stop ----------
  function startPicker() {
    if (picking) return;
    picking = true;
    ensureStyles();
    showBanner();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onClickCapture, true);
  }

  function stopPicker() {
    picking = false;
    hoveredEl = null;
    highlight(null);
    closeContextMenu();
    closeConfirmPanel();
    hideBanner();
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', onClickCapture, true);
  }

  // ---------- entry point ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'START_PICKER') {
      startPicker();
    }
  });
})();
