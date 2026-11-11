// Общее для дополнительных страниц книги (экзамен, тренажёр IPv4, конспекты, команды, словарь, визуализации):
// прогресс читателя — тот же ключ и формат, что у уроков (engine.js) и оглавления, шапка с навигацией, гид-«бесконечность».
'use strict';
const BOOK_URL = new URL('../', location.href);
const BOOK_PROGRESS_KEY = 'animebook:progress:' + BOOK_URL.pathname;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
// done: пройденные главы, last: открыта последней, at: закладки { глава: { id, i, n } },
// res: { глава: { id вопроса: [верно, всего, неверные строки?] } }, exams: история экзаменов,
// tasks: задачи тренажёра, решённые неверно или с показанным решением, — {g, q, fields, sol}, новые первыми.
function loadProgress() {
  let p = {};
  try { const saved = JSON.parse(localStorage.getItem(BOOK_PROGRESS_KEY) || '{}'); if (isObj(saved)) p = saved; } catch {}
  p.done = Array.isArray(p.done) ? p.done.filter(n => Number.isInteger(n) && n > 0) : [];
  for (const k of ['at', 'res']) if (!isObj(p[k])) p[k] = {};
  if (!Array.isArray(p.exams)) p.exams = [];
  p.tasks = Array.isArray(p.tasks) ? p.tasks.filter(isObj) : [];
  return p;
}
function progress(f) {
  const p = loadProgress();
  f(p);
  try { localStorage.setItem(BOOK_PROGRESS_KEY, JSON.stringify(p)); } catch {}
}
// Ошибки к повторению: вопросы, последний ответ на которые был неверным.
function missed(p = loadProgress()) {
  const out = [];
  for (const [ch, qs] of Object.entries(p.res)) {
    if (!isObj(qs)) continue;
    for (const [id, r] of Object.entries(qs)) if (Array.isArray(r) && r[0] < r[1]) out.push({ ch: +ch, id, wrong: r[2] || [] });
  }
  return out;
}
// Всего к повторению: вопросы уроков и экзамена плюс нерешённые задачи тренажёра IPv4.
const missCount = (p = loadProgress()) => missed(p).length + p.tasks.length;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const chId = n => 'ch' + String(n).padStart(2, '0');
const lessonHref = (ch, beat) => `../${chId(ch)}/` + (beat ? `?from=${encodeURIComponent(beat)}` : '');
function h(tag, cls, kids = []) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of [].concat(kids)) if (k != null && k !== false) e.append(k);
  return e;
}
const $ = id => document.getElementById(id);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Шапка: гид и название ведут к оглавлению, справа — разделы книги. current — ключ текущей страницы.
const PAGES = [['contents', '../#contents', 'Главы'], ['exam', '../exam/', 'Экзамен'], ['miss', '../exam/?mode=miss', 'Ошибки'],
  ['trainer', '../trainer/', 'Тренажёр'], ['lab', '../lab/', 'Лаборатория'], ['notes', '../notes/', 'Конспекты'], ['defense', '../defense/', 'К защите']];
function topBar(current) {
  $('top').innerHTML = `<a class="home" href="../#contents" aria-label="К оглавлению"><svg class="mascot" width="46" height="32"></svg><strong>Методы <i>оптимизации</i></strong></a>` +
    `<nav class="nav" aria-label="Разделы книги">` + PAGES.map(([k, href, label]) =>
      `<a href="${href}" data-k="${k}"${k === current ? ' aria-current="page"' : ''}>${label}</a>`).join('') + `</nav>`;
  missBadge();
  drawGuides();
  $('top').querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
// Счётчик у «Ошибок»: обновляется сразу после ответа, шапка не перерисовывается.
function missBadge() {
  const a = document.querySelector('.nav a[data-k="miss"]');
  if (!a) return;
  const n = missCount();
  let b = a.querySelector('b');
  if (!n) { b?.remove(); return; }
  if (!b) a.append(b = document.createElement('b'));
  b.textContent = n;
}

// Гид нарисован так же, как в уроках: знак бесконечности, петли — глаза.
function lemniscate(cx, cy, a, k) {
  let d = '';
  for (let i = 0; i <= 96; i++) {
    const t = i / 96 * 2 * Math.PI, sn = Math.sin(t), q = 1 + sn * sn;
    d += (i ? 'L' : 'M') + (cx + a * Math.cos(t) / q).toFixed(1) + ' ' + (cy + k * a * sn * Math.cos(t) / q).toFixed(1);
  }
  return d + 'Z';
}
function drawGuides() {
  for (const svg of document.querySelectorAll('svg.mascot:not([viewBox])')) {
    svg.setAttribute('viewBox', '0 0 120 84');
    svg.setAttribute('aria-hidden', 'true');
    const ln = 'fill="none" stroke="#ece8dc" stroke-linecap="round" stroke-linejoin="round"';
    svg.innerHTML = `<g class="mbody"><path d="${lemniscate(60, 40, 52, 1.5)}" ${ln} stroke-width="6"/>` +
      [33, 87].map(x => `<circle class="pupil" cx="${x}" cy="40" r="6.5" fill="#ece8dc"/><path class="joy" d="M${x - 7} 43Q${x} 32 ${x + 7} 43" ${ln} stroke-width="4"/>`).join('') +
      `<path d="M55 62Q60 67 65 62" ${ln} stroke-width="3.5"/></g>`;
  }
}
// Склонение: plural(5, 'вопрос', 'вопроса', 'вопросов').
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
