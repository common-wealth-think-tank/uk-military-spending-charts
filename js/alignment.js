// Global military expenditure by geopolitical alignment: the US and US-aligned countries against the rest, with the
// first broken down beside the pie.
import { start } from "./data.js";
import { COLOURS, SANS, narrow, screenReaderHeading, setTitle, usd } from "./ui.js";

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
  // Each slice's label: its name and share, broken where the name is long, then its value.
  const slices = [
    { name: "US and US-aligned", y: aligned, share: alignedPct, color: COLOURS.blue, text: "#ffffff", breakShare: true },
    { name: "Not US-aligned", y: g.not_aligned, share: 100 - alignedPct, color: COLOURS.green, text: COLOURS.ink, breakShare: false },
  ];

  const chart = Highcharts.chart(el("chart"), {
    chart: { type: "pie", spacing: [4, 4, 4, 4] },
    accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Global military spending by alignment chart") },
      description: `Global military expenditure in ${d.year}, ${usd(d.total)}bn: US and US-aligned ${usd(aligned)}bn (${alignedPct}%), `
        + `not US-aligned ${usd(g.not_aligned)}bn (${100 - alignedPct}%).`,
      point: { descriptionFormatter: (p) => `${p.name}: ${usd(p.y)}bn, ${p.options.share}%.` } },
    legend: { enabled: false },
    tooltip: { formatter() { return `${this.point.name}: ${usd(this.y)}bn`; } },
    plotOptions: { pie: { startAngle: 0, borderWidth: 1, borderColor: "#ffffff", size: "100%",
      states: { hover: { halo: false, brightness: 0 }, inactive: { enabled: false } },
      dataLabels: { enabled: true, distance: "-38%", crop: false, overflow: "allow", useHTML: false,
        formatter() {
          const o = this.point.options, tight = this.series.chart.plotWidth < 400;
          return `<span style="font-family:${SANS};font-weight:700">${this.point.name}${o.breakShare || tight ? "<br>" : " "}(${o.share}%)</span>`
            + `<br>${usd(this.y)}`;
        },
        style: { fontSize: "13px", textOutline: "none", fontWeight: "normal", textAlign: "center", whiteSpace: "nowrap" } } } },
    series: [{ name: "Military expenditure", data: slices.map((s) => ({ name: s.name, y: s.y, share: s.share, breakShare: s.breakShare,
      color: s.color, dataLabels: { style: { color: s.text } } })) }],
  });

  function update() {
    chart.update({ plotOptions: { pie: { dataLabels: { style: { fontSize: narrow() ? "12px" : "13px" } } } } });
    setTitle(el("title"), "The US and US-Aligned Countries Make Up Almost 80% of Global Military Spending");
    el("description").textContent = `Global military expenditure by geopolitical alignment, ${d.year}, $bn`;
    const inset = el("inset");
    inset.replaceChildren();
    const title = document.createElement("p");
    title.className = "inset-title";
    title.textContent = `US and US-aligned: ${alignedPct}%`;
    const list = document.createElement("dl");
    for (const p of parts) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = p.name;
      dd.textContent = `${p.whole}%`;
      list.append(dt, dd);
    }
    inset.append(title, list);
    el("notes").textContent = "Calendar year; figures are in current US dollars at market exchange rates. US-aligned covers "
      + "NATO members, US major non-NATO allies, Shield of the Americas members and US security partners, and includes "
      + `EU-level expenditure. The US-aligned grouping is ${d.aligned_entities} entities; ${d.not_aligned_countries} countries `
      + `are classified as not US-aligned. Classification is as of ${d.classified_as_of}.`;
    el("source").textContent = "Chart: Transition Security Project • Source: “Posturing to the World”";
  }


  update();
  window.matchMedia("(max-width: 499px)").addEventListener("change", update);
});
