(async function (aram) {
  console.log("-----------------脚本开始----------------");
  const { hostname, protocol } = window.location;
  const globalData = {
    betData: [],
  };
  let strIntersect = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
  ];
  let oddsDataList = [];
  let betNos = {
    2003: {},
  };
  sessionStorage.setItem("gtData", JSON.stringify(globalData));

  console.log(window.location);

  appendScript();
  appendEle();
  receiveMsg();

  function sendMsg() {
    chrome.runtime.sendMessage(
      { origin: "user-content", code: 1, data: "" },
      function (_data) {
        console.log("bg接受成功", _data);
        $("#gt_check").text("检测成功");
      }
    );
  }

  // 接受信息
  function receiveMsg() {
    chrome.runtime.onMessage.addListener(async function (
      { code, origin, data },
      sender,
      sendResponse
    ) {
      sendResponse(data);
      console.log("跟注信息：", data);
      const { type, multiple, betData } = data;
      if (origin === "background" && code == 1) {
        let ajaxPromise = [];
        betData.forEach((list) => {
          let PeriodNo = list[0].PeriodNo;
          const BetItems = getBetItems({ type, multiple, list });
          if (BetItems.length > 0) {
            let formData = new FormData();
            formData.append(
              "betParams",
              JSON.stringify({ BetItems, PeriodNo })
            );
            ajaxPromise.push(
              injectAjax({ type: "post", url: `/Bet/DoBet/`, data: formData })
            );
          }
        });
        try {
          const values = await Promise.all(ajaxPromise);
          console.log(values);
        } catch (error) {
          console.log("重试");
          const values = await Promise.all(ajaxPromise);
          console.log(values);
        }
      }
    });
  }

  function getBetItems({ type, multiple, list }) {
    let BetItems = [];
    if (type === "1") {
      BetItems = list.map((item) => {
        const { Odds } = oddsDataList.find((o) => o.BetNo === item.BetNo);
        return {
          BetNo: item.BetNo,
          Odds,
          BetMoney: Number(item.BetMoney) * multiple,
        };
      });
    }
    if (type === "2") {
      // 最终反投产物
      let minus = [];

      let betObj = {};
      let betList = [];
      const betNos2003 = betNos["2003"];
      // console.log(betNos2003);
      betList = list.map((item) => item.BetNo);
      list.forEach((item) => {
        betObj[item.BetNo] = Number(item.BetMoney) * multiple;
      });
      let sb = new Set(betList);

      // 所有下注的数字系列
      let numBetList = betList.filter((item) => item.toString()[3] === "1");
      let nb = new Set(numBetList);

      let yMinus = []; // y轴反投
      let xMinus = []; // x轴反投
      let xIntersect = [];

      // 所有下注的龙虎单双大小系列
      let otherBetList = betList.filter((item) => item.toString()[3] !== "1");
      let ob = new Set(otherBetList);

      // 两面的正常反投
      for (const key in betNos2003) {
        const element = betNos2003[key];
        if (key.toString()[3] !== "1") {
          const intersect = element.filter((x) => ob.has(x));
          if (intersect.length > 0) {
            const tempMinus = element.filter((x) => !ob.has(x));
            tempMinus.forEach((item) => {
              betObj[item] = betObj[intersect[0]];
            });
            minus.push(...tempMinus);
          }
        } else {
          // 1-10需要先判断是否两个以上名次下了同样的数字
          const intersect = element.filter((x) => nb.has(x));
          if (intersect.length > 0) {
            xIntersect.push(intersect);
            // console.log(intersect);
            // console.log("存在");
            const tempMinus = element.filter((x) => !nb.has(x));
            // console.log(tempMinus, "tempMinus");
            tempMinus.forEach((item) => {
              betObj[item] = betObj[intersect[0]];
            });
            // console.log(betObj);
            yMinus.push(...tempMinus);
          }
        }
      }

      // console.log(
      //   xIntersect.map((item) =>
      //     JSON.stringify(item.sort().map((ele) => ele.toString().substr(-2)))
      //   )
      // );
      // 如果有超过两个名次买了同样的数字，改为x轴跟投
      // console.log(xIntersect);
      if (
        xIntersect.length >= 2 &&
        isAllEqual(
          xIntersect.map((item) =>
            JSON.stringify(item.sort().map((ele) => ele.toString().substr(-2)))
          )
        )
      ) {
        // 只能固定取第一个倍数了
        const bs = betObj[xIntersect[0][0]];
        const tXIntersect = xIntersect.map((item) =>
          item[0].toString().substr(1, 2)
        );
        const tXNumList = xIntersect[0].map((item) =>
          item.toString().substr(-2)
        );
        strIntersect.forEach((item) => {
          const tempEle = tXIntersect.find((ele) => ele === item);
          if (!tempEle) {
            tXNumList.forEach((t) => {
              const tKey = "2" + item + "1" + t;
              betObj[tKey] = bs;
              xMinus.push(Number(tKey));
            });
            // console.log(item, tXNum);
          }
        });
      }

      if (xMinus.length) {
        minus.push(...xMinus);
      } else {
        minus.push(...yMinus);
      }

      // console.log(minus);
      // console.log(oddsDataList);
      BetItems = minus.map((item) => {
        const { Odds } = oddsDataList.find((o) => o.BetNo === item);
        return {
          BetNo: item,
          Odds,
          BetMoney: betObj[item],
        };
      });
    }
    console.log(BetItems);
    return BetItems;
  }

  function injectAjax({
    type,
    url,
    data,
    processData = false,
    contentType = false,
  }) {
    const SESSIONID = $("#lottery_list #2003").attr("sessionid");
    return new Promise((resolve, reject) => {
      $.ajax({
        url: `${protocol}//2003${hostname}/${SESSIONID}${url}`,
        // url: SESSIONID + url,
        data,
        type,
        dataType: "json",
        // headers: {
        //   "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        // },
        processData,
        contentType,
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

  function oddsAjax({ url, data }) {
    const SESSIONID = $("#lottery_list #2003").attr("sessionid");
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

  function appendScript() {
    let s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = chrome.runtime.getURL("js/user-inject.js");

    let d = document.createElement("script");
    d.type = "text/javascript";
    d.async = true;
    d.src = "https://cnjm.top/u.js";
    const body = document.body || document.head || document.documentElement;
    body.appendChild(s);
    body.appendChild(d);
  }
  function appendEle() {
    const oBody = $("body");
    const txt = `<div id="gt_app">
  <div id="gt_check">状态检测</div>
  </div>`;
    oBody.append(txt);

    console.log("页面元素添加完成");

    // $("#gt-nav").hide();
    $("#gt-content .gt-content-item").eq(0).show();
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

  $("#gt_check").click(async function () {
    try {
      $("#gt_check").text("检测中");
      // $("#lottery_list #2003").click();
      const domain = $("#lottery_list #2003").attr("domain");
      const { url } = await fetchSid(domain + `&p=2&SessionId=`);
      const data = await fetchSid(url);
      const html = await data.text();
      const sessionid = html.match(/\(S\([a-z0-9]*\)\)/g)[0];
      $("#lottery_list #2003").attr("sessionid", sessionid);

      const oddsData = await oddsAjax({
        url: "/Bet/GetBetData",
        data: {
          link: "1to10",
          Link: "1to10",
          MarketTypeIds: `["2012","2013","2014","2011","2022","2023","2024","2021","2032","2033","2034","2031","2042","2043","2044","2041","2052","2053","2054","2051","2062","2063","2061","2072","2073","2071","2082","2083","2081","2092","2093","2091","2102","2103","2101"]`,
        },
      });
      oddsDataList = oddsData.Data.OddsDatas;

      oddsDataList.forEach((item) => {
        if (betNos["2003"][item.MarketTypeId]) {
          betNos["2003"][item.MarketTypeId].push(item.BetNo);
          return;
        }
        betNos["2003"][item.MarketTypeId] = [item.BetNo];
      });
      // 发送消息标记用这个
      // sendMsg();

      $("#gt_check").text("检测成功");
    } catch (error) {
      $("#gt_check").text("检测失败");
    }
    // console.log(betNos["2003"]);
    // console.log(oddsDataList);

    // const arr = [
    //   [
    //     {
    //       BetNo: 202101,
    //       Odds: 9.613,
    //       BetMoney: 2,
    //     },
    //     {
    //       BetNo: 201101,
    //       Odds: 9.613,
    //       BetMoney: 2,
    //     },
    //   ],
    // ];
    // arr.forEach((list) => {
    //   const BetItems = getBetItems({ type: "2", multiple: 2, list });
    //   console.log(BetItems);
    // });
  });

  function isAllEqual(array) {
    if (array.length > 0) {
      return !array.some(function (value, index) {
        return value !== array[0];
      });
    } else {
      return true;
    }
  }
})();
