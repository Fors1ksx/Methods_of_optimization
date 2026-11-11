"""Автотест плеера (lib/player.js): удержание Пробела/ПКМ = 2×, < > скорость, меню скорости, перемотка перетаскиванием.
uv run -q --with playwright tools/e2e_player.py [NN] [скриншот.png]
"""
import asyncio, sys
from playwright.async_api import async_playwright

CH = sys.argv[1] if len(sys.argv) > 1 else '03'
URL = f'http://127.0.0.1:8766/opt/ch{CH}/'
ok = []


def check(name, cond, extra=''):
    ok.append(bool(cond))
    print(('OK  ' if cond else 'FAIL') + f' {name} {extra}')


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1640, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(800)
        await pg.evaluate("try{localStorage.removeItem('speed')}catch(e){}")
        await pg.reload(); await pg.wait_for_timeout(800)
        st = lambda: pg.evaluate("({rate: P.rate, playing: P.playing, i: P.i, t: P.t, started: P.started, btn: document.getElementById('bSpeed').textContent})")
        # старт пробелом (короткое нажатие)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
        s = await st(); check('короткий Пробел запускает урок', s['started'] and s['playing'], s)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(300)
        s = await st(); check('короткий Пробел ставит паузу', not s['playing'], s)
        # удержание пробела
        await pg.keyboard.down('Space'); await pg.wait_for_timeout(600)
        s = await st(); vis = await pg.evaluate("document.querySelector('.pp-fast').classList.contains('on')")
        check('удержание Пробела = 2× и играет', s['rate'] == 2 and s['playing'] and vis, s)
        await pg.keyboard.up('Space'); await pg.wait_for_timeout(300)
        s = await st(); check('отпустили — обычная скорость, урок продолжается', s['rate'] == 1 and s['playing'], s)
        # правая кнопка мыши на кадре
        await pg.mouse.move(800, 400); await pg.mouse.down(button='right'); await pg.wait_for_timeout(400)
        s = await st(); check('удержание ПКМ = 2×', s['rate'] == 2, s)
        await pg.mouse.up(button='right'); await pg.wait_for_timeout(200)
        s = await st(); check('ПКМ отпущена — 1×', s['rate'] == 1, s)
        # < >
        await pg.keyboard.press('Shift+Period'); await pg.keyboard.press('Shift+Period'); await pg.wait_for_timeout(200)
        s = await st(); check('> дважды = 1,5×', s['rate'] == 1.5 and s['btn'] == '1,5×', s)
        await pg.keyboard.press('Shift+Comma'); await pg.wait_for_timeout(200)
        s = await st(); check('< = 1,25×', s['rate'] == 1.25, s)
        # меню скорости
        await pg.click('#bSpeed'); await pg.wait_for_timeout(200)
        await pg.click('.pp-menu button[data-r="2"]'); await pg.wait_for_timeout(200)
        s = await st(); check('меню: выбрали 2×', s['rate'] == 2 and s['btn'] == '2×', s)
        await pg.click('#bSpeed'); await pg.click('.pp-menu button[data-r="1"]'); await pg.wait_for_timeout(200)
        # перетаскивание по полосе
        box = await pg.evaluate("(() => { const r = document.getElementById('segs').getBoundingClientRect(); return {x: r.left, y: r.top + r.height / 2, w: r.width}; })()")
        y = box['y']
        await pg.mouse.move(box['x'] + 5, y); await pg.mouse.down()
        await pg.mouse.move(box['x'] + box['w'] * .35, y, steps=8); await pg.wait_for_timeout(150)
        tip = await pg.evaluate("(() => { const t = document.querySelector('.pp-tip'); return t.style.display + ' | ' + t.textContent; })()")
        scr = await pg.evaluate("document.querySelector('.pp-scrub').style.display")
        check('во время перетаскивания видна подсказка и заливка', tip.startswith('block') and scr == 'block', tip)
        if len(sys.argv) > 2:
            await pg.screenshot(path=sys.argv[2])
        await pg.mouse.move(box['x'] + box['w'] * .6, y, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(500)
        s = await st(); exp = await pg.evaluate(f"(() => {{ const els = [...document.querySelectorAll('#segs .seg')]; const x = {box['x'] + box['w'] * .6}; return els.findIndex(e => x < e.getBoundingClientRect().right + 1); }})()")
        check('отпустили — урок на шаге под курсором', s['i'] == exp, f"шаг {s['i'] + 1}, ожидали {exp + 1}")
        check('ошибок страницы нет', not errs, errs[:3])
        await b.close()
    print('итог:', sum(ok), 'из', len(ok))
    sys.exit(0 if all(ok) else 1)

asyncio.run(main())
