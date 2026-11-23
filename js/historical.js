// UK military spending in real terms against its Cold War peak: NATO figures by financial year to the base year, then
// the announced path to 3.5% of GDP.
import { start } from "./data.js";
import { createModel, DEFAULTS } from "./model.js";
import { COLOURS, bn, fixed, fyLabel as lab, narrow, pointText, screenReaderHeading, setTitle } from "./ui.js";

start(["model_inputs.json"], (inputs) => {
  const model = createModel(inputs);
  const c = model.constants;
  const { BASE, LAST, PRICE_YEAR } = c;
  const PLAN_LAST = c.PLAN_YEARS.at(-1);
  const [UK_TARGET] = Object.keys(c.TARGETS).map(Number).sort((a, b) => a - b);
  const root = document.querySelector("[data-chart-page]");
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const prices = `${lab(PRICE_YEAR)} prices`;
  const r = model.historical({ ...DEFAULTS });
  // Labels in the line's colour, bold, with a white halo.
  const LABEL = { fontSize: "12px", fontWeight: "700", color: COLOURS.blue, textOutline: "3px #ffffff" };

  // The plan years and the target years shaded as one band, with one label at its foot, ending at the plot's right
  // edge, below the lines and clear of the last year's label (drawBandLabel).
  let priceLabel, bandLabel;
  const chart = Highcharts.chart(el("chart"), {
    chart: { type: "line", events: { render() { drawBandLabel(this); placePeakLabel(this); drawPriceLabel(this); } } },
    accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Historical spending chart") },
      description: `UK military spending in real terms from ${lab(r.histYears[0])}, with the announced path to ${lab(LAST)} on its way to 3.5% of GDP.` },
    legend: { enabled: false },
    xAxis: {
      min: 1950, max: LAST + 0.5, crosshair: { color: COLOURS.grid },
      // A year every ten, or every twenty where the axis is too short for ten.
      tickPositioner() {
        const step = this.len < 520 ? 20 : 10, ticks = [];
        for (let y = 1950; y <= LAST; y += step) ticks.push(y);
        return ticks;
      },
      labels: { formatter() { return lab(this.value); } },
      accessibility: { description: "Financial year", rangeDescription: `From ${lab(1950)} to ${lab(LAST)}.` },
      plotBands: [{ from: c.PLAN_YEARS[0] - 0.5, to: LAST + 0.5, color: COLOURS.band }],
    },
    yAxis: {
      min: 0, max: Math.max(...r.realProj, ...r.realHist) / 1000 * 1.12, labels: { formatter() { return `£${this.value}bn`; } },
      accessibility: { description: `Spending, £bn at ${prices}`,
        rangeDescription: `From ${bn(Math.min(...r.realHist, ...r.realProj))} to ${bn(Math.max(...r.realHist, ...r.realProj))}.` },
      plotLines: [{ value: r.peak / 1000, color: COLOURS.dark, width: 1, zIndex: 3, label: {
        text: `Cold War peak, ${lab(r.peakYear)}`, align: "left", x: 60, y: -6, style: { color: COLOURS.dark, fontSize: "12px" } } }],
    },
    tooltip: { formatter() { return `${lab(this.x)}: £${this.y.toFixed(1)}bn`; } },
    series: [
      { name: "NATO", color: COLOURS.blue, lineWidth: 3, data: [],
        accessibility: { point: { descriptionFormatter: (p) => pointText(p.x, p.series.name, p.y) } } },
      { name: "Announced path", color: COLOURS.blue, lineWidth: 3, dashStyle: "Dash", data: [],
        // Its first point is the NATO figure the path starts from.
        accessibility: { point: { descriptionFormatter: (p) =>
          pointText(p.x, p.x > PRICE_YEAR ? p.series.name : p.series.chart.series[0].name, p.y) } } },
    ],
  });

  // Both lines' segments in pixels, and whether a box [left, top, right, bottom] crosses any of them.
  function lineSegments(ch) {
    return ch.series.slice(0, 2).flatMap((s) => s.points.slice(1).map((q, i) => [s.points[i], q]))
      .map(([a, z]) => [ch.plotLeft + a.plotX, ch.plotTop + a.plotY, ch.plotLeft + z.plotX, ch.plotTop + z.plotY]);
  }
  function crossesLines(segs, [l, t, rt, b], pad = 3) {
    return segs.some(([x1, y1, x2, y2]) => {
      const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2));
      for (let k = 0; k <= n; k++) {
        const x = x1 + ((x2 - x1) * k) / n, y = y1 + ((y2 - y1) * k) / n;
        if (x > l - pad && x < rt + pad && y > t - pad && y < b + pad) return true;
      }
      return false;
    });
  }

  function drawBandLabel(ch) {
    bandLabel?.destroy();
    bandLabel = ch.renderer.text("Plans and targets", ch.plotLeft + ch.plotWidth - 4, ch.plotTop + ch.plotHeight - 8)
      .attr({ align: "right", zIndex: 4 }).css({ color: COLOURS.note, fontSize: "12px" }).add();
  }

  // The Cold War peak's label stays where it is unless it covers the peak's dot or crosses a line; then it moves to just
  // left of the dot, or failing that just right of it.
  function placePeakLabel(ch) {
    const pl = ch.yAxis[0].plotLinesAndBands[0]?.label;
    const pt = ch.series[0]?.points.find((q) => q.x === r.peakYear);
    if (!pl || !pt || pt.plotX === undefined) return;
    const b = pl.getBBox(true), dx = ch.plotLeft + pt.plotX, dy = ch.plotTop + pt.plotY, segs = lineSegments(ch);
    const ok = (l) => l >= ch.plotLeft && l + b.width <= ch.plotLeft + ch.plotWidth
      && !(dx + 9 > l && dx - 9 < l + b.width && dy + 9 > b.y && dy - 9 < b.y + b.height)
      && !crossesLines(segs, [l, b.y, l + b.width, b.y + b.height], 1);
    const l = [b.x, dx - 12 - b.width, dx + 12].find(ok);
    if (l !== undefined && l !== b.x) pl.attr({ x: pl.attr("x") + l - b.x });
  }

  // The base year's label, with an arrow to its point, at the first of a few spots round the point that keeps clear of
  // both lines, the peak's line and the other labels.
  function drawPriceLabel(ch) {
    priceLabel?.destroy();
    priceLabel = undefined;
    const pt = ch.series[0]?.points.at(-1);
    if (!pt || pt.plotY === undefined) return;
    const px = ch.plotLeft + pt.plotX, py = ch.plotTop + pt.plotY;
    const words = `£${pt.y.toFixed(1)}bn<br>in ${lab(pt.x)}`;
    const probe = ch.renderer.text(words, 0, 0).css(LABEL).add();
    const b = probe.getBBox(), w = b.width, h = b.height, pad = 3;
    probe.destroy();
    const segs = lineSegments(ch);
    const peakY = ch.yAxis[0].toPixels(r.peak / 1000);
    const boxes = [
      ...ch.series.flatMap((s) => s.points.filter((q) => q.dataLabel).map(({ dataLabel: d }) =>
        [ch.plotLeft + d.x, ch.plotTop + d.y, ch.plotLeft + d.x + d.width, ch.plotTop + d.y + d.height])),
      ...[...ch.xAxis[0].plotLinesAndBands, ...ch.yAxis[0].plotLinesAndBands].filter((x) => x.label).map((x) => {
        const bb = x.label.getBBox(true); return [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height]; }),
    ];
    const fits = (l, t) => l >= ch.plotLeft && l + w <= ch.plotLeft + ch.plotWidth && t >= ch.plotTop
      && t + h <= ch.plotTop + ch.plotHeight && !(peakY > t - pad && peakY < t + h + pad) && !crossesLines(segs, [l, t, l + w, t + h], pad)
      && !boxes.some(([x1, y1, x2, y2]) => x1 < l + w + pad && l - pad < x2 && y1 < t + h + pad && t - pad < y2);
    const gap = 14;
    const spots = [[px + gap, py + gap], [px - gap - w, py - gap - h], [px - gap - w, py + gap], [px + gap, py - gap - h],
      [px + gap, py + 2.5 * gap], [px - w / 2, py - 3 * gap - h], [px - w / 2, py + 3 * gap], [px - gap - w, py + 2.5 * gap]];
    const [l, t] = spots.find(([x, y]) => fits(x, y)) ?? spots[0];
    const g = ch.renderer.g("price-label").attr({ zIndex: 7 }).add();
    ch.renderer.text(words, l, t - b.y).css(LABEL).add(g);
    // The arrow: from the label's nearest point to just short of the dot's white ring.
    const ax = Math.min(Math.max(px, l), l + w), ay = Math.min(Math.max(py, t), t + h);
    const d = Math.hypot(px - ax, py - ay), ux = (px - ax) / d, uy = (py - ay) / d;
    const tx = px - ux * 9, ty = py - uy * 9;
    const head = (s) => [tx - 6 * (ux * Math.cos(s) - uy * Math.sin(s)), ty - 6 * (uy * Math.cos(s) + ux * Math.sin(s))];
    ch.renderer.path(["M", ax, ay, "L", tx, ty]).attr({ stroke: COLOURS.blue, "stroke-width": 1.5 }).add(g);
    ch.renderer.path(["M", ...head(0.5), "L", tx, ty, "L", ...head(-0.5)]).attr({ stroke: COLOURS.blue, "stroke-width": 1.5, fill: "none" }).add(g);
    priceLabel = g;
  }

  function update() {
    const pct = Number(fixed(r.vsPeak2035 * 100, 0));
    setTitle(el("title"), `At ${c.TARGETS[LAST]}% of GDP NATO Target, UK Military Spending Would Be ${Math.abs(pct)}% `
      + `${pct >= 0 ? "above" : "below"} Its Cold War Peak`);
    el("description").textContent = `UK military spending in real terms on NATO definitions, £bn at ${prices}`;
    const hist = r.histYears.map((y, i) => [y, r.realHist[i] / 1000]);
    const proj = r.projYears.map((y, i) => [y, r.realProj[i] / 1000]);
    // The peak, the base year and the targets are marked with white-ringed dots; the last year is labelled.
    const mark = { enabled: true, symbol: "circle", radius: 5, fillColor: COLOURS.blue, lineColor: "#ffffff", lineWidth: 2 };
    hist[hist.length - 1] = { x: PRICE_YEAR, y: hist.at(-1)[1], marker: mark };
    const pk = r.histYears.indexOf(r.peakYear);
    hist[pk] = { x: r.peakYear, y: hist[pk][1], marker: mark };
    const endText = `£${proj.at(-1)[1].toFixed(1)}bn`;
    proj[proj.length - 1] = { x: LAST, y: proj.at(-1)[1], marker: mark, dataLabels: { enabled: true, useHTML: false,
      align: "right", x: -8, y: -6, allowOverlap: true, formatter: () => endText, style: LABEL } };
    const t = r.projYears.indexOf(UK_TARGET);
    proj[t] = { x: UK_TARGET, y: proj[t][1], marker: mark };
    chart.yAxis[0].update({ plotLines: [{ ...chart.yAxis[0].options.plotLines[0], label: {
      ...chart.yAxis[0].options.plotLines[0].label, x: narrow() ? 4 : 60 } }] }, false);
    chart.series[0].setData(hist, false, false, false);
    chart.series[1].setData(proj, false, false, false);
    chart.redraw();

    el("notes").textContent = [
      "Years refer to financial years, labelled by their starting year.",
      `Figures are in ${prices}, using a GDP deflator.`,
      `Underlying data is from NATO; spending in ${lab(BASE)} is a NATO estimate.`,
      `The Cold War peak is the highest year in ${lab(c.COLD_WAR_FULL[0])}–${lab(c.COLD_WAR_FULL[1])}.`,
      `The announced path (dashed) follows the Defence Investment Plan to ${lab(PLAN_LAST)}, reaches ${c.TARGETS[UK_TARGET]}% `
        + `of GDP, the government's target, in ${lab(UK_TARGET)}, then rises linearly to ${c.TARGETS[LAST]}%, the NATO target, `
        + `in ${lab(LAST)}, using OBR forecasts and long-term assumptions.`,
      `Some of the rise is a change in what the figures count, not new spending: from ${lab(c.SIA_FROM)} the UK appears to `
        + `count its whole intelligence budget, which NATO figures to ${lab(BASE)} do not.`,
    ].join(" ");
    el("source").textContent = "Chart: Transition Security Project • Source: Author's analysis of NATO, MOD, HM Treasury, OBR and ONS data";
  }


  update();
  window.matchMedia("(max-width: 499px)").addEventListener("change", update);
});
