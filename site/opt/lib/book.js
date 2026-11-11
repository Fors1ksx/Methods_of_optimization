// Общее для страниц практики учебника МО (после pages.js и katex): формулы в тексте и карточка задачи.
'use strict';
// Десятичная запятая в формуле: 2,6186 → 2{,}6186 (иначе KaTeX ставит после запятой пробел).
const KX = (t, d) => { try { return katex.renderToString(t.replace(/(\d),(\d)/g, '$1{,}$2'), { displayMode: d, throwOnError: false }); } catch (e) { return t; } };
// Текст с $…$ и $$…$$ (KaTeX) и **жирным**.
const richHTML = s => String(s ?? '')
  .replace(/\$\$([\s\S]+?)\$\$/g, (m, t) => KX(t, true))
  .replace(/\$([^$\n]+?)\$/g, (m, t) => KX(t, false))
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const parseNum = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };
const numStr = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : (+v.toFixed(6)).toString()).replace('.', ',') : String(v);

// Карточка задачи. inst = { q, fields:[{label, a, tol}], hint, sol } или { q, opts, a, sol, why }.
// opts.gen — имя генератора (кнопка «Новая задача»), opts.onResult(ok, inst) — запись в прогресс.
function taskCard(inst, { title = 'Задача', tag = '', color, regen, onResult } = {}) {
  const box = el('div', 'pcard');
  const draw = (I) => {
    box.className = 'pcard';
    box.innerHTML = '';
    let first = true;
    const st = el('span', 'st');
    const ph = el('div', 'ph'); ph.append(el('span', '', title));
    if (tag) { const t = el('span', 'tg', tag); if (color) t.style.setProperty('--c', color); ph.append(t); }
    ph.append(st);
    box.append(ph, el('div', 'q', richHTML(I.q)));
    const fb = el('div', 'fbk');
    const done = (ok) => {
      if (first) { first = false; onResult && onResult(ok, I); }
      box.classList.toggle('ok', ok); box.classList.toggle('no', !ok);
      st.textContent = ok ? '✓ верно' : '✗ есть ошибка'; st.style.color = ok ? 'var(--good)' : 'var(--bad)';
    };
    if (I.opts) {
      const os = el('div', 'opts');
      I.opts.forEach((o, k) => {
        const b = el('button', 'opt', richHTML(o));
        b.onclick = () => {
          os.querySelectorAll('.opt').forEach(x => x.classList.remove('good', 'bad'));
          const ok = k === I.a;
          b.classList.add(ok ? 'good' : 'bad');
          fb.className = 'fbk ' + (ok ? 'ok' : 'no');
          fb.innerHTML = ok ? 'Верно. ' + richHTML(I.sol || '') : 'Нет. ' + richHTML(I.why?.[k] || 'Подумайте ещё.');
          done(ok);
        };
        os.append(b);
      });
      box.append(os);
    } else {
      const fs = el('div', 'flds');
      const inputs = I.fields.map(f => {
        const lab = el('label', '', richHTML(f.label.includes('$') ? f.label : f.label) + ' = ');
        const inp = el('input'); Object.assign(inp, { type: 'text', inputMode: 'decimal', autocomplete: 'off', placeholder: 'число' });
        lab.append(inp); fs.append(lab); return inp;
      });
      const check = () => {
        const res = I.fields.map((f, k) => { const v = parseNum(inputs[k].value), tol = f.tol ?? Math.max(5e-4 * Math.abs(f.a), 5e-4); return isFinite(v) && Math.abs(v - f.a) <= tol + 1e-12; });
        inputs.forEach((x, k) => { x.classList.toggle('good', res[k]); x.classList.toggle('bad', !res[k]); });
        const ok = res.every(Boolean);
        fb.className = 'fbk ' + (ok ? 'ok' : 'no');
        fb.innerHTML = ok ? 'Верно! ' + richHTML(I.sol || '') : `Верно ${res.filter(Boolean).length} из ${res.length}. Проверьте вычисления или откройте подсказку.`;
        done(ok);
      };
      inputs.forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') check(); }));
      const row = el('div', 'prow');
      const b1 = el('button', 'btn go sm', 'Проверить'); b1.onclick = check; row.append(b1);
      if (I.hint) { const b = el('button', 'btn quiet sm', 'Подсказка'); b.onclick = () => { fb.className = 'fbk info'; fb.innerHTML = 'Подсказка: ' + richHTML(I.hint); }; row.append(b); }
      const b3 = el('button', 'btn quiet sm', 'Решение');
      b3.onclick = () => { if (first) { first = false; onResult && onResult(false, I); } fb.className = 'fbk info'; fb.innerHTML = 'Решение: ' + richHTML(I.sol || '') + '<br>Ответ: ' + I.fields.map(f => `${f.label} = ${numStr(f.a)}`).join('; '); };
      row.append(b3);
      if (regen) { const b = el('button', 'btn quiet sm', '↻ Новая задача'); b.onclick = () => draw(regen()); row.append(b); }
      box.append(fs, row);
      requestAnimationFrame(() => { if (box.getBoundingClientRect().top < innerHeight) {} });
    }
    box.append(fb);
  };
  draw(inst);
  return box;
}
