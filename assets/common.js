// 공통: 숫자 형식·CSS 토큰·선거일·툴팁
window.GP = (() => {
  const ELECTION = "2026-11-03";
  const PAST_ELECTIONS = [
    ["1994-11-08", "1994 중간"], ["1996-11-05", "1996"], ["1998-11-03", "1998 중간"], ["2000-11-07", "2000"],
    ["2002-11-05", "2002 중간"], ["2004-11-02", "2004"], ["2006-11-07", "2006 중간"], ["2008-11-04", "2008"],
    ["2010-11-02", "2010 중간"], ["2012-11-06", "2012"], ["2014-11-04", "2014 중간"], ["2016-11-08", "2016"],
    ["2018-11-06", "2018 중간"], ["2020-11-03", "2020"], ["2022-11-08", "2022 중간"], ["2024-11-05", "2024"],
    ["2026-11-03", "2026 중간"],
  ];
  const FUEL_LABEL = { regular: "일반 휘발유", mid_grade: "중급 휘발유", premium: "고급 휘발유", diesel: "디젤" };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const usd = (v, d = 2) => (v == null ? "—" : "$" + v.toFixed(d));
  const delta = (v) => {
    if (v == null) return '<span class="muted">—</span>';
    const s = (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(2);
    return `<span class="${v > 0.004 ? "up" : v < -0.004 ? "down" : "muted"}">${s}</span>`;
  };
  const kdate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${y}년 ${m}월 ${d}일`; };
  const daysTo = (iso) => Math.ceil((new Date(iso + "T00:00:00-05:00") - new Date()) / 86400000);
  const ts = (iso) => Date.parse(iso + "T00:00:00Z");

  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
  const showTip = (html, ev) => {
    tip.innerHTML = html; tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  };
  const hideTip = () => { tip.style.display = "none"; };

  // Chart.js 플러그인: 선거일 세로 점선 (x축이 타임스탬프인 그림에만)
  const electionLines = {
    id: "electionLines",
    afterDatasetsDraw(chart, _a, opts) {
      if (!opts || !opts.show) return;
      const { ctx, chartArea: a, scales: { x } } = chart;
      ctx.save();
      ctx.strokeStyle = css("--ink-3"); ctx.fillStyle = css("--ink-2");
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.font = '10px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = "center";
      const ticks = PAST_ELECTIONS.filter(([d]) => ts(d) >= x.min && ts(d) <= x.max);
      const dense = ticks.length > 8;
      ticks.forEach(([d, lab], i) => {
        const px = x.getPixelForValue(ts(d));
        ctx.beginPath(); ctx.moveTo(px, a.top + 12); ctx.lineTo(px, a.bottom); ctx.stroke();
        if (!dense || lab.includes("중간")) ctx.fillText(dense ? lab.slice(0, 4) : lab, px, a.top + 8);
      });
      ctx.restore();
    },
  };

  return { ELECTION, PAST_ELECTIONS, FUEL_LABEL, css, usd, delta, kdate, daysTo, ts, showTip, hideTip, electionLines };
})();
