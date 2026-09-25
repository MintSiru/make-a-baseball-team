# KBO 신구단

2026년, KBO 11번째 구단의 초대 단장이 되어 창단부터 우승까지 구단을 키우는 운영 시뮬레이션입니다. 설치·서버 없이 HTML 파일 하나로 실행합니다.

현재 버전은 **0.1.0 (기반)**. 창단 첫 드래프트(2027 신인 드래프트, 2026년 9월)의 후보 400명과 스카우팅 리포트를 볼 수 있습니다. 앞으로의 계획은 [`ROADMAP.md`](ROADMAP.md)에 있습니다.

## 실행

```bash
npm ci
npm run build   # dist/index.html 하나가 만들어집니다
```

`dist/index.html`을 브라우저로 열면 됩니다. 개발 중에는 `npm run dev`.

## 테스트

```bash
npm run typecheck
npm test               # 단위 테스트 + Draft Room 1.0.1 동일성 테스트
npm run build && npm run test:browser   # 실제 Chromium, 4개 화면 크기
```

## 구조

```
src/
  draftroom/  Draft Room 1.0.1 코어 이식본 (docs/UPSTREAM.md) + index.ts 타입 창구
  core/       시뮬레이션 버전
  rules/      2026 KBO 규정 설정값 (docs/RULES.md 근거)
  club/       모기업 유형, 구장
  model/      리그 선수·구단·계약 모델, 공개 정보 뷰
  world/      월드 생성
  save/       저장 형식(입력 + 스냅샷), IndexedDB
  ui/         Preact 화면
docs/
  RULES.md        현실 규정 조사표 (출처·확인 수준)
  CALIBRATION.md  리그 지표 목표값
  UPSTREAM.md     Draft Room 이식 출처
```

## 원칙

- **숨은 능력과 공개 평가 분리**: 화면·AI·기사는 스카우팅 리포트만 봅니다 (`publicView`).
- **결정성**: 같은 시드와 같은 선택이면 같은 결과. 결과가 바뀌면 `src/core/version.ts`의 `SIM_VERSION`을 올립니다.
- **현실 규정 우선**: 규정 값은 `src/rules/`에만 두고, 근거를 `docs/RULES.md`에 적습니다.

선수·학교·기록은 모두 가상입니다. 구단명 외에는 실제와 관계없습니다.
