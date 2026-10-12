// 추세: EIA 전국 장기 · 지역 비교 · AAA 주별 일일 (data/eia_weekly.json, data/site.json)
(async () => {
  const { css, usd, kdate, ts, electionLines, FUEL_LABEL } = GP;
  Chart.register(electionLines);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => location.reload());
  const [eia, site] = await Promise.all([
    fetch("data/eia_weekly.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("data/site.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  const G = eia.products.gasoline, Dz = eia.products.diesel;
  document.getElementById("dateline").innerHTML =
    `EIA 최신 주 <b>${kdate(G.weeks[G.weeks.length - 1])}</b> · AAA 최신일 <b>${kdate(site.aaa_date)}</b>`;

  Chart.defaults.font.family = '"IBM Plex Sans KR", sans-serif';
  Chart.defaults.color = css("--ink-2");
  const SLOT = ["--gas", "--diesel", "--c3", "--c4"].map(css);
  const fmtDate = (v) => { const d = new Date(v); return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`; };
  const pts = (weeks, vals) => weeks.map((w, i) => ({ x: ts(w), y: vals[i] })).filter((p) => p.y != null);
  const lastTs = ts(G.weeks[G.weeks.length - 1]);
  const minFor = (years) => (years ? lastTs - years * 365.25 * 864e5 : undefined);

  // 눈금: 기간이 2년 넘으면 1월 1일(연 단위, 최대 8개), 짧으면 분기 첫날
  function yearTicks(axis) {
    const lo = new Date(axis.min), hi = axis.max, out = [];
    if (hi - axis.min > 2 * 365 * 864e5) {
      const span = new Date(hi).getUTCFullYear() - lo.getUTCFullYear();
      const step = [1, 2, 5, 10].find((k) => span / k <= 8) || 10;
      for (let y = Math.ceil((lo.getUTCFullYear() + 1) / step) * step; Date.UTC(y, 0, 1) <= hi; y += step) out.push(Date.UTC(y, 0, 1));
    } else {
      for (let y = lo.getUTCFullYear(), m = Math.ceil((lo.getUTCMonth() + 1) / 3) * 3; Date.UTC(y, m, 1) <= hi; m += 3) {
        if (m >= 12) { y += 1; m -= 12; }
        if (Date.UTC(y, m, 1) >= axis.min) out.push(Date.UTC(y, m, 1));
      }
    }
    axis.ticks = out.map((value) => ({ value }));
  }
  const baseOpts = (showElec) => ({
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    interaction: { mode: "index", intersect: false, axis: "x" },
    scales: {
      x: { type: "linear", grid: { color: css("--grid") }, afterBuildTicks: yearTicks,
        ticks: { autoSkip: false, maxRotation: 0, callback: (v) => {
          const d = new Date(v); return d.getUTCMonth() ? `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}` : `${d.getUTCFullYear()}`; } } },
      y: { grid: { color: css("--grid") }, ticks: { callback: (v) => "$" + v.toFixed(2) }, title: { display: true, text: "달러/갤런" } },
    },
    plugins: {
      legend: { position: "top", align: "start", labels: { boxWidth: 14, boxHeight: 2 } },
      tooltip: { callbacks: { title: (it) => (it[0] ? fmtDate(it[0].parsed.x) : ""), label: (it) => ` ${it.dataset.label}: ${usd(it.parsed.y, 3)}` } },
      electionLines: { show: showElec },
    },
    elements: { point: { radius: 0, hoverRadius: 4 }, line: { borderWidth: 2, tension: 0 } },
  });
  const line = (label, data, color) => ({ label, data, borderColor: color, backgroundColor: color });

  // 1) 전국 휘발유·디젤
  const c1 = new Chart(document.getElementById("c1"), {
    type: "line",
    data: { datasets: [line("일반 휘발유", pts(G.weeks, G.series.NUS), SLOT[0]), line("디젤", pts(Dz.weeks, Dz.series.NUS), SLOT[1])] },
    options: baseOpts(true),
  });
  const setRange = (chart, years) => { chart.options.scales.x.min = minFor(years); chart.options.scales.x.max = lastTs; chart.update(); };
  setRange(c1, 5);
  segment("range1", "y", (y) => setRange(c1, +y));
  document.getElementById("elec1").addEventListener("change", (e) => { c1.options.plugins.electionLines.show = e.target.checked; c1.update(); });

  // 2) 지역 비교 — 색은 지역에 붙고(선택 순서 슬롯), 다른 지역을 끄더라도 다시 칠하지 않는다
  let prod = "gasoline", years2 = 5;
  const DEFAULTS = { gasoline: ["NUS", "SOH", "STX", "R1Z"], diesel: ["NUS", "R20", "R1Z", "SCA"] };
  let picked = new Map();
  const c2 = new Chart(document.getElementById("c2"), { type: "line", data: { datasets: [] }, options: baseOpts(false) });
  function areaBoxes() {
    const p = eia.products[prod];
    picked = new Map(DEFAULTS[prod].map((a, i) => [a, i]));
    document.getElementById("areas2").innerHTML = Object.keys(p.series).map((a) =>
      `<label class="chk"><input type="checkbox" value="${a}" ${picked.has(a) ? "checked" : ""}> ${eia.areas[a] || a}</label>`).join("");
    document.querySelectorAll("#areas2 input").forEach((cb) => cb.addEventListener("change", () => {
      if (cb.checked) {
        if (picked.size >= 4) { cb.checked = false; return; }
        const free = [0, 1, 2, 3].find((i) => ![...picked.values()].includes(i));
        picked.set(cb.value, free);
      } else picked.delete(cb.value);
      draw2();
    }));
    draw2();
  }
  function draw2() {
    const p = eia.products[prod];
    c2.data.datasets = [...picked].map(([a, slot]) => line(eia.areas[a] || a, pts(p.weeks, p.series[a]), SLOT[slot]));
    setRange(c2, years2);
    document.getElementById("note2").textContent = prod === "gasoline"
      ? "EIA 휘발유 주간 시계열은 전국·PADD 권역·주 9곳(CA·CO·FL·MA·MN·NY·OH·TX·WA)·도시 10곳만 있습니다. 경합주 대부분(GA·MI·NC·ME 등)은 소속 PADD 권역으로만 볼 수 있습니다. 최대 4곳."
      : "EIA 디젤 주간 시계열은 전국·PADD 권역·캘리포니아뿐입니다. 다른 주의 디젤은 아래 AAA 일일 값으로 보세요. 최대 4곳.";
  }
  segment("prod2", "p", (p) => { prod = p; areaBoxes(); });
  segment("range2", "y", (y) => { years2 = +y; setRange(c2, years2); });
  areaBoxes();

  // 3) AAA 주별 일일
  const sel = document.getElementById("st3");
  const states = site.states.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
  sel.innerHTML = states.map((s) => `<option value="${s.code}">${s.name}${s.competitive ? " · 경합" : ""}</option>`).join("");
  sel.value = "GA";
  const OFFSET = { year_ago: 365, month_ago: 30, week_ago: 7, yesterday: 1 };
  const PLAB = { year_ago: "1년 전", month_ago: "1달 전", week_ago: "1주 전", yesterday: "어제" };
  const c3 = new Chart(document.getElementById("c3"), { type: "line", data: { datasets: [] }, options: baseOpts(false) });
  c3.options.elements.point.radius = 3;
  c3.options.interaction = { mode: "nearest", intersect: false };
  c3.options.plugins.tooltip.callbacks.label = (it) => ` ${it.dataset.label}${it.raw.p ? " (" + PLAB[it.raw.p] + ")" : ""}: ${usd(it.parsed.y, 3)}`;
  function draw3() {
    const s = site.states.find((x) => x.code === sel.value);
    const h = site.history[s.code];
    const ds = [];
    ["regular", "diesel"].forEach((f, i) => {
      const refPts = Object.entries(s.refs).filter(([p]) => OFFSET[p]).map(([p, v]) =>
        ({ x: ts(site.aaa_date) - OFFSET[p] * 864e5, y: v[f], p }));
      const daily = h.dates.map((d, j) => ({ x: ts(d), y: h[f][j] }));
      ds.push({ ...line(FUEL_LABEL[f], [...refPts, ...daily].sort((a, b) => a.x - b.x), SLOT[i]), borderWidth: 2, spanGaps: true,
        segment: { borderDash: (ctx) => (ctx.p0.raw.p || ctx.p1.raw.p ? [4, 4] : undefined) } });
    });
    c3.data.datasets = ds;
    c3.update();
    document.getElementById("note3").textContent =
      `${s.name}: AAA 일일 기록은 ${kdate(site.aaa_first_date)}부터 쌓입니다(${h.dates.length}일). 그 이전은 AAA가 알려 준 비교값 점뿐이며 점 사이 점선은 보간이 아니라 연결선입니다. ` +
      "「1달 전」의 정확한 날짜는 AAA가 밝히지 않아 30일 전에 찍었습니다.";
  }
  sel.addEventListener("change", draw3);
  draw3();

  function segment(id, key, fn) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute("aria-pressed", x === b));
      fn(b.dataset[key]);
    }));
  }
})();
