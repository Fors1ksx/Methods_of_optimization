"""Банк вопросов книги: все проверки и практика глав — для экзамена и работы над ошибками.

При работающем сервере (python -m http.server 8765 -d site):
  uv run --with playwright tools/build_bank.py http://localhost:8765/networks/ [отчёт.json]

Пишет site/networks/lib/bank.js (self.BANK) и картинки сцен к вопросам в site/networks/exam/img/.
Для каждого вопроса ищет шаг урока, где объясняется ответ: по словам озвучки и текста на схеме
(у проверки — ближайшие шаги перед ней, у практики — вся глава, в практикуме — шаг «разбор»).
Перезапускать после правок глав.
"""
import asyncio, json, math, re, sys, pathlib, datetime
from collections import Counter
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / 'site/opt'
CONTENT = ROOT / 'content/opt'
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766/opt/').rstrip('/') + '/'
REPORT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
IMG = SITE / 'exam/img'
K = 0.7   # масштаб сцены на картинках: 1600×900 → 1120×630

SETUP = r"""() => {
  window.__cap = [];   // quiz() пишет сюда (engine.js подменён при загрузке, см. ENGINE_HOOK)
  const vis = el => {
    for (let e = el; e && e.getAttribute; e = e.parentNode) {
      const o = e.getAttribute('opacity');
      if ((o !== null && +o < .05) || e.style.visibility === 'hidden') return false;
    }
    return true;
  };
  window.__vis = vis;
  window.__panelText = () => S.panel ? [...S.panel.querySelectorAll('text')].filter(vis).map(t => t.textContent.trim()).filter(Boolean).join(' · ') : '';
  const plain = p => [].concat(p ?? []).map(x => typeof x === 'string' ? x : '').join('');
  window.__ser = q => {
    const m = q.build.meta || { type: 'unknown' };
    const o = { id: q.id, prompt: plain(q.prompt), odd: [].concat(q.prompt).some(x => typeof x !== 'string'), type: m.type };
    if (m.type === 'choice') Object.assign(o, { opts: m.opts.map(plain), right: m.right, yes: plain(m.yes), no: (m.no || []).map(x => x == null ? null : plain(x)) });
    else if (m.type === 'typeIn') o.rows = m.rows.map(r => ({
      parts: r.parts.map(p => p && p.box !== undefined ? { box: String(p.box), alts: (p.alts || []).map(String), ...(p.num !== undefined ? { num: p.num, tol: p.tol } : {}) } : String(p)),
      why: plain(r.why), hint: r.hint == null ? null : plain(r.hint) }));
    else if (m.type === 'grid') Object.assign(o, { items: m.items.map(it => ({ text: plain(it.parts), ans: it.ans, why: plain(it.why) })),
      cols: m.cols.map(c => [c[0], plain(c[1])]), multi: m.multi });
    else if (m.type === 'pick') Object.assign(o, { labels: m.labels.map(plain), right: m.right, yes: plain(m.yes) });
    return o;
  };
}"""

# Сцены всех шагов подряд: текст на схеме у объясняющих шагов, вопросы — у шагов с вопросом.
PASS = r"""() => {
  return BEATS.map((b, i) => {
    __cap.length = 0;
    let err = null;
    try { seek(i, false); evalTo(Infinity); } catch (e) { err = String(e); }   // seek() запускает шаг и его ask()
    const rec = { i, id: b.id, title: b.title, ask: !!b.ask && b.ask !== finishCard, fin: b.ask === finishCard, text: __panelText() };
    if (err) rec.err = err;
    if (rec.ask) rec.quiz = __cap.map(c => ({ pos: c.pos, label: c.label, qs: c.qs.map(__ser) }));
    return rec;
  });
}"""

# Рамка картинки: всё видимое на панели шага с вопросом, кроме заголовка «Проверка».
CLIP = r"""(i) => {
  seek(i, false); evalTo(Infinity);
  const st = document.getElementById('stage').getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (const el of S.panel.querySelectorAll('text, path, rect, circle, ellipse, line, polyline, polygon, image')) {
    if (!__vis(el)) continue;
    if (el.tagName === 'text' && /^Проверка/.test(el.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); n++;
  }
  if (!n) return null;
  const pad = 16 * """ + str(K) + r""";
  const L = Math.max(st.left, x0 - pad), T = Math.max(st.top, y0 - pad);
  return { x: L, y: T, width: Math.min(st.right, x1 + pad) - L, height: Math.min(st.bottom, y1 + pad) - T, n };
}"""

