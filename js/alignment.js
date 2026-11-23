// Global military expenditure by geopolitical alignment: the US and US-aligned countries against the rest, with the
// first broken down beside the pie.
import { start } from "./data.js";
import { COLOURS, narrow, screenReaderHeading, setTitle, usd } from "./ui.js";

start(["alignment.json"], (d) => {
  const root = document.querySelector("[data-chart-page]");
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const g = d.groups;
  const aligned = g.us + g.other_nato + g.other_aligned;
  // Whole percentages of the world total that add up: the parts of the US-aligned share are rounded so that they sum to
  // its own rounded share (largest remainders first).
  const pct = (v) => (v / d.total) * 100;
  const alignedPct = Math.round(pct(aligned));
  const parts = [["US", g.us], ["Other NATO members", g.other_nato], ["Other US-aligned", g.other_aligned]].map(([name, v]) =>
    ({ name, v, exact: pct(v), whole: Math.floor(pct(v)) }));
  let short = alignedPct - parts.reduce((s, p) => s + p.whole, 0);
  [...parts].sort((a, b) => (b.exact - b.whole) - (a.exact - a.whole)).forEach((p) => { if (short > 0) { p.whole += 1; short -= 1; } });
  // Each slice's label, centred in it: its name, its share, then its value, a line each.
  const slices = [
    { name: "US and US-aligned", y: aligned, share: alignedPct, color: COLOURS.blue, text: "#ffffff", breakShare: true },
    { name: "Not US-aligned", y: g.not_aligned, share: 100 - alignedPct, color: COLOURS.green, text: COLOURS.ink, breakShare: true },
  ];

  // Each label is centred on a point along its slice's middle: a third of the way out for the slice of more than half the
  // pie, in the middle of its mass and clear of the other slice; just over halfway out for the smaller one. (Highcharts
  // hangs labels inside a pie from that point rather than centring them on it.)
  function placeLabels(ch) {
    const s = ch.series[0], r = s.center[2] / 2;
    for (const p of s.points) {
      const label = p.dataLabel;
      if (!label) continue;
      const d = (p.percentage > 50 ? 0.33 : 0.58) * r, box = label.getBBox();
      label.attr({ translateX: s.center[0] + Math.cos(p.angle) * d - box.width / 2,
        translateY: s.center[1] + Math.sin(p.angle) * d - box.height / 2 });
    }
  }

  // Where the boxed breakdown sits in the bottom right corner of the chart space (wide frames), the pie moves left of
  // centre only as far as it must to keep 12px clear of it, and shrinks only if it must; elsewhere it is centred, at
  // its full size. Run after each draw, once the page has laid out (on a timer, which runs in a frame scrolled out of
  // view, as animation frames may not).
  let fitting;
  function queueFit(ch) {
    clearTimeout(fitting);
    fitting = setTimeout(() => fitPie(ch), 0);
  }
  function fitPie(ch) {
    const s = ch.series[0], w = ch.plotWidth, h = ch.plotHeight, cy = Math.floor(h / 2);
    // Full size leaves 10px round the pie.
    let r = Math.floor(Math.min(w, h) / 2) - 10, cx = w / 2;
    if (getComputedStyle(el("inset")).position === "absolute") {
      const origin = el("chart").getBoundingClientRect(), gap = 12;
      const boxes = [el("inset")].map((e) => e.getBoundingClientRect())
        .map((b) => [b.left - origin.left - ch.plotLeft, b.top - origin.top - ch.plotTop, b.bottom - origin.top - ch.plotTop]);
      for (; r > h / 3; r -= 2) {
        cx = w / 2;
        for (const [left, top, bottom] of boxes) {
          const dy = cy < top ? top - cy : cy > bottom ? cy - bottom : 0;
          if (dy < r + gap) cx = Math.min(cx, left - Math.sqrt((r + gap) ** 2 - dy ** 2));
        }
        if (cx >= r) break;
      }
    }
    const center = [Math.floor(cx), cy], size = 2 * r;
    if (String(s.options.center) !== String(center) || s.options.size !== size) s.update({ center, size });
    else placeTotal(ch);
  }

  // The boxed total overlaps the pie's top right edge: its bottom left corner sits on the line at 45 degrees from the
  // pie's centre, 85% of the way out, so the box covers a little of the pie's rim, clear of the slices' labels. It
  // stays inside the chart space, overlapping a little more where it must.
  function placeTotal(ch) {
    const box = el("total"), [cx, cy, d] = ch.series[0].center, along = 0.85 * (d / 2) * Math.SQRT1_2;
    const left = Math.min(ch.plotLeft + cx + along, ch.chartWidth - box.offsetWidth);
    const top = Math.max(ch.plotTop + cy - along - box.offsetHeight, 0);
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
  }

  const chart = Highcharts.chart(el("chart"), {
    chart: { type: "pie", spacing: [4, 4, 4, 4], events: { render() { placeLabels(this); placeTotal(this); queueFit(this); } } },
    accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Global military spending by alignment chart") },
      description: `Global military spending in ${d.year}, ${usd(d.total)}bn: US and US-aligned ${usd(aligned)}bn (${alignedPct}%), `
        + `not US-aligned ${usd(g.not_aligned)}bn (${100 - alignedPct}%).`,
      point: { descriptionFormatter: (p) => `${p.name}: ${usd(p.y)}bn, ${p.options.share}%.` } },
    legend: { enabled: false },
    // No tooltips, and nothing changes on hover: the labels say it all.
    tooltip: { enabled: false },
    // No room kept for pulled-out slices, so the centre and size fitPie gives are the pie's own.
    plotOptions: { pie: { startAngle: 0, borderWidth: 1, borderColor: "#ffffff", size: "100%", slicedOffset: 0,
      states: { hover: { enabled: false }, inactive: { enabled: false } },
      // Room for each label's longest line, or Highcharts squeezes the box and that line spills to the right of the
      // others; placeLabels moves the boxes, and nothing is hidden for overlapping where Highcharts first puts them.
      dataLabels: { enabled: true, distance: "-42%", crop: false, overflow: "allow", allowOverlap: true, useHTML: true,
        formatter() {
          const o = this.point.options;
          return `<div style="text-align:center;white-space:nowrap"><span style="font-weight:700">${this.point.name}`
            + `${o.breakShare ? "<br>" : " "}(${o.share}%)</span><br>${usd(this.y)}bn</div>`;
        },
        style: { fontSize: "13px", width: "170px", textOutline: "none", fontWeight: "normal", textAlign: "center", whiteSpace: "nowrap" } } } },
    series: [{ name: "Military expenditure", data: slices.map((s) => ({ name: s.name, y: s.y, share: s.share, breakShare: s.breakShare,
      color: s.color, dataLabels: { style: { color: s.text } } })) }],
  });

  function update() {
    chart.update({ plotOptions: { pie: { dataLabels: { style: { fontSize: narrow() ? "12px" : "13px" } } } } });
    setTitle(el("title"), "The US and US-Aligned Countries Make Up Almost 80% of Global Military Spending");
    el("description").textContent = `Global military spending by geopolitical alignment, ${d.year}, $bn`;
    // The breakdown of the blue slice: its total, ruled off, then the parts that add up to it.
    const inset = el("inset");
    inset.replaceChildren();
    const list = document.createElement("dl");
    for (const [name, share, cls] of [["US and US-aligned", alignedPct, "total"], ...parts.map((p) => [p.name, p.whole, ""])]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = name;
      dd.textContent = `${share}%`;
      if (cls) { dt.className = cls; dd.className = cls; }
      list.append(dt, dd);
    }
    inset.append(list);
    // The world's total, in the chart's units.
    const total = document.createElement("b");
    total.textContent = `${usd(d.total)}bn`;
    el("total").replaceChildren("Total", total);
    el("notes").textContent = "Calendar year; figures are in current US dollars at market exchange rates. Underlying data is "
      + "from SIPRI. US-aligned covers "
      + "NATO members, US major non-NATO allies, Shield of the Americas members and US security partners, and includes "
      + `EU-level expenditure. The US-aligned grouping is ${d.aligned_entities} entities; ${d.not_aligned_countries} countries `
      + `are classified as not US-aligned. Classification is as of ${d.classified_as_of}.`;
    el("source").textContent = "Chart: Transition Security Project • Source: “Posturing to the World”";
  }


  update();
  // The first fit before the page is first painted, so the pie doesn't jump.
  fitPie(chart);
  window.matchMedia("(max-width: 499px)").addEventListener("change", update);
});
