import asyncio
import json
from js import document, console, window

# Known selectors for the actual "skip ad" control on major platforms.
# These are specific, high-confidence matches — checked first.
AD_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-container button",
    ".videoAdUiSkipButton",
    ".ad-closing-button",
    ".close-ad",
    "[aria-label='Close ad']",
    "[aria-label='Skip ad']",
    "[aria-label='Skip Ad']",
]

# Player controls that must NEVER be auto-clicked, even if a loose text/aria
# match would otherwise catch them. This is what was getting hit before.
CONTROL_BLACKLIST = [
    "ytp-mute-button",
    "ytp-volume-panel",
    "ytp-subtitles-button",   # CC / captions toggle
    "ytp-settings-button",
    "ytp-fullscreen-button",
    "ytp-play-button",
    "ytp-size-button",
    "ytp-miniplayer-button",
]


def _is_visible(el):
    # offsetWidth/offsetHeight are 0 for hidden or not-yet-rendered elements
    return el.offsetWidth > 0 and el.offsetHeight > 0


def _is_blacklisted(el):
    class_name = (el.className or "")
    # className can be a string or (for SVG) an SVGAnimatedString; str() handles both
    class_name = str(class_name).lower()
    return any(blocked in class_name for blocked in CONTROL_BLACKLIST)


def _describe(el):
    # Helper for debug logging so you can see exactly what got clicked
    cls = str(el.className or "")[:60]
    aria = el.getAttribute("aria-label") or ""
    text = (el.innerText or "").strip()[:20]
    return f"tag={el.tagName} class='{cls}' aria-label='{aria}' text='{text}'"


def get_custom_filters():
    """Read user-defined filters injected by content.js as window.__adSkipperFilters.
    Re-read every cycle so edits made in the popup take effect live."""
    raw = getattr(window, "__adSkipperFilters", None)
    if raw is None:
        return []
    try:
        # Pyodide JsProxy -> Python list[dict]
        return raw.to_py()
    except Exception as e:
        console.error(f"[AdSkipper] Failed to read custom filters: {e}")
        return []


def apply_custom_filters():
    """Apply every user-defined rule: click matching elements, or remove them.
    Unlike the built-in detection this does NOT stop after the first match —
    a 'remove' filter especially may need to clear several elements at once."""
    filters = get_custom_filters()
    for rule in filters:
        selector = rule.get("selector")
        action = rule.get("action", "click")
        if not selector:
            continue

        try:
            elements = document.querySelectorAll(selector)
        except Exception as e:
            console.error(f"[AdSkipper] Bad custom selector '{selector}': {e}")
            continue

        for i in range(elements.length):
            el = elements.item(i)
            if not el or not _is_visible(el):
                continue

            if action == "click":
                console.log(f"[AdSkipper] Custom filter CLICK: {_describe(el)}")
                el.click()
            elif action == "remove":
                console.log(f"[AdSkipper] Custom filter REMOVE: {_describe(el)}")
                el.remove()


def scan_and_click():
    # 0. User-defined custom filters run first, every cycle
    apply_custom_filters()

    # 1. Known, specific ad-skip/close selectors first (high confidence)
    for selector in AD_SELECTORS:
        elements = document.querySelectorAll(selector)
        for i in range(elements.length):
            el = elements.item(i)
            if el and _is_visible(el) and not _is_blacklisted(el):
                console.log(f"[AdSkipper] MATCH via selector '{selector}': {_describe(el)}")
                el.click()
                return

    # 2. Fallback: only buttons whose aria-label or text clearly says
    #    "skip ad" / "skip ads" / "skip intro" — no bare "close"/"×"/"x"
    #    matching anymore, since that's what was catching mute/CC.
    SKIP_PHRASES = ("skip ad", "skip ads", "skip intro", "skip advertisement")

    buttons = document.querySelectorAll("button, div[role='button'], span[role='button']")
    for i in range(buttons.length):
        btn = buttons.item(i)
        if _is_blacklisted(btn):
            continue

        aria = (btn.getAttribute("aria-label") or "").lower()
        text = (btn.innerText or "").strip().lower()

        if any(phrase in aria for phrase in SKIP_PHRASES) or \
           any(phrase in text for phrase in SKIP_PHRASES):
            if _is_visible(btn):
                console.log(f"[AdSkipper] MATCH via fallback text/aria: {_describe(btn)}")
                btn.click()
                return


async def main_loop():
    console.log("[AdSkipper] Background scan loop started.")
    while True:
        try:
            scan_and_click()
        except Exception as e:
            console.error(f"[AdSkipper] Error during scan: {e}")

        await asyncio.sleep(1)  # scan once per second


asyncio.ensure_future(main_loop())