STOP = set('''это как что для при или его она они так уже все тот эта этот эти если когда только можно нужно надо есть был была
были будет будут ещё еще также тоже через между после перед потом кроме чтобы почему какой какая какие каких каком который
которая которые которых где куда там тут здесь вот один одна одно два две три нет его ему нее неё них них сам сама само свой
своя свои своих вам нам вас нас под над без про того тем том той чем всё всех всем один ли же бы не ни да но а и в на с к у о от
до из за по об'''.split())


def toks(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'\[\[[^\]]*\]\]', ' ', s)
    out = []
    for w in re.findall(r'[a-z0-9][a-z0-9./:-]*[a-z0-9]|[a-z0-9]|[а-я]+', s):
        if re.match('[а-я]', w):
            if len(w) < 3 or w in STOP:
                continue
            out.append(w[:6])            # грубая основа слова
        else:
            out.append(w)
    return out


def ans_text(q):
    t = q['type']
    if t == 'choice':
        return q['opts'][q['right']]
    if t == 'pick':
        return q['labels'][q['right']]
    if t == 'typeIn':
        return '; '.join(p['box'] for r in q['rows'] for p in r['parts'] if isinstance(p, dict))
    if t == 'grid':
        lab = dict((k, v) for k, v in q['cols'])
        if len(q['items']) == 1:
            return ', '.join(lab[a] for a in q['items'][0]['ans'])
        return '; '.join(f"{it['text']} — {', '.join(lab[a].lower() for a in it['ans']) or 'ничего'}" for it in q['items'])
    return ''


