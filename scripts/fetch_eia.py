#!/usr/bin/env python3
"""EIA 주간 소매 휘발유·디젤 가격 전체 시계열을 받아 data/eia_weekly.json 으로 저장.

원자료(키 불필요, 매주 월요일 가격, 보통 월요일 오후~화요일 발표):
 - 휘발유 https://www.eia.gov/petroleum/gasdiesel/xls/pswrgvwall.xls  'Data 3' = Regular · All Formulations (1990-08-20~)
 - 디젤   https://www.eia.gov/petroleum/gasdiesel/xls/psw18vwall.xls   'Data 1' = No 2 Diesel (1994-03-21~)
지역: 휘발유는 전국·PADD·주 9곳(CA CO FL MA MN NY OH TX WA)·도시 10곳, 디젤은 전국·PADD·CA뿐.
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "data", "eia_weekly.json")
SOURCES = {
    "gasoline": ("https://www.eia.gov/petroleum/gasdiesel/xls/pswrgvwall.xls", "Data 3", "Regular Gasoline, All Formulations"),
    "diesel": ("https://www.eia.gov/petroleum/gasdiesel/xls/psw18vwall.xls", "Data 1", "No 2 Diesel"),
}
AREAS = {
    "NUS": "미국 전체", "R10": "동부 해안(PADD 1)", "R1X": "뉴잉글랜드(PADD 1A)", "R1Y": "중부 대서양(PADD 1B)",
    "R1Z": "남부 대서양(PADD 1C)", "R20": "중서부(PADD 2)", "R30": "멕시코만 연안(PADD 3)", "R40": "로키산맥(PADD 4)",
    "R50": "서부 해안(PADD 5)", "R5XCA": "서부 해안(캘리포니아 제외)",
    "SCA": "캘리포니아", "SCO": "콜로라도", "SFL": "플로리다", "SMA": "매사추세츠", "SMN": "미네소타",
    "SNY": "뉴욕주", "SOH": "오하이오", "STX": "텍사스", "SWA": "워싱턴주",
    "YBOS": "보스턴", "YORD": "시카고", "YCLE": "클리블랜드", "YDEN": "덴버", "Y44HO": "휴스턴",
    "Y05LA": "로스앤젤레스", "YMIA": "마이애미", "Y35NY": "뉴욕시", "Y05SF": "샌프란시스코", "Y48SE": "시애틀",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def parse(raw: bytes, sheet: str) -> dict:
    df = pd.read_excel(io.BytesIO(raw), sheet_name=sheet, header=None, engine="xlrd")
    keys = [str(k) for k in df.iloc[1, :].tolist()]  # 행 1 = Sourcekey, 예: EMM_EPMR_PTE_NUS_DPG
    cols = {k.split("_")[3]: i for i, k in enumerate(keys) if k.count("_") >= 4}
    body = df.iloc[3:, :]
    body = body[pd.to_datetime(body[0], errors="coerce").notna()]
    weeks = pd.to_datetime(body[0]).dt.strftime("%Y-%m-%d").tolist()
    series = {}
    for area, i in cols.items():
        series[area] = [None if pd.isna(v) else round(float(v), 3) for v in body[i].tolist()]
    return {"weeks": weeks, "series": series}


def main() -> int:
    out = {"fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "unit": "USD/gallon",
           "areas": AREAS, "products": {}}
    for prod, (url, sheet, label) in SOURCES.items():
        d = parse(fetch(url), sheet)
        unknown = sorted(set(d["series"]) - set(AREAS))
        if unknown:
            print(f"[warn] {prod}: 이름 없는 지역 코드 {unknown}", file=sys.stderr)
        d.update({"label": label, "source_url": url})
        out["products"][prod] = d
        print(f"{prod}: {len(d['weeks'])}주 {d['weeks'][0]}~{d['weeks'][-1]}, 지역 {len(d['series'])}, "
              f"전국 최신 {d['series']['NUS'][-1]}")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
