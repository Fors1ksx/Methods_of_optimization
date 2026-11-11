"""Оглавление из глав: названия и минуты берутся из CHAPTER каждой site/opt/chNN/index.html.
python tools/sync_toc.py
"""
import pathlib, re, json

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'site/opt'
PARTS = [('ЛР1 · Одномерная минимизация без производной', [1, 2, 3, 4, 5], 0),
         ('ЛР2 · Минимизация с производной', [6, 7, 8, 9], 1)]
chs = {}
for d in sorted(ROOT.glob('ch0*')):
    s = (d / 'index.html').read_text(encoding='utf-8')
    m = re.search(r"const CHAPTER = \{[^}]*number:\s*(\d+)[^}]*title:\s*'([^']*)'[^}]*minutes:\s*(\d+)", s)
    if m:
        chs[int(m.group(1))] = (m.group(2), int(m.group(3)))
units = []
for name, nums, art in PARTS:
    units.append(f"  [{json.dumps(name, ensure_ascii=False)}, [" + ', '.join(f"[{json.dumps(chs[n][0], ensure_ascii=False)}, {chs[n][1]}, {n}]" for n in nums if n in chs) + f"], {art}],")
idx = ROOT / 'index.html'
s = idx.read_text(encoding='utf-8')
s = re.sub(r"const UNITS = \[.*?\n\];", "const UNITS = [   // [часть, [[глава, минуты, номер], ...], индекс эскиза] — собрано tools/sync_toc.py\n" + '\n'.join(units) + "\n];", s, flags=re.S)
idx.write_text(s, encoding='utf-8')
print('\n'.join(units))
print('всего минут:', sum(v[1] for v in chs.values()))
