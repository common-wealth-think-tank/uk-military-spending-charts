// Loads what a page needs and draws it once Highcharts, the data and the fonts are ready. If anything fails before the
// chart has drawn, the page shows its message instead of an empty chart; an error after that leaves the chart as it is.
import { highchartsDefaults } from "./ui.js";
import { sendHeight, setupFrame } from "./frame.js";

// Safari before 15.4 lacks Array.prototype.at.
if (!Array.prototype.at) {
  Object.defineProperties(Array.prototype, { at: { value(n) {
    const i = Math.trunc(n) || 0;
    return this[i < 0 ? i + this.length : i];
  }, writable: true, configurable: true } });
}

const ROOT = new URL("../", import.meta.url);
let drawing = true;

function fail() {
  if (!drawing) return;
  document.querySelector('[data-el="load-error"]').hidden = false;
  document.querySelectorAll("[data-chart-page]").forEach((el) => el.remove());
  sendHeight();
}

// Only errors from the page's own scripts and Highcharts count; scripts that browser extensions add raise errors too.
const ours = (file) => typeof file === "string" && (file.startsWith(ROOT.href) || file.startsWith("https://cdn.jsdelivr.net/npm/highcharts@"));
window.addEventListener("error", (event) => {
  if (event.error && ours(event.filename)) fail();
  else if (drawing) console.warn("Not the page's own error, so the chart still draws:", event.message, event.filename);
});

async function load(files, needs) {
  if (typeof Highcharts === "undefined") throw new Error("Highcharts did not load");
  if (needs.includes("more") && !Highcharts.seriesTypes?.arearange) throw new Error("highcharts-more did not load");
  if (!Highcharts.getOptions().accessibility?.screenReaderSection) throw new Error("Highcharts' accessibility module did not load");
  const data = await Promise.all(files.map(async (file) => {
    const res = await fetch(new URL(`data/${file}`, ROOT), { cache: "no-cache" });
    if (!res.ok) throw new Error(`data/${file}: HTTP ${res.status}`);
    return res.json();
  }));
  // Roboto before the chart draws, so its labels are measured and placed in it: three seconds at most.
  if (document.fonts) {
    await Promise.race([Promise.all(["400 12px Roboto", "700 12px Roboto", "700 13px Roboto"]
      .map((font) => document.fonts.load(font))), new Promise((resolve) => setTimeout(resolve, 3000))]).catch(() => {});
  }
  highchartsDefaults();
  return data;
}

// Loads the files, shows the page and calls draw with their contents, so the chart draws at its full width.
export async function start(files, draw, needs = []) {
  setupFrame();
  try {
    const data = await load(files, needs);
    document.querySelectorAll("[data-chart-page]").forEach((el) => { el.hidden = false; });
    draw(...data);
    sendHeight();
    setTimeout(() => { drawing = false; });
  } catch (error) {
    fail();
    throw error;
  }
}
