// The figure number and the page's height. A page that embeds this one can number it with ?figure=2 in its address.
// Inside a frame, the page sends its height whenever it changes, in the message Datawrapper's embed code listens for,
// so the frame grows and shrinks with the chart.
export function setupFrame() {
  const number = new URLSearchParams(location.search).get("figure");
  const tab = document.querySelector('[data-el="figure"]');
  if (tab && number && /^[0-9A-Za-z.]{1,4}$/.test(number)) {
    tab.textContent = number;
    tab.hidden = false;
    tab.closest(".card")?.classList.add("numbered");
  }
  if (window.parent === window) return;
  const id = document.body.dataset.chart;
  let sent = 0;
  const send = () => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === sent) return;
    sent = height;
    window.parent.postMessage({ "datawrapper-height": { [id]: height } }, "*");
  };
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener("load", send);
  window.addEventListener("resize", send);
  send();
}
