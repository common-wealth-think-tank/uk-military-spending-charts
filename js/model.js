// The calculation behind the historical and extra-spending charts. Inputs: data/model_inputs.json.

export const DEFAULTS = {
  measure: "nato", target: "own", path: "step", target_years: "fy", held: "s2025", nato_def: 0, nato_plan: "dip",
  annington: "published", revision: false, aid: "in", plan: "budget", pension: "cancel", war: "in", deflator: "YBGB",
  coldwar: "full", gdp_vintage: "latest", rebasing: "published", nato_adjust: "none",
};

const series = (years, values) => new Map(years.map((y, i) => [y, values[i]]));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function createModel(inp, vintages = true) {
  const c = inp.constants;
  const { BASE, FIRST, LAST, PRICE_YEAR } = c;
  const PLAN_YEARS = c.PLAN_YEARS;
  const PATH = Object.fromEntries(Object.entries(c.PATH_ANCHORS).map(([y, v]) => [Number(y), v]));
  const fy = { gdp: series(inp.fy.years, inp.fy.gdp), deflator: series(inp.fy.years, inp.fy.deflator) };
  const cy = { gdp: series(inp.cy.years, inp.cy.gdp), deflator: series(inp.cy.years, inp.cy.deflator) };
  const nato = series(inp.nato_fy.years, inp.nato_fy.values);
  const sipri = series(inp.sipri_fy.years, inp.sipri_fy.values);
  const war = series(inp.war_pensions_fy.years, inp.war_pensions_fy.values);
  const mod = {
    ncr: series(inp.mod.years, inp.mod.with_pensions_ncr),
    budget: series(inp.mod.years, inp.mod.with_pensions_budget),
  };
  const fyHist = inp.fy_history;
  const histGdp = series(fyHist.years, fyHist.gdp);
  const histDeflator = Object.fromEntries(c.DEFLATORS.map((d) => [d, series(fyHist.years, fyHist.deflator[d])]));
  const natoHist = inp.nato_history;
  const natoCash = series(natoHist.years, natoHist.values);

  const bridgeFactor = (y) => natoHist.breaks.filter((b) => y < b).reduce((f, b) =>
    f * (natoCash.get(b) / natoCash.get(b - 1)) / (sipri.get(b) / sipri.get(b - 1)), 1);
  const natoBasis = series(natoHist.years, natoHist.basis);
  const sipriBasis = series(inp.sipri_fy.years, inp.sipri_fy.basis);
  const projDeflatorFy = Object.fromEntries(
    c.DEFLATORS.map((d) => [d, series(inp.projection_deflators_fy.years, inp.projection_deflators_fy[d])]));
  const share = (cash, y) => (cash / fy.gdp.get(y)) * 100;

  function fyAdjustments(o) {
    const adj = new Map();
    const add = (y, v) => adj.set(y, (adj.get(y) ?? 0) + v);
    const total = c.ANNINGTON_GBP_M, cap = c.ANNINGTON_CAPITAL_GBP_M, ay = c.ANNINGTON_FY;
    if (o.annington === "capital") add(ay, -(total - cap));
    else if (o.annington === "out") add(ay, -total);
    else if (o.annington === "spread") { add(ay, -total / 2); add(ay + 1, total / 2); }
    if (o.revision) add(BASE, c.SIPRI_REVISION_GBP_M);
    if (o.aid === "out") for (const [y, v] of Object.entries(c.AID_DOUBLE_COUNT_GBP_M)) add(Number(y), -v);
    if (o.war === "out") for (const [y, v] of war) add(y, -v);
    return adj;
  }

  function spend(o) {
    if (o.measure === "nato") return new Map(nato);
    const s = new Map(sipri);
    for (const [y, v] of fyAdjustments(o)) if (s.has(y)) s.set(y, s.get(y) + v);
    return s;
  }

  const offsetOf = (o) => c.NATO_SIPRI_GAP - (o.revision ? (c.SIPRI_REVISION_GBP_M / fy.gdp.get(BASE)) * 100 : 0)
    + (o.aid === "out" ? (c.AID_DOUBLE_COUNT_GBP_M[BASE] / fy.gdp.get(BASE)) * 100 : 0);
  const warShareOf = (o) => (o.measure === "sipri" && o.war === "out" ? (war.get(BASE) / fy.gdp.get(BASE)) * 100 : 0);

  function targetAnchors(shape, t30, t35) {
    return {
      step: { 2030: t30, [LAST]: t35 },
      nostep: { [LAST]: t35 },
      hold3: { 2030: t30, [LAST - 1]: t30, [LAST]: t35 },
      early: { 2030: t30, 2031: t35, [LAST]: t35 },
    }[shape];
  }

  function targets(o) {
    let t30 = PATH[2030], t35 = PATH[LAST];
    if (o.measure === "nato" && o.nato_adjust === "sipri") { t30 -= c.NATO_SIPRI_GAP; t35 -= c.NATO_SIPRI_GAP; }
    if (o.measure === "sipri") {
      if (o.target === "reexpressed") { t30 -= offsetOf(o); t35 -= offsetOf(o); }
      t30 -= warShareOf(o); t35 -= warShareOf(o);
    }
    return [t30, t35];
  }

  function anchors(o, s) {
    let plans;
    if (o.measure === "nato") {
      plans = Object.fromEntries(PLAN_YEARS.map((y) => [y, PATH[y]]));
      if (o.nato_plan === "own") for (const [y, v] of Object.entries(c.NATO_OWN_PLAN)) plans[Number(y)] = v;

      if (o.nato_adjust === "sipri") for (const y of PLAN_YEARS) plans[y] -= c.NATO_SIPRI_GAP;
    } else if (o.plan === "natoshares") {
      plans = Object.fromEntries(PLAN_YEARS.map((y) => [y, PATH[y] - offsetOf(o) - warShareOf(o)]));
    } else {
      const base = new Map(o.plan === "budget" ? mod.budget : mod.ncr);
      if (o.pension === "count") {
        for (const [y, v] of Object.entries(c.PENSION_SAVING_GBP_M)) base.set(Number(y), base.get(Number(y)) + v);
      }
      const margin = share(s.get(BASE), BASE) - share(base.get(BASE), BASE);
      plans = Object.fromEntries(PLAN_YEARS.map((y) => [y, share(base.get(y), y) + margin]));
    }
    const [t30, t35] = targets(o);
    return { ...plans, ...targetAnchors(o.path, t30, t35) };
  }

  function interpolate(anch, years) {
    const known = Object.keys(anch).map(Number).sort((a, b) => a - b);
    const out = new Map();
    for (const y of years) {
      const lo = Math.max(...known.filter((k) => k <= y)), hi = Math.min(...known.filter((k) => k >= y));
      out.set(y, lo === hi ? anch[lo] : anch[lo] + ((anch[hi] - anch[lo]) * (y - lo)) / (hi - lo));
    }
    return out;
  }

  function fyPaths(o) {
    const s = spend(o);

    const hs = spend({ ...o, annington: "out" });
    const anch = anchors(o, s);
    const shares = interpolate(anch, range(BASE + 1, LAST));
    const extra = o.measure === "nato" ? o.nato_def : 0;
    const years = range(FIRST - 1, LAST), announced = [], held = [];
    for (const y of years) {
      if (y <= BASE) { announced.push(s.get(y)); held.push(s.get(y)); continue; }
      const g = fy.gdp.get(y);
      let h;

      const p = PLAN_YEARS[PLAN_YEARS.length - 1];

      if (o.held === "plans" || o.held === "plansreal") {
        if (y <= p) h = (shares.get(y) / 100) * g;
        else if (o.held === "plans") h = (shares.get(p) / 100) * g;
        else h = ((shares.get(p) / 100) * fy.gdp.get(p) * fy.deflator.get(y)) / fy.deflator.get(p);
      } else if (o.held === "real" || o.held === "real2024") {
        const b = o.held === "real" ? BASE : BASE - 1;
        h = (hs.get(b) * fy.deflator.get(y)) / fy.deflator.get(b) + (extra / 100) * g;
      } else {
        const by = o.held === "s2025" ? BASE : BASE - 1;
        h = ((share(hs.get(by), by) + extra) / 100) * g;
      }
      announced.push((shares.get(y) / 100) * g);
      held.push(h);
    }
    return { years, announced, held, spend: s, heldSpend: hs };
  }

  function cyPaths(o, f) {
    const years = range(FIRST, LAST);
    const rule = (arr) => years.map((y) => {
      const i = f.years.indexOf(y);
      return 0.25 * arr[i - 1] + 0.75 * arr[i];
    });
    const announced = rule(f.announced), held = rule(f.held);
    if (o.target_years === "cy") {
      const last = PLAN_YEARS[PLAN_YEARS.length - 1];
      const [t30, t35] = targets(o);
      const anch = { [last]: (announced[years.indexOf(last)] / cy.gdp.get(last)) * 100, ...targetAnchors(o.path, t30, t35) };
      for (const [y, v] of interpolate(anch, range(last + 1, LAST))) announced[years.indexOf(y)] = (v / 100) * cy.gdp.get(y);
    }
    return { years, announced, held };
  }

  function extra(o, view = { years: "fy", units: "cash", price: "2025" }) {
    const f = fyPaths(o);
    let years, announced, held, d, g;
    if (view.years === "fy") {
      const i0 = f.years.indexOf(FIRST);
      years = f.years.slice(i0); announced = f.announced.slice(i0); held = f.held.slice(i0); d = fy.deflator; g = fy.gdp;
    } else {
      ({ years, announced, held } = cyPaths(o, f)); d = cy.deflator; g = cy.gdp;
    }
    const n = years.indexOf(view.end ?? LAST) + 1;
    years = years.slice(0, n); announced = announced.slice(0, n); held = held.slice(0, n);
    const sharesAnnounced = years.map((y, i) => (announced[i] / g.get(y)) * 100);
    const sharesHeld = years.map((y, i) => (held[i] / g.get(y)) * 100);
    if (view.units === "real") {
      const scale = view.price === "2026" ? d.get(BASE + 1) / 100 : 1;
      announced = announced.map((v, i) => (v / d.get(years[i])) * 100 * scale);
      held = held.map((v, i) => (v / d.get(years[i])) * 100 * scale);
    }
    const gapByYear = years.map((y, i) => (y > BASE ? announced[i] - held[i] : 0));
    return {
      years, announced, held, sharesAnnounced, sharesHeld, gapByYear,
      gap: gapByYear.reduce((a, b) => a + b, 0),
      baseShare: share(f.heldSpend.get(BASE), BASE),
    };
  }

  function historical(o) {
    const nato = o.measure === "nato";
    const f = fyPaths(o);
    const histYears = fyHist.years, defl = histDeflator[o.deflator];
    const adj = nato ? null : fyAdjustments(o);
    const bridged = nato && o.nato_adjust === "sipri";
    const cash = histYears.map((y) => (nato ? natoCash.get(y) * (bridged ? bridgeFactor(y) : 1) : sipri.get(y) + (adj.get(y) ?? 0)));
    const realHist = histYears.map((y, i) => cash[i] / (defl.get(y) / 100));
    const histShare = histYears.map((y, i) => (cash[i] / histGdp.get(y)) * 100);
    const projYears = range(PRICE_YEAR, LAST);
    const projCash = projYears.map((y) => f.announced[f.years.indexOf(y)]);
    const realProj = projYears.map((y, i) => projCash[i] / (projDeflatorFy[o.deflator].get(y) / 100));
    const projShare = projYears.map((y, i) => (projCash[i] / fy.gdp.get(y)) * 100);
    const w = o.coldwar === "full" ? c.COLD_WAR_FULL : c.COLD_WAR_EX_KOREA;
    let peak = -Infinity, peakYear = null;
    histYears.forEach((y, i) => { if (y >= w[0] && y <= w[1] && realHist[i] > peak) { peak = realHist[i]; peakYear = y; } });
    const real = new Map(histYears.map((y, i) => [y, realHist[i]]));

    const rebasing = nato ? "published" : (o.rebasing ?? "published");
    const test = new Map(real);
    if (rebasing === "onebasis") {
      for (const [y, v] of Object.entries(c.NATO_PRE_1986_GBP_M).map(([y, v]) => [Number(y), v])) {
        test.set(y, real.get(y) + (v * c.SIPRI_NATO_SCALE - sipri.get(y)) / (defl.get(y) / 100));
      }
    }
    const lastOld = Math.max(...Object.keys(c.NATO_PRE_1986_GBP_M).map(Number));
    const base = c.BUILDUP_START - 1, k = PRICE_YEAR - base;
    const rate = (a, n = k) => (test.get(a + n) / test.get(a)) ** (1 / n) - 1;

    const whole = (a) => {
      if (nato) return natoBasis.get(a) === natoBasis.get(a + k) && (bridged || !natoHist.breaks.some((b) => a < b && b <= a + k));
      if (rebasing === "onebasis") return !(a <= lastOld && lastOld < a + k);
      if (rebasing === "skip") return sipriBasis.get(a) === sipriBasis.get(a + k);
      return true;
    };
    let rival = null, rivalRate = -Infinity;
    for (const a of range(c.KOREA[1] + 1, base - k)) {
      if (!whole(a)) continue;
      const r = rate(a);
      if (r > rivalRate) { rivalRate = r; rival = a; }
    }
    let overlapYear = null, overlapRate = -Infinity;
    for (const a of range(base - k + 1, base - 1)) { const r = rate(a); if (r > overlapRate) { overlapRate = r; overlapYear = a; } }
    const now = rate(base), korea = rate(c.KOREA[0], c.KOREA[1] - c.KOREA[0]);
    const holds = korea > now + c.CLEARLY && rivalRate < now + c.CLEARLY;
    return {
      histYears, realHist, histShare, projYears, realProj, projShare, peak, peakYear,
      vsPeak2025: real.get(PRICE_YEAR) / peak - 1, vsPeak2035: realProj[realProj.length - 1] / peak - 1,
      share2035: projShare[projShare.length - 1], now, korea, rival, rivalRate, overlapYear, overlapRate,
      buildupStart: base, buildupYears: k, holds, alike: holds && Math.abs(rivalRate - now) < c.CLEARLY,
    };
  }

  const springNato = { ...inp.nato_fy, values: inp.nato_fy.values.map((v, i) => (inp.nato_fy.years[i] === BASE ? inp.nato_2025_spring : v)) };
  const others = vintages ? {
    summit: createModel({ ...inp, fy: inp.fy_summit, cy: inp.cy_summit }, false),
    spring2026: createModel({ ...inp, fy: inp.fy_spring, cy: inp.cy_spring, nato_fy: springNato }, false),
  } : {};
  const other = (o) => (o.gdp_vintage && o.gdp_vintage !== "latest" ? others[o.gdp_vintage] : null);
  const latest = (o) => ({ ...o, gdp_vintage: "latest" });
  return {
    constants: c, historical,
    extra: (o, view) => (other(o) ? other(o).extra(latest(o), view) : extra(o, view)),
  };
}
