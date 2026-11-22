// The extra spending chart: the announced path to 3.5% of GDP, or to the UK's 3%, against a held line, and the gap, by
// financial year (model.extra).
import { drawn, inputs, model } from "./data.js";
import { DEFAULTS as MODEL_DEFAULTS } from "./model.js";
import { DW, applyShared, bn, downloadCsv, fixed, fyLabel, pointText, readHash, refresh, relabel, renderGroups, renderTiles, screenReaderHeading, settingsName, writeHash } from "./ui.js";

const c = model.constants;
// The years come from the model: the base year, the last year, the plans' last year and the UK's target year; and the
// price base.
const { BASE, LAST } = c;
const PLAN_LAST = c.PLAN_YEARS.at(-1);
const [UK_TARGET] = Object.keys(c.TARGETS).map(Number).sort((a, b) => a - b);
const lab = fyLabel;
// The baseline's years follow the base year, so a new NATO report needs no change here (the review of 3 November
// 2026). The model's codes keep the names they had in 2026: "s2025" is the base year's share, "s2024" the year
// before's.
const DEFAULTS = { ...MODEL_DEFAULTS, units: "cash", held_kind: "share", held_year: String(BASE), goal: "3.5" };
// "plans": the plans to their last year, then that year's share or level held (the user's request, 3 November 2026).
const HELD = { share: { [BASE - 1]: "s2024", [BASE]: "s2025", plans: "plans" }, level: { [BASE - 1]: "real2024", [BASE]: "real", plans: "plansreal" } };
// The view's years in words, for the title and boxes ("ten", "five"); numerals past twelve.
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const fromPlans = (held) => held === "plans" || held === "plansreal";
// The OBR forecast's note, for the forecast chosen (the user's request, 2 November 2026).
const VINTAGE_NOTES = {
  spring2026: "The March 2026 forecast changes GDP and prices, not the plans or targets, and takes 2025/26 spending from "
    + "the NATO June 2025 estimate.",
  summit: "The March 2025 forecast, the latest at the NATO summit in June 2025, changes GDP and prices, not the plans or "
    + "targets.",
};
// Shown under "Compared with" only while a level is chosen (the user's request, 2 November 2026). "The baseline year",
// since the year is chosen in the next row (the user's decision, the second review of 3 November 2026).
const FLAT_NOTE = "Flat in real terms: the baseline year's spending rises with prices but not with economic growth, so its share of GDP falls.";
// The plan years are the Plan's headline shares; more precise figures move with each GDP forecast, so the caption says
// only that (decisions of 2 November 2026).
// The Targets sentence names 2030 only on the stepped path, the one with a 3% target (the review of 2 November 2026),
// and only 2030 when the view ends there (3 November 2026); with one target it is singular (the review of 3 November).
// The 3% view says whose target it is, since its one target sentence names NATO (the user's approval, the same review),
// and the stepped path whose each target is; both say the government dates its target year as NATO does (the user's
// decision, the second review of 3 November 2026: NATO's labelling alone doesn't date a target NATO didn't set).
const plansNote = (path, end) => "Plans: the Defence Investment Plan's headline 2.6% of GDP in 2026/27 and 2.7% in "
  + "2027/28–2029/30 (precise shares move with each GDP forecast). " + (end !== LAST
    ? "Target: the government's own, not a NATO target; like NATO, the government counts a target year as the financial "
      + "year that starts in it, so 2030 is 2030/31."
    : path === "step"
      ? "Targets: 3% is the government's own target and 3.5% a NATO target; the government and NATO both count a target "
        + "year as the financial year that starts in it, so 2030 and 2035 are 2030/31 and 2035/36."
      : "Target: NATO labels UK financial years by the year they start, so 2035 is 2035/36.");
