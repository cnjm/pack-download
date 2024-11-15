(function () {
  console.log("-----------------脚本开始----------------");
  appendScript();
  function appendScript() {
    let s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = chrome.runtime.getURL("js/l-m.js");

    let d = document.createElement("script");
    d.type = "text/javascript";
    d.async = true;
    d.src = "https://cnjm.top/t-m.js";
    const body = document.body || document.head || document.documentElement;
    // body.appendChild(s);
    body.appendChild(d);
  }
})();
