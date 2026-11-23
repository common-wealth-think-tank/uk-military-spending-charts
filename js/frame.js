// The page's height: inside a frame, the page sends it in the message Datawrapper's embed code listens for, so the frame
// fits the page. Nothing is sent while the page is loading, so the frame keeps the height its embed code gives it; the
// height is sent once the chart has drawn (or the page's error shows), then whenever the page's size changes. It is sent
// straight after drawing too, since a browser may hold back notices of size changes in a frame that is off screen.
let send = () => {};

export function setupFrame() {
  if (window.parent === window) return;
  const id = document.body.dataset.chart;
  let sent = 0;
  send = () => {
    if (document.querySelector("[data-chart-page][hidden]")) return;
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === sent) return;
    sent = height;
    window.parent.postMessage({ "datawrapper-height": { [id]: height } }, "*");
  };
  if (window.ResizeObserver) new ResizeObserver(() => send()).observe(document.documentElement);
  window.addEventListener("load", () => send());
  window.addEventListener("resize", () => send());
}

// Sends the page's height now, and again after anything the drawing left to a timer.
export function sendHeight() {
  send();
  setTimeout(() => send(), 300);
}
