"""Скриншоты всех шагов главы и ошибки консоли.
uv run --with playwright tools/shots.py 03 [папка]   (сервер: python -m http.server 8766 -d site)
"""
import asyncio, sys, pathlib, re
from playwright.async_api import async_playwright

CH = sys.argv[1]
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else f"shots/ch{CH}")
OUT.mkdir(parents=True, exist_ok=True)
URL = f"http://127.0.0.1:8766/opt/ch{CH}/"


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome")
        pg = await b.new_page(viewport={"width": 1640, "height": 1000})
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.wait_for_timeout(800)
        beats = await pg.evaluate("BEATS.map(b => [b.id, TIMINGS[b.id] ? TIMINGS[b.id].dur : -1])")
        for i, (bid, dur) in enumerate(beats):
            for frac, tag in ((0.55, "a"), (99, "z")):
                t = dur * frac if frac < 1 else 999
                await pg.goto(f"{URL}?beat={i}&t={t:.2f}")
                await pg.wait_for_timeout(500)
                await pg.screenshot(path=str(OUT / f"{i:02d}-{bid}-{tag}.png"))
        print("beats:", len(beats))
        print("errors:", "\n".join(sorted(set(errs))) or "нет")
        await b.close()

asyncio.run(main())
