// UK military spending per person against the G7 and European NATO medians, in current US dollars.
import { start } from "./data.js";
import { COLOURS, fixed, narrow, screenReaderHeading, setTitle, usd } from "./ui.js";

start(["per_person.json"], (d) => {
  const root = document.querySelector("[data-chart-page]");
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const [g7, europe] = d.medians;
  const higher = (m) => Number(fixed((d.uk / m.value - 1) * 100, 0));
  const bars = [
    { name: "United Kingdom", y: d.uk, color: COLOURS.blue, sub: "", text: "#ffffff" },
    ...d.medians.map((m) => ({ name: m.label, y: m.value, color: COLOURS.teal, sub: `UK: ${higher(m)}% higher`, text: COLOURS.ink })),
  ];
  // Each bar's name, and under it how far the UK is above that median.
  const LEFT = 190;
  const label = (b, sep = "<br>") => `<span style="font-size:14px;font-weight:700;color:${COLOURS.ink}">${b.name}</span>`
    + (b.sub ? `${sep}<span style="font-size:12px;color:${COLOURS.note}">${b.sub}</span>` : "");

  const chart = Highcharts.chart(el("chart"), {
    chart: { type: "bar", spacing: [4, 4, 4, 0] },
    accessibility: { screenReaderSection: { beforeChartFormat: screenReaderHeading("Military spending per person chart") },
      description: `UK military spending per person in ${d.year}, ${usd(d.uk)}, against the G7 median, ${usd(g7.value)}, and the `
        + `European NATO median, ${usd(europe.value)}.`,
      point: { descriptionFormatter: (p) => `${p.name}: ${usd(p.y)} per person.` } },
    legend: { enabled: false },
    xAxis: { type: "category", lineColor: COLOURS.ink, accessibility: { description: "Country or median" },
      labels: { align: "left", x: 2 - LEFT, reserveSpace: false, useHTML: true, formatter() { return label(bars[this.pos]); } } },
    // No value axis or gridlines: each bar shows its value.
    yAxis: { min: 0, max: d.uk, visible: false },
    // No tooltips, and nothing changes on hover: the labels say it all.
    tooltip: { enabled: false },
    plotOptions: { bar: { borderWidth: 0, borderRadius: 0, groupPadding: 0.12, pointPadding: 0.08, states: { hover: { enabled: false } } } },
    series: [{ name: "US dollars per person", data: [] }],
  });

  // Each bar's value at its end; on narrow frames its name goes above it too, in place of the axis labels, so the bars
  // keep the width.
  const points = (small) => bars.map((b) => ({ name: b.name, y: b.y, color: b.color, dataLabels: [
    { enabled: true, inside: true, align: "right", x: -8, crop: false, overflow: "allow", formatter() { return usd(this.y); },
      style: { fontSize: "13px", textOutline: "none", fontWeight: "normal", color: b.text } },
    { enabled: small, useHTML: true, inside: true, align: "left", verticalAlign: "top", x: 0, y: b.sub ? -46 : -26, crop: false,
      overflow: "allow", formatter: () => label(b),
      style: { textOutline: "none", fontWeight: "normal", width: "400px", whiteSpace: "nowrap", textOverflow: "clip" } },
  ] }));

  function update() {
    const small = narrow();
    chart.update({
      chart: { marginLeft: small ? 1 : LEFT },
      xAxis: { labels: { enabled: !small } },
      plotOptions: { bar: { groupPadding: small ? 0.34 : 0.12 } },
    }, false);
    chart.series[0].setData(points(small), false, false, false);
    chart.redraw();
    setTitle(el("title"), `UK Military Spending per Person Is ${higher(europe)}% above the Median for NATO Countries in Europe`);
    el("description").textContent = `Annual military spending per person, ${d.year}, $`;
    el("notes").textContent = `Figures are for calendar year ${d.year}, in current US dollars at market exchange rates. `
      + `Spending figures are from SIPRI. The medians include the UK; the ${europe.label} excludes Türkiye.`;
    el("source").textContent = "Chart: Transition Security Project • Source: Author's analysis of SIPRI data";
  }


  update();
  window.matchMedia("(max-width: 499px)").addEventListener("change", update);
});
