#!/usr/bin/env python3
"""AAA 주별 평균 유가(50개 주 + DC, Regular·Mid-Grade·Premium·Diesel)를 하루 1회 기록.

1) https://gasprices.aaa.com/state-gas-price-averages/  한 페이지 → data/aaa_daily.csv (date,state,...)
2) --refs: 주별 페이지 https://gasprices.aaa.com/?state=XX 51곳의 「어제·1주 전·1달 전·1년 전」 평균
   → data/aaa_refs.csv (date,state,period,...). robots.txt Crawl-delay 10초를 지킨다(약 9분).
같은 날 다시 돌리면 그날 행을 덮어쓴다. 표준 라이브러리만 사용.
"""
from __future__ import annotations

import csv
import os
import re
import sys
import time
import urllib.request
from datetime import datetime

ROOT = os.path.join(os.path.dirname(__file__), "..")
DAILY = os.path.join(ROOT, "data", "aaa_daily.csv")
REFS = os.path.join(ROOT, "data", "aaa_refs.csv")
ALL_URL = "https://gasprices.aaa.com/state-gas-price-averages/"
STATE_URL = "https://gasprices.aaa.com/?state={}"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")
FUELS = ["regular", "mid_grade", "premium", "diesel"]
PERIODS = {"Current": "current", "Yesterday": "yesterday", "Week Ago": "week_ago",
           "Month Ago": "month_ago", "Year Ago": "year_ago"}
CRAWL_DELAY = 10


def get(url: str) -> str:
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html",
                                                       "Accept-Language": "en-US,en;q=0.9"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 — 네트워크 오류는 재시도 후 그대로 보고
            last = e
            time.sleep(CRAWL_DELAY * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def price(s: str) -> str:
    m = re.search(r"\$\s*([\d.]+)", s)
    return m.group(1) if m else ""


def as_of_date(html: str) -> str:
    m = re.search(r"Price as of (\d{1,2})/(\d{1,2})/(\d{2})", html)
    if not m:
        raise RuntimeError("'Price as of' 날짜를 찾지 못함 — 페이지 구조 변경 확인")
    mo, d, y = (int(x) for x in m.groups())
    return f"{2000 + y:04d}-{mo:02d}-{d:02d}"


def parse_all(html: str) -> list[dict]:
    tbody = html[html.find('id="sortable"'):]
    tbody = tbody[:tbody.find("</table>")]
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", tbody, flags=re.S):
        st = re.search(r"\?state=([A-Z]{2})", tr)
        if not st:
            continue
        tds = re.findall(r'<td class="(regular|mid_grade|premium|diesel)"[^>]*>(.*?)</td>', tr, flags=re.S)
        vals = {cls: price(v) for cls, v in tds}
        rows.append({"state": st.group(1), **{f: vals.get(f, "") for f in FUELS}})
    return rows


def parse_state(html: str) -> list[dict]:
    out = []
    for label, body in re.findall(r"<td>\s*(Current|Yesterday|Week Ago|Month Ago|Year Ago) Avg\.\s*</td>(.*?)</tr>",
                                  html, flags=re.S):
        ps = re.findall(r"\$\s*([\d.]+)", body)
        if len(ps) == 4:
            out.append({"period": PERIODS[label], **dict(zip(FUELS, ps))})
        if len(out) == 5:  # 첫 표(주 평균)만. 아래쪽 도시별 표는 쓰지 않는다
            break
    return out


def upsert(path: str, fields: list[str], date: str, new_rows: list[dict]) -> None:
    old = []
    if os.path.exists(path):
        with open(path, newline="", encoding="utf-8") as f:
            old = [r for r in csv.DictReader(f) if r["date"] != date]
    rows = old + [{"date": date, **r} for r in new_rows]
    rows.sort(key=lambda r: (r["date"], r["state"], r.get("period", "")))
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    html = get(ALL_URL)
    date = as_of_date(html)
    rows = parse_all(html)
    blanks = [r["state"] for r in rows if not all(r[f] for f in FUELS)]
    print(f"AAA {date}: {len(rows)}곳" + (f", 빈 값 {blanks}" if blanks else ""))
    if len(rows) != 51:
        print(f"[error] 51곳이어야 하는데 {len(rows)}곳 — 저장하지 않음", file=sys.stderr)
        return 1
    upsert(DAILY, ["date", "state"] + FUELS, date, rows)

    if "--refs" in sys.argv:
        refs, failed = [], []
        for r in rows:
            time.sleep(CRAWL_DELAY)
            try:
                got = parse_state(get(STATE_URL.format(r["state"])))
            except RuntimeError as e:
                print(f"[warn] {e}", file=sys.stderr)
                got = []
            if len(got) != 5:
                failed.append(r["state"])
            refs += [{"state": r["state"], **g} for g in got]
        print(f"refs: {len(refs)}행" + (f", 실패 {failed}" if failed else ""))
        upsert(REFS, ["date", "state", "period"] + FUELS, date, refs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
