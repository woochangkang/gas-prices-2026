# 미국 유가 트래커 (gas-prices-2026)

미국 50개 주 + D.C.의 휘발유·디젤 평균 가격. AAA 일일 주별 평균 + EIA 주간 장기 시계열, 2026 중간선거 경합주(Cook 상원·주지사 Toss-up/Lean) 표시.

- 사이트: https://woochangkang.github.io/gas-prices-2026/
- 갱신: `.github/workflows/update.yml` — 매일 23:00 KST (AAA 51곳 + 주별 비교값, EIA 엑셀 재다운로드) → `data/` 커밋 → Pages 배포

## 파이프라인
| 스크립트 | 산출 | 비고 |
|---|---|---|
| `scripts/fetch_aaa.py [--refs]` | `data/aaa_daily.csv`, `data/aaa_refs.csv` | 51곳이 다 안 잡히면 저장 안 함. robots.txt Crawl-delay 10초 준수(--refs 약 9분) |
| `scripts/fetch_eia.py` | `data/eia_weekly.json` | pswrgvwall.xls(Data 3 Regular) · psw18vwall.xls(Data 1 No 2 Diesel), 키 불필요 |
| `scripts/fetch_ratings.py` | `data/ratings.json` | 270toWin 게재 Cook 상원·주지사. as_of=「As of」(Cook 기준일), posted_at=270toWin 게시 |
| `scripts/build.py` | `data/site.json` | 위 세 파일 병합 |

정적 페이지: `index.html`(개요·타일 지도·표), `trends.html`(EIA 장기·지역·AAA 일일), `about.html`(출처·방법). 로컬 확인: `python3 -m http.server`.

## 확인된 데이터 사실 (2026-10-12)
- EIA 휘발유 주 단위 = CA·CO·FL·MA·MN·NY·OH·TX·WA 9곳뿐, 디젤 주 단위 = CA뿐. 나머지 주는 AAA로만.
- AAA는 과거 일별 주 평균 아카이브 없음(추정) → 일일 기록은 2026-10-12부터. 그 이전은 주별 페이지의 어제·1주·1달·1년 전 값.
- AAA는 기본 curl UA에 403, 브라우저 UA로는 200.