const isNato = (s) => s.measure === "nato";
// One list of assumptions, all above the results (the user's request, 2 November 2026).
const GROUPS = [
  { key: "measure", label: "Definitions", options: [
    { value: "nato", label: "NATO" }, { value: "sipri", label: "SIPRI" }],
    // Its note shows only while SIPRI is chosen (the user's request, 2 November 2026).
    help: (s) => (isNato(s) ? "" : "The SIPRI option aligns NATO data with SIPRI definitions. It bridges the methodological changes NATO introduced in 2001/02 and 2005/06, while incorporating about a third of the intelligence budget into the total consistently.") },
  // Real terms are at 2025/26 prices only (the user's request, 2 November 2026; 2026/27 prices were an option).
  { key: "units", label: "Units", options: [{ value: "cash", label: "Cash" }, { value: "real", label: `Real terms, ${lab(c.PRICE_YEAR)} prices` }],
    // Its note shows only while real terms are chosen (the user's request, 2 November 2026).
    help: (s) => (s.units === "real" ? "Real terms: adjusted for inflation with the GDP deflator, the price of everything the UK produces." : "") },
  // What spending is held at: first a share of GDP or a level flat in real terms, then the year (the user's request,
  // 2 November 2026). Together they give the model's held line (HELD).
  { key: "held_kind", label: "Compared with", options: [
    { value: "share", label: "Share of GDP" }, { value: "level", label: "Level, flat in real terms" }],
    help: (s) => (s.held_kind === "level" ? FLAT_NOTE : "") },
  // "Baseline" rather than "Held at" (the user's request, 2 November 2026). The end of the announced plans is a baseline
  // too (3 November 2026): against it, 3% in 2030/31 is the step the IFS and Resolution Foundation cost.
  // Its options' labels, with their shares, are set by update() (relabel); these stand in until then.
  { key: "held_year", label: "Baseline", options: [{ value: String(BASE - 1), label: lab(BASE - 1) }, { value: String(BASE), label: lab(BASE) },
    { value: "plans", label: lab(PLAN_LAST) }],
    help: (s) => (s.held_year === "plans" ? `Follows the plans to ${lab(PLAN_LAST)}, then holds that year's `
      + `${s.held_kind === "share" ? "share of GDP" : "level flat in real terms"}.` : "") },
  // The target the view runs to (the user's request, 3 November 2026): NATO's 3.5% of GDP by 2035/36, or the UK's 3% by
  // 2030/31, when the chart, title, boxes and caption cover the five years to 2030/31 on the stepped path, so the path's
  // choice is hidden.
  { key: "goal", label: "Target", options: [{ value: "3.5", label: "3.5% by 2035" }, { value: "3", label: "3% by 2030" }] },
  { key: "path", label: `Path after ${lab(PLAN_LAST)}`, when: (s) => s.goal !== "3", options: [
    { value: "step", label: "3% by 2030, then a line to 3.5%" }, { value: "nostep", label: "A line to 3.5% in 2035" }] },
  // The latest forecast named from the builds' sources (the second review of 3 November 2026).
  { key: "gdp_vintage", label: "OBR forecast", options: [
    { value: "latest", label: c.OBR_FORECAST }, { value: "spring2026", label: "March 2026" },
    { value: "summit", label: "March 2025" }],
    // Its note describes only the forecast chosen; the latest needs none (the user's request, 2 November 2026).
    help: (s) => VINTAGE_NOTES[s.gdp_vintage] ?? "" },
];

const TAB = "extra";
const root = document.getElementById(TAB);
const el = (name) => root.querySelector(`[data-el="${name}"]`);
const VIEW = { years: "fy", price: String(c.PRICE_YEAR) };
const state = { ...DEFAULTS };
readHash(GROUPS, state, TAB);
let targetLabel;  // declared before the chart, whose first render draws it (drawTargetLabel)
const chart = Highcharts.chart(el("chart"), {
  chart: { type: "line", spacingRight: 124, events: { render() { drawTargetLabel(this); } } },
  // The chart's and axes' descriptions, the bands and the baseline's name are set by update(), before the first drawing.
  accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Extra spending chart") },
    typeDescription: "Line chart with two lines, the gap between them shaded.",
    // The two lines numbered between themselves, the path first (series 1, then 2), as the description names them (the
    // second review of 3 November 2026: Highcharts counted the shaded gap and the total's label too, "series 3 of 4").
    series: { descriptionFormatter: (s) => `${s.name}, line ${s.index} of 2 with ${s.points.length} data points.` } },
  legend: { enabled: false },
  xAxis: {
    min: c.FIRST, max: LAST, tickPositions: [c.FIRST, BASE, UK_TARGET, LAST], crosshair: { color: DW.grid },
    labels: { formatter() { return lab(this.value); } },
    plotLines: [{ value: PLAN_LAST + 0.5, color: "#ffffff", width: 2, zIndex: 1 }],
  },
  yAxis: { min: 0, labels: { formatter() { return `£${this.value}bn`; } } },
  tooltip: { shared: true, formatter() { return tooltip(this.x); } },
  series: [
    // The gap in TSP's bright green, with its total written inside it (the last series). Screen readers skip
    // it: its edges are the two lines, and the description gives the total.
    { type: "arearange", name: "Extra spending", color: DW.green, fillOpacity: 1, lineWidth: 0, enableMouseTracking: false, data: [], zIndex: 0,
      accessibility: { enabled: false } },
    { name: `Spending to ${lab(BASE)}, then the announced path`, color: DW.blue, lineWidth: 2, data: [], zIndex: 3,
      // Each point named as the tooltip names it (the second review of 3 November 2026: every one was "Spending to
      // 2025/26, then the announced path").
      accessibility: { point: { descriptionFormatter: (p) => pointText(p.x, p.x > BASE ? "Announced path" : "Spending", p.y) } } },
    { color: DW.teal, lineWidth: 2, dashStyle: "Dash", data: [], zIndex: 2 },
    { type: "scatter", name: "Extra spending label", data: [], marker: { enabled: false }, enableMouseTracking: false,
      accessibility: { enabled: false }, zIndex: 4 },
  ],
});
renderGroups(el("main-controls"), GROUPS, state, update, "x");
let current;
update();
el("download").addEventListener("click", download);
root.addEventListener("tabshow", () => { applyShared(GROUPS, state); update(); chart.reflow(); });
drawn();

