// What the pages share: number formats, the option controls and the address that keeps them, the boxes, the
// colours and fonts, and the Highcharts defaults.

export const fyLabel = (y) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
// A value that rounds to zero is written as zero, never "-0.0". A whole number is rounded from the figure to one
// decimal, as the boxes give it, so the two always agree.
const unsigned = (v, digits) => {
  const r = digits === 0 ? Number(v.toFixed(1)) : v;
  return Math.abs(r) < 0.5 * 10 ** -digits ? 0 : r;
};
export const fixed = (v, digits) => unsigned(v, digits).toFixed(digits);
const grouped = (v, digits) => unsigned(v, digits).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const bn = (gbpM, digits = 1) => `£${grouped(gbpM / 1000, digits)}bn`;
export const usd = (v, digits = 0) => `$${grouped(v, digits)}`;
export const signed = (fraction, digits = 0) => {
  const v = unsigned(fraction * 100, digits);
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
};

export const COLOURS = {
  blue: "#388dff", teal: "#7ac3c1", tealInk: "#00968f", green: "#8cffa7", ink: "#181818", axis: "#a2a2a2",
  grid: "#e7e7e7", band: "#f3f3f3", note: "#666666", dark: "#333333",
};
// Single-quoted names, so they can go inside a label's style attribute.
export const SANS = "'Unica 77', 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'Unica 77 Mono', ui-monospace, Menlo, Consolas, monospace";

// Whether the page is narrow, as in a phone's frame (the stylesheet's own breakpoint).
export const narrow = () => window.matchMedia("(max-width: 499px)").matches;

// Each group: { key, label, options: [{ value, label }], help? }, where help is a note under the options, or a function
// of the state giving it. Radio inputs styled as a segmented control, so they work by keyboard and with screen readers.
export function renderGroups(container, groups, state, onChange) {
  container.replaceChildren();
  for (const g of groups) {
    const row = document.createElement("div");
    row.className = "group";
    const label = document.createElement("span");
    label.className = "group-label";
    label.id = `label-${g.key}`;
    label.textContent = g.label;
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-labelledby", label.id);
    g.inputs = g.options.map((opt, i) => {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `group-${g.key}`;
      input.id = `opt-${g.key}-${i}`;
      input.checked = String(state[g.key]) === String(opt.value);
      input.addEventListener("change", () => { state[g.key] = opt.value; onChange(); });
      const l = document.createElement("label");
      l.htmlFor = input.id;
      l.textContent = opt.label;
      seg.append(input, l);
      return input;
    });
    g.note = document.createElement("p");
    g.note.className = "group-note";
    g.note.id = `note-${g.key}`;
    g.seg = seg;
    row.append(label, seg, g.note);
    container.append(row);
  }
  refresh(groups, state);
}

// Ticks the controls to match the state and writes each group's note for it.
export function refresh(groups, state) {
  for (const g of groups) {
    g.inputs.forEach((input, i) => { input.checked = String(state[g.key]) === String(g.options[i].value); });
    g.note.textContent = (typeof g.help === "function" ? g.help(state) : g.help) ?? "";
    if (g.note.textContent) g.seg.setAttribute("aria-describedby", g.note.id);
    else g.seg.removeAttribute("aria-describedby");
  }
}

// The address keeps the choices that aren't the default, so a view can be linked to or embedded: #units=real.
export function readHash(groups, state, defaults) {
  Object.assign(state, defaults);
  const params = new URLSearchParams(location.hash.slice(1));
  for (const g of groups) {
    const opt = g.options.find((o) => String(o.value) === params.get(g.key));
    if (opt) state[g.key] = opt.value;
  }
}

// Written after a short pause, so a burst of changes writes it once: browsers limit how often a page may rewrite its
// address. A write that fails is skipped; the next one puts it right.
let pendingWrite;
export function writeHash(groups, state, defaults) {
  const params = new URLSearchParams();
  for (const g of groups) if (String(state[g.key]) !== String(defaults[g.key])) params.set(g.key, String(state[g.key]));
  const hash = params.toString();
  clearTimeout(pendingWrite);
  pendingWrite = setTimeout(() => {
    try { history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search); } catch { /* skipped */ }
  }, 300);
}


// Result boxes: [label, value, sub] each.
export function renderTiles(container, tiles) {
  container.replaceChildren(...tiles.map((texts) => {
    const div = document.createElement("div");
    div.className = "tile";
    ["label", "value", "sub"].forEach((cls, i) => {
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = texts[i];
      div.append(p);
    });
    return div;
  }));
}


// The page's title and heading follow the chart's title.
export function setTitle(el, text) {
  el.textContent = text;
  document.title = text;
}

// Screen readers hear each point as its year, its line and its value, in £bn to one decimal.
export const pointText = (x, line, y) => `${fyLabel(x)}, ${line}: £${y.toFixed(1)}bn.`;

export function highchartsDefaults() {
  const axisLabels = { style: { color: COLOURS.axis, fontSize: "12px", fontFamily: SANS } };
  Highcharts.setOptions({
    chart: { style: { fontFamily: MONO }, backgroundColor: "#ffffff", spacing: [12, 4, 8, 4], animation: false },
    title: { text: null },
    credits: { enabled: false },
    lang: { thousandsSep: "," },
    xAxis: { lineColor: COLOURS.ink, tickLength: 0, labels: axisLabels },
    yAxis: { title: { text: null }, gridLineColor: COLOURS.grid, labels: axisLabels },
    tooltip: { backgroundColor: "#ffffff", borderColor: "#d9d9d9", shadow: false, style: { color: COLOURS.ink, fontSize: "12px", fontFamily: MONO } },
    plotOptions: { series: { marker: { enabled: false, symbol: "circle" }, states: { hover: { lineWidthPlus: 0 }, inactive: { enabled: false } },
      animation: false } },
  });
}

// A chart's heading for screen readers, which otherwise hear "Chart".
export const screenReaderHeading = (title) =>
  Highcharts.getOptions().accessibility?.screenReaderSection?.beforeChartFormat?.replace("{chartTitle}", title);
