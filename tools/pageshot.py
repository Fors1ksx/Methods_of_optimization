"""Скриншот страницы и ошибки консоли: uv run -q --with playwright tools/pageshot.py trainer/ out.png [клик-селектор ...]"""
import asyncio, sys
from playwright.async_api import async_playwright


async def main():
    url = "http://127.0.0.1:8766/opt/" + sys.argv[1]
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome")
        pg = await b.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(url)
        await pg.wait_for_timeout(700)
        for sel in sys.argv[3:]:
            await pg.click(sel)
            await pg.wait_for_timeout(400)
        await pg.screenshot(path=sys.argv[2], full_page=True)
        print("errors:", "\n".join(sorted(set(errs))) or "нет")
        await b.close()

asyncio.run(main())
