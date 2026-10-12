// 개요: KPI · 타일 지도 · 주별 표 (data/site.json)
(async () => {
  const { usd, delta, kdate, daysTo, showTip, hideTip, FUEL_LABEL, ELECTION } = GP;
  const site = await (await fetch("data/site.json", { cache: "no-cache" })).json();
  const S = site.states;
  const byCode = Object.fromEntries(S.map((s) => [s.code, s]));

  // 타일 배치 [행, 열] — 11열
  const GRID = {
    AK: [0, 0], ME: [0, 10], WI: [1, 5], VT: [1, 9], NH: [1, 10],
    WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], IL: [2, 5], MI: [2, 6], NY: [2, 8], MA: [2, 9],
    OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IN: [3, 5], OH: [3, 6], PA: [3, 7], NJ: [3, 8], CT: [3, 9], RI: [3, 10],
    CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9],
    AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7], DC: [5, 8],
    OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
    HI: [7, 0], TX: [7, 3], FL: [7, 8],
  };
  const RACE = { senate: "상원", governor: "주지사" };
  const partyCls = (r) => (r === "Toss-up" ? "t" : / D$/.test(r) ? "d" : / R$/.test(r) ? "r" : "");
  const badges = (s, compOnly) => s.races.filter((x) => !compOnly || x.competitive)
    .map((x) => `<span class="badge ${partyCls(x.rating)}">${RACE[x.race]} ${x.rating}</span>`).join("");
  const chg = (s, fuel, period) => {
    const ref = s.refs[period];
    return ref && ref[fuel] != null && s.price[fuel] != null ? s.price[fuel] - ref[fuel] : null;
  };

  const rm = site.ratings_meta;
  const ratingDates = () => Object.keys(rm).length
    ? Object.entries(rm).map(([k, v]) => `<a href="${v.detail_url}">${RACE[k]}</a> <b>${v.as_of}</b> 기준`).join(" · ") +
      " (270toWin 게재본)"
    : "등급을 불러오지 못함";
  // 머리띠·KPI
  const e = site.eia_latest;
  const reg = S.filter((s) => s.price.regular != null).sort((a, b) => b.price.regular - a.price.regular);
  document.getElementById("dateline").innerHTML =
    `AAA 주별 평균 <b>${kdate(site.aaa_date)}</b> 기준 · EIA 전국 주간 <b>${kdate(e.gasoline.week)}</b> 주 · ` +
    `2026년 중간선거(11월 3일)까지 <b>${daysTo(ELECTION)}일</b><br>` +
    `경합 표시 기준: Cook Political Report ${ratingDates()}`;
  const kpi = (lab, val, sub) => `<div class="kpi"><div class="lab">${lab}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  document.getElementById("kpis").innerHTML = [
    kpi("전국 일반 휘발유 (EIA 주간)", usd(e.gasoline.us, 3), `전주 대비 ${delta(e.gasoline.us - e.gasoline.week_ago)} · 1년 전 대비 ${delta(e.gasoline.us - e.gasoline.year_ago)}`),
    kpi("전국 디젤 (EIA 주간)", usd(e.diesel.us, 3), `전주 대비 ${delta(e.diesel.us - e.diesel.week_ago)} · 1년 전 대비 ${delta(e.diesel.us - e.diesel.year_ago)}`),
    kpi(`가장 비싼 주 · ${reg[0].name}`, usd(reg[0].price.regular), "일반 휘발유 (AAA 일일)"),
    kpi(`가장 싼 주 · ${reg[reg.length - 1].name}`, usd(reg[reg.length - 1].price.regular), "일반 휘발유 (AAA 일일)"),
  ].join("");
  document.getElementById("kpi-note").textContent =
    "EIA 전국값은 매주 월요일 조사 가격이고, 1년 전 = 52주 전입니다. AAA 주별 값은 매일 아침 한 번 기록한 값이라 두 출처의 수준이 조금 다를 수 있습니다.";

  // 지도
  let fuel = "regular", metric = "price";
  const BINS = 7;
  // 지도 값: 현재가 또는 1년 변화(현재 − AAA 「1년 전」 평균)
  const mapVal = (s) => (metric === "price" ? s.price[fuel] : chg(s, fuel, "year_ago"));
  const fmtVal = (v) => (metric === "price" ? v.toFixed(2) : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2));
  const tilemap = document.getElementById("tilemap");
  const tiles = {};
  Object.entries(GRID).forEach(([code, [r, c]]) => {
    const el = document.createElement("div");
    el.className = "tile"; el.style.gridRow = r + 1; el.style.gridColumn = c + 1;
    el.innerHTML = `<span class="st">${code}</span><span class="pr"></span>`;
    el.tabIndex = 0;
    const s = byCode[code];
    if (s && s.competitive) el.classList.add("comp");
    const show = (ev) => s && showTip(tipHtml(s), ev);
    el.addEventListener("mousemove", show);
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", () => { const b = el.getBoundingClientRect(); show({ clientX: b.right, clientY: b.top }); });
    el.addEventListener("blur", hideTip);
    tilemap.appendChild(el); tiles[code] = el;
  });
  function tipHtml(s) {
    const rows = Object.keys(FUEL_LABEL).map((f) =>
      `<tr><td>${FUEL_LABEL[f]}</td><td class="n">${usd(s.price[f], 3)}</td><td class="n">${delta(chg(s, f, "week_ago"))}</td><td class="n">${delta(chg(s, f, "year_ago"))}</td></tr>`).join("");
    return `<b>${s.name}</b> <span class="muted">${s.code}</span><br>${badges(s) || '<span class="muted small">2026 상원·주지사 선거 없음</span>'}` +
      `<table style="margin-top:.3rem"><tr class="muted"><td></td><td class="n">현재</td><td class="n">1주</td><td class="n">1년</td></tr>${rows}</table>`;
  }
  function quantileBreaks(vals) {
    const v = vals.slice().sort((a, b) => a - b);
    return Array.from({ length: BINS - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / BINS)]);
  }
  function drawMap() {
    const vals = S.map(mapVal).filter((v) => v != null);
    // 1년 변화에서 하락한 주가 있으면, 하락은 순차 색 단계에 섞지 않고 회색으로 따로 칠한다
    const neg = metric === "change" && vals.some((v) => v < 0);
    const posVals = neg ? vals.filter((v) => v >= 0) : vals;
    const br = quantileBreaks(posVals.length ? posVals : vals);
    const compOnly = document.getElementById("comp-only").checked;
    Object.entries(tiles).forEach(([code, el]) => {
      const s = byCode[code];
      const v = s && mapVal(s);
      if (v == null || (neg && v < 0)) {
        el.dataset.b = "na"; el.style.background = "";
        el.querySelector(".pr").textContent = v == null ? "—" : fmtVal(v);
      } else {
        const b = br.filter((x) => v >= x).length;
        el.dataset.b = b;
        el.style.background = `var(--s${b + 1})`;
        el.querySelector(".pr").textContent = fmtVal(v);
      }
      if (s) el.setAttribute("aria-label", `${s.name} ${FUEL_LABEL[fuel]} ${metric === "price" ? "" : "1년 변화 "}${v == null ? "없음" : fmtVal(v)}달러${s.competitive ? ", 경합" : ""}`);
      el.classList.toggle("dim", compOnly && !s.competitive);
    });
    const lo = Math.min(...posVals), hi = Math.max(...posVals);
    const edges = [lo, ...br, hi];
    const title = metric === "price" ? `${FUEL_LABEL[fuel]} 현재가 (달러/갤런)` : `${FUEL_LABEL[fuel]} 1년 전 대비 변화 (달러/갤런)`;
    document.getElementById("legend").innerHTML =
      `<span>${title}</span><span class="ramp">${Array.from({ length: BINS }, (_, i) =>
        `<span style="background:var(--s${i + 1})" title="${fmtVal(edges[i])} ~ ${fmtVal(edges[i + 1])}"></span>`).join("")}</span>` +
      `<span class="mono">${fmtVal(lo)} → ${fmtVal(hi)}</span><span class="small">(${posVals.length}곳을 7단계로 같은 수씩 나눔)</span>` +
      (neg ? `<span><span class="ramp"><span style="background:var(--grid)"></span></span> 하락 ${vals.length - posVals.length}곳</span>` : "") +
      `<span><span class="ringkey"></span> 2026 경합(상원·주지사, Cook)</span>`;
  }
  document.querySelectorAll("#fuel-seg button").forEach((b) => b.addEventListener("click", () => {
    fuel = b.dataset.f;
    document.querySelectorAll("#fuel-seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    drawMap();
  }));
  document.querySelectorAll("#metric-seg button").forEach((b) => b.addEventListener("click", () => {
    metric = b.dataset.m;
    document.querySelectorAll("#metric-seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    drawMap();
  }));
  document.getElementById("comp-only").addEventListener("change", drawMap);
  drawMap();
  document.getElementById("map-rdate").innerHTML = ratingDates();

  // 표
  const COLS = [
    { k: "name", lab: "주", get: (s) => s.name, fmt: (s) => `${s.name} <span class="muted small">${s.code}</span>` },
    { k: "races", lab: "2026 등급(Cook)", get: (s) => (s.competitive ? 0 : s.races.length ? 1 : 2), fmt: (s) => badges(s) },
    { k: "reg", lab: "일반", n: 1, get: (s) => s.price.regular, fmt: (s) => usd(s.price.regular, 3) },
    { k: "reg_w", lab: "1주", n: 1, get: (s) => chg(s, "regular", "week_ago"), fmt: (s) => delta(chg(s, "regular", "week_ago")) },
    { k: "reg_y", lab: "1년", n: 1, get: (s) => chg(s, "regular", "year_ago"), fmt: (s) => delta(chg(s, "regular", "year_ago")) },
    { k: "dsl", lab: "디젤", n: 1, get: (s) => s.price.diesel, fmt: (s) => usd(s.price.diesel, 3) },
    { k: "dsl_w", lab: "1주", n: 1, get: (s) => chg(s, "diesel", "week_ago"), fmt: (s) => delta(chg(s, "diesel", "week_ago")) },
    { k: "dsl_y", lab: "1년", n: 1, get: (s) => chg(s, "diesel", "year_ago"), fmt: (s) => delta(chg(s, "diesel", "year_ago")) },
    { k: "mid", lab: "중급", n: 1, get: (s) => s.price.mid_grade, fmt: (s) => usd(s.price.mid_grade, 3) },
    { k: "pre", lab: "고급", n: 1, get: (s) => s.price.premium, fmt: (s) => usd(s.price.premium, 3) },
  ];
  let sortK = "reg", sortDir = -1;
  const tbl = document.getElementById("tbl");
  function drawTable() {
    const only = document.getElementById("table-comp-only").checked;
    const col = COLS.find((c) => c.k === sortK);
    const rows = S.filter((s) => !only || s.competitive).sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y, "ko") : x - y) * sortDir;
    });
    tbl.innerHTML = `<thead><tr>${COLS.map((c) => `<th class="${c.n ? "n" : ""}" data-k="${c.k}" ${c.k === sortK ? `aria-sort="${sortDir > 0 ? "ascending" : "descending"}"` : ""}>${c.lab}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map((s) => `<tr class="${s.competitive ? "comp" : ""}">${COLS.map((c) => `<td class="${c.n ? "n" : ""}">${c.fmt(s)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    tbl.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
      if (sortK === th.dataset.k) sortDir = -sortDir; else { sortK = th.dataset.k; sortDir = th.classList.contains("n") ? -1 : 1; }
      drawTable();
    }));
  }
  document.getElementById("table-comp-only").addEventListener("change", drawTable);
  drawTable();
  const nRefs = S.filter((s) => Object.keys(s.refs).length).length;
  document.getElementById("tbl-note").innerHTML =
    `1주·1년 변화는 AAA 주별 페이지의 「1주 전」「1년 전」 평균과 비교한 값입니다(${nRefs}/51곳 수집). ` +
    `등급: ${Object.entries(rm).map(([k, v]) => `${RACE[k]} ${v.label} ${v.as_of} 기준(<a href="${v.detail_url}">270toWin 게재본</a>, 270toWin 게시 ${v.posted_at.slice(0, 10)}, 이 사이트 수집 ${v.fetched_at.slice(0, 10)})`).join(" · ") || "불러오지 못함"}.`;
  document.getElementById("foot").innerHTML =
    `자료: <a href="https://gasprices.aaa.com/state-gas-price-averages/">AAA Gas Prices</a> · <a href="https://www.eia.gov/petroleum/gasdiesel/">EIA Gasoline and Diesel Fuel Update</a> · 등급은 <a href="https://www.270towin.com/2026-senate-election/cook-political-report-2026-senate">270toWin 게재 Cook Political Report</a>(상원)·<a href="https://www.270towin.com/2026-governor-election/cook-political-report-2026-governor">(주지사)</a>. 빌드 ${site.built_at}.`;
})();