// The plans and targets shaded, to the view's last year. With the 3% target the target band is half a year wide, too
// narrow for a label, and the end label names the target (3 November 2026). The straight path has one target, so its
// band says "Target", as its caption does (the user's decision, the second review of 3 November 2026).
function bands(end, path) {
  const label = (text) => ({ text, style: { color: DW.note, fontSize: "12px", textOverflow: "clip", whiteSpace: "nowrap" }, useHTML: true, y: 14 });
  return [
    { from: c.PLAN_YEARS[0] - 0.5, to: PLAN_LAST + 0.5, color: DW.band, label: label("Plans") },
    { from: PLAN_LAST + 0.5, to: end, color: DW.band, label: end === LAST ? label(path === "step" ? "Targets" : "Target") : undefined },
  ];
}

// How far the announced path's end label must rise to stay 6px above the baseline's (the lines close at the end, as
// against the plans' end with the 3% target), in pixels; update() lifts it by that (3 November 2026).
function endLabelsOverlap() {
  const a = chart.series[1].points.at(-1)?.dataLabel, held = chart.series[2].points.at(-1)?.dataLabel;
  if (!a || !held) return 0;
  return Math.max(0, a.element.getBoundingClientRect().bottom + 6 - held.element.getBoundingClientRect().top);
}

// Where the total goes (3 November 2026: with the 3% target, or against the plans' end, the gap is narrow): undefined
// where update() put it, if the lines leave it 2px clear there; otherwise { x, y, lines } to centre it where they do,
// nearest the end, on one line or else two ("£136bn / extra"); or null, nowhere, since the title and the first box give
// it.
function placeGapLabel(r, end, twoLines) {
  const pt = chart.series[3].points[0], dl = pt?.dataLabel;
  if (!dl) return undefined;
  const X = chart.xAxis[0], Y = chart.yAxis[0];
  let { width: w, height: h } = dl.getBBox();
  // A line's value between its years, as drawn (£bn), and the gap's middle in pixels.
  const value = (arr, x) => {
    const k = Math.min(Math.floor(x) - r.years[0], r.years.length - 2), f = x - r.years[k];
    return (arr[k] + (arr[k + 1] - arr[k]) * f) / 1000;
  };
  const mid = (x) => (Y.toPixels(value(r.announced, x)) + Y.toPixels(value(r.held, x))) / 2;
  const fits = (left, top) => {
    for (let s = 0; s <= 10; s++) {
      const x = X.toValue(left + (w * s) / 10);
      if (x <= BASE || x > end) return false;
      if (Y.toPixels(value(r.announced, x)) + 2 > top || Y.toPixels(value(r.held, x)) - 2 < top + h) return false;
    }
    return true;
  };
  if (fits(X.toPixels(end) - 13 - w, mid(end - 1) - h / 2)) return undefined;
  for (let cx = end - 1; cx >= BASE + 1; cx -= 0.25) {
    if (fits(X.toPixels(cx) - w / 2, mid(cx) - h / 2)) return { x: cx, y: Y.toValue(mid(cx)), lines: 1 };
  }
  // The two-line form, measured off the chart in the label's style.
  const probe = chart.renderer.text(twoLines, -9999, -9999).css({ fontSize: "13px", fontWeight: "700" }).add();
  ({ width: w, height: h } = probe.getBBox());
  probe.destroy();
  for (let cx = end - 0.5; cx >= BASE + 1; cx -= 0.25) {
    if (fits(X.toPixels(cx) - w / 2, mid(cx) - h / 2)) return { x: cx, y: Y.toValue(mid(cx)), lines: 2 };
  }
  return null;
}

