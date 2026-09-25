# Draft Room에서 가져온 코드

`src/draftroom/`은 [KBO-Draft-Room](https://github.com/MintSiru/KBO-Draft-Room)의 게임 코어를 한 번 복사해 온 것입니다. 이후 두 저장소는 따로 발전하며, 원본의 변경을 자동으로 따라가지 않습니다.

| 항목 | 값 |
|---|---|
| 원본 저장소 | `MintSiru/KBO-Draft-Room` |
| 브랜치 | `claude/kbo-draft-game-refactor-wngav3` |
| 커밋 | `df4faaddb057b1da92d8762976fdb5a545bb4460` (1.0.1) |
| 원본 경로 | `src/core/*.js` (17개 파일) |
| 가져온 날 | 2026-09-25 |
| 시뮬레이션 버전 | Draft Room `SIM_VERSION` 1.0 |

## 무엇을 바꿨나

모듈 포장만 바꿨습니다. 안쪽 코드는 한 글자도 고치지 않았습니다.

- 원본은 `(function (root) { … })(window)` IIFE가 `window.DraftXxx` 전역에 등록하고, Node에서는 `require()`로 읽는 방식입니다.
- `scripts/port-draftroom.py`가 이 포장을 ES 모듈 `import` / `export default`로 바꾸고 들여쓰기 두 칸을 걷어 냅니다.
- 다시 가져와야 하면 원본을 위 커밋으로 체크아웃한 뒤 `python3 scripts/port-draftroom.py <원본 경로>`를 실행합니다.

## 같다는 증거

`tests/draftroom-parity.test.ts`가 Draft Room의 golden master(`tests/fixtures/draftroom-golden.json`, 원본 `tests/fixtures/golden.json` 복사본)를 이 저장소의 코드로 다시 계산합니다.

- 선수 풀 3개, 구단·난이도·지역 1차 설정이 다른 10시즌 완주 게임 6개
- `sim`(시뮬레이션 값)과 `full`(문장 포함 전체) 해시 모두 일치

## 원본과 달라질 때

리그 규모로 넓히면서 `src/draftroom/`을 고치게 되면 이 동일성 테스트가 깨집니다. 그때는:

1. 바뀐 내용을 아래 "이식 후 변경" 목록에 적고,
2. 동일성 테스트를 이 게임 자체의 golden 테스트로 옮기고, 이 게임의 `SIM_VERSION`을 올립니다.

원본 설계 설명은 `docs/draftroom/ANALYSIS.md`(원본 `docs/ANALYSIS.md` 복사본)에 있습니다.

## 이식 후 변경

`src/draftroom/*.js`는 그대로입니다. 이 게임 쪽에서 붙인 것은 타입 창구 `src/draftroom/index.ts`뿐이며, 리그 계층은 이 창구를 통해 `developTools`(성장·노화), `observe`(스카우트 관측), 선수 풀 생성 등을 호출합니다. 노화는 35세 이상 베테랑용 하락을 리그 쪽(`src/league/offseason.ts`)에서 덧붙였습니다.
