// Математика на доске для учебника «Методы оптимизации»: графики, точки методов, отрезки,
// касательные, параболы, формулы KaTeX и анимация итераций из lib/methods.js.
// Подключается после engine.js и net.js; все функции — поверх их примитивов (G, path, T, tw, show, draw…).
'use strict';
const OC = { curve: COL.chalk, seg: COL.whole, x1: COL.whole, x2: COL.nat, u: COL.task, best: COL.good, cut: '#0d1714', par: COL.real, tan: COL.task, d: COL.rat, bad: COL.bad };
const fm = (v, d = 4) => (typeof v !== 'number' || !isFinite(v)) ? '—' : (+v.toFixed(d)).toString().replace('.', ',').replace('-', '−');
let _clipN = 0;

// Формула KaTeX на доске. x,y — левый (или центральный при anchor:'middle') край и верх строки.
function tex(p, s, x, y, t0, { size = 40, color = COL.chalk, anchor = 'start', w = 1400, o = 0, display = false } = {}) {
  const hgt = size * (display ? 3.6 : 3);
  const fo = mk('foreignObject', { x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y, width: w, height: hgt }, p);
  const div = document.createElement('div');
  Object.assign(div.style, { color, fontSize: size + 'px', textAlign: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', lineHeight: 1.25, whiteSpace: 'nowrap' });
  try { div.innerHTML = katex.renderToString(s.replace(/(\d),(\d)/g, '$1{,}$2'), { throwOnError: false, displayMode: false }); } catch (e) { div.textContent = s; }
  fo.appendChild(div);
  put(fo, { o });
  if (t0 !== undefined) show(fo, t0);
  return fo;
}
// Несколько строк формул столбиком, каждая на своей метке.
function texRows(p, rows, x, y, ts, { size = 38, dy = 74, color = COL.chalk, anchor = 'start', w = 1400 } = {}) {
  return rows.map((r, i) => tex(p, r, x, y + i * dy, ts[i] ?? ts.at(-1), { size, color: Array.isArray(color) ? color[i] : color, anchor, w }));
}

// Оси с делениями (как axes() движка, но подписи с запятой и без ошибок округления).
function faxes(p, { x0, y0, w, h, xs: [xlo, xhi, xst], ys: [ylo, yhi, yst], xl, yl, t0 }) {
  const PX = v => x0 + (v - xlo) / (xhi - xlo) * w, PY = v => y0 - (v - ylo) / (yhi - ylo) * h, g = G(p, { o: 0 });
  const nx = Math.round((xhi - xlo) / xst), ny = Math.round((yhi - ylo) / yst);
  let d = '';
  for (let i = 1; i <= nx; i++) d += `M${PX(xlo + i * xst)} ${y0}V${y0 - h}`;
  for (let i = 1; i <= ny; i++) d += `M${x0} ${PY(ylo + i * yst)}H${x0 + w}`;
  mk('path', { d, stroke: COL.chalk, 'stroke-opacity': .1, 'stroke-width': 1.5, fill: 'none' }, g);
  path(g, `M${x0} ${y0 - h - 20}V${y0}H${x0 + w + 20}`, { stroke: COL.chalk, 'stroke-width': 3 });
  const dx = Math.max(3, Math.ceil(-Math.log10(xst)) + 1), dy = Math.max(3, Math.ceil(-Math.log10(yst)) + 1);
  for (let i = 0; i <= nx; i++) T(g, fm(xlo + i * xst, dx), { x: PX(xlo + i * xst), y: y0 + 30, size: 20, fill: COL.dim, font: MATH, anchor: 'middle' });
  for (let i = 0; i <= ny; i++) T(g, fm(ylo + i * yst, dy), { x: x0 - 14, y: PY(ylo + i * yst) + 7, size: 20, fill: COL.dim, font: MATH, anchor: 'end' });
  if (xl) T(g, xl, { x: x0 + w + 34, y: y0 + 8, size: 26, fill: COL.dim, font: MATH, anchor: 'start' });
  if (yl) T(g, yl, { x: x0, y: y0 - h - 34, size: 26, fill: COL.dim, font: MATH, anchor: 'middle' });
  show(g, t0);
  return { PX, PY };
}
// График функции в рамке: оси с делениями, кривая рисуется мелом. Возвращает объект для слоёв.
// xs, ys: [от, до, шаг]. fn — функция или ключ OPT.FN.
function graph(p, fn, { x0 = 130, y0 = 790, w = 820, h = 560, xs, ys, xl = 'x', yl = 'f(x)', t0 = .2, dur = 1.2, color = OC.curve, sw = 4.5, name, nameColor = COL.dim } = {}) {
  const F = typeof fn === 'string' ? OPT.FN[fn] : { f: fn };
  const f = F.f;
  const A = faxes(p, { x0, y0, w, h, xs, ys, xl, yl, t0 });
  const id = 'oc' + (++_clipN);
  const cp = mk('clipPath', { id }, p); mk('rect', { x: x0, y: y0 - h - 6, width: w + 4, height: h + 12 }, cp);
  const layer = mk('g', { 'clip-path': `url(#${id})` }, p);
  const top = mk('g', {}, p);   // точки и подписи поверх кривой, без обрезки
  const Gr = { p, F, f, df: F.df, PX: A.PX, PY: A.PY, x0, y0, w, h, xs, ys, layer, top, back: mk('g', {}, layer) };
  layer.insertBefore(Gr.back, layer.firstChild);
  Gr.curve = curve(Gr, f, t0 + .3, { color, sw, dur });
  if (name) tex(p, name, x0 + 24, y0 - h - 10, t0 + .5, { size: 30, color: nameColor });
  return Gr;
}
function curvePath(Gr, f, lo = Gr.xs[0], hi = Gr.xs[1], N = 260) {
  let d = '', pen = false;
  const [ylo, yhi] = Gr.ys, pad = (yhi - ylo) * 2;
  for (let i = 0; i <= N; i++) {
    const x = lo + (hi - lo) * i / N, y = f(x);
    if (!isFinite(y) || y < ylo - pad || y > yhi + pad) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + Gr.PX(x).toFixed(1) + ' ' + Gr.PY(y).toFixed(1);
    pen = true;
  }
  return d;
}
function curve(Gr, f, t0, { color = OC.curve, sw = 4, dur = 1, dash = '', lo, hi, o } = {}) {
  const c = path(Gr.layer, curvePath(Gr, f, lo, hi), { stroke: color, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': dash } : {}) }, dash ? { o: 0 } : { d: 0 });
  if (t0 !== undefined) dash ? show(c, t0, dur) : draw(c, t0, dur);
  return c;
}
// Точка на кривой: кружок, пунктир к оси, подпись под осью. Возвращает группу (её можно hide/pulse).
function fdot(Gr, x, t0, { color = OC.x1, label, y, r = 12, drop = true, ly = 34, lsize = 26, above, o = 0 } = {}) {
  const yy = y ?? Gr.f(x), X = Gr.PX(x), Y = Gr.PY(yy);
  const g = G(Gr.top, { o });
  if (drop) mk('path', { d: `M${X} ${Y}V${Gr.y0}`, stroke: color, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: .7 }, g);
  mk('circle', { cx: X, cy: Y, r, fill: color, stroke: COL.board, 'stroke-width': 3 }, g);
  if (label) T(g, label, { x: X, y: above ? Y - 22 : Gr.y0 + ly + 20, size: lsize, fill: color, anchor: 'middle', weight: 600, font: MATH });
  if (t0 !== undefined) show(g, t0, .35);
  g._x = x;
  return g;
}
// Текущий отрезок [a, b]: светлая полоса во всю высоту графика. moveBand анимирует её.
function band(Gr, a, b, t0, { color = OC.seg, op = .13 } = {}) {
  const r = mk('rect', { x: Gr.PX(a), y: Gr.y0 - Gr.h, width: Math.max(2, Gr.PX(b) - Gr.PX(a)), height: Gr.h, fill: color, 'fill-opacity': op }, Gr.back);
  const l = mk('path', { d: `M0 ${Gr.y0 - Gr.h}V${Gr.y0}`, stroke: color, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, Gr.back);
  const rr = mk('path', { d: `M0 ${Gr.y0 - Gr.h}V${Gr.y0}`, stroke: color, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, Gr.back);
  put(l, { x: Gr.PX(a) }); put(rr, { x: Gr.PX(b) });
  const B = { r, l, rr, a, b };
  for (const e of [r, l, rr]) put(e, { o: 0 });
  if (t0 !== undefined) [r, l, rr].forEach(e => show(e, t0));
  return B;
}
function moveBand(Gr, B, a, b, t0, dur = .7) {
  tw(B.r, { a_x: Gr.PX(a), a_width: Math.max(2, Gr.PX(b) - Gr.PX(a)) }, t0, dur);
  tw(B.l, { x: Gr.PX(a) }, t0, dur); tw(B.rr, { x: Gr.PX(b) }, t0, dur);
  B.a = a; B.b = b;
}
// Затемнить выброшенную часть [a, b].
function cut(Gr, a, b, t0, { op = .55 } = {}) {
  const r = mk('rect', { x: Gr.PX(a), y: Gr.y0 - Gr.h, width: Math.max(0, Gr.PX(b) - Gr.PX(a)), height: Gr.h, fill: OC.cut }, Gr.layer);
  put(r, { o: 0 }); tw(r, { o: op }, t0, .5);
  return r;
}
function tangent(Gr, x, t0, { color = OC.tan, sw = 3, dur = .7, df } = {}) {
  const y = Gr.f(x), k = (df || Gr.df)(x);
  const [lo, hi] = Gr.xs, l = path(Gr.layer, `M${Gr.PX(lo)} ${Gr.PY(y + k * (lo - x))}L${Gr.PX(hi)} ${Gr.PY(y + k * (hi - x))}`, { stroke: color, 'stroke-width': sw }, { d: 0 });
  draw(l, t0, dur);
  return l;
}
// Парабола через три точки (x, f(x)).
function parab(Gr, xs3, t0, { color = OC.par, sw = 3.5, ys3 } = {}) {
  const [a, b, c] = xs3, [fa, fb, fc] = ys3 || xs3.map(Gr.f);
  const q = x => fa * (x - b) * (x - c) / ((a - b) * (a - c)) + fb * (x - a) * (x - c) / ((b - a) * (b - c)) + fc * (x - a) * (x - b) / ((c - a) * (c - b));
  return curve(Gr, q, t0, { color, sw, dash: '12 9', dur: .6 });
}
function vline(Gr, x, t0, { color = OC.best, label, sw = 3 } = {}) {
  const g = G(Gr.top, { o: 0 });
  mk('path', { d: `M${Gr.PX(x)} ${Gr.y0 - Gr.h}V${Gr.y0}`, stroke: color, 'stroke-width': sw, 'stroke-dasharray': '4 8' }, g);
  if (label) T(g, label, { x: Gr.PX(x), y: Gr.y0 - Gr.h - 12, size: 26, fill: color, anchor: 'middle', weight: 600, font: MATH });
  show(g, t0);
  return g;
}
// Подпись значения у точки кривой (например, «f = 0,619»).
function fval(Gr, x, str, t0, { color = COL.chalk, dx = 18, dy = -20, size = 24, anchor = 'start' } = {}) {
  const t = T(Gr.top, str, { x: Gr.PX(x) + dx, y: Gr.PY(Gr.f(x)) + dy, size, fill: color, anchor, font: MATH, o: 0 });
  show(t, t0, .3);
  return t;
}

// Прогон метода по шагам на графике: полоса отрезка двигается, точки шага появляются и гаснут.
// R — результат OPT.METHODS[m].run(...). steps: [от, до]. Возвращает время окончания.
const PT_COL = { p: OC.x1, q: OC.u, best: OC.best, p2: OC.par };
function animate(Gr, R, { from = 0, to = R.steps.length - 1, t0 = .3, dt = 1.4, ts, B, keepLast = true, tangents = false, parabola = true, labels = true, onStep } = {}) {
  if (ts) t0 = ts[0];
  const st0 = R.steps[from];
  B = B || band(Gr, st0.a, st0.b, t0);
  let t = t0, prev = [];
  for (let k = from; k <= to; k++) {
    const s = R.steps[k];
    if (k > from) moveBand(Gr, B, s.a, s.b, t);
    prev.forEach(e => hide(e, t, .3));
    prev = [];
    (s.pts || []).forEach(q => prev.push(fdot(Gr, q.x, t + .25, { color: PT_COL[q.c] || OC.x1, label: labels ? q.l : '', y: q.y })));
    if (parabola && s.par) prev.push(parab(Gr, s.par.map(v => v[0]), t + .3, { ys3: s.par.map(v => v[1]) }));
    if (tangents && s.tan) s.tan.forEach(([x, y, kk]) => prev.push(tangent(Gr, x, t + .3, { df: () => kk })));
    onStep && onStep(k, s, t);
    t = ts && ts[k - from + 1] !== undefined ? ts[k - from + 1] : t + dt;
  }
  if (!keepLast) prev.forEach(e => hide(e, t, .3));
  Gr.B = B;
  return t;
}
// Таблица итераций справа от графика (net.js table): строки появляются на своих шагах.
function iterTable(p, cols, rows, ts, { x = 1000, y = 240, rh = 46, size = 22, widths } = {}) {
  const ws = widths || cols.map(() => Math.floor(560 / cols.length));
  const tb = table(p, { x, y, cols: cols.map((c, i) => [c, ws[i]]), rh, size, t0: ts[0] - .3, mono: cols.map((_, i) => i) });
  rows.forEach((r, i) => tb.row(r.map(v => typeof v === 'number' ? fm(v, 6) : v), ts[i] ?? ts.at(-1)));
  return tb;
}
const runM = (m, fnKey, a, b, eps) => { const F = OPT.FN[fnKey]; return OPT.METHODS[m].run(F, a ?? F.a, b ?? F.b, eps ?? F.eps); };

// Вопрос с числовыми полями: [{ parts: ['x₁ = ', { num: 2.145898, tol: 1e-5 }], why }]. Запятая и точка равноправны.
const parseN = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };
const numIn = rowsIn => tagQ({ type: 'typeIn', rows: rowsIn.map(r => ({ ...r, parts: r.parts.map(p => p && p.num !== undefined ? { box: fm(p.num, p.d ?? 6), alts: [], num: p.num, tol: p.tol } : p) })) }, (body, api) => {
  const all = [];
  const rows = rowsIn.map(it => {
    const line = h('div', 'bline tline'), mark = h('span', 'mark'), why = h('div', 'why');
    const boxes = [];
    for (const p of it.parts) {
      if (p && p.num !== undefined) {
        const b = h('input', 'box tbox');
        Object.assign(b, { type: 'text', autocomplete: 'off', spellcheck: false, inputMode: 'decimal' });
        b.setAttribute('aria-label', 'Ответ');
        b._num = p.num; b._tol = p.tol ?? Math.max(5e-4 * Math.abs(p.num), 5e-4); b._show = fm(p.num, p.d ?? 6);
        b.style.width = `${p.w || 10}ch`;
        line.append(b); boxes.push(b); all.push(b);
      } else line.append(h('span', /[а-яё]/i.test(p) ? 'tpart txt' : 'tpart', String(p)));
    }
    line.append(mark);
    body.append(h('div', 'brow', [line, why]));
    return { it, boxes, mark, why };
  });
  body.classList.add('blanks');
  const single = rows.length === 1;
  const judge = r => {
    let ok = true;
    for (const b of r.boxes) { const v = parseN(b.value), good = isFinite(v) && Math.abs(v - b._num) <= b._tol + 1e-12; b.classList.toggle('good', good); b.classList.toggle('bad', !good); ok = ok && good; }
    r.mark.className = 'mark ' + (ok ? 'good' : 'bad'); r.mark.textContent = ok ? '✓' : '✗';
    r.why.replaceChildren(ok || single ? '' : rich(r.it.hint ?? r.it.why, 20));
    return ok;
  };
  requestAnimationFrame(() => all[0]?.focus({ preventScroll: true }));
  return {
    check() {
      const oks = rows.map(judge), right = oks.filter(Boolean).length, done = right === rows.length;
      api.grade(done, single ? (done ? rows[0].it.why : rows[0].it.hint ?? 'Пересчитайте: ответ не попал в допуск.') : done ? [] : [`${right} из ${rows.length} верно. Исправьте строки с ✗.`],
        { right, total: rows.length, wrong: oks.flatMap((ok, i) => ok ? [] : [i]) });
    },
    reveal() {
      for (const r of rows) { r.boxes.forEach(b => { b.value = b._show; }); judge(r); if (!single) r.why.replaceChildren(rich(r.it.why, 20)); }
      return single ? rows[0].it.why : 'правильные ответы вписаны.';
    },
    lock() { all.forEach(b => { b.disabled = true; }); },
    hint: ['число с запятой или точкой, ', kbd('Tab'), ' следующее поле, ', kbd('Enter'), ' проверить'],
  };
});

// Листинг на доске: строки кода моноширинным шрифтом с номерами; codeHl подсвечивает строки по меткам озвучки.
// lines — массив строк (отступы пробелами сохраняются); first — номер первой строки (как в листинге отчёта).
function codeBlock(p, lines, x, y, t0, { size = 21, lh = 1.42, first = 1, w = 760, numbers = true, title } = {}) {
  const g = G(p, { o: 0 }), dy = size * lh, nw = numbers ? size * 2.4 : 0;
  if (title) T(g, title, { x, y: y - size * .9, size: size * .95, fill: COL.dim, weight: 600 });
  const bg = mk('rect', { x: x - 12, y: y - 4, width: w, height: lines.length * dy + 14, rx: 12, fill: '#0f1a17', 'fill-opacity': .72, stroke: COL.faint, 'stroke-width': 1.5 }, g);
  lines.forEach((ln, i) => {
    const yy = y + (i + 1) * dy - size * .32;
    if (numbers) T(g, String(first + i), { x: x + nw - 12, y: yy, size: size * .8, fill: COL.faint, font: MONO, anchor: 'end' });
    const isComment = /^\s*#/.test(ln);
    T(g, ln, { x: x + nw, y: yy, size, fill: isComment ? COL.dim : COL.chalk, font: MONO });
  });
  if (t0 !== undefined) show(g, t0);
  return { g, bg, x, y, dy, w, n: lines.length, first };
}
// Подсветить строки [from..to] (номера как в листинге) на t0; вернуть рамку (её можно hide).
function codeHl(cb, from, to, t0, { color = COL.task, dur = .4 } = {}) {
  const i0 = from - cb.first, i1 = to - cb.first;
  const r = mk('rect', { x: cb.x - 8, y: cb.y + i0 * cb.dy + 2, width: cb.w - 8, height: (i1 - i0 + 1) * cb.dy, rx: 8, fill: color, 'fill-opacity': .16, stroke: color, 'stroke-width': 2 }, cb.g);
  cb.g.insertBefore(r, cb.bg.nextSibling);   // под текстом, над фоном
  put(r, { o: 0 }); show(r, t0, dur);
  return r;
}

// Конспект главы поверх урока: кнопка на панели плеера и клавиша G (в движке v2.12 нет словаря, поэтому — своя).
(() => {
  const bar = document.getElementById('bar');
  if (!bar) return;
  const box = document.createElement('div');
  box.id = 'notesOverlay'; box.hidden = true;
  box.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(10,16,14,.72);align-items:center;justify-content:center';
  const css = document.createElement('style'); css.textContent = '#notesOverlay{display:flex}#notesOverlay[hidden]{display:none}'; document.head.append(css);
  const fr = document.createElement('iframe');
  fr.title = 'Конспект главы';
  fr.style.cssText = 'width:min(1000px,94vw);height:88vh;border:1.5px solid #3a5047;border-radius:16px;background:#1d2b27';
  box.append(fr); document.body.append(box);
  const btn = document.createElement('button');
  btn.className = 'icon txt'; btn.id = 'bNotes'; btn.title = 'Конспект главы (G)'; btn.setAttribute('aria-label', 'Конспект главы (G)'); btn.textContent = '§';
  const help = document.getElementById('bHelp');
  help ? bar.insertBefore(btn, help) : bar.append(btn);
  let resume = false;
  const toggle = (open = box.hidden) => {
    if (open === !box.hidden) return;
    box.hidden = !open;
    if (open) {
      resume = P.playing; if (P.playing) setPlaying(false);
      if (!fr.src) fr.src = `../notes/?embed=1#ch${String(CHAPTER.number).padStart(2, '0')}`;
      fr.focus();
    } else { window.focus(); if (resume) setPlaying(true); }
  };
  btn.onclick = () => toggle();
  box.onclick = e => { if (e.target === box) toggle(false); };
  addEventListener('message', e => { if (e.source === fr.contentWindow && e.data?.glossary === 'close') toggle(false); });
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    if ((e.key === 'g' || e.key === 'G' || e.code === 'KeyG') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); toggle(); }
    else if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); e.stopPropagation(); toggle(false); }
  }, true);
})();
