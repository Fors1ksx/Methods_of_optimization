// SVG-график функции со слоями: отрезок, точки, касательные, парабола, сетка, хорда φ′.
(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const fmt = (v) => {
    const s = Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? (+v.toFixed(2)).toString() : (+v.toPrecision(2)).toString();
    return s.replace(".", ",");
  };
  function ticks(lo, hi, n) {
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || raw;
    const out = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
    return out;
  }

  // spec: {f, x:[x0,x1], y?:[y0,y1], seg?:[a,b], pts?:[{x,y,c,l}], tan?:[[x,y,k]], par?:[[x,y]x3],
  //        grid?:{a,b,n}, vlines?:[{x,l}], hl?:[[x0,x1]], df?:fn (вторая панель φ′), chord?:[[x,y],[x,y]], curves?:[{f,c}]}
  function draw(svg, spec) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = 640, H = spec.df ? 420 : 340;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const panels = spec.df ? [{ f: spec.f, top: 10, h: 230, main: true }, { f: spec.df, top: 262, h: 140, main: false }] : [{ f: spec.f, top: 10, h: 300, main: true }];
    const [x0, x1] = spec.x;
    const L = 52, R = W - 14;
    const sx = (x) => L + ((x - x0) / (x1 - x0)) * (R - L);
    for (const pn of panels) {
      const N = 320, xs = [], ys = [];
      for (let i = 0; i <= N; i++) { const x = x0 + ((x1 - x0) * i) / N; xs.push(x); ys.push(pn.f(x)); }
      let y0, y1;
      if (pn.main && spec.y) [y0, y1] = spec.y;
      else {
        const fin = ys.filter(isFinite);
        y0 = Math.min(...fin); y1 = Math.max(...fin);
        if (!pn.main) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
        const pad = (y1 - y0 || 1) * 0.12; y0 -= pad; y1 += pad;
      }
      const T = pn.top, B = pn.top + pn.h;
      const sy = (y) => B - ((y - y0) / (y1 - y0)) * (B - T);
      const g = el("g", {}, svg);
      el("rect", { x: L, y: T, width: R - L, height: B - T, class: "pl-bg" }, g);
      // подсветка текущего отрезка
      if (spec.seg && pn.main) {
        const a = Math.max(spec.seg[0], x0), b = Math.min(spec.seg[1], x1);
        el("rect", { x: sx(a), y: T, width: Math.max(1.5, sx(b) - sx(a)), height: B - T, class: "pl-seg" }, g);
        el("line", { x1: sx(a), x2: sx(a), y1: T, y2: B, class: "pl-segedge" }, g);
        el("line", { x1: sx(b), x2: sx(b), y1: T, y2: B, class: "pl-segedge" }, g);
      }
      (spec.hl || []).forEach(([a, b]) => pn.main && el("rect", { x: sx(a), y: T, width: sx(b) - sx(a), height: B - T, class: "pl-cut" }, g));
      for (const t of ticks(x0, x1, 7)) {
        el("line", { x1: sx(t), x2: sx(t), y1: T, y2: B, class: "pl-grid" }, g);
        if (!pn.main || !spec.df) { const tx = el("text", { x: sx(t), y: B + 15, class: "pl-tick", "text-anchor": "middle" }, g); tx.textContent = fmt(t); }
      }
      for (const t of ticks(y0, y1, pn.main ? 5 : 3)) {
        el("line", { x1: L, x2: R, y1: sy(t), y2: sy(t), class: "pl-grid" }, g);
        const ty = el("text", { x: L - 6, y: sy(t) + 4, class: "pl-tick", "text-anchor": "end" }, g); ty.textContent = fmt(t);
      }
      if (y0 < 0 && y1 > 0) el("line", { x1: L, x2: R, y1: sy(0), y2: sy(0), class: "pl-axis" }, g);
      const lbl = el("text", { x: L + 6, y: T + 16, class: "pl-name" }, g);
      lbl.textContent = pn.main ? spec.name || "" : spec.dname || "φ′(x)";
      // кривая
      const clip = "c" + Math.random().toString(36).slice(2);
      const cp = el("clipPath", { id: clip }, g); el("rect", { x: L, y: T, width: R - L, height: B - T }, cp);
      const gg = el("g", { "clip-path": `url(#${clip})` }, g);
      const path = (pts) => pts.map(([x, y], i) => (i ? "L" : "M") + sx(x).toFixed(1) + "," + sy(y).toFixed(1)).join("");
      const curve = (f, cls) => { const d = []; for (let i = 0; i <= N; i++) { const x = x0 + ((x1 - x0) * i) / N, y = f(x); if (isFinite(y)) d.push([x, y]); } el("path", { d: path(d), class: cls }, gg); };
      (pn.main ? spec.curves || [] : []).forEach((c) => curve(c.f, "pl-curve2"));
      curve(pn.f, pn.main ? "pl-curve" : "pl-dcurve");
      if (pn.main) {
        if (spec.grid) {
          const { a, b, n } = spec.grid;
          for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; el("circle", { cx: sx(x), cy: sy(pn.f(x)), r: 2, class: "pl-node" }, gg); }
        }
        (spec.tan || []).forEach(([x, y, k]) => el("path", { d: path([[x0, y + k * (x0 - x)], [x1, y + k * (x1 - x)]]), class: "pl-tan" }, gg));
        if (spec.par) {
          const [[a, fa], [b, fb], [c, fc]] = spec.par;
          const q = (x) => fa * ((x - b) * (x - c)) / ((a - b) * (a - c)) + fb * ((x - a) * (x - c)) / ((b - a) * (b - c)) + fc * ((x - a) * (x - b)) / ((c - a) * (c - b));
          if (isFinite(q(a))) curve(q, "pl-par");
        }
        (spec.vlines || []).forEach((v) => {
          el("line", { x1: sx(v.x), x2: sx(v.x), y1: T, y2: B, class: "pl-vline" }, gg);
          if (v.l) { const t = el("text", { x: sx(v.x) + 4, y: B - 6, class: "pl-vl" }, gg); t.textContent = v.l; }
        });
        (spec.pts || []).forEach((p) => {
          const y = p.y !== undefined ? p.y : pn.f(p.x);
          if (!isFinite(y)) return;
          el("line", { x1: sx(p.x), x2: sx(p.x), y1: sy(y), y2: B, class: "pl-drop" }, gg);
          el("circle", { cx: sx(p.x), cy: sy(y), r: 5.5, class: "pl-pt pl-" + (p.c || "p") }, gg);
          if (p.l) { const t = el("text", { x: sx(p.x) + 7, y: sy(y) - 8, class: "pl-ptl" }, gg); t.textContent = p.l; }
        });
      } else {
        if (spec.chord) el("path", { d: path(spec.chord), class: "pl-tan" }, gg);
        (spec.pts || []).forEach((p) => { const y = pn.f(p.x); if (isFinite(y)) el("circle", { cx: sx(p.x), cy: sy(y), r: 4.5, class: "pl-pt pl-" + (p.c || "p") }, gg); });
      }
    }
  }
  root.PLOT = { draw, fmt };
})(window);
