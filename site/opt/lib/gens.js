// Генераторы задач со случайными данными. Каждый возвращает {q, fields:[{label,a,tol}], hint, sol}.
(function (root) {
  const { K, METHODS, parabolaVertex } = root.OPT;
  const rnd = (lo, hi, d = 0) => { const v = lo + Math.random() * (hi - lo); return +v.toFixed(d); };
  const ri = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const n6 = (v) => (+v.toFixed(6)).toString().replace(".", ",");
  const c = (v) => String(v).replace(".", ",");

  const G = {
    uniformCount() {
      const a = ri(-3, 2), L = ri(2, 6), eps = pick([0.1, 0.01, 0.005, 0.001, 0.0005, 0.002]);
      const N = Math.round(L / eps);
      return { q: `Равномерный поиск на $[${a};\\,${a + L}]$ с шагом $h=\\varepsilon=${c(eps)}$. Сколько раз будет вычислена функция?`,
        fields: [{ label: "вычислений", a: N + 1, tol: 0 }],
        hint: "Число интервалов $N=(b-a)/h$, узлов на один больше.",
        sol: `$N=${L}/${c(eps)}=${N}$ интервалов, узлов $N+1=${N + 1}$. В каждом узле одно вычисление.` };
    },
    goldenFirst() {
      const a = rnd(-2, 2, 1), b = +(a + rnd(1, 5, 1)).toFixed(1);
      const x1 = b - K * (b - a), x2 = a + K * (b - a);
      return { q: `Золотое сечение на $[${c(a)};\\,${c(b)}]$. Найдите стартовые точки $x_1<x_2$ (6 знаков).`,
        fields: [{ label: "x₁", a: x1, tol: 2e-6 }, { label: "x₂", a: x2, tol: 2e-6 }],
        hint: "$x_1=b-0{,}618034(b-a)$, $x_2=a+0{,}618034(b-a)$; $k=(\\sqrt5-1)/2$.",
        sol: `$b-a=${c(+(b - a).toFixed(4))}$. $x_1=${c(b)}-0{,}618034\\cdot${c(+(b - a).toFixed(4))}=${n6(x1)}$, $x_2=${c(a)}+0{,}618034\\cdot${c(+(b - a).toFixed(4))}=${n6(x2)}$.` };
    },
    goldenNext() {
      const a = 0, b = ri(3, 6), m = rnd(0.3, b - 0.3, 2);
      const f = (x) => (x - m) ** 2;
      const x1 = b - K * b, x2 = K * b, f1 = f(x1), f2 = f(x2);
      let na = a, nb = b, nx;
      if (f1 <= f2) { nb = x2; nx = nb - K * (nb - na); } else { na = x1; nx = na + K * (nb - na); }
      return { q: `Минимизируем $f(x)=(x-${c(m)})^2$ золотым сечением на $[0;\\,${b}]$. Стартовые точки $x_1=${n6(x1)}$, $x_2=${n6(x2)}$. Каким станет отрезок после 1-й итерации и где будет **новая** точка?`,
        fields: [{ label: "новое a", a: na, tol: 2e-5 }, { label: "новое b", a: nb, tol: 2e-5 }, { label: "новая точка", a: nx, tol: 2e-5 }],
        hint: "Сравните $f(x_1)$ и $f(x_2)$. Одна старая точка остаётся, новую ставят симметрично ей.",
        sol: `$f(x_1)=${n6(f1)}$, $f(x_2)=${n6(f2)}$. ${f1 <= f2 ? "$f(x_1)\\le f(x_2)$ ⇒ $b:=x_2$" : "$f(x_1)>f(x_2)$ ⇒ $a:=x_1$"}. Новый отрезок $[${n6(na)};\\,${n6(nb)}]$, новая точка ${n6(nx)} (вторая — старая ${f1 <= f2 ? "x_1" : "x_2"}).` };
    },
    goldenN() {
      const L = ri(1, 8), eps = pick([0.01, 0.001, 0.0005, 0.0001, 0.002, 0.005]);
      const n = Math.ceil(Math.log(eps / L) / Math.log(K) - 1e-12);
      return { q: `Отрезок длины ${L}, точность $\\varepsilon=${c(eps)}$. Сколько итераций золотого сечения нужно, чтобы длина стала $\\le\\varepsilon$? Сколько при этом вычислений $f$ (как в ЛР1: 2 стартовых + по одному на итерацию, кроме последней, + 1 в середине)?`,
        fields: [{ label: "итераций n", a: n, tol: 0 }, { label: "вычислений", a: n + 2, tol: 0 }],
        hint: "$L\\cdot 0{,}618^n\\le\\varepsilon \\iff n\\ge \\ln(\\varepsilon/L)/\\ln 0{,}618$.",
        sol: `$n\\ge \\ln(${c(eps)}/${L})/\\ln 0{,}618 = ${c((Math.log(eps / L) / Math.log(K)).toFixed(3))}$ ⇒ $n=${n}$. Вычислений: $2+(n-1)+1=${n + 2}$.` };
    },
    dichN() {
      const L = ri(1, 6), eps = pick([0.01, 0.001, 0.002]), d = eps / 2;
      let n = 0, len = L;
      while (len > eps) { len = (len + d) / 2; n++; }
      return { q: `Дихотомия: длина ${L}, $\\varepsilon=${c(eps)}$, $\\delta=\\varepsilon/2$. После скольких итераций длина станет $\\le\\varepsilon$? Сколько вычислений $f$ (без финального в середине)?`,
        fields: [{ label: "итераций", a: n, tol: 0 }, { label: "вычислений", a: 2 * n, tol: 0 }],
        hint: "$L_{k+1}=(L_k+\\delta)/2$. Каждая итерация — две новые точки.",
        sol: `Итерируем $L_{k+1}=(L_k+\\delta)/2$ от ${L}: становится $\\le ${c(eps)}$ на шаге ${n}. По 2 вычисления: ${2 * n}.` };
    },
    fibN() {
      const L = ri(1, 5), eps = pick([0.1, 0.01, 0.001, 0.05]);
      const fib = [1, 1]; while (fib[fib.length - 1] < L / eps) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
      const N = fib.length - 1;
      return { q: `Метод Фибоначчи ($F_0=F_1=1$): длина ${L}, $\\varepsilon=${c(eps)}$. Найдите наименьшее $N$, при котором $F_N\\ge (b-a)/\\varepsilon$, и само $F_N$.`,
        fields: [{ label: "N", a: N, tol: 0 }, { label: "F_N", a: fib[N], tol: 0 }],
        hint: "1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, …",
        sol: `$(b-a)/\\varepsilon=${c(+(L / eps).toFixed(2))}$. Первое $F_N$ не меньше: $F_{${N}}=${fib[N]}$.` };
    },
    vertex() {
      const x1 = rnd(0, 1, 1), x2 = +(x1 + rnd(0.5, 1.5, 1)).toFixed(1), x3 = +(x2 + rnd(0.5, 1.5, 1)).toFixed(1);
      const f2 = rnd(0, 1, 1), f1 = +(f2 + rnd(0.5, 3, 1)).toFixed(1), f3 = +(f2 + rnd(0.5, 3, 1)).toFixed(1);
      const u = parabolaVertex(x1, f1, x2, f2, x3, f3);
      return { q: `Через точки $(${c(x1)};\\,${c(f1)})$, $(${c(x2)};\\,${c(f2)})$, $(${c(x3)};\\,${c(f3)})$ проведена парабола. Найдите абсциссу её вершины $u$.`,
        fields: [{ label: "u", a: u, tol: 1e-4 }],
        hint: "$u=x_2-\\dfrac12\\cdot\\dfrac{(x_2-x_1)^2(f_2-f_3)-(x_2-x_3)^2(f_2-f_1)}{(x_2-x_1)(f_2-f_3)-(x_2-x_3)(f_2-f_1)}$",
        sol: `Подстановка в формулу даёт $u\\approx${n6(u)}$. Так как $f_2$ меньше крайних, $u\\in(${c(x1)};\\,${c(x3)})$.` };
    },
    analytic() {
      const k = ri(2, 6);
      const T = pick([
        { f: `x-${k}\\ln x`, x: k, d: `1-${k}/x`, why: `$f''=${k}/x^2>0$` },
        { f: `e^x-${k}x`, x: Math.log(k), d: `e^x-${k}`, why: "$f''=e^x>0$" },
        { f: `x^2-${2 * k}x+1`, x: k, d: `2x-${2 * k}`, why: "$f''=2>0$" },
        { f: `${k}x+\\dfrac{1}{x}\\ (x>0)`, x: 1 / Math.sqrt(k), d: `${k}-1/x^2`, why: "$f''=2/x^3>0$" },
      ]);
      return { q: `Найдите аналитически точку минимума $f(x)=${T.f}$.`, fields: [{ label: "x*", a: T.x, tol: 1e-4 }],
        hint: "Необходимое условие $f'(x)=0$, достаточное $f''(x^*)>0$.",
        sol: `$f'(x)=${T.d}=0$ ⇒ $x^*=${n6(T.x)}$; ${T.why} ⇒ минимум.` };
    },
    tangentC() {
      const m = rnd(1.2, 3.8, 2), a = 1, b = 4;
      const f = (x) => (x - m) ** 2, d = (x) => 2 * (x - m);
      const cc = (f(b) - f(a) + d(a) * a - d(b) * b) / (d(a) - d(b));
      return { q: `Метод касательных для $\\varphi(x)=(x-${c(m)})^2$ на $[1;\\,4]$. Найдите точку пересечения касательных $c$ на первой итерации.`,
        fields: [{ label: "c", a: cc, tol: 1e-4 }],
        hint: "$c=\\dfrac{\\varphi(b)-\\varphi(a)+a\\varphi'(a)-b\\varphi'(b)}{\\varphi'(a)-\\varphi'(b)}$",
        sol: `$\\varphi(1)=${n6(f(a))}$, $\\varphi(4)=${n6(f(b))}$, $\\varphi'(1)=${n6(d(a))}$, $\\varphi'(4)=${n6(d(b))}$ ⇒ $c=${n6(cc)}$. (Для параболы $c=(a+b)/2$ — проверьте!)` };
    },
    secant() {
      const x0 = rnd(1, 2, 1), x1 = +(x0 + rnd(1, 2, 1)).toFixed(1), g0 = -rnd(0.5, 3, 2), g1 = rnd(0.5, 3, 2);
      const s = x1 - g1 * (x1 - x0) / (g1 - g0);
      return { q: `Известно $\\varphi'(${c(x0)})=${c(g0)}$, $\\varphi'(${c(x1)})=${c(g1)}$. Шаг секущей (хорды) для уравнения $\\varphi'(x)=0$ даёт точку…`,
        fields: [{ label: "x", a: s, tol: 1e-4 }],
        hint: "$x=x_1-\\varphi'(x_1)\\dfrac{x_1-x_0}{\\varphi'(x_1)-\\varphi'(x_0)}$",
        sol: `$x=${c(x1)}-${c(g1)}\\cdot\\dfrac{${c(+(x1 - x0).toFixed(2))}}{${c(+(g1 - g0).toFixed(2))}}=${n6(s)}$.` };
    },
    bisectN() {
      const L = ri(1, 8), eps = pick([0.01, 0.001, 0.002, 0.0005]);
      const n = Math.ceil(Math.log2(L / eps) - 1e-12);
      return { q: `Метод средней точки (деление пополам по знаку $\\varphi'$), длина ${L}, остановка при $b-a\\le\\varepsilon=${c(eps)}$. Сколько итераций в худшем случае?`,
        fields: [{ label: "итераций", a: n, tol: 0 }],
        hint: "$L/2^n\\le\\varepsilon$.",
        sol: `$n\\ge\\log_2(${L}/${c(eps)})=${c(Math.log2(L / eps).toFixed(3))}$ ⇒ $n=${n}$.` };
    },
    countEvals() {
      const T = pick([
        { m: "касательных", it: ri(5, 15), f: (n) => 4 + 2 * n, why: (n) => `4 на концах ($\\varphi,\\varphi'$ в $a$ и $b$) + 2 за итерацию: $4+2\\cdot${n}$` },
        { m: "Брента (корень φ′)", it: ri(4, 10), f: (n) => 2 + n + 1, why: (n) => `2 значения $\\varphi'$ в концах + 1 за итерацию + 1 вычисление $f$ для ответа: $2+${n}+1$` },
        { m: "Брента (минимизация, ЛР1)", it: ri(6, 14), f: (n) => 1 + n, why: (n) => `1 в стартовой точке + 1 за итерацию: $1+${n}$` },
        { m: "золотого сечения", it: ri(10, 25), f: (n) => n + 2, why: (n) => `2 стартовых + $(n-1)$ новых + 1 в середине: $2+${n - 1}+1$` },
      ]);
      return { q: `Метод ${T.m} сделал ${T.it} итераций. Сколько вычислений функции/производной насчитает программа из вашей ЛР?`,
        fields: [{ label: "вычислений", a: T.f(T.it), tol: 0 }], hint: "Разложите: старт + за итерацию + в конце.", sol: T.why(T.it) + ` $=${T.f(T.it)}$.` };
    },
    traceGolden() {
      const F = { f: (x) => x - 2 * Math.log(x) };
      const R = METHODS.golden.run(F, 1, 4, 0.0005);
      const k = ri(2, 4), s = R.steps[k];
      return { q: `ЛР1, $f=x-2\\ln x$, $[1;4]$. Какой отрезок $[a;\\,b]$ останется после итерации ${k} золотого сечения? (Используйте Лабораторию или считайте руками.)`,
        fields: [{ label: "a", a: s.a, tol: 2e-5 }, { label: "b", a: s.b, tol: 2e-5 }], hint: "Итерация 1: $f(x_1)=0{,}6189 < f(x_2)=0{,}7566$ ⇒ $b:=x_2=2{,}854102$.",
        sol: R.steps.slice(1, k + 1).map((t) => `$k=${t.k}$: $[${n6(t.a)};\\,${n6(t.b)}]$`).join("; ") + "." };
    },
    convexity() {
      const k = ri(2, 6);
      // f = x^2 e^{-x/k}... проще: f'' знак на отрезке через корни
      const r1 = k - Math.sqrt(2) * k / 2 * 0, r = [k * (2 - Math.SQRT2), k * (2 + Math.SQRT2)];
      void r1;
      const lo = +(r[0] + rnd(0.2, 1, 1)).toFixed(1), hi = +(r[1] - rnd(0.2, 1, 1)).toFixed(1);
      return { q: `Для $f(x)=x^2e^{-x/${k}}$ вторая производная $f''(x)=e^{-x/${k}}\\left(\\dfrac{x^2}{${k * k}}-\\dfrac{4x}{${k}}+2\\right)$. Найдите меньший корень $f''$; выпукла ли $-f$ на $[${c(lo)};\\,${c(hi)}]$? (1 — да, 0 — нет)`,
        fields: [{ label: "меньший корень", a: r[0], tol: 1e-3 }, { label: "выпукла? 1/0", a: 1, tol: 0 }],
        hint: `Корни квадратного трёхчлена: $x=${k}(2\\pm\\sqrt2)$.`,
        sol: `Корни $${k}(2\\pm\\sqrt2)\\approx ${n6(r[0])},\\ ${n6(r[1])}$. Между ними $f''<0$ ⇒ $f$ вогнута, $-f$ выпукла. Отрезок лежит между корнями ⇒ да (1).` };
    },
    brentAccept() {
      const a = rnd(0, 1, 2), b = +(a + rnd(1, 3, 2)).toFixed(2), eps = pick([0.01, 0.02, 0.05]), tol = eps / 2;
      const x = +(a + (b - a) * rnd(0.3, 0.7, 2)).toFixed(3), eOld = rnd(0.05, 0.8, 2);
      const kind = ri(0, 2), sg = Math.random() < .5 ? -1 : 1;
      const u = kind === 0 ? +(x + sg * eOld * rnd(0.1, 0.4, 2)).toFixed(3)
        : kind === 1 ? +(x + sg * eOld * rnd(0.6, 1.2, 2)).toFixed(3)
        : +(b - tol * rnd(0.2, 1.5, 2)).toFixed(4);
      const inside = u - a > 2 * tol && b - u > 2 * tol, small = Math.abs(u - x) < eOld / 2, ok = inside && small;
      const du = c(+Math.abs(u - x).toFixed(4));
      return { q: `Метод Брента (ЛР1): $[a;b]=[${c(a)};\\,${c(b)}]$, $x=${c(x)}$, $\\varepsilon=${c(eps)}$ ($tol=\\varepsilon/2$), позапрошлый шаг $|e|=${c(eOld)}$. Вершина параболы $u=${c(u)}$. Какой шаг сделает метод?`,
        opts: ['шаг параболы в точку $u$', 'шаг золотого сечения'], a: ok ? 0 : 1,
        sol: ok ? 'Вершина внутри отрезка дальше $2\\,tol$ от концов, и $|u-x|$ меньше половины позапрошлого шага.'
          : inside ? `$|u-x|=${du}\\ge |e|/2=${c(eOld / 2)}$ — парабола отвергнута.` : `$u$ ближе $2\\,tol=${c(eps)}$ к концу отрезка — парабола отвергнута.`,
        why: [inside ? `Шаг слишком длинный: $|u-x|=${du}\\ge |e|/2$.` : 'Вершина прилипла к краю отрезка (ближе $2\\,tol$).', 'Оба условия выполнены — берётся парабола.'] };
    },
    tangentSide() {
      const a = rnd(1, 2, 2), b = +(a + rnd(1.5, 3, 2)).toFixed(2), cc = +(a + (b - a) * rnd(0.25, 0.75, 2)).toFixed(4), d = (Math.random() < .5 ? -1 : 1) * rnd(0.01, 0.9, 3);
      const na = d > 0 ? a : cc, nb = d > 0 ? cc : b;
      return { q: `Метод касательных (выпуклая $\\varphi$): отрезок $[${c(a)};\\,${c(b)}]$, точка пересечения касательных $c=${c(cc)}$, $\\varphi'(c)=${c(d)}$, $\\varepsilon=0{,}002$. Каким станет отрезок?`,
        fields: [{ label: 'новое a', a: na, tol: 1e-6 }, { label: 'новое b', a: nb, tol: 1e-6 }],
        hint: "$\\varphi'(c)>0$ — функция растёт, минимум левее $c$.",
        sol: d > 0 ? "$\\varphi'(c)>0$ ⇒ минимум левее ⇒ $b:=c$." : "$\\varphi'(c)<0$ ⇒ минимум правее ⇒ $a:=c$." };
    },
    uniformErr() {
      const a = ri(0, 2), eps = pick([0.1, 0.05, 0.02]), xs = +(a + rnd(0.3, 2.7, 3)).toFixed(3);
      const i = Math.round((xs - a) / eps), node = +(a + i * eps).toFixed(6), er = +Math.abs(node - xs).toFixed(6);
      return { q: `Равномерный поиск на $[${a};\\,${a + 3}]$ с шагом $h=${c(eps)}$; точный минимум $x^*=${c(xs)}$ (функция симметрична около $x^*$). Какой узел выберет метод и какова ошибка $|x-x^*|$?`,
        fields: [{ label: 'узел x', a: node, tol: 1e-6 }, { label: '|x − x*|', a: er, tol: 1e-6 }],
        hint: 'Ближайший к $x^*$ узел $a+i\\,h$.',
        sol: `$i=\\mathrm{round}((x^*-a)/h)=${i}$, узел $${c(node)}$, ошибка $${c(er)}\\le h/2$.` };
    },
  };
  root.GEN = G;
})(window);
