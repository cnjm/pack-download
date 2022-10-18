(function () {
  console.log("background.js");

  // 接收到信息
  function receiveMsg() {
    // data数据  sender发送方  sendResponse回调
    chrome.runtime.onMessage.addListener(function (data, sender, sendResponse) {
      console.log("😝: bj.js  receive", data);
      console.log("😝: bj.js  receiveFn");
      sendResponse(data);
      console.log(".....................");
      tabs();
    });
  }
  receiveMsg();

  // 获取当前 tab ID
  function getCurrentTabId() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve(tabs.length ? tabs[0].id : null);
      });
    });
  }

  // 监测到新的tab
  async function tabs() {
    const tabId = await getCurrentTabId();
    // 在背景页面发送消息，需要当前 tabID
    chrome.tabs.sendMessage(tabId, { name: "bJs" }, function (data) {
      console.log("📌: bj.js  send");
      console.log("📌: bj.js  sendBack", data);
      console.log(".....................");
    });
  }

  // // 监测打开了新的tab
  // chrome.tabs.onCreated.addListener(function (tab) {
  //   console.log("🎪: 监测打开了新", tab);
  // });
})();
