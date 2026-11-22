// The page's height: inside a frame, the page sends it whenever it changes, in the message Datawrapper's embed code
// listens for, so the frame grows and shrinks with the chart.
export function setupFrame() {
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
