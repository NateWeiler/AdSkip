// content.js
// Content scripts can't run Python directly, so this injects the PyScript
// runtime (CSS + JS core) plus our Python logic file into the page.

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
