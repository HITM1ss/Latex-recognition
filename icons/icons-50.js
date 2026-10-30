// 自由创作 · 50 个新图形 —— 由 index.html 主脚本读取 window.BATCH4_ICONS 自动建卡
// 描绘动画统一使用 pathLength="1" 归一化技巧（dasharray=1, offset 1→0），无需手算路径实长
(function () {
  const svgOpen = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">';
  const svgClose = '</g></svg>';

  // 描绘一笔：attrs 为 path 属性串，t0/dur 秒，ease 为 keySplines
  function dr(attrs, t0, dur, ease) {
    return '<path ' + attrs + ' pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate fill="freeze" attributeName="stroke-dashoffset" begin="' + (t0 || 0) + 's" dur="' + (dur || 0.35) + 's" values="1;0" calcMode="spline" keyTimes="0;1" keySplines="' + (ease || '0.22 1 0.36 1') + '"/></path>';
  }
  // 元素尾部追加无限呼吸（opacity）
  function breathe(el, t0, dur, lo) {
    return el.replace(/<\/(path|circle|rect|g)>$/, '<animate attributeName="opacity" values="1;' + lo + ';1" keyTimes="0;0.5;1" dur="' + dur + 's" begin="' + t0 + 's" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/></$1>');
  }
  // 元素尾部追加一次闪光（opacity 0→peak→0，元素需自带 opacity="0"）
  function flash(el, t0, dur, peak) {
    return el.replace(/<\/(path|circle|rect|g)>$/, '<animate fill="freeze" attributeName="opacity" values="0;' + (peak || 1) + ';0" keyTimes="0;0.35;1" dur="' + dur + 's" begin="' + t0 + 's"/></$1>');
  }
  // 绕点缩放弹出（0→peak→1，回弹缓动）
  function popG(content, cx, cy, t0, dur, peak) {
    return '<g transform="translate(' + cx + ' ' + cy + ')"><g><animateTransform attributeName="transform" type="scale" values="0;' + (peak || 1.12) + ';1" keyTimes="0;0.6;1" dur="' + (dur || 0.35) + 's" begin="' + t0 + 's" calcMode="spline" keySplines="0.34 1.56 0.64 1;0.4 0 0.6 1" fill="freeze"/><g transform="translate(' + (-cx) + ' ' + (-cy) + ')">' + content + '</g></g></g>';
  }
  // 平移入场（from→to，easeOutExpo）
  function slide(content, fx, fy, tx, ty, t0, dur) {
    return '<g><animateTransform attributeName="transform" type="translate" values="' + fx + ' ' + fy + ';' + tx + ' ' + ty + '" keyTimes="0;1" dur="' + dur + 's" begin="' + t0 + 's" calcMode="spline" keySplines="0.16 1 0.3 1" fill="freeze"/>' + content + '</g>';
  }
  // 垂直浮动循环
  function floatY(content, amp, dur, t0) {
    return '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ' + amp + ';0 0" keyTimes="0;0.5;1" dur="' + dur + 's" begin="' + t0 + 's" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>' + content + '</g>';
  }
  // 绕点旋转循环
  function spin(content, cx, cy, deg, dur, t0) {
    return '<g><animateTransform attributeName="transform" type="rotate" values="0 ' + cx + ' ' + cy + ';' + deg + ' ' + cx + ' ' + cy + '" dur="' + dur + 's" begin="' + (t0 || 0) + 's" repeatCount="indefinite"/>' + content + '</g>';
  }
  // 绕点摆动循环（左右摇）
  function sway(content, cx, cy, deg, dur, t0) {
    return '<g><animateTransform attributeName="transform" type="rotate" values="0 ' + cx + ' ' + cy + ';' + deg + ' ' + cx + ' ' + cy + ';0 ' + cx + ' ' + cy + ';-' + deg + ' ' + cx + ' ' + cy + ';0 ' + cx + ' ' + cy + '" keyTimes="0;0.25;0.5;0.75;1" dur="' + dur + 's" begin="' + t0 + 's" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>' + content + '</g>';
  }
  // 绕点摇摆一次（多段角度，freeze）
  function wiggle(content, cx, cy, amps, t0, dur) {
    const vals = amps.map(a => a + ' ' + cx + ' ' + cy).join(';');
    const kt = amps.map((_, i) => (i / (amps.length - 1)).toFixed(3)).join(';');
    const spl = amps.slice(1).map(() => '0.4 0 0.6 1').join(';');
    return '<g><animateTransform attributeName="transform" type="rotate" values="' + vals + '" keyTimes="' + kt + '" dur="' + dur + 's" begin="' + t0 + 's" calcMode="spline" keySplines="' + spl + '" fill="freeze"/>' + content + '</g>';
  }
  // 一次位移微调（settle）
  function settle(content, dx, dy, t0, dur) {
    return '<g><animateTransform attributeName="transform" type="translate" values="0 0;' + dx + ' ' + dy + ';0 0" keyTimes="0;0.5;1" dur="' + dur + 's" begin="' + t0 + 's" calcMode="spline" keySplines="0.3 0 0.4 1;0.6 0 0.7 1" fill="freeze"/>' + content + '</g>';
  }
  // 沿路径巡游（infinite，el 定位在原点）
  function travel(el, pathId, dur, t0) {
    return '<g>' + el + '<animateMotion dur="' + dur + 's" begin="' + t0 + 's" repeatCount="indefinite"><mpath href="#' + pathId + '"/></animateMotion></g>';
  }

  const RAYS8 = ['M12 2.8v2.4', 'M12 18.8v2.4', 'M21.2 12h-2.4', 'M2.8 12h2.4', 'M18.4 5.6l-1.7 1.7', 'M5.6 18.4l1.7-1.7', 'M18.4 18.4l-1.7-1.7', 'M5.6 5.6l1.7 1.7'];
  const TEETH8 = ['M12 2.8v2.7', 'M12 18.5v2.7', 'M2.8 12h2.7', 'M18.5 12h2.7', 'M5.4 5.4l1.9 1.9', 'M16.7 16.7l1.9 1.9', 'M18.6 5.4l-1.9 1.9', 'M7.3 16.7l-1.9 1.9'];

  const ICONS = [
    { key: 'ascend', title: '双峰 · 上升波', tag: '错峰描绘 + 上升循环波浪', chips: ['描绘 0–0.4s', '波浪 ∞'], loop: true,
      svg: svgOpen + floatY(dr('d="M6 17l6-6 6 6"', 0, 0.22), -2, 1.6, 0.5) + floatY(dr('d="M6 11l6-6 6 6"', 0.15, 0.22), -2, 1.6, 0.8) + svgClose },
    { key: 'outbox', title: '托盘 · 上传', tag: '托盘描绘 + 箭头上滑出场', chips: ['托盘 0–0.3s', '上滑 0.25s'],
      svg: svgOpen + dr('d="M4.5 16v4.5h15V16"', 0, 0.3) + slide(dr('d="M12 13.5V4.8"', 0.3, 0.18) + dr('d="M8.5 8.2 12 4.8l3.5 3.4"', 0.42, 0.18), '0 7', '0 0', 0.2, 0.45) + svgClose },
    { key: 'arcin', title: '弧环 · 右箭入', tag: '圆环描绘 + 箭头滑入', chips: ['环 0–0.4s', '箭 0.4s'],
      svg: svgOpen + dr('d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"', 0, 0.4) + slide(dr('d="M8 12h7.5"', 0.4, 0.15) + dr('d="M12.6 8.6 16 12l-3.4 3.4"', 0.5, 0.15), '-7 0', '0 0', 0.4, 0.35) + svgClose },
    { key: 'bncdown', title: '下指 · 弹跳', tag: '描绘 + 向下弹跳循环', chips: ['描绘 0–0.35s', '弹跳 ∞'], loop: true,
      svg: svgOpen + floatY(dr('d="M12 4v9"', 0, 0.18) + dr('d="M7 9.5 12 14.5l5-5"', 0.12, 0.2), 3, 1.3, 0.5) + svgClose },
    { key: 'diagup', title: '斜上 · 冲线', tag: '对角描绘 + 微冲定版', chips: ['线 0–0.4s', '箭头 0.35s', '定版 0.6s'],
      svg: svgOpen + settle(dr('d="M6 18 18 6"', 0, 0.4) + dr('d="M10.5 6H18v7.5"', 0.35, 0.2), -0.8, -0.8, 0.6, 0.3) + svgClose },
    { key: 'bullseye', title: '靶心 · 命中', tag: '环描绘 + 箭射入 + 冲击闪光', chips: ['环 0–0.45s', '箭 0.5s', '闪光 0.75s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.45) + dr('d="M20.5 3.5 13 11"', 0.5, 0.2, '0.5 0 0.8 0.4') + flash('<path d="M12 9.6v1.2M12 13.2v1.2M9.6 12h1.2M13.2 12h1.2" opacity="0"></path>', 0.75, 0.35) + svgClose },
    { key: 'okcircle', title: '圆环 · 对勾', tag: '环描绘 + 对勾两笔接力', chips: ['环 0–0.4s', '勾 0.45–0.7s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.4) + dr('d="M8.8 12.2l2.3 2.3"', 0.45, 0.12) + dr('d="M11.1 14.5 15.2 10.4"', 0.55, 0.15) + svgClose },
    { key: 'xmark', title: '交叉 · 关闭', tag: '两笔对角描绘', chips: ['撇 0–0.3s', '捺 0.12s'],
      svg: svgOpen + dr('d="M7 7l10 10"', 0, 0.3) + dr('d="M17 7 7 17"', 0.12, 0.3) + svgClose },
    { key: 'pluscircle', title: '圆环 · 加号', tag: '环描绘 + 加号旋入', chips: ['环 0–0.4s', '旋入 0.45s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.4) + '<g><animateTransform attributeName="transform" type="rotate" values="90 12 12;0 12 12" keyTimes="0;1" dur="0.35s" begin="0.45s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze"/>' + dr('d="M12 8.5v7"', 0.45, 0.18) + dr('d="M8.5 12h7"', 0.5, 0.18) + '</g>' + svgClose },
    { key: 'infoic', title: '圆环 · 信息', tag: '环描绘 + 圆点落下 + 竖杆', chips: ['环 0–0.4s', '点 0.45s', '杆 0.6s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.4) + slide(dr('d="M12 8.2v.4"', 0.45, 0.1), '0 -3', '0 0', 0.45, 0.25) + dr('d="M12 11.2v4.6"', 0.6, 0.18) + svgClose },
    { key: 'warn', title: '三角 · 警告', tag: '三角描绘 + 感叹号', chips: ['三角 0–0.45s', '! 0.5s'],
      svg: svgOpen + dr('d="M12 4.5 21 19.5H3Z"', 0, 0.45) + dr('d="M12 10.2v4"', 0.5, 0.15) + dr('d="M12 16.9v.2"', 0.65, 0.1) + svgClose },
    { key: 'shield', title: '盾牌 · 防护', tag: '盾形描绘 + 对勾', chips: ['盾 0–0.55s', '勾 0.6s'],
      svg: svgOpen + dr('d="M12 3.5c2.9 1.6 5.4 2.4 7.5 2.6-.1 6.4-2.6 10.8-7.5 13.9-4.9-3.1-7.4-7.5-7.5-13.9 2.1-.2 4.6-1 7.5-2.6Z"', 0, 0.55) + dr('d="M8.8 11.8l2.3 2.3 4.2-4.6"', 0.6, 0.25) + svgClose },
    { key: 'sun', title: '太阳 · 光芒', tag: '核心描绘 + 光芒错峰 + 缓旋', chips: ['核心 0–0.35s', '光芒 0.35s+', '缓旋 ∞'], loop: true,
      svg: svgOpen + spin(dr('d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0"', 0, 0.35) + RAYS8.map((d, i) => dr('d="' + d + '"', 0.35 + i * 0.05, 0.18)).join(''), 12, 12, 360, 30, 0.8) + svgClose },
    { key: 'moon', title: '月牙 · 眨星', tag: '月牙描绘 + 星星弹出 + 摇曳', chips: ['月牙 0–0.6s', '星 0.65s', '摇曳 ∞'], loop: true,
      svg: svgOpen + sway(dr('d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"', 0, 0.6) + popG('<path d="M17.8 4.2v2.4M16.6 5.4H19"/>', 17.8, 5.4, 0.65, 0.3), 12, 12, 4, 3.2, 1) + svgClose },
    { key: 'rain', title: '乌云 · 落雨', tag: '云描绘 + 雨滴循环下落', chips: ['云 0–0.55s', '雨 ∞'], loop: true,
      svg: svgOpen + dr('d="M17.5 16.5H9a6.5 6.5 0 1 1 6.23-8.36A4.3 4.3 0 1 1 17.5 16.5Z"', 0, 0.55)
        + ['M8.5 19v1.6', 'M12.2 19v1.6', 'M15.9 19v1.6'].map((d, i) => {
          const t0 = 0.9 + i * 0.28;
          return '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 2.4" dur="0.9s" begin="' + t0 + 's" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.25;1" dur="0.9s" begin="' + t0 + 's" repeatCount="indefinite"/><path d="' + d + '"/></g>';
        }).join('') + svgClose },
    { key: 'snow', title: '雪花 · 凝晶', tag: '六向描绘 + 缓旋', chips: ['主轴 0–0.4s', '枝杈 0.45s', '缓旋 ∞'], loop: true,
      svg: svgOpen + spin(dr('d="M12 4v16"', 0, 0.25) + dr('d="M5.1 8l13.8 8"', 0.1, 0.25) + dr('d="M18.9 8 5.1 16"', 0.2, 0.25) + dr('d="M9.6 6.2 12 8.2l2.4-2"', 0.45, 0.18) + dr('d="M9.6 17.8 12 15.8l2.4 2"', 0.52, 0.18), 12, 12, 360, 40, 0.7) + svgClose },
    { key: 'drop', title: '水滴 · 涟漪', tag: '水滴描绘 + 涟漪扩散', chips: ['滴 0–0.55s', '涟漪 ∞'], loop: true,
      svg: svgOpen + dr('d="M12 3.5c3.2 3.6 5.5 6.4 5.5 9.4a5.5 5.5 0 1 1-11 0c0-3 2.3-5.8 5.5-9.4Z"', 0, 0.55) + '<circle cx="12" cy="13" r="2" opacity="0"><animate attributeName="r" values="2;6" dur="1.8s" begin="0.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0" dur="1.8s" begin="0.8s" repeatCount="indefinite"/></circle>' + svgClose },
    { key: 'flame', title: '火焰 · 燃动', tag: '焰形描绘 + 内焰抖动', chips: ['焰 0–0.55s', '内焰 ∞'], loop: true,
      svg: svgOpen + dr('d="M12 3.5c1.6 2.6 4.2 4.6 4.2 8a4.2 4.2 0 0 1-8.4 0c0-1.5.6-2.8 1.5-3.9.4 1 .9 1.7 1.8 2.1.1-2.2-.1-4.2.9-6.2Z"', 0, 0.55) + breathe(dr('d="M12 11.2c.7 1 1.5 1.9 1.5 3a1.5 1.5 0 1 1-3 0c0-1.1.8-2 1.5-3Z"', 0.6, 0.25), 1, 0.7, 0.25) + svgClose },
    { key: 'chat', title: '气泡 · 输入中', tag: '气泡描绘 + 三点脉动', chips: ['气泡 0–0.5s', '三点 0.55s', '脉动 ∞'], loop: true,
      svg: svgOpen + dr('d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"', 0, 0.5) + [8.5, 12, 15.5].map((x, i) => breathe(dr('d="M' + x + ' 10.5v.01"', 0.5 + i * 0.08, 0.08), 1 + i * 0.2, 1.2, 0.3)).join('') + svgClose },
    { key: 'mail', title: '信封 · 通知', tag: '信封描绘 + 角标脉动', chips: ['封 0–0.35s', '盖 0.35s', '角标 ∞'], loop: true,
      svg: svgOpen + dr('d="M3.5 6.5h17v11h-17Z"', 0, 0.35) + dr('d="M3.5 7l8.5 6 8.5-6"', 0.35, 0.25) + breathe(popG('<circle cx="20" cy="5" r="2"/>', 20, 5, 0.7, 0.3), 1, 1.4, 0.4) + svgClose },
    { key: 'phone', title: '听筒 · 来电', tag: '听筒描绘 + 电波脉动', chips: ['听筒 0–0.55s', '电波 0.6s ∞'], loop: true,
      svg: svgOpen + dr('d="M5.5 4.5h3L10 8.5 8 10a12.5 12.5 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3.5 6.5a2 2 0 0 1 2-2Z"', 0, 0.55) + breathe(dr('d="M15.5 5.5a5 5 0 0 1 3 3"', 0.6, 0.2), 1, 1.3, 0.35) + breathe(dr('d="M16 2.8a8 8 0 0 1 5.2 5.2"', 0.7, 0.2), 1.15, 1.3, 0.35) + svgClose },
    { key: 'bell', title: '铃铛 · 摇响', tag: '铃身描绘 + 摇铃一次', chips: ['铃 0–0.55s', '摇 0.75s'],
      svg: svgOpen + wiggle(dr('d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"', 0, 0.55) + dr('d="M10.3 21a1.94 1.94 0 0 0 3.4 0"', 0.6, 0.15), 12, 4, [0, 7, -6, 3, 0], 0.75, 0.8) + svgClose },
    { key: 'horn', title: '喇叭 · 广播', tag: '喇叭描绘 + 声波扩散', chips: ['喇叭 0–0.5s', '声波 0.55s ∞'], loop: true,
      svg: svgOpen + dr('d="M3.5 10v4H7l6 4.5v-13L7 10Z"', 0, 0.5) + breathe(dr('d="M16.5 9.5a4 4 0 0 1 0 5"', 0.55, 0.2), 1, 1.3, 0.35) + breathe(dr('d="M19 7.5a7.5 7.5 0 0 1 0 9"', 0.65, 0.2), 1.2, 1.3, 0.35) + svgClose },
    { key: 'wifi', title: 'Wi-Fi · 连接', tag: '逐层点亮 + 循环波送', chips: ['点亮 0–0.7s', '波送 ∞'], loop: true,
      svg: svgOpen + dr('d="M12 18.2v.01"', 0, 0.08) + breathe(dr('d="M8.6 15.2a5 5 0 0 1 6.8 0"', 0.2, 0.18), 1, 1.4, 0.4) + breathe(dr('d="M5.8 12.4a9 9 0 0 1 12.4 0"', 0.35, 0.18), 1.2, 1.4, 0.4) + breathe(dr('d="M3 9.6a13 13 0 0 1 18 0"', 0.5, 0.18), 1.4, 1.4, 0.4) + svgClose },
    { key: 'play', title: '圆环 · 播放', tag: '环描绘 + 三角弹出', chips: ['环 0–0.45s', '三角 0.5s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.45) + popG('<path d="M10 8.6v6.8L15.8 12Z"/>', 12.9, 12, 0.5, 0.35) + svgClose },
    { key: 'pause', title: '圆环 · 暂停', tag: '环描绘 + 双柱落下', chips: ['环 0–0.45s', '柱 0.5s'],
      svg: svgOpen + dr('d="M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0"', 0, 0.45) + slide(dr('d="M10 9v6"', 0.5, 0.15), '0 -3', '0 0', 0.5, 0.25) + slide(dr('d="M14 9v6"', 0.6, 0.15), '0 -3', '0 0', 0.6, 0.25) + svgClose },
    { key: 'volume', title: '喇叭 · 音量', tag: '扬声器描绘 + 声波接力', chips: ['喇叭 0–0.4s', '波 0.45s', '脉动 ∞'], loop: true,
      svg: svgOpen + dr('d="M11 5 6.5 9H3.5v6H6.5L11 19Z"', 0, 0.4) + breathe(dr('d="M14.8 9.2a4.2 4.2 0 0 1 0 5.6"', 0.45, 0.18), 1, 1.2, 0.35) + breathe(dr('d="M17.8 6.7a8.3 8.3 0 0 1 0 10.6"', 0.55, 0.18), 1.2, 1.2, 0.35) + svgClose },
    { key: 'note', title: '音符 · 摆动', tag: '音符描绘 + 摇摆循环', chips: ['符 0–0.6s', '摇摆 ∞'], loop: true,
      svg: svgOpen + sway(dr('d="M11.2 17.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 1 1 4.4 0"', 0, 0.25) + dr('d="M11.2 17.5V5"', 0.2, 0.2) + dr('d="M11.2 5c2.6.5 4.1 2 4.1 4.4 0 1.2-.5 2.2-1.3 3"', 0.4, 0.25), 9, 17.5, 4, 2.6, 0.9) + svgClose },
    { key: 'camera', title: '相机 · 闪光', tag: '机身描绘 + 周期闪光', chips: ['机身 0–0.5s', '镜头 0.55s', '闪光 ∞'], loop: true,
      svg: svgOpen + dr('d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.2l1.5-2h6.6l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"', 0, 0.5) + dr('d="M15.2 13a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 1 1 6.4 0"', 0.55, 0.25) + '<path d="M20.5 3.2v2M19.5 4.2h2" opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.2;1" dur="2.8s" begin="1.2s" repeatCount="indefinite"/></path>' + svgClose },
    { key: 'folder', title: '文件夹 · 归档', tag: '夹形描绘 + 横线', chips: ['夹 0–0.5s', '横线 0.55s'],
      svg: svgOpen + dr('d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z"', 0, 0.5) + dr('d="M7.5 14h6"', 0.55, 0.15) + svgClose },
    { key: 'fileplus', title: '文件 · 新建', tag: '纸页描绘 + 折角 + 加号', chips: ['页 0–0.4s', '折角 0.4s', '加号 0.55s'],
      svg: svgOpen + dr('d="M6.5 4.5A1 1 0 0 1 7.5 3.5H13l5.5 5.5v10.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"', 0, 0.4) + dr('d="M13 3.5V9h5.5"', 0.4, 0.18) + dr('d="M12 11.8v5"', 0.55, 0.15) + dr('d="M9.5 14.3h5"', 0.62, 0.15) + svgClose },
    { key: 'dlin', title: '托盘 · 下载', tag: '托盘描绘 + 箭头下落回弹', chips: ['托盘 0–0.25s', '下落 0.2s'],
      svg: svgOpen + dr('d="M4.5 16.5v3.5h15v-3.5"', 0, 0.25) + '<g><animateTransform attributeName="transform" type="translate" values="0 -3.5;0 0.9;0 0" keyTimes="0;0.6;1" dur="0.55s" begin="0.25s" calcMode="spline" keySplines="0.45 0 0.6 0.5;0.3 0 0.4 1" fill="freeze"/>' + dr('d="M12 4v9"', 0.3, 0.2) + dr('d="M8.5 9.8 12 13.3l3.5-3.5"', 0.42, 0.18) + '</g>' + svgClose },
    { key: 'copytwo', title: '双层 · 复制', tag: '后层描绘 + 前层滑入', chips: ['后层 0–0.3s', '前层 0.25s'],
      svg: svgOpen + dr('d="M15.5 5.5v-1a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"', 0, 0.3) + slide(dr('d="M8.5 8.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"', 0.3, 0.35), '3 3', '0 0', 0.25, 0.4) + svgClose },
    { key: 'trash', title: '垃圾桶 · 清空', tag: '桶身描绘 + 桶盖摆动', chips: ['桶 0–0.55s', '盖 0.8s'],
      svg: svgOpen + dr('d="M6.3 7l.7 11.6a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5L17.7 7"', 0, 0.3) + dr('d="M10.2 10.5v5.5"', 0.35, 0.12) + dr('d="M13.8 10.5v5.5"', 0.43, 0.12) + wiggle(dr('d="M4.5 7h15"', 0.15, 0.1) + dr('d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"', 0.22, 0.15), 12, 7, [0, 8, -5, 0], 0.8, 0.5) + svgClose },
    { key: 'gear', title: '齿轮 · 运转', tag: '轮描绘 + 齿错峰 + 缓旋', chips: ['轮 0–0.4s', '齿 0.4s', '缓旋 ∞'], loop: true,
      svg: svgOpen + spin(dr('d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0"', 0, 0.4) + TEETH8.map((d, i) => dr('d="' + d + '"', 0.4 + i * 0.05, 0.15)).join(''), 12, 12, 360, 32, 0.9) + svgClose },
    { key: 'wrench', title: '扳手 · 紧固', tag: '扳手描绘 + 摆动一次', chips: ['扳手 0–0.7s', '摆动 0.8s'],
      svg: svgOpen + wiggle(dr('d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z"', 0, 0.7), 12, 12, [0, -6, 4, 0], 0.8, 0.6) + svgClose },
    { key: 'search', title: '放大镜 · 扫描', tag: '镜片描绘 + 扫描光环', chips: ['镜 0–0.4s', '柄 0.4s', '扫描 ∞'], loop: true,
      svg: svgOpen + dr('d="M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 1 1 11 0"', 0, 0.4) + dr('d="M14.3 14.3 20 20"', 0.4, 0.15) + '<path d="M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 1 1 11 0" pathLength="1" stroke-dasharray="0.12 0.88" opacity="0.7"><animate attributeName="stroke-dashoffset" values="0;-1" dur="2.4s" begin="0.7s" repeatCount="indefinite"/></path>' + svgClose },
    { key: 'sliders', title: '滑杆 · 调节', tag: '轨道描绘 + 滑块滑动', chips: ['轨道 0–0.3s', '滑块 0.7s'],
      svg: svgOpen + dr('d="M4 7h16"', 0, 0.12) + dr('d="M4 12h16"', 0.08, 0.12) + dr('d="M4 17h16"', 0.16, 0.12) + slide(dr('d="M9 5.4v3.2"', 0.3, 0.12), '0 0', '-4 0', 0.7, 0.35) + slide(dr('d="M15 10.4v3.2"', 0.4, 0.12), '0 0', '3 0', 0.78, 0.35) + slide(dr('d="M7 15.4v3.2"', 0.5, 0.12), '0 0', '-4 0', 0.86, 0.35) + svgClose },
    { key: 'link2', title: '链条 · 相连', tag: '双环描绘 + 对拉咬合', chips: ['环 0–0.5s', '咬合 0.6s'],
      svg: svgOpen + settle(dr('d="M10.2 13.2a4.5 4.5 0 0 0 6.8.5l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"', 0, 0.4), 0.9, -0.9, 0.6, 0.3) + settle(dr('d="M13.8 10.8a4.5 4.5 0 0 0-6.8-.5l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"', 0.1, 0.4), -0.9, 0.9, 0.6, 0.3) + svgClose },
    { key: 'clock', title: '时钟 · 走针', tag: '表盘描绘 + 分针旋转', chips: ['盘 0–0.45s', '针 0.5s', '走针 ∞'], loop: true,
      svg: svgOpen + dr('d="M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0"', 0, 0.45) + dr('d="M12 12V8.2"', 0.5, 0.15) + spin(dr('d="M12 12l3.2 1.8"', 0.6, 0.15), 12, 12, 360, 9, 0.8) + svgClose },
    { key: 'hourglass', title: '沙漏 · 流转', tag: '框架描绘 + 沙流循环', chips: ['框架 0–0.6s', '沙流 ∞'], loop: true,
      svg: svgOpen + dr('d="M7 3.5v3.2c0 2.8 5 3.3 5 5.3s-5 2.5-5 5.5v3"', 0, 0.35) + dr('d="M17 3.5v3.2c0 2.8-5 3.3-5 5.3s5 2.5 5 5.3v3"', 0.1, 0.35) + dr('d="M5.5 3.5h13"', 0.45, 0.12) + dr('d="M5.5 20.5h13"', 0.5, 0.12) + dr('d="M9.6 18.4h4.8"', 0.7, 0.15) + '<path d="M12 13v2.2" opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.6s" begin="0.8s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 -1.5;0 3.5" dur="1.6s" begin="0.8s" repeatCount="indefinite"/></path>' + svgClose },
    { key: 'calcheck', title: '日历 · 打勾', tag: '日历描绘 + 事件打勾', chips: ['框 0–0.4s', '勾 0.55s'],
      svg: svgOpen + dr('d="M4.5 8A1.5 1.5 0 0 1 6 6.5h12A1.5 1.5 0 0 1 19.5 8v10A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18Z"', 0, 0.4) + dr('d="M8.5 4v4"', 0.15, 0.1) + dr('d="M15.5 4v4"', 0.22, 0.1) + dr('d="M4.5 10.5h15"', 0.3, 0.12) + dr('d="M9 14.6l2.1 2.1 4-4.4"', 0.55, 0.22) + svgClose },
    { key: 'alarm', title: '闹钟 · 催促', tag: '钟体描绘 + 摇铃循环', chips: ['钟 0–0.5s', '摇 ∞'], loop: true,
      svg: svgOpen + sway(dr('d="M18.5 13a6.5 6.5 0 1 1-13 0 6.5 6.5 0 1 1 13 0"', 0, 0.4) + dr('d="M5.2 5.8 3.5 4.2"', 0.45, 0.1) + dr('d="M18.8 5.8l1.7-1.6"', 0.5, 0.1) + dr('d="M12 13V9.8"', 0.5, 0.12) + dr('d="M12 13l2.4 1.6"', 0.6, 0.12), 12, 13, 5, 1.5, 0.9) + svgClose },
    { key: 'gem', title: '钻石 · 切面', tag: '轮廓描绘 + 切面接力 + 闪点', chips: ['轮廓 0–0.5s', '切面 0.5s', '闪点 0.85s'],
      svg: svgOpen + dr('d="M7 4.5h10l4 5-9 10-9-10Z"', 0, 0.5) + dr('d="M3 9.5h18"', 0.5, 0.15) + dr('d="M7 4.5l5 15 5-15"', 0.6, 0.25) + popG('<path d="M20.5 2.8v2M19.5 3.8h2"/>', 20.5, 3.8, 0.85, 0.25) + svgClose },
    { key: 'hexpulse', title: '六边 · 呼吸', tag: '描绘 + 循环呼吸缩放', chips: ['框 0–0.45s', '呼吸 ∞'], loop: true,
      svg: svgOpen + '<g transform="translate(12 12)"><g><animateTransform attributeName="transform" type="scale" values="1;1.06;1" keyTimes="0;0.5;1" dur="2.2s" begin="0.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/><g transform="translate(-12 -12)">' + dr('d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z"', 0, 0.45) + '</g></g></g>' + svgClose },
    { key: 'cube', title: '立方 · 等距', tag: '外框描绘 + 棱线接力', chips: ['框 0–0.4s', '棱 0.45s'],
      svg: svgOpen + dr('d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z"', 0, 0.4) + dr('d="M12 12v9"', 0.45, 0.12) + dr('d="M12 12 4.2 7.5"', 0.55, 0.12) + dr('d="M12 12l7.8-4.5"', 0.65, 0.12) + svgClose },
    { key: 'burst', title: '放射 · 星芒线', tag: '旋转缩放入场 + 缓旋', chips: ['入场 0–0.5s', '缓旋 ∞'], loop: true,
      svg: svgOpen + spin('<g><animateTransform attributeName="transform" type="rotate" values="-90 12 12;0 12 12" keyTimes="0;1" dur="0.5s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze"/><g transform="translate(12 12)"><g><animateTransform attributeName="transform" type="scale" values="0.3;1" keyTimes="0;1" dur="0.5s" calcMode="spline" keySplines="0.22 1 0.36 1" fill="freeze"/><g transform="translate(-12 -12)">' + dr('d="M12 3.5v17"', 0, 0.2) + dr('d="M4.6 7.75l14.8 8.5"', 0.08, 0.2) + dr('d="M19.4 7.75l-14.8 8.5"', 0.16, 0.2) + '</g></g></g></g>', 12, 12, 360, 26, 0.7) + svgClose },
    { key: 'orbit', title: '轨道 · 卫星', tag: '环描绘 + 卫星巡游', chips: ['环 0–0.5s', '卫星 ∞'], loop: true,
      svg: svgOpen + dr('d="M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0" id="orbPath"', 0, 0.5) + popG('<circle cx="12" cy="12" r="1.6"/>', 12, 12, 0.55, 0.25) + travel('<circle r="1.5"/>', 'orbPath', 3.2, 0.8) + svgClose },
    { key: 'inf', title: '无限 · 循环', tag: '∞ 描绘 + 能量流', chips: ['描绘 0–0.7s', '流动 ∞'], loop: true,
      svg: svgOpen + dr('d="M12 12c-2-2.5-3.4-3.8-5.4-3.8a3.8 3.8 0 1 0 0 7.6c2 0 3.4-1.3 5.4-3.8 2 2.5 3.4 3.8 5.4 3.8a3.8 3.8 0 1 0 0-7.6c-2 0-3.4 1.3-5.4 3.8Z"', 0, 0.7) + '<path d="M12 12c-2-2.5-3.4-3.8-5.4-3.8a3.8 3.8 0 1 0 0 7.6c2 0 3.4-1.3 5.4-3.8 2 2.5 3.4 3.8 5.4 3.8a3.8 3.8 0 1 0 0-7.6c-2 0-3.4 1.3-5.4 3.8Z" pathLength="1" stroke-dasharray="0.06 0.94" opacity="0.85"><animate attributeName="stroke-dashoffset" values="0;-1" dur="2.2s" begin="0.9s" repeatCount="indefinite"/></path>' + svgClose },
    { key: 'battery', title: '电池 · 充电', tag: '电池描绘 + 电量递升', chips: ['体 0–0.35s', '格 0.5s', '脉动 ∞'], loop: true,
      svg: svgOpen + dr('d="M2.5 8.7A1.7 1.7 0 0 1 4.2 7h11.6a1.7 1.7 0 0 1 1.7 1.7v6.6a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7Z"', 0, 0.35) + dr('d="M20.5 10.5v3"', 0.3, 0.1) + dr('d="M6 10.8v2.4"', 0.5, 0.1) + dr('d="M9.5 10.8v2.4"', 0.6, 0.1) + breathe(dr('d="M13 10.8v2.4"', 0.7, 0.1), 1.2, 1.2, 0.35) + svgClose },
  ];

  window.BATCH4_ICONS = ICONS;
})();
