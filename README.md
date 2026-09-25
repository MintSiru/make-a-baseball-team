# KBO 신구단

2026년, KBO 11번째 구단의 초대 단장이 되어 창단부터 우승까지 구단을 키우는 운영 시뮬레이션입니다. 설치·서버 없이 HTML 파일 하나로 실행합니다.

현재 버전은 **0.7.0 (이야기와 기록)**. 브라우저에서 바로 플레이: https://mintsiru.github.io/make-a-baseball-team/  2026년 7월 연고지·모기업·구장·1군 진입 방식을 골라 구단을 창단하고, 트라이아웃·우선지명·특별지명·FA 특례로 선수단을 꾸려 11구단 체제의 1군에 들어갑니다. 그 뒤로는 해마다 신인 드래프트와 계약금 협상, 육성선수 계약, 병역, FA 재계약, 스프링캠프 계획을 정하고, 시즌 중에는 1군 등록·말소와 퓨처스·잔류군 배치를 직접 하거나 감독에게 맡깁니다. 겨울에는 연봉 협상·연봉 조정, FA 시장(등급제·보상선수), 외국인 재계약, 격년 2차 드래프트를 치르고, 시즌 중에는 트레이드(7월 31일 마감)·방출·웨이버·외국인 교체를 하며 경쟁균형세를 관리합니다. 구단 운영에서는 모기업 목표와 평가, 시즌 결산(입장·중계권·스폰서·상품 / 연봉·스태프·구장), 티켓 가격과 마케팅, 감독·코치·스카우트 등 스태프, 구장 증축·신축을 다룹니다. 경기마다 기록지와 문자중계(처음부터 관전), 한눈에 보는 라인업, 뉴스·인터뷰·팬 반응, 시상·기록실·명예의 전당, 구단 연표와 업적이 있고, 원하면 본인 API 키로 Claude·GPT·Gemini가 기사를 다시 씁니다(키는 저장하지 않음). 2026년부터는 모든 구단과 상무가 퓨처스리그를 치르고, 어린 선수는 뛴 만큼 자랍니다. 구단 없이 리그만 관전할 수도 있습니다. 앞으로의 계획은 [`ROADMAP.md`](ROADMAP.md)에 있습니다.

리그 기록은 2021~2025 실제 KBO 리그 평균에 맞춰 조정했습니다 ([`docs/CALIBRATION.md`](docs/CALIBRATION.md)).

## 실행

```bash
npm ci
npm run build   # dist/index.html 하나가 만들어집니다
```

`dist/index.html`을 브라우저로 열면 됩니다. 개발 중에는 `npm run dev`.

GitHub Pages로 배포하려면 저장소 설정 → Pages → Source를 "GitHub Actions"로 바꾸면, main 브랜치에 올라갈 때마다 `.github/workflows/pages.yml`이 빌드해서 올립니다.

## 테스트

```bash
npm run typecheck
npm test               # 단위·리그·밸런스·golden 테스트 + Draft Room 1.0.1 동일성 테스트
npm run build && npm run test:browser   # 실제 Chromium: 창단부터 1군 진입, 정렬·직접 엔트리 관리까지, 4개 화면 크기
```

밸런스를 바꿀 때:

```bash
npm run calibrate            # 2026 시즌 리그 기록을 2025 실제 값과 비교
npm run report -- seed 2025  # 2015~2025 시즌별 리그 기록·연봉
# 결과가 바뀌면 src/core/version.ts의 SIM_VERSION을 올린 뒤
npm run golden:write
```

실제 기록 데이터는 `python3 scripts/fetch-kbo-stats.py 2021 2022 2023 2024 2025`로 다시 받을 수 있습니다.

## 구조

```
src/
  draftroom/  Draft Room 1.0.1 코어 이식본 (docs/UPSTREAM.md) + index.ts 타입 창구
  core/       시뮬레이션 버전
  league/     리그: 경기 엔진, 일정·순위·포스트시즌, AI 감독, 시즌·단계별 오프시즌, 퓨처스리그(futures.ts), 과거 시뮬레이션, 창단(expansion.ts), 해마다의 결정(userclub.ts), 엔트리(entry.ts), 튜닝
  worker/     리그 생성·긴 진행을 돌리는 Web Worker
  rules/      2026 KBO 규정 설정값 (docs/RULES.md 근거)
  club/       모기업 유형, 구장, 창단 연고지 후보
  model/      리그 선수·구단·계약 모델, 공개 정보 뷰
  world/      월드 생성
  save/       저장 형식(입력 + 스냅샷), IndexedDB
  ui/         Preact 화면
data/
  kbo-league-stats.json  KBO 기록실 팀 기록 2021~2025
docs/
  RULES.md        현실 규정 조사표 (출처·확인 수준)
  CALIBRATION.md  리그 지표 목표값
  UPSTREAM.md     Draft Room 이식 출처
```

## 원칙

- **숨은 능력과 공개 평가 분리**: 화면·AI·기사는 스카우팅 리포트만 봅니다 (`publicView`).
- **결정성**: 같은 시드와 같은 선택이면 같은 결과. 결과가 바뀌면 `src/core/version.ts`의 `SIM_VERSION`을 올립니다.
- **현실 규정 우선**: 규정 값은 `src/rules/`에만 두고, 근거를 `docs/RULES.md`에 적습니다.

선수·학교·기록은 모두 가상입니다. 구단명과 구장 외에는 실제와 관계없고, 2025년까지의 리그 역사도 게임이 만든 가상 역사입니다.
