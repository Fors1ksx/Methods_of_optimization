"""Ошибки страниц глав по всем шагам: uv run -q --with playwright tools/errs.py opttest 01 02 ..."""
import asyncio, sys
from playwright.async_api import async_playwright
BOOK = sys.argv[1]
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome")
        pg = await b.new_page(viewport={"width": 1640, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and "404" not in m.text else None)
        for ch in sys.argv[2:]:
            errs.clear()
            url = f"http://127.0.0.1:8766/{BOOK}/ch{ch}/"
            await pg.goto(url); await pg.wait_for_timeout(600)
            n = await pg.evaluate("typeof BEATS === 'undefined' ? -1 : BEATS.length")
            for i in range(max(n, 0)):
                await pg.goto(f"{url}?beat={i}&t=999"); await pg.wait_for_timeout(250)
            print(ch, "шагов", n, "ошибок", len(set(errs)), *sorted(set(errs))[:4], sep="\n  " if errs else " ")
        await b.close()
asyncio.run(main())
