(function () {
  console.log("-----------------脚本开始----------------");
  const getImageBase64 = (image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    // 获取图片后缀名
    // const extension = image.src
    //   .substring(image.src.lastIndexOf(".") + 1)
    //   .toLowerCase();
    // 直接转成png
    return canvas.toDataURL("image/png", 1);
  };

  const downloadZip = async ({ sourceList, zipName = "test" }) => {
    const zip = new JSZip();
    const fileFolder = zip.folder(zipName); // 创建 zipName 文件夹
    const fileList = [];
    for (let i = 0; i < sourceList.length; i++) {
      const { name } = sourceList[i];
      const image = new Image();
      image.setAttribute("crossOrigin", "Anonymous"); // 设置 crossOrigin 属性，解决图片跨域报错
      image.src = sourceList[i].url;
      image.onload = async () => {
        const url = await getImageBase64(image);
        fileList.push({ name: name, img: url.substring(22) }); // 截取 data:image/png;base64, 后的数据
        if (fileList.length === sourceList.length) {
          if (fileList.length) {
            for (let k = 0; k < fileList.length; k++) {
              // 往文件夹中，添加每张图片数据
              fileFolder.file(fileList[k].name + ".png", fileList[k].img, {
                base64: true,
              });
            }
            zip.generateAsync({ type: "blob" }).then((content) => {
              saveAs(content, zipName + ".zip");
            });
          }
        }
      };
    }
  };
  console.log("window ", window);
  // saveAs("content", "zipName" + ".zip");
  const oBody = $("body");
  const txt = `<div id="plug_open">采集</div>`;
  console.log(oBody.append(txt));
  $("#plug_open").click(function () {
    const libVideos = $(".lib-video");
    const videoIcons = $(".detail-gallery-turn-wrapper .detail-gallery-img");
    // 标题
    const title = $(".title-first-column .title-text").text();
    // 视频链接
    let videoList = [];
    // 图片链接
    let iconList = [];
    libVideos.each((index, element) => {
      element.src && videoList.push(element.src);
    });
    videoIcons.each((index, element) => {
      element.src && iconList.push(element.src);
    });
    const sourceList = iconList.map((item, index) => {
      return { url: item, name: index };
    });
    downloadZip({ sourceList, zipName: title.replace(/\//g, "-") });
    console.log(title, videoList, iconList);
  });
})();
