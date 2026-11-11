// Дополнения плеера книги поверх движка Papermorph v2.12 (движок не меняется, всё через его API: P, seekInto,
// hideCover, setSpeed, BEATS, TIMINGS). Как в «Сетевичке»:
//   • полосу шагов можно зажать и тянуть: заполнение идёт за курсором, над ним номер шага, название и время;
//     при отпускании урок играет с этой точки (наведение без нажатия тоже показывает подсказку);
//   • скорость 0,75–2×: кнопка открывает меню, клавиши < и > (Б и Ю в русской раскладке) — ниже/выше;
//   • удерживать Пробел или правую кнопку мыши на кадре — временно 2×, отпустить — прежняя скорость.
// Подключается в главе после engine.js (и opt.js), до timings.js не обязательно.
'use strict';
(() => {
  if (typeof P === 'undefined' || !document.getElementById('segs')) return;
  const $id = id => document.getElementById(id);
  const RATES = [.75, 1, 1.25, 1.5, 1.75, 2];
  const FAST = 2, HOLD_MS = 280;
  const fmtRate = r => String(r).replace('.', ',') + '×';
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------- стили ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #segs { position: relative; touch-action: none; cursor: pointer; }
  #segs.drag, #segs.drag * { cursor: grabbing; }
  .pp-scrub { position: absolute; left: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 4px; pointer-events: none;
    background: var(--quiz, #86c9e8); opacity: .55; z-index: 2; display: none; }
  .pp-knob { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; pointer-events: none;
    background: var(--chalk, #ece8dc); box-shadow: 0 0 0 3px rgba(0,0,0,.35); z-index: 3; display: none; }
  .pp-tip { position: absolute; bottom: 30px; transform: translateX(-50%); pointer-events: none; z-index: 4; display: none;
    background: rgba(15, 24, 21, .96); color: var(--chalk, #ece8dc); border: 1px solid #3a5047; border-radius: 10px;
    padding: 6px 10px; font: 600 14px/1.3 "Segoe UI", Arial, sans-serif; white-space: nowrap; box-shadow: 0 8px 22px rgba(0,0,0,.4); }
  .pp-tip small { display: block; font-weight: 500; color: var(--dim, #9aaba3); }
  .pp-fast { position: absolute; top: 22px; right: 26px; z-index: 30; display: none; align-items: center; gap: 8px;
    padding: 8px 14px; border-radius: 999px; background: rgba(15, 24, 21, .85); color: var(--chalk, #ece8dc);
    font: 700 20px "Segoe UI", Arial, sans-serif; pointer-events: none; }
  .pp-fast.on { display: flex; }
  .pp-menu { position: absolute; bottom: 52px; z-index: 40; background: rgba(15, 24, 21, .97); border: 1px solid #3a5047;
    border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 2px; min-width: 96px; box-shadow: 0 10px 26px rgba(0,0,0,.45); }
  .pp-menu[hidden] { display: none; }
  .pp-menu p { margin: 2px 8px 4px; font: 600 12px "Segoe UI", Arial, sans-serif; color: var(--dim, #9aaba3); text-transform: uppercase; letter-spacing: .1em; }
  .pp-menu button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 8px; font: 600 16px "Segoe UI", Arial, sans-serif; color: var(--chalk, #ece8dc); }
  .pp-menu button:hover, .pp-menu button:focus-visible { background: rgba(134, 201, 232, .18); }
  .pp-menu button.on { color: var(--quiz, #86c9e8); }
  .pp-menu small { display: block; margin: 4px 8px 2px; font: 500 11px "Segoe UI", Arial, sans-serif; color: var(--dim, #9aaba3); white-space: normal; max-width: 150px; }`;
  document.head.append(css);

  /* ---------- скорость ---------- */
  const bSpeed = $id('bSpeed');
  let base = P.rate || 1, fast = false;
  const apply = r => { setSpeed(r); if (bSpeed) bSpeed.textContent = fmtRate(r); };
  try { const r = +localStorage.getItem('speed'); if (RATES.includes(r)) { base = r; apply(r); } } catch {}
  const setBase = r => { base = r; if (!fast) apply(r); else try { localStorage.setItem('speed', String(r)); } catch {} flash(fmtRate(r)); markMenu(); };
  const step = d => setBase(RATES[Math.max(0, Math.min(RATES.length - 1, (RATES.includes(base) ? RATES.indexOf(base) : 1) + d))]);

  const menu = document.createElement('div');
  menu.className = 'pp-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  menu.innerHTML = '<p>Скорость</p>' + RATES.slice().reverse().map(r => `<button role="menuitemradio" data-r="${r}">${fmtRate(r)}</button>`).join('') +
    '<small>Удерживать Пробел или правую кнопку мыши — 2×</small>';
  const markMenu = () => menu.querySelectorAll('button').forEach(b => { const on = +b.dataset.r === base; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  menu.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setBase(+b.dataset.r); menu.hidden = true; });
  if (bSpeed) {
    bSpeed.parentNode.style.position = 'relative';
    bSpeed.parentNode.append(menu);
    bSpeed.title = 'Скорость (< >); удерживать Пробел — 2×';
    // заменяем перебор скоростей движка меню (onclick перезаписывается, обработчик движка не вызывается)
    bSpeed.onclick = e => { e.stopPropagation(); markMenu(); menu.hidden = !menu.hidden; if (!menu.hidden) menu.querySelector('button.on, button')?.focus({ preventScroll: true }); };
    addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== bSpeed) menu.hidden = true; }, true);
  }

  /* ---------- временное ускорение ---------- */
  const fastMark = document.createElement('div');
  fastMark.className = 'pp-fast';
  fastMark.innerHTML = '<span>2×</span><svg width="28" height="18" viewBox="0 0 30 20"><path d="M1 1v18l13-9zM15 1v18l13-9z" fill="currentColor"/></svg>';
  ($id('frame') || document.body).append(fastMark);
  let flashT = 0;
  function flash(txt) {
    fastMark.firstChild.textContent = txt; fastMark.classList.add('on');
    clearTimeout(flashT); flashT = setTimeout(() => { if (!fast) fastMark.classList.remove('on'); }, 700);
  }
  function fastOn() {
    if (fast || !P.started || P.waiting || P.done) return false;
    fast = true; apply(FAST);
    try { localStorage.setItem('speed', String(base)); } catch {}   // в памяти остаётся обычная скорость
    if (!P.playing) $id('bPlay')?.click();
    fastMark.firstChild.textContent = fmtRate(FAST); fastMark.classList.add('on');
    return true;
  }
  function fastOff() {
    if (!fast) return;
    fast = false; apply(base); fastMark.classList.remove('on');
  }

  // Пробел: короткое нажатие — пуск/пауза (как в движке), удержание — 2× на время удержания.
  // поля ввода и кнопки карточек вопросов (#ui) — пробел для них; кнопки панели плеера пробел не «нажимает»
  const typing = t => t && t.closest && !!(t.closest('input, textarea, select, [contenteditable="true"]') || t.closest('#ui button, #ui [tabindex], .pp-menu, #notesOverlay'));
  let spaceT = 0, spaceHeld = false, spaceDown = false;
  addEventListener('keydown', e => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (typing(e.target) || !$id('help')?.hidden || P.waiting) return;   // в вопросах и полях пробел ведёт себя как обычно
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || spaceDown) return;
    spaceDown = true; spaceHeld = false;
    spaceT = setTimeout(() => { spaceHeld = fastOn(); }, HOLD_MS);
  }, true);
  addEventListener('keyup', e => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (!spaceDown) return;
    e.preventDefault(); e.stopImmediatePropagation();
    spaceDown = false; clearTimeout(spaceT);
    if (spaceHeld) fastOff();
    else $id('bPlay')?.click();   // короткое нажатие — как кнопка пуска движка
  }, true);
  addEventListener('blur', () => { spaceDown = false; clearTimeout(spaceT); fastOff(); });

  // Правая кнопка мыши на кадре: удержание — 2×.
  const stage = $id('stage');
  let mouseFast = false;
  stage?.addEventListener('contextmenu', e => e.preventDefault());
  stage?.addEventListener('pointerdown', e => { if (e.button === 2) { e.preventDefault(); mouseFast = fastOn(); } });
  addEventListener('pointerup', e => { if (e.button === 2 && mouseFast) { mouseFast = false; fastOff(); } });

  // < > (и Б Ю в русской раскладке) — скорость ниже/выше.
  addEventListener('keydown', e => {
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, c = e.code;
    const down = k === '<' || k === ',' && e.shiftKey || c === 'Comma' && e.shiftKey || k === 'Б' || k === 'б' && e.shiftKey;
    const up = k === '>' || k === '.' && e.shiftKey || c === 'Period' && e.shiftKey || k === 'Ю' || k === 'ю' && e.shiftKey;
    if (down || up) { e.preventDefault(); e.stopImmediatePropagation(); step(up ? 1 : -1); }
  }, true);

  /* ---------- перемотка по полосе ---------- */
  const segsBox = $id('segs');
  const scrub = document.createElement('div'); scrub.className = 'pp-scrub';
  const knob = document.createElement('div'); knob.className = 'pp-knob';
  const tip = document.createElement('div'); tip.className = 'pp-tip';
  segsBox.append(scrub, knob, tip);
  const segEls = () => [...segsBox.querySelectorAll('.seg')];
  const durOf = i => (TIMINGS[BEATS[i].id]?.dur || 0) + (BEATS[i].pre || 0);
  const total = () => BEATS.reduce((s, _, i) => s + durOf(i), 0);
  // точка полосы под x: шаг и доля внутри него
  function at(x) {
    const els = segEls();
    if (!els.length) return null;
    const box = segsBox.getBoundingClientRect();
    x = Math.max(els[0].getBoundingClientRect().left, Math.min(x, els.at(-1).getBoundingClientRect().right - 1));
    let i = els.findIndex(el => x < el.getBoundingClientRect().right + 1);
    if (i < 0) i = els.length - 1;
    const r = els[i].getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width)));
    return { i, frac, x: x - box.left, left0: els[0].getBoundingClientRect().left - box.left };
  }
  function showTip(p) {
    let t = 0; for (let k = 0; k < p.i; k++) t += durOf(k); t += p.frac * durOf(p.i);
    tip.innerHTML = `Шаг ${p.i + 1} из ${BEATS.length} · ${fmtTime(t)} / ${fmtTime(total())}<small>${BEATS[p.i].title}${BEATS[p.i].ask ? ' · вопрос' : ''}</small>`;
    tip.style.left = p.x + 'px'; tip.style.display = 'block';
  }
  let drag = null, swallowClick = false;
  segsBox.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const p = at(e.clientX); if (!p) return;
    e.preventDefault();
    drag = { p, wasPlaying: P.playing || !P.started };
    segsBox.setPointerCapture(e.pointerId);
    segsBox.classList.add('drag');
    move(e);
  });
  function move(e) {
    const p = at(e.clientX); if (!p) return;
    showTip(p);
    if (!drag) return;
    drag.p = p;
    scrub.style.display = knob.style.display = 'block';
    scrub.style.left = p.left0 + 'px'; scrub.style.width = Math.max(0, p.x - p.left0) + 'px';
    knob.style.left = p.x + 'px';
  }
  segsBox.addEventListener('pointermove', move);
  segsBox.addEventListener('pointerleave', () => { if (!drag) tip.style.display = 'none'; });
  function end(e, go = true) {
    if (!drag) return;
    const { p, wasPlaying } = drag; drag = null;
    segsBox.classList.remove('drag');
    scrub.style.display = knob.style.display = 'none';
    tip.style.display = 'none';
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);   // клик после отпускания не должен перематывать ещё раз
    if (!go) return;
    hideCover();
    seekInto(p.i, BEATS[p.i].ask ? 0 : p.frac);
    if (!wasPlaying && P.playing) setPlaying(false);
  }
  segsBox.addEventListener('pointerup', e => end(e));
  segsBox.addEventListener('pointercancel', e => end(e, false));
  segsBox.addEventListener('click', e => { if (swallowClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

  /* ---------- справка по клавишам ---------- */
  const dl = $id('help')?.querySelector('dl');
  if (dl) dl.insertAdjacentHTML('beforeend',
    '<dt><kbd>Space</kbd> удерж.</dt><dd>2× пока держите (или правая кнопка мыши)</dd>' +
    '<dt><kbd>&lt;</kbd><kbd>&gt;</kbd></dt><dd>Скорость ниже / выше (0,75–2×)</dd>' +
    '<dt>полоса</dt><dd>Зажать и тянуть — перемотка с подсказкой шага и времени</dd>' +
    '<dt><kbd>G</kbd></dt><dd>Конспект главы поверх урока</dd>');
})();
