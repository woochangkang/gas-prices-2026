#!/usr/bin/env python3
"""270toWin에 재게시된 Cook Political Report 2026 상원·주지사 등급 → data/ratings.json

해독 규칙은 us_elections 저장소 scripts/fetch_senate_ratings.py·fetch_governor_ratings.py 와 같다
(map_string = 주 약자 알파벳순, 상원은 주×2석+1자 · 주지사는 주당 1자, 9 = 미선거,
코드표는 270toWin map.class.js `mapCodeRatings` 전사).
날짜 두 가지를 따로 남긴다:
  as_of     = 지도 설명의 "As of …" — Cook 등급 자체의 기준일
  posted_at = 270toWin이 그 지도를 올린 시각(date_created)
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "data", "ratings.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")
CODE = {"0": "Toss-up", "1": "Solid D", "2": "Solid R", "3": "Likely D", "4": "Likely R",
        "5": "Lean D", "6": "Lean R", "a": "Tilt D", "b": "Tilt R"}
ABBR = sorted(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
               "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND",
               "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"])
RACES = {
    "senate": ("https://www.270towin.com/2026-senate-election/", "cook-political-report-2026-senate"),
    "governor": ("https://www.270towin.com/2026-governor-election/", "cook-political-report-2026-governor"),
}
GOV_NO_RACE = {"DE", "IN", "KY", "LA", "MO", "MS", "MT", "NC", "ND", "NJ", "UT", "VA", "WA", "WV"}
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "ignore").replace("\\/", "/").replace('\\"', '"')


def parse_as_of(desc: str) -> str | None:
    m = re.search(r"As of ([A-Za-z]+)\.? (\d{1,2}), (\d{4})", desc)
    if not m or m.group(1)[:3].lower() not in MONTHS:
        return None
    return f"{int(m.group(3)):04d}-{MONTHS[m.group(1)[:3].lower()]:02d}-{int(m.group(2)):02d}"


def decode(race: str, html: str, s: str) -> dict:
    if race == "governor":
        if len(s) != 50 or {ABBR[i] for i, c in enumerate(s) if c == "9"} != GOV_NO_RACE:
            raise ValueError("주지사 map_string 길이·미선거 주 불일치")
        return {ab: CODE.get(c) for ab, c in zip(ABBR, s) if c != "9"}
    seats = re.findall(r'\{"state_abbr":"([A-Z]{2})","state_name":"[^"]+","seat_status":"T",'
                       r'"state_fips_code":"\d+","seat_number":(\d+)', html)
    if len(s) != 101 or not seats:
        raise ValueError("상원 map_string 길이 또는 선거석 메타 이상")
    idx = {ABBR.index(ab) * 2 + int(n) - 1: ab for ab, n in seats}
    nine = {i for i, c in enumerate(s[:100]) if c == "9"}
    if set(idx) & nine or (set(range(100)) - set(idx)) - nine:
        raise ValueError("상원 정렬 불일치 — 다른 종류의 지도로 보임")
    out = {}
    for i, ab in sorted(idx.items()):
        out.setdefault(ab, []).append(CODE.get(s[i]))
    # 한 주에 두 석(정규+보궐)이 걸리면 더 경합인 쪽을 앞에 둔다
    order = ["Toss-up", "Tilt D", "Tilt R", "Lean D", "Lean R", "Likely D", "Likely R", "Solid D", "Solid R", None]
    return {ab: sorted(v, key=order.index)[0] if len(v) == 1 else sorted(v, key=order.index)
            for ab, v in out.items()}


def main() -> int:
    res = {"fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "label": "Cook Political Report", "races": {}}
    for race, (url, slug) in RACES.items():
        html = get(url)
        obj = re.search(r'\{[^{}]*"url_title":"' + re.escape(slug) + r'"[^{}]*\}', html)
        if not obj:
            print(f"[error] {race}: Cook 지도 없음", file=sys.stderr)
            return 1
        o = obj.group(0)
        s = re.search(r'"map_string":"([0-9a-z]+)"', o).group(1)
        desc = re.search(r'"description":"(.*?)","hashid"', o)
        detail = re.search(r'href="([^"]+)"', desc.group(1)) if desc else None
        res["races"][race] = {
            "as_of": parse_as_of(desc.group(1)) if desc else None,
            "posted_at": re.search(r'"date_created":"([^"]+)"', o).group(1),
            "detail_url": (detail.group(1).replace("http://", "https://") if detail else url),
            "page_url": url,
            "ratings": decode(race, html, s),
        }
        r = res["races"][race]
        print(f"{race}: Cook as of {r['as_of']} · 270toWin 게시 {r['posted_at']} · {len(r['ratings'])}곳")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
