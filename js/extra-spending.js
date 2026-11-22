// The extra spending needed to reach 3.5% of GDP: the announced path against a baseline held at a year's share of GDP,
// and the gap between them, by financial year.
import { start } from "./data.js";
import { createModel, DEFAULTS as MODEL_DEFAULTS } from "./model.js";
import { COLOURS, bn, fixed, fyLabel as lab, narrow, pointText, readHash, refresh, renderGroups, screenReaderHeading,
  setTitle, writeHash } from "./ui.js";

start(["model_inputs.json"], (inputs) => {
  const model = createModel(inputs);
  const c = model.constants;
  const { BASE, LAST, PRICE_YEAR } = c;
  const PLAN_LAST = c.PLAN_YEARS.at(-1);
  const [UK_TARGET] = Object.keys(c.TARGETS).map(Number).sort((a, b) => a - b);
  const YEARS = LAST - BASE;
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const span = WORDS[YEARS] ?? String(YEARS);
  const root = document.querySelector("[data-chart-page]");
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const prices = `${lab(PRICE_YEAR)} prices`;
  // The baseline holds spending at the base year's share of GDP, or the year before's.
  const HELD = { [BASE - 1]: "s2024", [BASE]: "s2025" };
  const DEFAULTS = { units: "cash", held_year: String(BASE) };
  const GROUPS = [
    { key: "units", label: "Units", options: [{ value: "cash", label: "Cash" }, { value: "real", label: `Real terms, ${prices}` }],
      help: (s) => (s.units === "real" ? "Real terms: adjusted for inflation with the GDP deflator, the price of everything the UK produces." : "") },
    { key: "held_year", label: "Baseline", options: [
      { value: String(BASE - 1), label: `${lab(BASE - 1)} share` }, { value: String(BASE), label: `${lab(BASE)} share` }] },
  ];
  const state = {};
  readHash(GROUPS, state, DEFAULTS);
  const HALO = "3px #ffffff";
  const LABEL = (color) => ({ fontSize: "12px", fontWeight: "700", color, textOutline: HALO });
  let targetLabel;

  const chart = Highcharts.chart(el("chart"), {
    chart: { type: "line", spacingRight: 124, events: { render() { drawTargetLabel(this); } } },
    accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Extra spending chart") },
      typeDescription: "Line chart with two lines, the gap between them shaded.",
      series: { descriptionFormatter: (s) => `${s.name}, line ${s.index} of 2 with ${s.points.length} data points.` } },
    legend: { enabled: false },
    xAxis: {
      min: c.FIRST, max: LAST, tickPositions: [c.FIRST, BASE, UK_TARGET, LAST], crosshair: { color: COLOURS.grid },
      labels: { formatter() { return lab(this.value); }, style: { textOverflow: "none", whiteSpace: "nowrap" } },
      accessibility: { description: "Financial year", rangeDescription: `From ${lab(c.FIRST)} to ${lab(LAST)}.` },
      plotLines: [{ value: PLAN_LAST + 0.5, color: "#ffffff", width: 2, zIndex: 1 }],
    },
    yAxis: { min: 0, labels: { formatter() { return `£${this.value}bn`; } } },
    tooltip: { formatter() { return `${lab(this.x)}: £${this.y.toFixed(1)}bn`; } },
    series: [
      // The gap, with its total written inside it (the last series). Screen readers skip both: the description gives it.
      { type: "arearange", name: "Extra spending", color: COLOURS.green, fillOpacity: 1, lineWidth: 0, enableMouseTracking: false,
        data: [], zIndex: 0, accessibility: { enabled: false } },
      { name: `Spending to ${lab(BASE)}, then the announced path`, color: COLOURS.blue, lineWidth: 2, data: [], zIndex: 3,
        accessibility: { point: { descriptionFormatter: (p) => pointText(p.x, p.x > BASE ? "Announced path" : "Spending", p.y) } } },
      { name: "Baseline", color: COLOURS.teal, lineWidth: 2, dashStyle: "Dash", data: [], zIndex: 2 },
      { type: "scatter", name: "Extra spending label", data: [], marker: { enabled: false }, enableMouseTracking: false,
        accessibility: { enabled: false }, zIndex: 4 },
    ],
  });

  // The plans and targets shaded.
  const bands = () => {
    const label = (text) => ({ text, useHTML: true, y: 14, style: { color: COLOURS.note, fontSize: "12px", whiteSpace: "nowrap", textOverflow: "clip" } });
    return [
      { from: c.PLAN_YEARS[0] - 0.5, to: PLAN_LAST + 0.5, color: COLOURS.band, label: label("Plans") },
      { from: PLAN_LAST + 0.5, to: LAST, color: COLOURS.band, label: label("Targets") },
    ];
  };

  // A text's width in a style, measured off the chart.
  const measure = (text, style) => {
    const probe = chart.renderer.text(text, -9999, -9999).css(style).add();
    const w = probe.getBBox().width;
    probe.destroy();
    return w;
  };

  // How far the announced path's end label must rise to stay 6px above the baseline's, in pixels.
  function endLabelsOverlap() {
    const a = chart.series[1].points.at(-1)?.dataLabel, held = chart.series[2].points.at(-1)?.dataLabel;
    if (!a || !held) return 0;
    return Math.max(0, a.element.getBoundingClientRect().bottom + 6 - held.element.getBoundingClientRect().top);
  }

  // Where the total goes: undefined where update() put it, if the lines leave it 2px clear there; otherwise { x, y,
  // lines } to centre it where they do, nearest the end, on one line or else two; or null, nowhere, since the title and
  // the first box give it.
  function placeGapLabel(r, twoLines) {
    const pt = chart.series[3].points[0], dl = pt?.dataLabel;
    if (!dl) return undefined;
    const X = chart.xAxis[0], Y = chart.yAxis[0];
    let { width: w, height: h } = dl.getBBox();
    const value = (arr, x) => {
      const k = Math.min(Math.floor(x) - r.years[0], r.years.length - 2), f = x - r.years[k];
      return (arr[k] + (arr[k + 1] - arr[k]) * f) / 1000;
    };
    const mid = (x) => (Y.toPixels(value(r.announced, x)) + Y.toPixels(value(r.held, x))) / 2;
    const fits = (left, top) => {
      for (let s = 0; s <= 10; s++) {
        const x = X.toValue(left + (w * s) / 10);
        if (x <= BASE || x > LAST) return false;
        if (Y.toPixels(value(r.announced, x)) + 2 > top || Y.toPixels(value(r.held, x)) - 2 < top + h) return false;
      }
      return true;
    };
    if (fits(X.toPixels(LAST) - 13 - w, mid(LAST - 1) - h / 2)) return undefined;
    for (let cx = LAST - 1; cx >= BASE + 1; cx -= 0.25) {
      if (fits(X.toPixels(cx) - w / 2, mid(cx) - h / 2)) return { x: cx, y: Y.toValue(mid(cx)), lines: 1 };
    }
    const probe = chart.renderer.text(twoLines, -9999, -9999).css({ fontSize: "13px", fontWeight: "700" }).add();
    ({ width: w, height: h } = probe.getBBox());
    probe.destroy();
    for (let cx = LAST - 0.5; cx >= BASE + 1; cx -= 0.25) {
      if (fits(X.toPixels(cx) - w / 2, mid(cx) - h / 2)) return { x: cx, y: Y.toValue(mid(cx)), lines: 2 };
    }
    return null;
  }

  // The 3% target's label, above the announced path with an arrow down to its dot, redrawn each time the chart renders.
  function drawTargetLabel(ch) {
    targetLabel?.destroy();
    targetLabel = undefined;
    const pt = ch.series[1]?.points.find((p) => p.x === UK_TARGET && p.options.marker?.enabled);
    if (!pt || pt.plotY === undefined) return;
    const x = ch.plotLeft + pt.plotX, y = ch.plotTop + pt.plotY, tip = y - 8;
    const g = ch.renderer.g("target-label").attr({ zIndex: 7 }).add();
    const text = ch.renderer.text(`${c.TARGETS[UK_TARGET]}% of GDP target`, x, 0).attr({ align: "center" }).css(LABEL(COLOURS.blue)).add(g);
    // The text's foot sits 35px above the dot, or higher where the path, climbing to the right of the dot, would run
    // into it: its foot then stays 6px above the path.
    const b = text.getBBox(), foot = b.y + b.height;
    const path = ch.series[1].points.filter((p) => p.plotY !== undefined).map((p) => [ch.plotLeft + p.plotX, ch.plotTop + p.plotY]);
    let last = y - 35;
    for (let k = 1; k < path.length; k++) {
      const [x0, y0] = path[k - 1], [x1, y1] = path[k], from = Math.max(x0, b.x), to = Math.min(x1, b.x + b.width);
      const at = (t) => y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
      if (from <= to) last = Math.min(last, Math.min(at(from), at(to)) - 6 - foot);
    }
    text.attr({ y: last });
    const top = last + 5;
    ch.renderer.path(["M", x, top, "L", x, tip]).attr({ stroke: COLOURS.blue, "stroke-width": 1.5 }).add(g);
    ch.renderer.path(["M", x - 4, tip - 6, "L", x, tip, "L", x + 4, tip - 6]).attr({ stroke: COLOURS.blue, "stroke-width": 1.5, fill: "none" }).add(g);
    targetLabel = g;
  }

  function update() {
    writeHash(GROUPS, state, DEFAULTS);
    refresh(GROUPS, state);
    const o = { ...MODEL_DEFAULTS, held: HELD[state.held_year] };
    const view = { years: "fy", price: String(PRICE_YEAR), end: LAST };
    const cash = model.extra(o, { ...view, units: "cash" }), realTerms = model.extra(o, { ...view, units: "real" });
    const r = state.units === "cash" ? cash : realTerms;
    const units = state.units === "cash" ? "in cash" : `at ${prices}`;
    const heldYear = Number(state.held_year);
    const heldShare = r.sharesHeld[r.years.indexOf(BASE + 1)];
    const small = narrow();

    setTitle(el("title"), `Reaching ${c.TARGETS[LAST]}% of GDP Would Mean £${fixed(r.gap / 1000, 0)} Billion More on the `
      + `Military over ${span[0].toUpperCase() + span.slice(1)} Years${state.units === "real" ? ` (${lab(PRICE_YEAR)} Prices)` : ""}`);
    el("description").textContent = `UK military spending on NATO definitions, £bn ${units}`;
    const i = r.years.length - 1;

    const pts = r.years.map((y, k) => [y, r.announced[k] / 1000]);
    const heldPts = r.years.filter((y) => y >= BASE).map((y) => [y, r.held[r.years.indexOf(y)] / 1000]);
    const gapPts = r.years.filter((y) => y >= BASE).map((y) => { const k = r.years.indexOf(y); return [y, r.held[k] / 1000, r.announced[k] / 1000]; });
    // The end labels give the last year's figures; on narrow frames, the figures alone.
    const pathEnd = `£${fixed(pts[i][1], 0)}bn${small ? "" : `<br>${c.TARGETS[LAST]}% of GDP target`}`;
    const heldEnd = `£${fixed(heldPts.at(-1)[1], 0)}bn${small ? "" : `<br>${r.sharesHeld[i].toFixed(1)}% of GDP`}`;
    const end = (text, color) => ({ enabled: true, crop: false, overflow: "allow", allowOverlap: true, align: "left", x: 6, y: 0,
      formatter: () => text, style: LABEL(color) });
    const mark = { enabled: true, symbol: "circle", radius: 5, fillColor: COLOURS.blue, lineColor: "#ffffff", lineWidth: 2 };
    pts[i] = { x: LAST, y: pts[i][1], marker: mark, dataLabels: end(pathEnd, COLOURS.blue) };
    const t = r.years.indexOf(UK_TARGET);
    pts[t] = { x: UK_TARGET, y: pts[t][1], marker: mark };
    heldPts[heldPts.length - 1] = { x: LAST, y: heldPts.at(-1)[1], dataLabels: end(heldEnd, COLOURS.tealInk) };
    // The lines are named on the chart: the announced path above its line, ending in the plans' last year, and the
    // baseline below its own, at its second year.
    const name = (text, color, align, verticalAlign, y) => ({ enabled: true, crop: false, overflow: "allow", align, verticalAlign,
      x: 0, y, formatter: () => text, style: LABEL(color) });
    const p = r.years.indexOf(PLAN_LAST);
    pts[p] = { x: pts[p][0], y: pts[p][1], dataLabels: name("Announced path", COLOURS.blue, "right", "bottom", -8) };
    heldPts[1] = { x: heldPts[1][0], y: heldPts[1][1], dataLabels: name("Baseline", COLOURS.tealInk, "left", "top", 8) };
    // Room on the right for the longer end label.
    const right = Math.ceil(Math.max(...[pathEnd, heldEnd].flatMap((s) => s.split("<br>")).map((s) => measure(s, { fontSize: "12px", fontWeight: "700" })))) + 14;
    chart.update({ chart: { spacingRight: right }, accessibility: { description: `UK military spending, ${lab(c.FIRST)} to ${lab(LAST)}: `
      + `the announced path to ${c.TARGETS[LAST]}% of GDP against a baseline, with the gap shaded.` } }, false);
    const drawn = [...r.announced, ...r.held.slice(r.years.indexOf(BASE))];
    chart.yAxis[0].update({ max: Math.max(...r.announced) / 1000 * 1.1, accessibility: { description: `Spending, £bn ${units}`,
      rangeDescription: `From ${bn(Math.min(...drawn))} to ${bn(Math.max(...drawn))}.` } }, false);
    // Narrow charts have room for three years on the axis.
    chart.xAxis[0].update({ plotBands: bands(), tickPositions: small ? [c.FIRST, BASE, LAST] : [c.FIRST, BASE, UK_TARGET, LAST] }, false);
    chart.series[0].setData(gapPts, false);
    chart.series[1].setData(pts, false, false, false);
    chart.series[2].setData(heldPts, false, false, false);
    // The total, written in the shaded gap: ending at the last year, level with the gap's middle a year earlier.
    const a = r.years.indexOf(LAST - 1), midY = (r.announced[a] + r.held[a]) / 2000;
    const total = (x, y, align, dx, lines = 1) => [{ x, y, dataLabels: { enabled: true, crop: false, padding: 0, overflow: "allow",
      align, verticalAlign: "middle", x: dx, y: 0, formatter: () => `${bn(r.gap, 0)}${lines === 2 ? "<br>" : " "}extra`,
      style: { fontSize: "13px", fontWeight: "700", color: COLOURS.ink, textOutline: "none" } } }];
    chart.series[3].setData(total(LAST, midY, "right", -13), false, false, false);
    chart.redraw();
    // Browsers measure text a little differently, so the end labels' room is checked as drawn, and widened if short.
    const box = chart.container.getBoundingClientRect();
    const over = Math.max(0, ...[chart.series[1].points.at(-1), chart.series[2].points.at(-1)]
      .map((pt) => pt?.dataLabel ? pt.dataLabel.element.getBoundingClientRect().right - (box.right - 3) : 0));
    if (over > 0) {
      chart.update({ chart: { spacingRight: right + Math.ceil(over) } }, false);
      chart.redraw();
    }
    // Labels moved after the first drawing are set again in full, then drawn once more: the end labels kept apart, the
    // total placed where the gap has room, and the path's name kept clear of the axis on narrow charts.
    const lift = endLabelsOverlap(), spot = placeGapLabel(r, `${bn(r.gap, 0)}<br>extra`);
    const nameBox = chart.series[1].points[p]?.dataLabel?.element.getBoundingClientRect();
    const nameShift = nameBox ? Math.max(0, Math.ceil(chart.plotLeft + 2 - (nameBox.left - chart.container.getBoundingClientRect().left))) : 0;
    if (lift > 0) pts[i] = { ...pts[i], dataLabels: { ...pts[i].dataLabels, y: -Math.ceil(lift) } };
    if (nameShift > 0) pts[p] = { ...pts[p], dataLabels: { ...pts[p].dataLabels, x: nameShift } };
    if (lift > 0 || nameShift > 0) chart.series[1].setData(pts, false, false, false);
    if (spot !== undefined) chart.series[3].setData(spot ? total(spot.x, spot.y, "center", 0, spot.lines) : [], false, false, false);
    if (lift > 0 || nameShift > 0 || spot !== undefined) chart.redraw();

    el("notes").textContent = [
      `Financial years; figures are in ${state.units === "cash" ? "nominal terms" : `${prices}, using a GDP deflator`}.`,
      `Underlying data is from NATO; spending in ${lab(BASE)} is a NATO estimate.`,
      `“Extra” is the cumulative gap over ${lab(BASE + 1)}–${lab(LAST)} between the announced path and the baseline, which `
        + `holds military spending at its ${lab(heldYear)} share of financial-year GDP, ${heldShare.toFixed(1)}%.`,
      `The announced path follows the Defence Investment Plan to ${lab(PLAN_LAST)}, reaches ${c.TARGETS[UK_TARGET]}% of GDP, `
        + `the government's target, in ${lab(UK_TARGET)}, then rises linearly to ${c.TARGETS[LAST]}%, the NATO target, in `
        + `${lab(LAST)}, using OBR forecasts and long-term assumptions.`,
      `Some of the gap is a change in what the figures count, not new spending: from ${lab(c.SIA_FROM)} the UK appears to `
        + "count its whole intelligence budget, which the baseline does not.",
    ].join(" ");
    el("source").textContent = "Chart: Transition Security Project • Source: Author's analysis of NATO, MOD, HM Treasury, OBR and ONS data";
  }


  renderGroups(el("controls"), GROUPS, state, update);
  update();
  // An address edited on the open page shows its view.
  window.addEventListener("hashchange", () => { readHash(GROUPS, state, DEFAULTS); update(); });
  window.matchMedia("(max-width: 499px)").addEventListener("change", update);
}, ["more"]);
