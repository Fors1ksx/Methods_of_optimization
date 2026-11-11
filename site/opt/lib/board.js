// Элементы доски книги (взяты из библиотеки учебника «Сетевичок»): текст, ярлыки, таблицы, пункты, ввод ответа (typeIn),
// итоги главы. Загружается после engine.js и math.js; пользуется их COL, G, T, path, mk, tw, fx и т.д.
'use strict';
// Метаданные вопроса для банка экзамена (tools/build_bank.py читает build.meta).
const tagQ = (meta, build) => Object.assign(build, { meta });
const MONO = '"Cascadia Mono","Consolas","DejaVu Sans Mono","Courier New",monospace';
// Цвет = уровень модели, одинаково во всей книге.
const NC = { l1: COL.nat, l2: COL.whole, l3: COL.int, l4: COL.rat, app: COL.irr, cmd: COL.real };
const monoW = (str, size) => { ctx2d.font = `${size}px ${MONO}`; return ctx2d.measureText(str).width; };
const textWd = (str, size, weight = 500) => { ctx2d.font = `${weight} ${size}px ${UI}`; return ctx2d.measureText(str).width; };

/* ---------- текст ---------- */
// Текст, появляющийся в t0 (если t0 задан).
function say(p, str, x, y, t0, { size = 30, fill = COL.chalk, anchor = 'start', weight = 500, font = UI, dur = .5 } = {}) {
  const e = T(p, str, { x, y, size, fill, anchor, weight, font, o: 0 });
  if (t0 !== undefined) show(e, t0, dur);
  return e;
}
// Абзац с переносом по ширине w; возвращает группу с ._h (высота).
function para(p, str, x, y, t0, { w = 600, size = 28, lh = 1.35, fill = COL.chalk, weight = 500, anchor = 'start' } = {}) {
  const g = G(p, { o: 0 }), lines = [];
  let cur = '';
  for (const word of str.split(/\s+/)) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && textWd(next, size, weight) > w) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => T(g, l, { x, y: y + i * size * lh, size, fill, weight, anchor }));
  g._h = lines.length * size * lh;
  if (t0 !== undefined) show(g, t0);
  return g;
}
// Заголовок шага в левом верхнем углу: «1.3 · Способы доступа».
function kick(p, str, t0 = .1) { return say(p, str, 96, 92, t0, { size: 26, fill: COL.dim, weight: 600 }); }
// Крупный заголовок идеи.
function title(p, str, t0 = .2, { x = 96, y = 160, size = 52, fill = COL.chalk } = {}) { return say(p, str, x, y, t0, { size, fill, weight: 600 }); }
// Ярлык-«таблетка» с текстом, центр в (x, y).
function tag(p, str, x, y, color, t0, { size = 24, fill, mono = false, o = 0, solid = false } = {}) {
  const g = G(p, { x, y, o, s: 1 });
  const w = (mono ? monoW(str, size) : textWd(str, size, 600)) + size * 1.2, hh = size * 1.6;
  mk('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: hh / 2, fill: solid ? color : mix(COL.board, color, .18), stroke: color, 'stroke-width': 2 }, g);
  T(g, str, { y: size * .36, size, anchor: 'middle', weight: 600, fill: fill || (solid ? COL.board : color), font: mono ? MONO : UI });
  g._w = w; g._h = hh;
  if (t0 !== undefined) show(g, t0);
  return g;
}
// Прямоугольник-рамка (o: 0), появится через show/draw. (Не frame: так называется цикл анимации движка.)
function boxR(p, x, y, w, h, { stroke = COL.dim, fill = 'none', rx = 14, sw = 2.5, dash = '', o = 0 } = {}) {
  return put(mk('rect', { x, y, width: w, height: h, rx, fill, stroke, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': dash } : {}) }, p), { o });
}
// Стрелка из (x1,y1) в (x2,y2), рисуется в t0.
function arrowTo(p, x1, y1, x2, y2, color, t0, { w = 3.5, head = 14, dur = .5, dash = '', run = tw } = {}) {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const g = G(p);
  const l = path(g, `M${x1} ${y1}L${x2} ${y2}`, { stroke: color, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': dash } : {}) }, dash ? { o: 0 } : { d: 0 });
  const hd = path(g, `M${x2 - head * ux - head * .6 * uy} ${y2 - head * uy + head * .6 * ux}L${x2} ${y2}L${x2 - head * ux + head * .6 * uy} ${y2 - head * uy - head * .6 * ux}`, { stroke: color, 'stroke-width': w }, { o: 0 });
  if (t0 !== undefined) { run(l, dash ? { o: 1 } : { d: 1 }, t0, dur); run(hd, { o: 1 }, t0 + dur * .8, .2); }
  return g;
}
// Перечёркивание: красный крест поверх элемента в рамке [x, y, w, h].
function strike(p, x, y, w, h, t0, run = tw) {
  const s = path(p, `M${x} ${y + h}L${x + w} ${y}`, { stroke: COL.bad, 'stroke-width': 5 }, { d: 0 });
  run(s, { d: 1 }, t0, .35);
  return s;
}

/* ---------- устройства ---------- */
// Значок устройства с центром в (x, y). kind: pc laptop server switch l3 router hub ap cloud firewall phone printer.
// Возвращает группу: ._r — радиус для обрезки линий, .x/.y — центр, ._lab — подпись.
const DEV_R = { pc: 46, laptop: 46, server: 48, switch: 62, l3: 62, router: 46, hub: 62, ap: 42, cloud: 92, firewall: 46, phone: 34, printer: 44 };
function dev(p, kind, x, y, { label, sub, color = COL.chalk, s = 1, o = 0, labelY, subColor = COL.dim, size = 24 } = {}) {
  const g = G(p, { x, y, s, o });
  const ln = { fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const body = { ...ln, fill: mix(COL.board, color, .12) };
  const P2 = (d, a = ln) => mk('path', { d, ...a }, g);
  switch (kind) {
    case 'pc':
      mk('rect', { x: -44, y: -40, width: 88, height: 60, rx: 6, ...body }, g);
      mk('rect', { x: -36, y: -32, width: 72, height: 44, rx: 3, fill: mix(COL.board, color, .22), stroke: 'none' }, g);
      P2('M-10 20L-14 36H14L10 20M-26 38H26'); break;
    case 'laptop':
      mk('rect', { x: -36, y: -38, width: 72, height: 48, rx: 5, ...body }, g);
      P2('M-48 16H48L42 26H-42Z', body); break;
    case 'server':
      mk('rect', { x: -30, y: -48, width: 60, height: 96, rx: 6, ...body }, g);
      for (const yy of [-28, -6, 16]) { P2(`M-18 ${yy}H8`); mk('circle', { cx: 18, cy: yy, r: 3.5, fill: color }, g); }
      break;
    case 'switch': case 'l3':
      mk('rect', { x: -60, y: -26, width: 120, height: 52, rx: 8, ...body }, g);
      P2('M-38 -9H30M22 -16L30 -9L22 -2M38 9H-30M-22 2L-30 9L-22 16');
      if (kind === 'l3') { mk('rect', { x: 34, y: -42, width: 40, height: 26, rx: 6, fill: COL.board, stroke: NC.l3, 'stroke-width': 2 }, g); T(g, 'L3', { x: 54, y: -22, size: 18, fill: NC.l3, weight: 700, anchor: 'middle' }); }
      break;
    case 'router':
      mk('ellipse', { cx: 0, cy: 10, rx: 44, ry: 16, ...body }, g);
      mk('rect', { x: -44, y: -12, width: 88, height: 22, fill: mix(COL.board, color, .12), stroke: 'none' }, g);
      P2('M-44 -12V10M44 -12V10');
      mk('ellipse', { cx: 0, cy: -12, rx: 44, ry: 16, ...body }, g);
      P2('M-26 -18L-8 -13M-26 -18L-22 -11M26 -6L8 -11M26 -6L22 -13M-8 -6L-26 -1M-8 -6L-12 -1M8 -18L26 -23M26 -23L19 -24', { ...ln, 'stroke-width': 2.5 });
      break;
    case 'hub':
      mk('rect', { x: -60, y: -20, width: 120, height: 40, rx: 6, ...body }, g);
      P2('M-40 0H40'); for (const xx of [-30, -10, 10, 30]) P2(`M${xx} -6V6`); break;
    case 'ap':
      mk('rect', { x: -38, y: -6, width: 76, height: 26, rx: 10, ...body }, g);
      for (const r of [12, 24, 36]) P2(`M${-r * .8} ${-12 - r * .4}Q0 ${-12 - r * 1.1} ${r * .8} ${-12 - r * .4}`);
      break;
    case 'cloud':
      P2('M-60 30C-96 30 -96 -14 -62 -16C-62 -50 -14 -58 -2 -34C10 -60 62 -54 60 -18C96 -18 96 30 60 30Z', body); break;
    case 'firewall':
      mk('rect', { x: -40, y: -36, width: 80, height: 72, rx: 4, ...body }, g);
      P2('M-40 -12H40M-40 12H40M-12 -36V-12M14 -12V12M-12 12V36M-26 -12V12M26 12V36M24 -36V-12'); break;
    case 'phone':
      mk('rect', { x: -22, y: -36, width: 44, height: 72, rx: 8, ...body }, g);
      P2('M-6 26H6'); break;
    case 'printer':
      mk('rect', { x: -40, y: -14, width: 80, height: 34, rx: 6, ...body }, g);
      P2('M-26 -14V-36H26V-14M-26 20V34H26V20'); break;
  }
  const r = DEV_R[kind] || 46;
  const ly = labelY ?? (kind === 'cloud' ? 62 : kind === 'server' ? 76 : kind === 'ap' ? 52 : kind === 'switch' || kind === 'l3' || kind === 'hub' ? 58 : 66);
  if (label) g._lab = T(g, label, { y: ly, size, fill: COL.chalk, weight: 600, anchor: 'middle' });
  if (sub) g._sub = T(g, sub, { y: ly + size * 1.15, size: size * .85, fill: subColor, anchor: 'middle', font: MONO });
  Object.assign(g, { _r: r * s, _kind: kind, cx: x, cy: y });
  return g;
}
const devAt = d => [d.cx, d.cy];
// Точка на окружности радиуса r вокруг устройства a в сторону точки (x, y).
function rim(a, x, y, r = a._r) { const L = Math.hypot(x - a.cx, y - a.cy) || 1; return [a.cx + (x - a.cx) / L * r, a.cy + (y - a.cy) / L * r]; }
// Линия связи между устройствами a и b (или точками [x, y]). kind: copper | fiber | wifi | serial.
function link(p, a, b, t0, { color, kind = 'copper', w = 4, label, labelColor, dur = .6, run = tw, la = .5, ldy = -16 } = {}) {
  const A = Array.isArray(a) ? a : rim(a, ...(Array.isArray(b) ? b : devAt(b)));
  const B = Array.isArray(b) ? b : rim(b, ...(Array.isArray(a) ? a : devAt(a)));
  const c = color || (kind === 'fiber' ? COL.nat : kind === 'wifi' ? COL.whole : kind === 'serial' ? COL.int : COL.dim);
  const g = G(p);
  const dash = kind === 'wifi' ? '3 12' : '';
  const l = path(g, `M${A[0]} ${A[1]}L${B[0]} ${B[1]}`, { stroke: c, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': dash } : {}) }, dash ? { o: 0 } : { d: 0 });
  if (kind === 'serial') { const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; l.setAttribute('d', `M${A[0]} ${A[1]}L${mx + 10} ${my - 12}L${mx - 10} ${my + 12}L${B[0]} ${B[1]}`); }
  if (t0 !== undefined) run(l, dash ? { o: 1 } : { d: 1 }, t0, dur);
  if (label) {
    const t = T(g, label, { x: A[0] + (B[0] - A[0]) * la, y: A[1] + (B[1] - A[1]) * la + ldy, size: 20, fill: labelColor || COL.dim, anchor: 'middle', font: MONO, o: 0 });
    if (t0 !== undefined) run(t, { o: 1 }, t0 + dur * .7, .3);
  }
  Object.assign(g, { A, B, line: l });
  return g;
}
// Подпись порта у конца линии, ближе к устройству a.
function portTag(p, lk, atStart, str, t0, { color = COL.dim, off = 34, side = -1 } = {}) {
  const [x1, y1] = atStart ? lk.A : lk.B, [x2, y2] = atStart ? lk.B : lk.A;
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  return say(p, str, x1 + ux * off - uy * 18 * side, y1 + uy * off + ux * 18 * side + 7, t0, { size: 19, fill: color, font: MONO, anchor: 'middle' });
}

/* ---------- пакеты и кадры в движении ---------- */
// Конверт (кадр/пакет) с центром в (x, y); label — надпись рядом; fields — короткая строка на конверте.
function envelope(p, x, y, color = COL.task, { label, o = 0, s = 1, w = 54, hgt = 36, text } = {}) {
  const g = G(p, { x, y, o, s });
  mk('rect', { x: -w / 2, y: -hgt / 2, width: w, height: hgt, rx: 5, fill: mix(COL.board, color, .35), stroke: color, 'stroke-width': 2.5 }, g);
  if (text) T(g, text, { y: 7, size: 18, fill: COL.chalk, weight: 700, anchor: 'middle' });
  else mk('path', { d: `M${-w / 2 + 3} ${-hgt / 2 + 3}L0 ${hgt * .12}L${w / 2 - 3} ${-hgt / 2 + 3}`, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g);
  if (label) g._lab = T(g, label, { y: -hgt / 2 - 10, size: 20, fill: color, weight: 600, anchor: 'middle' });
  return g;
}
// Путь из точек/устройств: каждый элемент — устройство или [x, y].
const pt = q => Array.isArray(q) ? q : [q.cx, q.cy];
// Отправить конверт по маршруту pts начиная с t0. speed — пикселей в секунду. Возвращает { e, end } — end: время прибытия.
// live: true — на часах вопроса (fx), иначе на часах урока (tw).
function send(p, pts, t0, { color = COL.task, label, speed = 520, live = false, keep = false, text, appear = .25, w, hgt } = {}) {
  const P0 = pt(pts[0]);
  const e = envelope(p, P0[0], P0[1], color, { label, text, w, hgt });
  const run = live ? (el, to, t, d, ease) => fx(el, to, t, d, ease) : tw;
  run(e, { o: 1 }, t0, appear);
  let t = t0 + appear * .6;
  for (let i = 1; i < pts.length; i++) {
    const a = pt(pts[i - 1]), b = pt(pts[i]), d = Math.hypot(b[0] - a[0], b[1] - a[1]) / speed;
    run(e, { x: b[0], y: b[1] }, t, d, i === 1 && pts.length === 2 ? io : lin);
    t += d;
  }
  if (!keep) run(e, { o: 0, s: .6 }, t, .3);
  return { e, end: t };
}
// Вспышка-кольцо вокруг точки (устройство получило/отбросило).
function ping(p, at, color, t0, { r = 60, run = tw } = {}) {
  const [x, y] = pt(at);
  const c = put(mk('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: color, 'stroke-width': 4 }, p), { x, y, s: .5, o: 0 });
  run(c, { o: 1, s: .9 }, t0, .2, out); run(c, { o: 0, s: 1.3 }, t0 + .2, .5);
  return c;
}
// Знак «отброшено» (красный крест) в точке.
function dropX(p, at, t0, run = tw) {
  const [x, y] = pt(at);
  const g = G(p, { x, y, o: 0, s: .5 });
  path(g, 'M-16 -16L16 16M16 -16L-16 16', { stroke: COL.bad, 'stroke-width': 6 });
  run(g, { o: 1, s: 1 }, t0, .35, back);
  return g;
}
// Галочка в точке.
function okMark(p, at, t0, run = tw) {
  const [x, y] = pt(at);
  const g = G(p, { x, y, o: 0, s: .5 });
  path(g, 'M-16 0L-5 12L18 -14', { stroke: COL.good, 'stroke-width': 6 });
  run(g, { o: 1, s: 1 }, t0, .35, back);
  return g;
}

/* ---------- терминал Cisco IOS ---------- */
// Окно терминала. Строки печатаются по очереди: cmd() — приглашение + набор команды, out() — вывод устройства.
function term(p, { x = 860, y = 160, w = 640, h = 420, title = 'Консоль', size = 24, o = 0 } = {}) {
  const g = G(p, { o });
  mk('rect', { x, y, width: w, height: h, rx: 14, fill: '#0f1714', stroke: COL.faint, 'stroke-width': 2 }, g);
  mk('path', { d: `M${x} ${y + 40}H${x + w}`, stroke: COL.faint, 'stroke-width': 1.5 }, g);
  [0, 1, 2].forEach(i => mk('circle', { cx: x + 24 + i * 20, cy: y + 20, r: 6, fill: [COL.bad, COL.int, COL.good][i], opacity: .6 }, g));
  T(g, title, { x: x + w / 2, y: y + 27, size: 18, fill: COL.dim, anchor: 'middle', weight: 600 });
  const clipId = 'tc' + Math.random().toString(36).slice(2, 8);
  const cp = mk('clipPath', { id: clipId }, g); mk('rect', { x, y: y + 42, width: w, height: h - 46 }, cp);
  const view = mk('g', { 'clip-path': `url(#${clipId})` }, g);
  const body = G(view);
  const lh = size * 1.45, rows = Math.floor((h - 60) / lh);
  let n = 0;
  const lineY = i => y + 50 + size + i * lh;
  const scroll = t0 => { if (n >= rows) tw(body, { y: -(n - rows + 1) * lh }, t0, .25); };
  const Tm = {
    g, x, y, w, h, lh, size,
    // Приглашение (появляется сразу) и команда (набирается). Возвращает время конца набора.
    cmd(prompt, command, t0, { color = COL.chalk, pc = COL.dim, speed = 22, hl, pt = t0 } = {}) {
      scroll(Math.min(pt, t0));
      const yy = lineY(n++);
      const pr = T(body, prompt, { x: x + 20, y: yy, size, fill: pc, font: MONO, o: 0 });
      show(pr, pt, .15);
      const px = x + 20 + monoW(prompt, size);   // как в IOS: команда сразу за приглашением
      const c = T(body, '', { x: px, y: yy, size, fill: hl || color, font: MONO, o: 0 });
      const dur = Math.max(.25, command.length / speed);
      show(c, t0 + .2, .05); stream(c, command, t0 + .2, dur);
      return t0 + .2 + dur;
    },
    // Строка вывода целиком.
    out(str, t0, { color = COL.dim, dx = 0 } = {}) {
      scroll(t0);
      const e = T(body, str, { x: x + 20 + dx, y: lineY(n++), size, fill: color, font: MONO, o: 0 });
      show(e, t0, .2);
      return e;
    },
    gap() { n++; },
    // Вывод нескольких строк подряд с шагом dt.
    outs(lines, t0, opts = {}, dt = .12) { return lines.map((l, i) => Tm.out(l, t0 + i * dt, opts)); },
  };
  return Tm;
}

/* ---------- таблицы ---------- */
// Таблица: cols = [[заголовок, ширина], ...]. row() добавляет строку, hl() подсвечивает.
function table(p, { x = 96, y = 220, cols, rh = 52, size = 24, head = COL.dim, mono = [], o = 0, t0 } = {}) {
  const g = G(p, { o }), W = cols.reduce((a, c) => a + c[1], 0);
  const xs = [x]; cols.forEach(c => xs.push(xs.at(-1) + c[1]));
  cols.forEach((c, j) => T(g, c[0], { x: xs[j] + 14, y: y + size, size: size * .85, fill: head, weight: 600 }));
  mk('path', { d: `M${x} ${y + rh * .75}H${x + W}`, stroke: COL.faint, 'stroke-width': 2 }, g);
  if (t0 !== undefined) show(g, t0);
  const Tb = {
    g, xs, W, rows: [], y0: y + rh * .75,
    rowY: i => y + rh * .75 + i * rh,
    row(cells, t1, { color = COL.chalk, run = tw, i = Tb.rows.length, o: ro = 0 } = {}) {
      const r = G(p, { o: ro }), yy = Tb.rowY(i);
      cells.forEach((c, j) => {
        const spec = c && typeof c === 'object' ? c : { t: String(c) };
        T(r, spec.t, { x: xs[j] + 14, y: yy + rh * .66, size, fill: spec.c || color, weight: spec.b ? 700 : 500, font: (spec.mono ?? mono.includes(j)) ? MONO : UI });
      });
      mk('path', { d: `M${x} ${yy + rh}H${x + W}`, stroke: COL.faint, 'stroke-width': 1, opacity: .6 }, r);
      if (t1 !== undefined) run(r, { o: 1 }, t1, .35);
      Tb.rows[i] = r;
      return r;
    },
    // Подсветка строки i (рамка цвета color).
    hl(i, color, t1, { run = tw, into = p } = {}) {
      const yy = Tb.rowY(i);
      const b = put(mk('rect', { x: x - 4, y: yy + 3, width: W + 8, height: rh - 6, rx: 10, fill: mix(COL.board, color, .16), stroke: color, 'stroke-width': 2.5 }, into), { o: 0 });
      into.insertBefore(b, into.firstChild);
      run(b, { o: 1 }, t1, .3);
      return b;
    },
    cellBox: (i, j) => [xs[j], Tb.rowY(i), xs[j + 1] - xs[j], rh],
  };
  return Tb;
}

/* ---------- заголовки PDU и стек уровней ---------- */
// Полоса заголовков: fields = [[подпись, ширина, цвет], ...] слева направо. Каждое поле — отдельная группа (o: 0).
function pdu(p, fields, { x = 800, y = 450, h = 64, size = 22, anchor = 'middle' } = {}) {
  const W = fields.reduce((a, f) => a + f[1], 0);
  let cx = anchor === 'middle' ? x - W / 2 : anchor === 'end' ? x - W : x;
  const blocks = fields.map(([lab, w, c]) => {
    const b = G(p, { o: 0 });
    mk('rect', { x: cx + 2, y: y - h / 2, width: w - 4, height: h, rx: 8, fill: mix(COL.board, c, .3), stroke: c, 'stroke-width': 2.5 }, b);
    const lines = String(lab).split('\n');
    lines.forEach((l, i) => T(b, l, { x: cx + w / 2, y: y + size * .36 + (i - (lines.length - 1) / 2) * size * 1.1, size, fill: COL.chalk, weight: 600, anchor: 'middle' }));
    b._x = cx; b._w = w; b._cx = cx + w / 2;
    cx += w;
    return b;
  });
  return Object.assign(blocks, { W, x0: blocks[0]?._x, y, h });
}
// Стек уровней сверху вниз: layers = [[название, цвет, подпись справа?], ...].
function layers(p, list, { x = 120, y = 200, w = 520, h = 76, gap = 10, size = 30 } = {}) {
  return list.map(([name, c, note], i) => {
    const g = G(p, { o: 0 }), yy = y + i * (h + gap);
    mk('rect', { x, y: yy, width: w, height: h, rx: 12, fill: mix(COL.board, c, .22), stroke: c, 'stroke-width': 2.5 }, g);
    T(g, name, { x: x + 24, y: yy + h / 2 + size * .36, size, fill: COL.chalk, weight: 600 });
    if (note) T(g, note, { x: x + w - 20, y: yy + h / 2 + 8, size: 22, fill: c, anchor: 'end', weight: 600 });
    g._y = yy; g._h = h; g._cy = yy + h / 2;
    return g;
  });
}

/* ---------- биты ---------- */
// Ряд битов: str из 0/1 и точек. Возвращает массив текстов битов (точки пропускаются) с ._x.
function bitRow(p, str, { x = 800, y = 450, cw = 30, size = 32, fill = COL.chalk, anchor = 'middle', o = 0, dotW = 18 } = {}) {
  const g = G(p, { o });
  const W = [...str].reduce((a, c) => a + (c === '.' ? dotW : c === ' ' ? cw * .5 : cw), 0);
  let cx = anchor === 'middle' ? x - W / 2 : x;
  const bits = [];
  for (const c of str) {
    if (c === '.' || c === ' ') { if (c === '.') T(g, '.', { x: cx + dotW / 2, y, size, fill: COL.dim, font: MONO, anchor: 'middle' }); cx += c === '.' ? dotW : cw * .5; continue; }
    const t = T(g, c, { x: cx + cw / 2, y, size, fill, font: MONO, anchor: 'middle' });
    t._x = cx + cw / 2; bits.push(t); cx += cw;
  }
  return Object.assign(bits, { g, W, x0: anchor === 'middle' ? x - W / 2 : x });
}
// Перекрасить биты с i по j (включительно).
function paintBits(bits, i, j, color, t0, run = tw) { for (let k = i; k <= j; k++) run(bits[k], { c_fill: color }, t0 + (k - i) * .02, .3); }

/* ---------- вопрос с вводом текста ---------- */
// rows: [{ parts: ['текст', { box: 'ответ', alts: ['вариант', ...], w: 10, hex? }, ...], why, hint? }].
// Сравнение без учёта регистра и лишних пробелов. Подходит для команд и адресов.
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
// hex: true — шестнадцатеричный идентификатор (EUI-64, MAC): годятся и группы IPv6 (001A:2BFF:FE3C:4D5E, 21a:…),
// и байты через «:», «-», «.», пробел или слитно; ведущие нули в группе необязательны.
function hexNorm(s) {
  const t = norm(s), g = t.split(/[:.\- ]+/).filter(Boolean);
  if (!g.length || !g.every(x => /^[0-9a-f]+$/.test(x))) return t;
  const size = g.length === 4 ? 4 : g.length >= 6 ? 2 : 0;
  return size ? g.map(x => x.padStart(size, '0')).join('') : g.join('');
}
const typeIn = rowsIn => tagQ({ type: 'typeIn', rows: rowsIn }, (body, api) => {
  const all = [];
  const rows = rowsIn.map(it => {
    const line = h('div', 'bline tline'), mark = h('span', 'mark'), why = h('div', 'why');
    const boxes = [];
    for (const p of it.parts) {
      if (p && p.box !== undefined) {
        const b = h('input', 'box tbox');
        Object.assign(b, { type: 'text', autocomplete: 'off', spellcheck: false });
        b.setAttribute('aria-label', 'Ответ');
        b._norm = p.hex ? hexNorm : norm;
        b._ok = [p.box, ...(p.alts || [])].map(b._norm);
        b._show = p.box;
        b.style.width = `${p.w || Math.max(4, String(p.box).length + 2)}ch`;
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
    for (const b of r.boxes) { const good = b._ok.includes(b._norm(b.value)); b.classList.toggle('good', good); b.classList.toggle('bad', !good); ok = ok && good; }
    r.mark.className = 'mark ' + (ok ? 'good' : 'bad'); r.mark.textContent = ok ? '✓' : '✗';
    r.why.replaceChildren(ok || single ? '' : rich(r.it.hint ?? r.it.why, 20));
    return ok;
  };
  requestAnimationFrame(() => all[0]?.focus({ preventScroll: true }));
  return {
    check() {
      const oks = rows.map(judge), right = oks.filter(Boolean).length, done = right === rows.length;
      api.grade(done, single ? (done ? rows[0].it.why : rows[0].it.hint ?? rows[0].it.why) : done ? [] : [`${right} из ${rows.length} верно. Исправьте строки с ✗ и проверьте снова.`],
        { right, total: rows.length, wrong: oks.flatMap((ok, i) => ok ? [] : [i]) });
    },
    reveal() {
      for (const r of rows) { r.boxes.forEach(b => { b.value = b._show; }); judge(r); if (!single) r.why.replaceChildren(rich(r.it.why, 20)); }
      return single ? rows[0].it.why : 'правильные ответы вписаны.';
    },
    lock() { all.forEach(b => { b.disabled = true; }); },
    hint: ['введите ответ, ', kbd('Tab'), ' следующее поле, ', kbd('Enter'), ' проверить, ', kbd('Esc'), ' выйти из поля'],
  };
});
// Верно/неверно для нескольких утверждений (текстовые строки).
const TFQ = items => grid(items.map(([s, ok, why]) => ({ parts: [s], ans: [ok ? 't' : 'f'], why })), TF, { multi: false, text: true });

/* ---------- общие кадры ---------- */
// Титульный кадр главы.
function introCard(m, D, unitLine, name, sub, { markSub = 'sub' } = {}) {
  const g = G(scene, { o: 0, y: 24 });
  const lines = name.split('\n'), big = lines.some(l => l.length > 22) ? 70 : 84, up = (lines.length - 1) * big * 1.1;
  T(g, unitLine, { x: 800, y: 330 - up, size: 28, fill: COL.dim, anchor: 'middle', weight: 600 });
  lines.forEach((l, i) => T(g, l, { x: 800, y: 430 - up + i * big * 1.1, size: big, weight: 600, anchor: 'middle' }));
  tw(g, { o: 1, y: 0 }, .2, 1.1, out);
  const r = say(scene, sub, 800, 560, m(markSub), { size: 34, fill: COL.dim, anchor: 'middle' });
  tw(g, { o: 0, y: -24 }, D - .9, .8); hide(r, D - .9, .8);
}
// Итоги: 3–4 пронумерованных вывода, каждый появляется на своей метке.
function wrapList(p, items, m, { y0 = 250, dy = 140, size = 34, w = 1200 } = {}) {
  title(p, 'Главное', .1, { y: 150 });
  items.forEach(([str, mark], i) => {
    const g = G(p, { x: -16, y: y0 + i * dy, o: 0 });
    mk('circle', { cx: 130, cy: -12, r: 26, fill: COL.task }, g);
    T(g, String(i + 1), { x: 130, y: -1, size: 30, fill: COL.board, weight: 700, anchor: 'middle' });
    const pa = para(g, str, 190, 0, undefined, { w, size, weight: 600 });
    put(pa, { o: 1 });
    tw(g, { o: 1, x: 0 }, m(mark), .6);
  });
}
// Позиции карточек вопросов для сетевых схем.
const QR = { x: 1000, y: 120, w: 560, cls: 'side', maxH: 700 };   // справа, во всю высоту
const QL = { x: 40, y: 120, w: 560, cls: 'side', maxH: 700 };     // слева

/* ---------- общие помощники глав ---------- */
const WIDE = { x: 96, y: 130, w: 1408, cls: 'side', maxH: 730 };   // широкая карточка вопроса
const halo = (p, x, y, w, h, color, t0) => { const b = boxR(p, x, y, w, h, { stroke: color, dash: '10 8', rx: 18, sw: 3 }); show(b, t0); return b; };
const showAll = (els, t0, step = .12) => els.forEach((e, i) => show(e, t0 + i * step));
// Ярлык, прижатый левым краем к x.
const tagL = (p, str, x, y, color, t0, o = {}) => { const g = tag(p, str, 0, y, color, t0, o); put(g, { x: x + g._w / 2 }); return g; };
// Ряд ярлыков слева направо от x.
function tagRow(p, list, x, y, color, t0, { gap = 12, size = 22, dt = .2, mono = false } = {}) {
  let cx = x;
  return list.map((s, i) => { const g = tag(p, s, 0, y, color, t0 + i * dt, { size, mono }); put(g, { x: cx + g._w / 2 }); cx += g._w + gap; return g; });
}
// Строка «ярлык — пояснение».
function legend(p, key, text, x, y, color, t0, { mono = true, size = 22 } = {}) {
  const g = tagL(p, key, x, y, color, t0, { mono, size });
  say(p, text, x + g._w + 16, y + 8, t0 + .15, { size: size + 2, fill: COL.chalk });
  return g;
}
// Пронумерованный пункт слева.
function item(p, n, str, y, t0, { color = NC.cmd, size = 26, x = 96, mono = false } = {}) {
  const g = G(p, { o: 0, x: -12 });
  mk('circle', { cx: x + 20, cy: y - 9, r: 19, fill: color }, g);
  T(g, String(n), { x: x + 20, y: y - 1, size: 22, fill: COL.board, weight: 700, anchor: 'middle' });
  T(g, str, { x: x + 54, y, size, fill: COL.chalk, weight: 500, font: mono ? MONO : UI });
  tw(g, { o: 1, x: 0 }, t0, .5);
  return g;
}
// Цвета VLAN (главы XI–XIV и далее): одинаковый номер VLAN — одинаковый цвет.
const VC = { 1: COL.dim, 10: '#7fd3c4', 20: '#e8a0c8', 30: '#c9d67a', 99: NC.cmd };
