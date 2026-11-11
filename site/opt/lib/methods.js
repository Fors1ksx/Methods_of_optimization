// Численные методы одномерной минимизации. Каждый метод возвращает
// {steps, x, fx, iters, evals, cols} — steps — состояния для визуализации.
// Реализации golden/brentMin/uniform/tangents/brentRoot повторяют код ЛР1/ЛР2 (вариант 21).
(function (root) {
  const K = (Math.sqrt(5) - 1) / 2; // 0.618...

  function counted(fn) {
    const g = (x) => { g.n++; return fn(x); };
    g.n = 0;
    return g;
  }

  // ---------- функции учебника ----------
  const FN = {
    f1: { tex: String.raw`f(x)=x-2\ln x`, f: (x) => x - 2 * Math.log(x), df: (x) => 1 - 2 / x, d2: (x) => 2 / (x * x), a: 1, b: 4, eps: 0.0005, xs: 2, name: "ЛР1, вар. 21: x − 2ln x" },
    f2: { tex: String.raw`f(x)=5x^2e^{-x/2}`, f: (x) => 5 * x * x * Math.exp(-x / 2), df: (x) => 5 * Math.exp(-x / 2) * (2 * x - x * x / 2), a: 2, b: 6, eps: 0.002, xs: 4, name: "ЛР2, вар. 21: 5x²e^(−x/2) (max)" },
    phi2: { tex: String.raw`\varphi(x)=-5x^2e^{-x/2}`, f: (x) => -5 * x * x * Math.exp(-x / 2), df: (x) => -5 * Math.exp(-x / 2) * (2 * x - x * x / 2), d2: (x) => -5 * Math.exp(-x / 2) * (x * x / 4 - 2 * x + 2), a: 2, b: 6, eps: 0.002, xs: 4, name: "ЛР2, вар. 21: φ = −5x²e^(−x/2)" },
    multi: { tex: String.raw`g(x)=\sin 3x+0.4x`, f: (x) => Math.sin(3 * x) + 0.4 * x, df: (x) => 3 * Math.cos(3 * x) + 0.4, a: 0, b: 4, eps: 0.001, name: "Не унимодальная: sin3x + 0.4x" },
    sq: { tex: String.raw`f(x)=(x-2)^2`, f: (x) => (x - 2) ** 2, df: (x) => 2 * (x - 2), a: 0, b: 3, eps: 0.0005, xs: 2, name: "ЛР1, вар. 2: (x − 2)²" },
    cosx: { tex: String.raw`f(x)=\cos x`, f: Math.cos, df: (x) => -Math.sin(x), a: 1, b: 5, eps: 0.0005, xs: Math.PI, name: "ЛР1, вар. 3: cos x" },
    xex: { tex: String.raw`f(x)=xe^x`, f: (x) => x * Math.exp(x), df: (x) => Math.exp(x) * (1 + x), a: -2, b: 0, eps: 0.0001, xs: -1, name: "ЛР1, вар. 6: x·eˣ" },
    l2v2: { tex: String.raw`f(x)=x^2+\sin x`, f: (x) => x * x + Math.sin(x), df: (x) => 2 * x + Math.cos(x), a: -1, b: 0, eps: 0.0005, name: "ЛР2, вар. 2: x² + sin x" },
    l2v23: { tex: String.raw`f(x)=5/x+x^2`, f: (x) => 5 / x + x * x, df: (x) => -5 / (x * x) + 2 * x, a: 0.5, b: 2, eps: 0.001, xs: Math.cbrt(2.5), name: "ЛР2, вар. 23: 5/x + x²" },
  };

  function customFn(expr) {
    const body = expr.replace(/\^/g, "**").replace(/\bln\(/g, "log(").replace(/\btg\(/g, "tan(").replace(/\bctg\(([^)]*)\)/g, "(1/tan($1))").replace(/\barctg\(/g, "atan(");
    // eslint-disable-next-line no-new-func
    const f = new Function("x", "with(Math){return (" + body + ");}");
    f(1.2345);
    const df = (x) => { const h = 1e-6 * Math.max(1, Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); };
    return { f, df, tex: expr, name: "своя функция" };
  }

  const P = (x, y, c, l) => ({ x, y, c: c || "p", l: l || "" });

  // ---------- ЛР1: без производной ----------
  function uniform(F, a, b, eps) {
    const f = counted(F.f);
    const n = Math.round((b - a) / eps), h = (b - a) / n;
    let xb = a, fb = f(a);
    const steps = [], stride = Math.max(1, Math.ceil(n / 60));
    steps.push({ k: 0, a, b, grid: { a, b, n: Math.min(n, 60) }, pts: [P(a, fb, "p", "x₀")], row: [0, a, fb, xb], note: `Сетка: ${n} интервалов, шаг h = ${h.toPrecision(3)}` });
    for (let i = 1; i <= n; i++) {
      const x = a + i * h, fx = f(x);
      if (fx < fb) { xb = x; fb = fx; }
      if (i % stride === 0 || i === n) steps.push({ k: i, a, b, grid: { a, b, n: Math.min(n, 60) }, pts: [P(x, fx, "q", "xᵢ"), P(xb, fb, "best", "лучший")], row: [i, x, fx, xb], note: `Узел ${i} из ${n}. Лучший пока x = ${xb.toFixed(6)}` });
    }
    return { steps, x: xb, fx: fb, iters: n + 1, evals: f.n, cols: ["i", "xᵢ", "f(xᵢ)", "лучший x"] };
  }

  function bitwise(F, a, b, eps) {
    const f = counted(F.f);
    let h = (b - a) / 4, x0 = a, f0 = f(x0), k = 0;
    const steps = [{ k: 0, a, b, pts: [P(x0, f0, "best", "x₀")], row: [0, x0, f0, h], note: `Старт в a, шаг Δ = ${h}` }];
    for (let guard = 0; guard < 10000; guard++) {
      const x1 = x0 + h;
      k++;
      let better = false, f1 = NaN;
      if (x1 >= a - 1e-12 && x1 <= b + 1e-12) { f1 = f(x1); better = f1 < f0; }
      if (better) {
        x0 = x1; f0 = f1;
        steps.push({ k, a, b, pts: [P(x0, f0, "best", "x₀")], row: [k, x0, f0, h], note: "f уменьшилась — идём дальше тем же шагом" });
      } else {
        if (!isNaN(f1)) { x0 = x1; f0 = f1; }
        if (Math.abs(h) <= eps) { steps.push({ k, a, b, pts: [P(x0, f0, "best", "x*")], row: [k, x0, f0, h], note: "|Δ| ≤ ε — стоп" }); break; }
        h = -h / 4;
        steps.push({ k, a, b, pts: [P(x0, f0, "best", "x₀")], row: [k, x0, f0, h], note: "f не уменьшилась — разворот, Δ := −Δ/4" });
      }
    }
    return { steps, x: x0, fx: f0, iters: k, evals: f.n, cols: ["k", "x₀", "f(x₀)", "Δ"] };
  }

  function dichotomy(F, a, b, eps) {
    const f = counted(F.f), d = eps / 2;
    const steps = [{ k: 0, a, b, pts: [], row: [0, a, b, b - a], note: `δ = ε/2 = ${d}` }];
    let k = 0;
    while (b - a > eps) {
      k++;
      const x1 = (a + b - d) / 2, x2 = (a + b + d) / 2, f1 = f(x1), f2 = f(x2);
      if (f1 <= f2) b = x2; else a = x1;
      steps.push({ k, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₂")], row: [k, a, b, b - a], note: f1 <= f2 ? "f(x₁) ≤ f(x₂) → b := x₂" : "f(x₁) > f(x₂) → a := x₁" });
    }
    const x = (a + b) / 2;
    return { steps, x, fx: f(x), iters: k, evals: f.n, cols: ["k", "a", "b", "b − a"] };
  }

  // точная копия golden() из lab1_var21.py
  function golden(F, a, b, eps) {
    const f = counted(F.f);
    let x1 = b - K * (b - a), x2 = a + K * (b - a), f1 = f(x1), f2 = f(x2), it = 0;
    const steps = [{ k: 0, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₂")], row: [0, a, b, x1, x2, b - a], note: "x₁ = b − 0,618(b − a), x₂ = a + 0,618(b − a)" }];
    while (true) {
      it++;
      let note;
      if (f1 <= f2) {
        b = x2; x2 = x1; f2 = f1; note = "f(x₁) ≤ f(x₂) → b := x₂, старая x₁ становится x₂";
        if (b - a <= eps) { steps.push({ k: it, a, b, pts: [], row: [it, a, b, NaN, NaN, b - a], note: note + "; b − a ≤ ε — стоп" }); break; }
        x1 = b - K * (b - a); f1 = f(x1);
      } else {
        a = x1; x1 = x2; f1 = f2; note = "f(x₁) > f(x₂) → a := x₁, старая x₂ становится x₁";
        if (b - a <= eps) { steps.push({ k: it, a, b, pts: [], row: [it, a, b, NaN, NaN, b - a], note: note + "; b − a ≤ ε — стоп" }); break; }
        x2 = a + K * (b - a); f2 = f(x2);
      }
      steps.push({ k: it, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₂")], row: [it, a, b, x1, x2, b - a], note });
    }
    const x = (a + b) / 2;
    return { steps, x, fx: f(x), iters: it, evals: f.n, cols: ["k", "a", "b", "x₁", "x₂", "b − a"] };
  }

  function fibonacci(F, a, b, eps) {
    const f = counted(F.f);
    const fib = [1, 1];
    while (fib[fib.length - 1] < (b - a) / eps) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
    const N = fib.length - 1; // F_N >= (b-a)/eps
    let x1 = a + (fib[N - 2] / fib[N]) * (b - a), x2 = a + (fib[N - 1] / fib[N]) * (b - a), f1 = f(x1), f2 = f(x2);
    const steps = [{ k: 0, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₂")], row: [0, a, b, x1, x2], note: `N = ${N}: F_N = ${fib[N]} ≥ (b − a)/ε` }];
    let k = 0;
    for (let j = 1; j <= N - 3; j++) {
      k++;
      if (f1 <= f2) { b = x2; x2 = x1; f2 = f1; x1 = a + b - x2; f1 = f(x1); }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + b - x1; f2 = f(x2); }
      if (x1 > x2) { [x1, x2] = [x2, x1]; [f1, f2] = [f2, f1]; }
      steps.push({ k, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₂")], row: [k, a, b, x1, x2], note: "симметричная точка: x_new = a + b − x_old" });
    }
    // последний шаг: точки совпали бы, сдвигаем на δ
    k++;
    x2 = x1 + eps / 10; f2 = f(x2);
    if (f1 <= f2) b = x2; else a = x1;
    steps.push({ k, a, b, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "q", "x₁+δ")], row: [k, a, b, x1, x2], note: "последний шаг: вторая точка = x₁ + δ" });
    const x = (a + b) / 2;
    return { steps, x, fx: f(x), iters: k, evals: f.n, cols: ["k", "a", "b", "x₁", "x₂"] };
  }

  function parabolaVertex(x1, f1, x2, f2, x3, f3) {
    const num = (x2 - x1) ** 2 * (f2 - f3) - (x2 - x3) ** 2 * (f2 - f1);
    const den = (x2 - x1) * (f2 - f3) - (x2 - x3) * (f2 - f1);
    return den === 0 ? NaN : x2 - 0.5 * num / den;
  }

  function parabolas(F, a, b, eps) {
    const f = counted(F.f);
    let x1 = a, x3 = b, x2 = (a + b) / 2, f1 = f(x1), f3 = f(x3), f2 = f(x2);
    // подбираем x2, чтобы f2 <= f1, f3 (тройка, «охватывающая» минимум)
    let tries = 0;
    while (!(f2 <= f1 && f2 <= f3) && tries++ < 40) {
      if (f1 < f3) { x3 = x2; f3 = f2; } else { x1 = x2; f1 = f2; }
      x2 = (x1 + x3) / 2; f2 = f(x2);
    }
    const steps = [{ k: 0, a: x1, b: x3, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "best", "x₂"), P(x3, f3, "p", "x₃")], par: [[x1, f1], [x2, f2], [x3, f3]], row: [0, x1, x2, x3, NaN], note: "тройка x₁ < x₂ < x₃ с f(x₂) ≤ f(x₁), f(x₃)" }];
    let k = 0, u = x2;
    while (k < 200) {
      k++;
      u = parabolaVertex(x1, f1, x2, f2, x3, f3);
      if (!isFinite(u) || u <= x1 || u >= x3) u = (x1 + x3) / 2;
      if (Math.abs(u - x2) < eps / 10) u = x2 + (x2 < (x1 + x3) / 2 ? eps / 10 : -eps / 10);
      const fu = f(u), par = [[x1, f1], [x2, f2], [x3, f3]];
      const done = Math.abs(u - x2) <= eps;
      if (u < x2) { if (fu <= f2) { x3 = x2; f3 = f2; x2 = u; f2 = fu; } else { x1 = u; f1 = fu; } }
      else { if (fu <= f2) { x1 = x2; f1 = f2; x2 = u; f2 = fu; } else { x3 = u; f3 = fu; } }
      steps.push({ k, a: x1, b: x3, pts: [P(x1, f1, "p", "x₁"), P(x2, f2, "best", "x₂"), P(x3, f3, "p", "x₃"), P(u, fu, "q", "u")], par, row: [k, x1, x2, x3, u], note: done ? "|u − x₂| ≤ ε — стоп" : "u — вершина параболы через три точки" });
      if (done || x3 - x1 <= eps) break;
    }
    return { steps, x: x2, fx: f2, iters: k, evals: f.n, cols: ["k", "x₁", "x₂", "x₃", "u"] };
  }

  // точная копия brent() из lab1_var21.py
  function brentMin(F, a, b, eps) {
    const f = counted(F.f), tol = eps / 2;
    let x, w, v; x = w = v = a + (1 - K) * (b - a);
    let fx, fw, fv; fx = fw = fv = f(x);
    let it = 0, d = b - a, e = b - a;
    const steps = [{ k: 0, a, b, pts: [P(x, fx, "best", "x=w=v")], row: [0, a, b, x, NaN, NaN, "старт"], note: "x = w = v = a + 0,382(b − a)" }];
    while (x - a > eps || b - x > eps) {
      it++;
      const eOld = e; e = d;
      let usePar = false, par = null;
      if (x !== w && w !== v && x !== v) {
        let r = (x - w) * (fx - fv), q = (x - v) * (fx - fw), p = (x - v) * q - (x - w) * r;
        q = 2 * (q - r);
        if (q > 0) p = -p;
        q = Math.abs(q);
        par = [[x, fx], [w, fw], [v, fv]];
        if (q !== 0 && Math.abs(p) < Math.abs(q * eOld / 2)) {
          const u = x + p / q;
          if (u - a > 2 * tol && b - u > 2 * tol) { d = p / q; usePar = true; }
        }
      }
      if (!usePar) { e = x < (a + b) / 2 ? b - x : a - x; d = (1 - K) * e; }
      let u;
      if (Math.abs(d) >= tol) u = x + d; else u = d > 0 ? x + tol : x - tol;
      const fu = f(u);
      const st = { k: it, a, b, pts: [P(x, fx, "best", "x"), P(w, fw, "p", "w"), P(v, fv, "p2", "v"), P(u, fu, "q", "u")], par: usePar ? par : null, row: [it, a, b, x, u, fu, usePar ? "парабола" : "золотое"], note: usePar ? "u — вершина параболы через x, w, v" : (par ? "парабола отвергнута → шаг золотого сечения" : "трёх разных точек нет → шаг золотого сечения") };
      steps.push(st);
      if (fu <= fx) {
        if (u < x) b = x; else a = x;
        v = w; fv = fw; w = x; fw = fx; x = u; fx = fu;
      } else {
        if (u < x) a = u; else b = u;
        if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; }
        else if (fu <= fv || v === x || v === w) { v = u; fv = fu; }
      }
    }
    return { steps, x, fx, iters: it, evals: f.n, cols: ["k", "a", "b", "x", "u", "f(u)", "шаг"] };
  }

  // ---------- ЛР2: с производной (минимизация выпуклой φ) ----------
  function midpoint(F, a, b, eps) {
    const df = counted(F.df);
    const steps = [{ k: 0, a, b, pts: [], row: [0, a, b, NaN, NaN], note: "c = (a + b)/2, смотрим знак φ′(c)" }];
    let k = 0, c, dc;
    while (true) {
      k++;
      c = (a + b) / 2; dc = df(c);
      steps.push({ k, a, b, pts: [P(c, F.f(c), "q", "c")], row: [k, a, b, c, dc], note: dc > 0 ? "φ′(c) > 0 → b := c" : "φ′(c) < 0 → a := c" });
      if (Math.abs(dc) <= eps || b - a <= eps) break;
      if (dc > 0) b = c; else a = c;
    }
    const f = counted(F.f), fx = f(c);
    return { steps, x: c, fx, iters: k, evals: df.n + f.n, cols: ["k", "a", "b", "c", "φ′(c)"] };
  }

  function chords(F, a, b, eps) {
    const df = counted(F.df);
    let da = df(a), db = df(b), k = 0, c, dc;
    const steps = [{ k: 0, a, b, pts: [], row: [0, a, b, NaN, NaN], note: "хорда графика φ′ между (a, φ′(a)) и (b, φ′(b))" }];
    while (true) {
      k++;
      c = a - da * (b - a) / (db - da); dc = df(c);
      steps.push({ k, a, b, pts: [P(c, F.f(c), "q", "c")], chord: [[a, da], [b, db]], row: [k, a, b, c, dc], note: dc > 0 ? "φ′(c) > 0 → b := c" : "φ′(c) < 0 → a := c" });
      if (Math.abs(dc) <= eps || b - a <= eps || k > 500) break;
      if (dc > 0) { b = c; db = dc; } else { a = c; da = dc; }
    }
    const f = counted(F.f), fx = f(c);
    return { steps, x: c, fx, iters: k, evals: df.n + f.n, cols: ["k", "a", "b", "c", "φ′(c)"] };
  }

  // точная копия tangents() из lab2_var21.py (F.f — минимизируемая φ)
  function tangents(F, a, b, eps) {
    const f = counted(F.f), df = counted(F.df);
    let fa = f(a), da = df(a), fb = f(b), db = df(b), it = 0, c, fc, dc;
    const steps = [{ k: 0, a, b, pts: [P(a, fa, "p", "a"), P(b, fb, "p", "b")], tan: [[a, fa, da], [b, fb, db]], row: [0, a, b, NaN, NaN, NaN], note: "касательные в концах отрезка" }];
    while (true) {
      it++;
      c = (fb - fa + da * a - db * b) / (da - db);
      fc = f(c); dc = df(c);
      steps.push({ k: it, a, b, pts: [P(a, fa, "p", "a"), P(b, fb, "p", "b"), P(c, fc, "q", "c")], tan: [[a, fa, da], [b, fb, db]], row: [it, a, b, c, fc, dc], note: Math.abs(dc) <= eps ? "|φ′(c)| ≤ ε — стоп" : dc > 0 ? "φ′(c) > 0 → b := c" : "φ′(c) < 0 → a := c" });
      if (Math.abs(dc) <= eps || b - a <= eps) break;
      if (dc > 0) { b = c; fb = fc; db = dc; } else { a = c; fa = fc; da = dc; }
    }
    return { steps, x: c, fx: fc, iters: it, evals: f.n + df.n, cols: ["k", "a", "b", "c", "φ(c)", "φ′(c)"] };
  }

  // точная копия brent() из lab2_var21.py: корень φ′(x) = 0
  function brentRoot(F, a, b, eps) {
    const df = counted(F.df);
    let fa = df(a), fb = df(b), it = 0;
    if (fa * fb > 0) throw new Error("на концах производная одного знака");
    if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
    let c = a, fc = fa, d = b - a, e = b - a;
    const lo0 = Math.min(b, c), hi0 = Math.max(b, c);
    const steps = [{ k: 0, a: lo0, b: hi0, pts: [P(b, F.f(b), "best", "b"), P(c, F.f(c), "p", "c")], row: [0, NaN, NaN, "старт", lo0, hi0], note: "корень φ′ зажат между b и c" }];
    while (true) {
      const tol = eps / 2, m = (c - b) / 2;
      if (Math.abs(m) <= tol || fb === 0) break;
      it++;
      let step = "бисекция";
      if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
        const s = fb / fa;
        let p, q, kind;
        if (a === c) { p = 2 * m * s; q = 1 - s; kind = "секущая"; }
        else { q = fa / fc; const r = fb / fc; p = s * (2 * m * q * (q - r) - (b - a) * (r - 1)); q = (q - 1) * (r - 1) * (s - 1); kind = "интерполяция"; }
        if (p > 0) q = -q; else p = -p;
        if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) { e = d; d = p / q; step = kind; }
        else { d = m; e = m; }
      } else { d = m; e = m; }
      a = b; fa = fb;
      if (Math.abs(d) > tol) b += d; else b += m > 0 ? tol : -tol;
      fb = df(b);
      const u = b, fu = fb;
      if ((fb > 0) === (fc > 0)) { c = a; fc = fa; d = e = b - a; }
      if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
      const lo = Math.min(b, c), hi = Math.max(b, c);
      steps.push({ k: it, a: lo, b: hi, pts: [P(u, F.f(u), "q", "u")], row: [it, u, fu, step, lo, hi], note: `шаг: ${step}` });
    }
    const f = counted(F.f), fx = f(b);
    return { steps, x: b, fx, iters: it, evals: df.n + f.n, cols: ["k", "u", "φ′(u)", "шаг", "корень от", "до"] };
  }

  const METHODS = {
    uniform: { name: "Равномерный поиск", lab: 1, run: uniform },
    bitwise: { name: "Поразрядный поиск", lab: 1, run: bitwise },
    dichotomy: { name: "Дихотомия", lab: 1, run: dichotomy },
    golden: { name: "Золотое сечение", lab: 1, run: golden },
    fibonacci: { name: "Метод Фибоначчи", lab: 1, run: fibonacci },
    parabolas: { name: "Метод парабол", lab: 1, run: parabolas },
    brentMin: { name: "Брент (минимизация)", lab: 1, run: brentMin },
    midpoint: { name: "Средней точки", lab: 2, run: midpoint },
    chords: { name: "Хорд", lab: 2, run: chords },
    tangents: { name: "Касательных", lab: 2, run: tangents },
    brentRoot: { name: "Брент (корень φ′)", lab: 2, run: brentRoot },
  };

  root.OPT = { K, FN, METHODS, customFn, parabolaVertex, counted };
  if (typeof module !== "undefined") module.exports = root.OPT;
})(typeof window !== "undefined" ? window : globalThis);