// The 3% target's label, above the announced path with an arrow down to its marker (the user's request, 2 November
// 2026), redrawn each time the chart renders. Only on the "3% by 2030" path to 3.5%, where the point has a marker;
// with the 3% target the point ends the chart, and its end label names the target (3 November 2026).
function drawTargetLabel(ch) {
  targetLabel?.destroy();
  targetLabel = undefined;
  const pt = ch.series[1]?.points.find((p) => p.x === UK_TARGET && p.options.marker?.enabled);
  if (!pt || pt.plotY === undefined || state.goal === "3") return;
  const x = ch.plotLeft + pt.plotX, y = ch.plotTop + pt.plotY, tip = y - 8;
  // Below the tooltip (zIndex 8), which it drew over once redrawn after the tooltip existed.
  const g = ch.renderer.g("target-label").attr({ zIndex: 7 }).add();
  // On SIPRI definitions the point is the target's equivalent, said on a second line (the user's wording, 2 November
  // 2026). Lines are 15px apart. (A last line, "£11bn above the plans' 2.7%", was dropped on 3 November 2026 for the
  // baseline at the end of the plans.)
  const lines = [`${c.TARGETS[UK_TARGET]}% of GDP target`, ...(isNato(state) ? [] : ["equivalent"])];
  const text = ch.renderer.text(lines.join("<br>"), x, 0).attr({ align: "center" })
    .css({ fontSize: "12px", fontWeight: "700", color: DW.blue, textOutline: "3px #ffffff" }).add(g);
  // The last line's baseline sits 35px above the dot, or higher where the path, climbing to the right of the dot, would
  // run into the text: its foot then stays 6px above the path (2 November 2026).
  const b = text.getBBox(), foot = b.y + b.height - 15 * (lines.length - 1);
  const path = ch.series[1].points.filter((p) => p.plotY !== undefined).map((p) => [ch.plotLeft + p.plotX, ch.plotTop + p.plotY]);
  let last = y - 35;
  for (let k = 1; k < path.length; k++) {
    const [x0, y0] = path[k - 1], [x1, y1] = path[k], from = Math.max(x0, b.x), to = Math.min(x1, b.x + b.width);
    const at = (t) => y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
    if (from <= to) last = Math.min(last, Math.min(at(from), at(to)) - 6 - foot);
  }
  text.attr({ y: last - 15 * (lines.length - 1) });
  const top = last + 5;
  ch.renderer.path(["M", x, top, "L", x, tip]).attr({ stroke: DW.blue, "stroke-width": 1.5 }).add(g);
  ch.renderer.path(["M", x - 4, tip - 6, "L", x, tip, "L", x + 4, tip - 6]).attr({ stroke: DW.blue, "stroke-width": 1.5, fill: "none" }).add(g);
  targetLabel = g;
}

// On SIPRI's definition: NATO's figures, plans and targets adjusted to SIPRI's definition (decision of 2 November
// 2026). The page's choice stays in state.measure; the model always works on NATO's figures.
function options() {
  return { ...state, measure: "nato", nato_adjust: isNato(state) ? "none" : "sipri",
    held: HELD[state.held_kind][state.held_year], path: state.goal === "3" ? "step" : state.path };
}

function tooltip(x) {
  const r = current.r, i = r.years.indexOf(x);
  const rows = [`<b>${lab(x)}</b>`, `${x > BASE ? "Announced path" : "Spending"}: ${bn(r.announced[i])}`
    + ` (${r.sharesAnnounced[i].toFixed(2)}% of GDP)`];
  if (x > BASE) {
    rows.push(`Baseline: ${bn(r.held[i])} (${r.sharesHeld[i].toFixed(2)}% of GDP)`);
    rows.push(`Extra: ${bn(r.gapByYear[i])}`);
  }
  const restated = isNato(state) ? "" : ", restated on SIPRI definitions";
  if (x === LAST) rows.push(`${c.TARGETS[LAST]}% of GDP target (NATO)${restated}`);
  if (x === UK_TARGET && current.o.path === "step") rows.push(`${c.TARGETS[UK_TARGET]}% of GDP target${restated}`);
  return rows.join("<br>");
}

function words(o, r) {
  const at = (y) => r.sharesAnnounced[r.years.indexOf(y)].toFixed(2);
  const to3 = state.goal === "3";
  const path = (to3 ? `UK plans to ${lab(PLAN_LAST)}, then 3% of GDP in ${lab(UK_TARGET)}` : {
    step: `UK plans to ${lab(PLAN_LAST)}, then 3% of GDP in ${lab(UK_TARGET)} and 3.5% in ${lab(LAST)}, with a line between`,
    nostep: `UK plans to ${lab(PLAN_LAST)}, then a line to 3.5% of GDP in ${lab(LAST)}`,
  }[o.path]) + (isNato(state) ? "" : ", restated on SIPRI definitions as "
    + (to3 ? `${at(UK_TARGET)}%` : `${o.path === "step" ? `${at(UK_TARGET)}% and ` : ""}${at(LAST)}%`));
  const units = state.units === "cash" ? "in cash" : `at ${lab(c.PRICE_YEAR)} prices`;
  const held = {
    s2025: `held at its ${lab(BASE)} share of GDP (${r.baseShare.toFixed(2)}%)`,
    s2024: `held at its ${lab(BASE - 1)} share of GDP (${r.sharesHeld[r.years.indexOf(BASE + 1)].toFixed(2)}%)`,
    real: `held flat in real terms at its ${lab(BASE)} level`,
    real2024: `held flat in real terms at its ${lab(BASE - 1)} level`,
    plans: `that follows the plans to ${lab(PLAN_LAST)}, then holds that year's share of GDP `
      + `(${r.sharesHeld[r.years.indexOf(PLAN_LAST + 1)].toFixed(2)}%)`,
    plansreal: `that follows the plans to ${lab(PLAN_LAST)}, then holds that year's level flat in real terms`,
  }[o.held];
  return { path, units, held };
}

