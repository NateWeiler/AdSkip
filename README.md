# PyScript Auto Ad Skipper

A browser extension that scans the page once per second for "Skip Ad" buttons
or corner close (×) buttons and clicks them automatically, using Python (via
PyScript) instead of plain JavaScript for the detection logic.

## Files
- `manifest.json` — extension config (Manifest V3)
- `content.js` — injects the PyScript runtime + `skipper.py` into every page
- `skipper.py` — the Python scan/click logic, run in-browser via PyScript

## Install (Chrome / Edge / Brave)
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `ad-skipper-extension` folder
5. Visit a page with video ads (e.g. YouTube) and open DevTools console to
   watch the `[AdSkipper]` log messages

## Install (Firefox)
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` inside the folder
   (Firefox temporary add-ons are removed on browser restart; for permanent
   install you'd need to package and sign it via addons.mozilla.org)

## Notes and caveats
- **Performance**: PyScript loads a full Python runtime (Pyodide) into every
  page, which is several megabytes and noticeably slower to start than plain
  JS. If you don't specifically need Python, a pure-JS content script doing
  the same `querySelectorAll` loop on a `setInterval` would be much lighter.
  I built it in Python here since that's what you asked for.
- **Terms of service**: auto-skipping ads on ad-supported sites (YouTube,
  Hulu, etc.) may violate those sites' terms of service, even though it's
  running entirely in your own browser. That's a separate question from
  legality — just worth knowing before relying on this daily.
- **False positives**: the generic text-matching fallback (matching "close",
  "skip", "×", etc.) can occasionally click buttons that aren't actually ads.
  Tighten `AD_SELECTORS` or remove the fallback loop if that's a problem for
  sites you use a lot.
- **Selector rot**: sites change their DOM/class names over time, so the
  hardcoded selectors will need occasional updates as platforms redesign.
