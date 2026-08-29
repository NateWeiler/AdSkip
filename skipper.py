import asyncio
from js import document, console

# Common selectors used by video platforms and popup/overlay ads
AD_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".videoAdUiSkipButton",
    "button[class*='skip']",
    "div[class*='skip']",
    ".ad-closing-button",
    ".close-ad",
    "[aria-label='Close ad']",
    "[aria-label='Skip ad']",
    "[aria-label='Close']",
]


def _is_visible(el):
    # offsetWidth/offsetHeight are 0 for hidden or not-yet-rendered elements
    return el.offsetWidth > 0 and el.offsetHeight > 0


def scan_and_click():
    # 1. Known CSS selectors first (fast, low false-positive rate)
    for selector in AD_SELECTORS:
        elements = document.querySelectorAll(selector)
        for i in range(elements.length):
            el = elements.item(i)
            if el and _is_visible(el):
                console.log(f"[AdSkipper] Clicking element matching: {selector}")
                el.click()
                return

    # 2. Fallback: scan generic buttons/divs for skip-like text or a bare "×"
    buttons = document.querySelectorAll("button, div[role='button'], span[role='button']")
    for i in range(buttons.length):
        btn = buttons.item(i)
        text = (btn.innerText or "").strip().lower()

        if text in ("×", "x", "skip", "skip ad", "skip ads", "skip intro", "close", "no thanks"):
            if _is_visible(btn):
                console.log(f"[AdSkipper] Clicking button with text: '{text}'")
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
