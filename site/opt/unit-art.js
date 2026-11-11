// Меловые эскизы частей учебника (viewBox 0 0 600 180). Классы: d — штрих рисуется, t — проявляется, a — белый мел, faint — бледнее.
'use strict';
(() => {
  let k = 0;
  const P = (d, cls = '', extra = '') => `<path class="d ${cls}" pathLength="1" style="--k:${k++}" d="${d}" ${extra}/>`;
  const Tx = (x, y, s, size = 24, cls = '', anchor = 'start') => `<text class="t ${cls}" style="--k:${k++}" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
  const C = (cx, cy, r, cls = '') => `<circle class="d ${cls}" pathLength="1" style="--k:${k++}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const curve = (f, x0, x1, X, Y) => { let d = ''; for (let i = 0; i <= 60; i++) { const x = x0 + (x1 - x0) * i / 60; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(f(x)).toFixed(1); } return d; };
  window.UNIT_ART = [];
  // Часть 1: унимодальная кривая, отрезок сужается золотым сечением.
  k = 0;
  {
    const X = x => 230 + (x - 1) * 110, Y = y => 160 - (y - .55) * 190, f = x => x - 2 * Math.log(x);
    let s = P('M220 160H580', 'a faint') + P(curve(f, 1, 4, X, Y));
    const a = 1, b = 4, x1 = 4 - .618 * 3, x2 = 1 + .618 * 3;
    s += `<rect class="cut" x="${X(x2)}" y="20" width="${X(4) - X(x2)}" height="140" fill="currentColor" stroke="none"/>`;
    s += P(`M${X(a)} 30V160M${X(b)} 30V160`, 'faint');
    s += C(X(x1), Y(f(x1)), 7) + C(X(x2), Y(f(x2)), 7, 'a');
    s += Tx(X(x1), 178, 'x₁', 18, '', 'middle') + Tx(X(x2), 178, 'x₂', 18, 'a', 'middle') + Tx(560, 60, '0,618', 26, '', 'end');
    window.UNIT_ART.push(s);
  }
  // Часть 2: выпуклая φ, касательные снизу и корень φ′.
  k = 0;
  {
    const X = x => 230 + (x - 2) * 85, Y = y => 150 - (y + 10.9) * 38, f = x => -5 * x * x * Math.exp(-x / 2), d = x => -5 * Math.exp(-x / 2) * (2 * x - x * x / 2);
    let s = P(curve(f, 2, 6, X, Y));
    const tl = (x0) => { const y0 = f(x0), kk = d(x0); return P(`M${X(x0 - 1.4)} ${Y(y0 - 1.4 * kk)}L${X(x0 + 1.4)} ${Y(y0 + 1.4 * kk)}`, 'a faint'); };
    s += tl(2.6) + tl(5.4);
    s += `<circle class="root" cx="${X(4)}" cy="${Y(f(4))}" r="7" fill="currentColor" stroke="none"/>`;
    s += Tx(X(4), 178, 'φ′(x*) = 0', 20, '', 'middle') + Tx(570, 60, 'max f = −min φ', 22, 'a', 'end');
    window.UNIT_ART.push(s);
  }
  // Часть 3: сравнение — столбики числа вычислений.
  k = 0;
  {
    const bars = [[6001, 'сетка'], [21, 'золото'], [9, 'Брент']];
    let s = P('M240 160H580', 'a faint');
    bars.forEach(([v, n], i) => { const hgt = Math.max(8, Math.log10(v) * 34); s += P(`M${300 + i * 100} 160V${160 - hgt}`, i === 2 ? '' : 'a', 'stroke-width="18"'); s += Tx(300 + i * 100, 160 - hgt - 10, String(v), 20, '', 'middle') + Tx(300 + i * 100, 178, n, 16, 'a', 'middle'); });
    window.UNIT_ART.push(s);
  }
})();
