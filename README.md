# PyScript Auto Ad Skipper

A browser extension that scans the page once per second for "Skip Ad" buttons
or corner close (×) buttons and clicks them automatically, using Python (via
PyScript) instead of plain JavaScript for the detection logic.

## Files
- `manifest.json` — extension config (Manifest V3)
- `content.js` — injects the PyScript runtime + `skipper.py`, and syncs your custom filters into the page
- `picker.js` — the visual element picker (hover, right-click, confirm)
- `skipper.py` — the Python scan/click logic, run in-browser via PyScript
- `popup.html` / `popup.js` — UI (click the toolbar icon) for adding/removing custom filters, or launching the picker

## Ad cover + fast scanning
Two things happen automatically, no setup needed:
- **200ms scan interval** (down from 1s) — the skip button gets clicked almost the instant it stops being disabled, rather than up to a second late.
- **Ad cover overlay** — the moment `skipper.py` detects an ad container (`AD_CONTAINER_SELECTORS` at the top of the file, currently tuned for YouTube's `.ad-showing`/`.ad-interrupting`/`.ytp-ad-player-overlay`), it places a black "Skipping ad…" panel exactly over that area. The overlay sits on top visually but has `pointer-events: none` and never touches the real ad DOM, so the skip-button scan underneath keeps working and clicking normally. Once the ad container disappears, the overlay is hidden and your video shows through again.

If you hit a site where ads aren't covered, add its ad-wrapper class to `AD_CONTAINER_SELECTORS` in `skipper.py` (or pick it with the element picker and export it to me — see below — and I'll add it to the defaults).

## Picking an element visually
Instead of writing a CSS selector by hand, click the toolbar icon → **🎯 Pick element on page**. The popup closes and:

1. **Hover** over the page — the element under your cursor gets a blue outline.
2. **Right-click** the element you want → a menu appears with four choices:
   - **👆 This is a Skip button** — clicks it automatically (skip/close/next-style buttons)
   - **🚫 This is an Exit / Close box** — deletes it from the page entirely (ad overlays, popups)
   - **↺ Choose a different element** — closes the menu and lets you keep hovering/right-clicking if the wrong thing got highlighted
   - **✕ Exit picker mode** — cancels without adding anything
3. If you pick Skip button or Exit/Close box, a small confirm panel shows the auto-generated CSS selector (editable) and domain before saving — nothing is added until you hit **Add filter**.
4. Press **Esc** at any time to exit picker mode.

While picking, ordinary left-clicks on the page are suppressed so you don't accidentally trigger the very ad/skip button you're trying to select — right-click is the only way to act on an element.

## Custom filters (manual entry)
You can also add filters directly from the popup form without the picker. Each filter has:
- **CSS selector** — e.g. `.some-ad-overlay`, `#skip-button`, `[aria-label="Close"]`
- **Domain** (optional) — restrict the rule to one site (e.g. `example.com`); leave blank to apply everywhere
- **Action**:
  - **Click** — clicks the matched element(s), same as hitting skip/close yourself
  - **Remove** — deletes the element from the page entirely (useful for overlay boxes with no working close button)

Filters are stored in `chrome.storage.sync` and re-read by the Python scan loop every second, so edits in the popup take effect on open tabs without a page reload. Custom filters run before the built-in ad-skip detection, and a "Remove" rule will clear *all* matching elements per cycle rather than stopping at the first one.

## Exporting filters back to Claude
Every filter you pick or add is just data — it doesn't automatically make the extension smarter on sites you haven't visited yet. If you find good selectors on sites you use a lot, click **📋 Export filters** in the popup, then **Copy to clipboard**, and paste the resulting list back into the chat with Claude. From there they can be folded into `AD_SELECTORS` / `CONTROL_BLACKLIST` in `skipper.py` directly, so the extension recognizes those patterns out of the box next time — no per-site filter needed. The export format is:
```
domain | type | selector
---
example.com | Skip button | .some-skip-class
example.com | Exit/Close box | .ad-overlay-close
```

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
