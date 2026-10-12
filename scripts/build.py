#!/usr/bin/env python3
"""수집 결과를 사이트용 data/site.json 으로 합친다(개요·주별 표가 읽음).

- AAA: 최신일 51곳 4종 + 그날의 비교값(어제·1주·1달·1년 전) + 주별 일일 이력(수집 시작일부터)
- 경합 표시: fetch_ratings.py가 270toWin에서 받은 Cook Political Report 상원·주지사 등급(data/ratings.json)
  경합 = Toss-up 또는 Lean(양당). as_of = Cook 기준일, posted_at = 270toWin 게시 시각, fetched_at = 수집 시각.
- EIA: 장기 추세 페이지는 data/eia_weekly.json 을 직접 읽으므로 여기서는 최신 주 요약만.
"""
from __future__ import annotations

import csv
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), "..")
D = lambda *p: os.path.join(ROOT, "data", *p)  # noqa: E731
COMPETITIVE = {"Toss-up", "Lean D", "Lean R"}
FUELS = ["regular", "mid_grade", "premium", "diesel"]
NAMES = {
    "AK": "알래스카", "AL": "앨라배마", "AR": "아칸소", "AZ": "애리조나", "CA": "캘리포니아", "CO": "콜로라도",
    "CT": "코네티컷", "DC": "워싱턴 D.C.", "DE": "델라웨어", "FL": "플로리다", "GA": "조지아", "HI": "하와이",
    "IA": "아이오와", "ID": "아이다호", "IL": "일리노이", "IN": "인디애나", "KS": "캔자스", "KY": "켄터키",
    "LA": "루이지애나", "MA": "매사추세츠", "MD": "메릴랜드", "ME": "메인", "MI": "미시간", "MN": "미네소타",
    "MO": "미주리", "MS": "미시시피", "MT": "몬태나", "NC": "노스캐롤라이나", "ND": "노스다코타", "NE": "네브래스카",
    "NH": "뉴햄프셔", "NJ": "뉴저지", "NM": "뉴멕시코", "NV": "네바다", "NY": "뉴욕", "OH": "오하이오",
    "OK": "오클라호마", "OR": "오리건", "PA": "펜실베이니아", "RI": "로드아일랜드", "SC": "사우스캐롤라이나",
    "SD": "사우스다코타", "TN": "테네시", "TX": "텍사스", "UT": "유타", "VA": "버지니아", "VT": "버몬트",
    "WA": "워싱턴주", "WI": "위스콘신", "WV": "웨스트버지니아", "WY": "와이오밍",
}


def num(s: str):
    return round(float(s), 3) if s not in ("", None) else None


def read_csv(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def ratings() -> dict:
    path = D("ratings.json")
    if not os.path.exists(path):
        print("[warn] data/ratings.json 없음 — 경합 표시 없이 빌드", file=sys.stderr)
        return {}
    feed = json.load(open(path, encoding="utf-8"))
    return {race: {"label": feed["label"], "fetched_at": feed["fetched_at"], **r} for race, r in feed["races"].items()}


def main() -> int:
    daily = read_csv(D("aaa_daily.csv"))
    if not daily:
        print("[error] data/aaa_daily.csv 없음", file=sys.stderr)
        return 1
    latest = max(r["date"] for r in daily)
    history = defaultdict(lambda: {"dates": [], **{f: [] for f in FUELS}})
    for r in sorted(daily, key=lambda r: r["date"]):
        h = history[r["state"]]
        h["dates"].append(r["date"])
        for f in FUELS:
            h[f].append(num(r[f]))
    refs = defaultdict(dict)
    for r in read_csv(D("aaa_refs.csv")):
        if r["date"] == latest:
            refs[r["state"]][r["period"]] = {f: num(r[f]) for f in FUELS}

    rt = ratings()
    states = []
    for r in daily:
        if r["date"] != latest:
            continue
        st = r["state"]
        races = []
        for race, src in rt.items():
            lab = src["ratings"].get(st)
            for one in (lab if isinstance(lab, list) else [lab] if lab else []):
                races.append({"race": race, "rating": one, "competitive": one in COMPETITIVE})
        states.append({"code": st, "name": NAMES.get(st, st), "price": {f: num(r[f]) for f in FUELS},
                       "refs": refs.get(st, {}), "races": races,
                       "competitive": any(x["competitive"] for x in races)})
    states.sort(key=lambda s: s["code"])

    eia = json.load(open(D("eia_weekly.json"), encoding="utf-8"))
    eia_latest = {}
    for prod, p in eia["products"].items():
        us = p["series"]["NUS"]
        eia_latest[prod] = {"week": p["weeks"][-1], "us": us[-1], "week_ago": us[-2], "year_ago": us[-53]}

    site = {"built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "aaa_date": latest,
            "aaa_first_date": min(r["date"] for r in daily), "states": states, "history": history,
            "ratings_meta": {k: {x: v[x] for x in ("label", "as_of", "posted_at", "detail_url", "fetched_at")} for k, v in rt.items()},
            "eia_latest": eia_latest, "eia_fetched_at": eia["fetched_at"]}
    with open(D("site.json"), "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, separators=(",", ":"))
    n_ref = sum(1 for s in states if s["refs"])
    print(f"site.json: AAA {latest} {len(states)}곳(비교값 {n_ref}곳), 경합 {sum(s['competitive'] for s in states)}곳, "
          f"등급 {list(rt)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