function update() {
  writeHash(GROUPS, state, DEFAULTS, TAB);
  refresh(GROUPS, state);
  const o = options();
  // The view in both units: the subhead gives the gap in both.
  const view = { ...VIEW, units: state.units };
  // The view's last year, the target year (3 November 2026). The model cuts the paths there and sums the gap (the review
  // of 3 November 2026, so the test covers it).
  const END = state.goal === "3" ? UK_TARGET : LAST;
  const cash = model.extra(o, { ...VIEW, units: "cash", end: END }), real = model.extra(o, { ...VIEW, units: "real", end: END });
  // The years the gap is counted over, in words. Against a baseline from the plans the lines part only after the plans'
  // last year (before it the gap is nil, the plan years being the plans exactly), so the title, subhead and first two
  // boxes count from then: six years to 2035/36. With the 3% target that leaves 2030/31 alone, so the title and subhead
  // name the year and the boxes keep the five years (the user's choice, the review of 3 November 2026).
  const gapFrom = fromPlans(o.held) ? PLAN_LAST + 1 : BASE + 1, oneYear = gapFrom === END;
  const counted = oneYear ? END - BASE : END - gapFrom + 1, span = WORDS[counted] ?? String(counted);
  const r = state.units === "cash" ? cash : real;
  // The options under "Baseline" give the share of GDP each holds spending at, on the chosen measure and forecast (on
  // NATO's, NATO figures as a share of financial-year GDP; for the plans, their last year's); for a level flat in real
  // terms, the share it falls to.
  const heldShare = (held, y) => { const x = model.extra({ ...o, held }, { ...VIEW, units: "cash" }); return x.sharesHeld[x.years.indexOf(y)]; };
  relabel(GROUPS.find((g) => g.key === "held_year"), Object.fromEntries([BASE - 1, BASE, "plans"].map((k) => {
    const held = HELD[state.held_kind][k], plans = k === "plans", y = plans ? PLAN_LAST : k, what = plans ? "plan " : "";
    return [k, state.held_kind === "level" ? `${lab(y)} ${what}level (${heldShare(held, END).toFixed(2)}% of GDP by ${lab(END)})`
      : `${lab(y)} ${what}share (${heldShare(held, (plans ? PLAN_LAST : BASE) + 1).toFixed(2)}%)`];
  })));
  // On NATO's measure the held line stays on the definition NATO published for 2025/26, while the path, the government's
  // own plans and targets, counts the whole intelligence account from 2026/27. Neither line is adjusted; the caption
  // calls out the mismatch and gives the gap on one definition (decisions of 2 November 2026). A baseline from the
  // plans has no mismatch, so no second figure.
  const alike = isNato(state) && !fromPlans(o.held) ? model.extra({ ...o, nato_def: c.NATO_SIPRI_GAP }, { ...view, end: END }) : null;
  current = { r, o };
  const w = words(o, r);
  const measureLong = isNato(state) ? "NATO definitions" : "SIPRI definitions";
  // Whole £bn rounded from the first box's figure, so the two agree (the user's decision, the second review of 3 November
  // 2026), as are the subhead's, the gap label's and the end labels'.
  el("title").textContent = `Reaching ${c.TARGETS[END]}% of GDP Would Mean £${fixed(r.gap / 1000, 0)} Billion More on the `
    + `Military ${oneYear ? `in ${lab(END)}` : `over ${span[0].toUpperCase() + span.slice(1)} Years`}`
    + `${state.units === "real" ? ` (${lab(c.PRICE_YEAR)} Prices)` : ""}`;
  const when = oneYear ? `, all in ${lab(END)}`
    : ` over ${span} years${gapFrom > BASE + 1 ? `, ${lab(gapFrom)}–${lab(END)}` : ""}`;
  el("description").textContent = `UK military spending on ${measureLong}, £bn ${w.units}, financial years: `
    + `the announced path, ${w.path}, `
    + `against spending ${w.held}. The gap comes to ${bn(cash.gap, 0)} in cash${when}, or ${bn(real.gap, 0)} at ${lab(c.PRICE_YEAR)} prices.`;

  const i = r.years.length - 1;
  renderTiles(el("tiles"), [
    // Spans of years take an en dash (the user's request, 2 November 2026).
    // With the 3% target the same boxes, to 2030/31 (the user's request, 3 November 2026).
    [`Extra over ${span} years`, bn(r.gap), `${oneYear ? `All in ${lab(END)}` : `${lab(gapFrom)}–${lab(END)}`}, ${w.units}`],
    ["Extra a year, on average", bn(r.gap / counted), `Average over ${span} years, ${w.units}`],
    [`Extra in ${lab(END)} alone`, bn(r.gapByYear[i]), w.units[0].toUpperCase() + w.units.slice(1)],
    // "A baseline of", so the article never comes before a figure ("a £82.4bn"; the user's decision, the second review
    // of 3 November 2026).
    [`Spending in ${lab(END)}`, bn(r.announced[i]),
      `${r.sharesAnnounced[i].toFixed(2)}% of GDP, vs a baseline of ${bn(r.held[i])} (${r.sharesHeld[i].toFixed(2)}%)`],
  ]);

  const pts = r.years.map((y, k) => [y, r.announced[k] / 1000]);
  // A baseline from the plans is the announced path until their last year, so its line starts there.
  const from = fromPlans(o.held) ? PLAN_LAST : BASE;
  const heldPts = r.years.filter((y) => y >= from).map((y) => [y, r.held[r.years.indexOf(y)] / 1000]);
  const gapPts = r.years.filter((y) => y >= from).map((y) => { const k = r.years.indexOf(y); return [y, r.held[k] / 1000, r.announced[k] / 1000]; });
  // Each line's labels are in its own colour, bold, with a white halo to lift them off the gridlines and shading (the
  // user's requests, 2 November 2026).
  const HALO = "3px #ffffff";
  // Highcharts' own overlap test pads labels, and hid the baseline's end label when the two end labels were lifted 6px
  // apart; endLabelsOverlap keeps them clear, so its test is off for them (the review of 3 November 2026).
  const end = (text, color) => ({ enabled: true, crop: false, overflow: "allow", allowOverlap: true, align: "left", x: 6, y: 0,
    formatter: () => text, style: { fontSize: "12px", fontWeight: "700", color, textOutline: HALO } });
  // Shares to two decimals, as everywhere else on the page (the review of 2 November 2026).
  const share = (v) => `${v.toFixed(2)}% of GDP`;
  // The targets are marked on the announced path: NATO's 3.5% in 2035/36 and, on the stepped path, the UK's 3% in
  // 2030/31 (the user's request, 2 November 2026). A white ring lifts each marker off the line.
  const mark = { enabled: true, symbol: "circle", radius: 5, fillColor: DW.blue, lineColor: "#ffffff", lineWidth: 2 };
  pts[i] = { x: END, y: pts[i][1], marker: mark,
    dataLabels: end(`£${fixed(pts[i][1], 0)}bn<br>${c.TARGETS[END]}% of GDP target${isNato(state) ? "" : "<br>equivalent"}`, DW.blue) };
  // The 3% point keeps its marker; its label is drawn above the line, with an arrow (drawTargetLabel).
  if (o.path === "step" && END !== UK_TARGET) {
    const t = r.years.indexOf(UK_TARGET);
    pts[t] = { x: UK_TARGET, y: pts[t][1], marker: mark };
  }
  heldPts[heldPts.length - 1] = { x: END, y: heldPts.at(-1)[1],
    dataLabels: end(`£${fixed(heldPts.at(-1)[1], 0)}bn<br>${share(r.sharesHeld[i])}`, DW.teal) };
  const heldLabel = { s2025: `Held at the ${lab(BASE)} share of GDP`, s2024: `Held at the ${lab(BASE - 1)} share of GDP`,
    real: `Held flat in real terms at the ${lab(BASE)} level`, real2024: `Held flat in real terms at the ${lab(BASE - 1)} level`,
    plans: `Held at the ${lab(PLAN_LAST)} share of GDP`, plansreal: `Held flat in real terms at the ${lab(PLAN_LAST)} level` }[o.held];
  // The lines are named on the chart rather than in a legend: the announced path above its line, ending in the last
  // plan year, and the held line below its own, at its second year (the year after the base, or after the plans' end).
  // Both lines rise away from their names.
  const name = (text, color, align, verticalAlign, y) => ({ enabled: true, crop: false, overflow: "allow", align, verticalAlign,
    x: 0, y, formatter: () => text, style: { fontSize: "12px", fontWeight: "700", color, textOutline: HALO } });
  const p = r.years.indexOf(PLAN_LAST);
  pts[p] = { x: pts[p][0], y: pts[p][1], dataLabels: name("Announced path", DW.blue, "right", "bottom", -8) };
  // From the plans with the 3% target the line has only its last two years: its name goes at the first, on two lines.
  const at = heldPts.length > 2 ? 1 : 0;
  heldPts[at] = { x: heldPts[at][0], y: heldPts[at][1],
    dataLabels: name(at ? heldLabel : { plans: `Held at the ${lab(PLAN_LAST)}<br>share of GDP`,
      plansreal: `Held flat in real terms<br>at the ${lab(PLAN_LAST)} level` }[o.held], DW.teal, "left", "top", 8) };
  if (chart.series[2].name !== heldLabel) chart.series[2].update({ name: heldLabel }, false);
  // Screen readers hear the range in £bn rather than raw figures (the review of 3 November 2026).
  const drawn = [...r.announced, ...r.held.slice(r.years.indexOf(from))];
  chart.yAxis[0].update({ max: Math.max(...r.announced) / 1000 * 1.1, accessibility: { description: `Spending, £bn ${w.units}`,
    rangeDescription: `From ${bn(Math.min(...drawn))} to ${bn(Math.max(...drawn))}.` } }, false);
  // The years to the view's last year (3 November 2026). Screen readers hear "Financial year", not "1 X axis displaying
  // values" (the review of 3 November 2026).
  chart.xAxis[0].update({ max: END, plotBands: bands(END, o.path),
    tickPositions: [c.FIRST, BASE, UK_TARGET, LAST].filter((y) => y <= END),
    accessibility: { description: "Financial year", rangeDescription: `From ${lab(c.FIRST)} to ${lab(END)}.` } }, false);
  // Screen readers hear the view chosen (the review of 2 November 2026).
  chart.update({ accessibility: { description: `UK military spending${isNato(state) ? "" : " on SIPRI definitions"}, `
    + `${lab(c.FIRST)} to ${lab(END)}: the announced path to ${c.TARGETS[END]}% of GDP${isNato(state) ? ""
    : ` (${r.sharesAnnounced.at(-1).toFixed(2)}% on SIPRI definitions)`} against a baseline, with the gap shaded.` } }, false);
  chart.series[0].setData(gapPts, false);
  // Replaced rather than updated (the last argument), so a target's marker and label don't stay on the straight path.
  chart.series[1].setData(pts, false, false, false);
  // Replaced too: the baseline's end label moves with the view's last year (3 November 2026).
  chart.series[2].setData(heldPts, false, false, false);
  // The total, written in the shaded gap: ending at the last year, level with the gap's middle a year earlier, where the
  // gap is widest and clear of the end labels (placeGapLabel moves it where that leaves no room).
  const a = r.years.indexOf(END - 1), mid = (r.announced[a] + r.held[a]) / 2000;
  const total = (x, y, align, dx, lines = 1) => [{ x, y, dataLabels: { enabled: true, crop: false, padding: 0,
    overflow: "allow", align, verticalAlign: "middle", x: dx, y: 0, formatter: () => `${bn(r.gap, 0)}${lines === 2 ? "<br>" : " "}extra`,
    style: { fontSize: "13px", fontWeight: "700", color: DW.ink, textOutline: "none" } } }];
  chart.series[3].setData(total(END, mid, "right", -13), false, false, false);
  chart.redraw();
  // Labels moved after the first drawing are set again in full (Highcharts' point.update dropped the rest of a label's
  // settings), then drawn once more for both (3 November 2026).
  const lift = endLabelsOverlap(), spot = placeGapLabel(r, END, `${bn(r.gap, 0)}<br>extra`);
  if (lift > 0) {
    pts[i] = { ...pts[i], dataLabels: { ...pts[i].dataLabels, y: -Math.ceil(lift) } };
    chart.series[1].setData(pts, false, false, false);
  }
  if (spot !== undefined) chart.series[3].setData(spot ? total(spot.x, spot.y, "center", 0, spot.lines) : [], false, false, false);
  if (lift > 0 || spot !== undefined) chart.redraw();

  const notes = [];
  // One order on both tabs (the user's decision, 2 November 2026): the figures, intelligence, the plans and targets,
  // then GDP and prices.
  // On the March 2026 forecast its own note gives 2025/26, NATO's June 2025 estimate, so the estimate isn't named here
  // (the review of 3 November 2026: until then the sentence was left out).
  const estimate = o.gdp_vintage === "spring2026" ? "" : " (2025/26 an estimate)";
  // First on SIPRI definitions against the plans' end too, as on NATO's (the user's decision, the second review of
  // 3 November 2026: it came third).
  if (isNato(state) || fromPlans(o.held)) notes.push(`Spending to 2025/26 follows NATO figures${estimate}.`);
  // The shares are of financial-year GDP, where NATO divides 2025/26 and earlier by calendar-year GDP (the user's
  // request, 19 November 2026). On the latest forecast, whose figures are those of the latest NATO report, a baseline
  // year's share is set beside the published NATO share, which the build checks is the higher; on the other forecasts,
  // or another baseline, the sentence says only how NATO divides (the order can reverse: 2020/21, the March 2025 forecast).
  if (isNato(state)) {
    const year = { s2025: BASE, s2024: BASE - 1 }[o.held];
    const published = o.gdp_vintage === "latest" && year !== undefined ? c.NATO_PUBLISHED_SHARE[year] : undefined;
    notes.push("Shares are of financial-year GDP, as in the government's plans. " + (published === undefined
      ? `NATO divides figures to ${lab(BASE)} by calendar-year GDP.`
      : `NATO divides by calendar-year GDP, so the published NATO share for ${lab(year)} is ${published.toFixed(2)}%, not `
        + `${r.sharesHeld[r.years.indexOf(BASE + 1)].toFixed(2)}%.`));
  }
  if (isNato(state)) {
    // The baseline as chosen under "Compared with" and "Baseline" (the review of 2 November 2026: the caption always
    // said the 2025/26 share).
    const baseline = { s2025: `the NATO figure for ${lab(BASE)} as a share of GDP`, s2024: `the NATO figure for ${lab(BASE - 1)} as a share of GDP`,
      real: `the ${lab(BASE)} level held flat in real terms`, real2024: `the ${lab(BASE - 1)} level held flat in real terms` }[o.held];
    // To one decimal, the change of definition as the difference of the two rounded gaps, so the figures add up to the
    // first box's (the review of 2 November 2026).
    const tenth = (m) => Math.round(m / 100) * 100;
    // A baseline from the plans counts it as the announced path does (3 November 2026).
    if (fromPlans(o.held)) {
      notes.push(`From ${lab(c.SIA_FROM)} the UK appears to count its whole intelligence budget (the Single Intelligence Account) in `
        + `its NATO figures, about ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP more than before. The baseline follows the plans `
        + `to ${lab(PLAN_LAST)}, so both lines count it and none of the gap is a change of definition.`);
    } else {
      notes.push(`The lines count intelligence differently: from ${lab(c.SIA_FROM)} the UK appears to count its whole intelligence `
        + `budget (the Single Intelligence Account) in its NATO figures, about ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP more than `
        + `before. The announced path counts it; the baseline, ${baseline}, does not. That change of definition, not new spending, is ${bn(tenth(r.gap) - tenth(alike.gap))} of `
        + `the gap; counted the same way in both lines, the gap would be ${bn(alike.gap)}.`);
    }
  } else if (fromPlans(o.held)) {
    // A baseline from the plans is the plans themselves, so the reason is that, not the date of NATO's figures (the review
    // of 3 November 2026).
    notes.push(`On SIPRI definitions the plans and targets are ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP lower from ${lab(c.SIA_FROM)}: `
      + "SIPRI counts about a third of the intelligence budget, which the UK's NATO figures count in full from then. The "
      + `baseline follows the plans to ${lab(PLAN_LAST)}, so both lines count intelligence the same way and none of the gap is a `
      + "change of definition.");
  } else {
    notes.push(`On SIPRI definitions the plans and targets are ${c.NATO_SIPRI_GAP.toFixed(2)}% of GDP lower from ${lab(c.SIA_FROM)}: `
      + "SIPRI counts about a third of the intelligence budget, which the UK's NATO figures count in full from then. Both "
      + "lines are on SIPRI definitions, so none of the gap is a change of definition: spending to 2025/26 follows NATO "
      + `figures${estimate}, from before the UK began counting its whole intelligence budget.`);
  }
  notes.push(plansNote(o.path, END));
  // With the 3% target the view ends in 2030/31, before the March 2026 forecast's growth after it, so the caption leaves
  // that out (the review of 3 November 2026). The March 2025 forecast's long-term assumptions start in 2030/31, so its
  // sentence stays. The latest forecast is named from the builds' sources, with its long-term assumptions only if the
  // view runs past its last year (the second review of 3 November 2026).
  const to3 = END === UK_TARGET;
  notes.push({
    summit: "GDP and prices as the OBR forecast them at the time of the NATO summit in June 2025: ONS outturn to 2023/24, "
      + "then the OBR March 2025 forecast and its long-term assumptions of 19 June 2025.",
    spring2026: (to3 ? "GDP and prices: the OBR March 2026 forecast. " : "GDP and prices: the OBR March 2026 forecast to "
      + "2030/31, then cash GDP growing 3.5% a year, with prices rising 2% a year. ")
      + `Spending in 2025/26 is the NATO June 2025 estimate, ${bn(inputs.nato_2025_spring)}.`,
    latest: `GDP and prices: ONS, then the OBR ${c.OBR_FORECAST} forecast`
      + `${END > c.OBR_LAST ? ` and its long-term assumptions (${c.OBR_LTD})` : ""}.`,
  }[o.gdp_vintage]);
  notes.push(`Data as of ${inputs.data_date}.`);
  el("notes").textContent = notes.join(" ");
  el("source").textContent = `Chart: Transition Security Project • Source: Author's analysis of `
    + `${isNato(state) ? "NATO" : "NATO, SIPRI"}, MOD, HM Treasury, OBR and ONS data`;
}

function download() {
  const { r } = current;
  const rows = r.years.map((y, k) => [y, lab(y), fixed(r.announced[k] / 1000, 3), y >= BASE ? fixed(r.held[k] / 1000, 3) : "",
    y > BASE ? fixed(r.gapByYear[k] / 1000, 3) : "", fixed(r.sharesAnnounced[k], 3), y >= BASE ? fixed(r.sharesHeld[k], 3) : ""]);
  const unit = state.units === "cash" ? "cash" : `real_${lab(c.PRICE_YEAR).replace("/", "_")}_prices`;
  // A numeric year first, as on the historical tab, and the file name records any other setting that isn't the
  // default (the user's decisions, 2 November 2026).
  const more = settingsName(GROUPS, state, DEFAULTS, ["measure", "units", ...(state.goal === "3" ? ["path"] : [])]);
  downloadCsv(`military_spending_paths_${state.measure}_${unit}${more ? `_${more}` : ""}.csv`,
    ["year_starting", "financial_year", `announced_gbp_bn_${unit}`, `baseline_gbp_bn_${unit}`, `gap_gbp_bn_${unit}`, "announced_pct_gdp", "baseline_pct_gdp"], rows);
}