def explain(chapter, beats, narr):
    """beat id → id шага-объяснения для каждого вопроса главы."""
    teach = [b for b in beats if not b['ask'] and not b['fin'] and b['i'] > 0]
    docs = {b['id']: Counter(toks(narr.get(b['id'], '') + ' ' + b['text'] + ' ' + b['title'])) for b in teach}
    df = Counter(w for c in docs.values() for w in c)
    nd = len(docs) or 1
    idf = {w: math.log((nd + 1) / (d + .5)) for w, d in df.items()}

    def vec(c):
        v = {w: (1 + math.log(n)) * idf.get(w, 0) for w, n in c.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        return {w: x / norm for w, x in v.items()}
    dv = {k: vec(c) for k, c in docs.items()}
    ids = [b['id'] for b in beats]
    out = {}
    for b in beats:
        if not b['ask']:
            continue
        for qz in b.get('quiz', []):
            for q in qz['qs']:
                solve = 's' + b['id'][1:] if b['id'].startswith('q') else None
                if solve in ids and chapter == 24:
                    out[q['id']] = (solve, [], None)
                    continue
                words = [q['prompt'], ans_text(q), q.get('yes', '')]
                for r in q.get('rows', []):
                    words += [p if isinstance(p, str) else p['box'] for p in r['parts']] + [r['why']]
                for it in q.get('items', []):
                    words += [it['text'], it['why']]
                before = [t for t in teach if t['i'] < b['i']]
                cands = before if q['id'].startswith('c-') and before else teach

                def best(text):
                    qv = vec(Counter(toks(text)))
                    scored = []
                    for d, t in enumerate(reversed(cands)):
                        sc = sum(x * dv[t['id']].get(w, 0) for w, x in qv.items())
                        if q['id'].startswith('c-'):
                            sc *= 1 + .6 / (1 + d)   # проверка обычно сразу после своего объяснения
                        if t['title'] == 'Главное':
                            sc *= .6                 # итог главы — запасной вариант, не объяснение
                        scored.append((sc, t['id']))
                    scored.sort(reverse=True)
                    return scored
                scored = best(' '.join(words))
                # Строки таблицы «верно/неверно» и ввода часто из разных тем: у каждой — своё объяснение.
                rows = [it['text'] + ' ' + it['why'] for it in q.get('items', [])] +                        [' '.join(p if isinstance(p, str) else p['box'] for p in r['parts']) + ' ' + r['why'] for r in q.get('rows', [])]
                per = [(best(q['prompt'] + ' ' + r) or [(0, None)])[0][1] for r in rows] if len(rows) > 1 else None
                out[q['id']] = (scored[0][1] if scored else None, scored[:3], per)
    return out


# Движок Papermorph v2.12 — замыкание ENGINE; глобальные quiz/choice/grid — const-копии. Для сборки банка (и только
# в браузере сборщика) они заменяются обёртками: quiz пишет вопросы в window.__cap, choice и grid несут .meta.
ENGINE_HOOK = [
    ("quiz = ENGINE.quiz,", "quiz = (pos, qs, done, label) => { (window.__cap || []).push({ pos: pos.cls, label: label ?? null, qs }); return ENGINE.quiz(pos, qs, done, label); },"),
    ("choice = ENGINE.choice,", "choice = (...a) => Object.assign(ENGINE.choice(...a), { meta: { type: 'choice', opts: a[0], right: a[1], yes: a[2], no: a[3] } }),"),
    ("grid = ENGINE.grid,", "grid = (...a) => Object.assign(ENGINE.grid(...a), { meta: { type: 'grid', items: a[0], cols: a[1], multi: (a[2] || {}).multi ?? true } }),"),
]


async def hook_engine(route):
    body = (SITE / 'lib/engine.js').read_text(encoding='utf-8')
    for a, b in ENGINE_HOOK:
        if a not in body:
            raise SystemExit(f'engine.js: не найдено «{a}» — обновите ENGINE_HOOK под новую версию движка')
        body = body.replace(a, b, 1)
    await route.fulfill(status=200, content_type='application/javascript; charset=utf-8', body=body)


async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    IMG.mkdir(parents=True, exist_ok=True)
    for f in IMG.glob('*.jpg'):
        f.unlink()
    async with async_playwright() as p:
        br = await p.chromium.launch(channel='chrome')
        pg = await br.new_page(viewport={'width': round(1640 * K), 'height': round(1000 * K)})
        await pg.route('**/lib/engine.js', hook_engine)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL + 'index.html'); await pg.wait_for_timeout(300)
        units = await pg.evaluate("UNITS.map(([name, chs, a], u) => [name, chs.map(c => c[2]), (a ?? u) + 1, chs.map(c => c[0])])")
        chapters, bank, report = {}, [], []
        for u, (uname, nums, art, titles) in enumerate(units):
            for n, t in zip(nums, titles):
                chapters[n] = {'title': t, 'unit': u + 1}
        for n in sorted(chapters):
            cid = f'ch{n:02d}'
            await pg.goto(URL + f'{cid}/index.html?beat=0'); await pg.wait_for_timeout(400)
            await pg.evaluate(SETUP)
            beats = await pg.evaluate(PASS)
            narr = json.loads((CONTENT / cid / 'narration.ru.json').read_text(encoding='utf-8'))['beats']
            ex = explain(n, beats, narr)
            title = {b['id']: b['title'] for b in beats}
            for b in beats:
                if not b['ask']:
                    continue
                if b.get('err'):
                    errs.append(f"{cid} {b['id']}: {b['err']}")
                clip = await pg.evaluate(CLIP, b['i'])
                img = None
                if clip and clip['width'] > 40 and clip['height'] > 40:
                    img = f"{cid}-{b['id']}.jpg"
                    await pg.screenshot(path=str(IMG / img), type='jpeg', quality=74,
                                        clip={k: clip[k] for k in ('x', 'y', 'width', 'height')})
                for qz in b['quiz']:
                    for q in qz['qs']:
                        e, cands, per = ex.get(q['id'], (None, [], None))
                        odd, text = q.pop('odd'), q.pop('prompt')
                        entry = {'ch': n, 'id': q['id'], 'beat': b['id'], 'ex': e, 'img': img, 'label': qz['label'],
                                 'text': text, 'ans': ans_text(q), 'exam': q['type'] in ('choice', 'typeIn', 'grid') and not odd}
                        if per:
                            entry['exRows'] = per
                        entry.update(q)
                        bank.append(entry)
                        report.append({'ch': n, 'id': q['id'], 'type': q['type'], 'text': entry['text'], 'ans': entry['ans'][:80],
                                       'img': img, 'ex': e, 'ex_title': title.get(e), 'q_title': b['title'],
                                       'cands': [(round(s, 3), c, title.get(c)) for s, c in cands],
                                       'rows': [title.get(r) for r in per] if per else None})
            ids = [x['id'] for x in bank if x['ch'] == n]
            dup = sorted({i for i in ids if ids.count(i) > 1})
            if dup:
                errs.append(f'{cid}: повторяются id вопросов {dup}')
            print(f'{cid}: {len(ids)} вопросов')
        await br.close()
    out = {'built': datetime.date.today().isoformat(),
           'units': [[name, nums, art] for name, nums, art, _ in units],
           'chapters': chapters, 'q': bank}
    (SITE / 'lib/bank.js').write_text('// Собрано tools/build_bank.py — не править вручную.\nself.BANK = '
                                      + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    if REPORT:
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"вопросов: {len(bank)}, для экзамена: {sum(x['exam'] for x in bank)}, с картинкой: {sum(1 for x in bank if x['img'])}")
    print('ошибки:', errs or 'нет')

asyncio.run(main())
