# 영어·일본어 현지화 QA 보고서

브랜치 `i18n/qa-review` · 기준: 현지화 체크포인트 2단계(번역 배치 31개, 키 6,505개 × ko/en/ja, 인명 1,360개)

## 1. 요약

| 자동 검사 (`npm run i18n:check`) | Critical | Major | Minor |
|---|---|---|---|
| 첫 실행 | 10 | 126 | 625 |
| 현재 | **0** | **0** | 628 (참고용 후보: 라벨 길이 601, 엔진 오류 문구 26, 다른 낱말인 チェン/チェーン 1) |

| 수정 | Critical | Major | Minor | 계 |
|---|---|---|---|---|
| 번역 수정 (`qa-changes.json`) | 13 | 100 | 53 | 166 |
| 추출이 놓친 문구 (키 추가·코드) | — | 48 | — | 48 |

판단 보류는 10건입니다(3장).

- **번역 수정 166건**: Critical 13, Major 100, Minor 53. 모두 `docs/localization/qa-changes.json`에 키·언어·수정 전·수정 후·사유와 함께 남겼고, 2장에 표로 옮겼습니다.
- **추출이 놓친 한국어 48곳**: 화면에 그대로 나오던 문구와 코드에서 이어 붙이던 문자중계 줄입니다. 기존 규칙(`그룹.문맥.sha1`)으로 키 47개를 새로 만들고, 값 사이에 끊겨 있던 5곳은 키 하나로 묶었습니다. 한국어 출력은 그대로입니다.
- **en/ja로 실제 화면 연결**
  - 언어 선택: 시작 화면과 화면 설정에 있고, 브라우저 설정이라 저장 파일에는 들어가지 않습니다.
  - 저장된 기사·리포트·인명·금액은 화면에 그리는 순간에 번역합니다. 시뮬레이션과 저장 데이터는 한국어 원문 그대로입니다.
  - 일본어 글꼴을 우선 적용했습니다.
- **화면 점검 결과** (en/ja × 데스크톱 1440px·휴대폰 390px)
  - 시즌 중 저장과 FA 시장 저장으로 모든 탭과 하위 화면을 돌았습니다. 선수 상세, 박스스코어·문자중계, FA 협상도 포함했습니다.
  - 가로 스크롤은 1곳(영어 포스트시즌 대진표)이었고 고쳤습니다.
  - 잘린 라벨과 두부(□) 문자는 없었습니다.
  - 화면에 남은 한국어는 대부분 코드에서 조각을 이어 붙여 만든 기사 문장입니다(3장).
- **회귀**
  - 한국어 화면과 저장, 시뮬레이션 결과는 바뀌지 않았습니다(골든 테스트 통과).
  - 이전 버전 저장 파일도 그대로 열립니다(compat 테스트 통과).

## 2. 수정 내역

### 2-1. 번역 수정 (166건)

분류별 건수:

| 분류 | 건수 |
|---|---|
| 영어 복수형 | 51 |
| 금액 표기 | 27 |
| 용어 일관성 | 22 |
| 스타일(UI 라벨 대소문자 등) | 22 |
| 야구 용어 | 15 |
| 오역·누락 | 12 |
| 인명 | 9 |
| 플레이스홀더 깨짐 | 6 |
| 로직 문자열 | 2 |

주요 수정:

- **플레이스홀더 깨짐(Critical 6)**: 영어 6곳이 `'{label}'`처럼 작은따옴표로 값을 감쌌습니다. ICU는 이를 글자 그대로 읽어 화면에 `{label}`이 그대로 나옵니다. `"{label}"`로 바꿨습니다.
- **성씨 '이' 누락(Critical 2)**: 모기업 회장 성씨 '이'가 조사 '이'와 같은 해시로 처리되어 en/ja 값이 비어 있었습니다. Lee/イ로 채웠습니다.
- **RNG 시드(Critical 2)**: `{seed}-school-event-…` 두 개가 표시용 리소스로 추출되어 있었습니다. 번역되면 생성 결과가 바뀝니다. 코드에 원래 리터럴을 되돌리고 키를 지웠습니다(생성 결과는 그대로이며 parity 테스트 통과).
- **금액(Critical 3, Major 24)**
  - `₩{value}0K`는 값에 쉼표가 들어가면 깨집니다("₩3,0000K"). `{value} × $10K`, `Pop. {value}0K`도 같은 문제입니다. 이제 런타임이 금액을 만들고(₩350M, $400K, 11M), 영어 값에는 `{value}`만 둡니다.
  - 이미 금액 문자열이 들어오는 파라미터(usd()/eok()/money())에 단위를 또 붙여 "$$400K", "40万ドルドル"가 되던 12곳을 고쳤습니다.
- **오역·누락(12)**
  - 일본어 선수단 탭·제목 4곳이 '選手間'이었습니다. 올스타 '선수단 투표(選手間投票)'와 해시가 같아 함께 옮겨진 것으로, 選手一覧로 바꿨습니다(올스타 쪽은 그대로).
  - 샐러리캡을 luxury tax로 옮긴 곳 2곳.
  - '샐러리캡처럼'과 '부진으로'가 빠진 튜토리얼.
  - '상무·현역 대신'이 빠진 문장.
  - '1라운드 9순위 하락'을 "9순위로"로 옮긴 곳(실제로는 9계단 하락).
  - 타격 라인 앞에 ".AVG"가 붙은 곳.
- **야구 용어**
  - 골든글러브: Gold Glove → Golden Glove(KBO 시상명).
  - 2차 드래프트: Second Draft로 통일.
  - 투수 결정: Win/Loss/Save/Hold.
  - 상대 타석: BF.
  - 승리 기록판: "Victory" → Wins.
  - 문자중계: "Double down left field line" → "Double down the left-field line"(3곳).
- **일관성**
  - ウェイバー → ウェーバー(11건).
  - ロスター → ロースター.
  - プロバイダ → プロバイダー.
  - 문자중계: 一球速報로 통일.
- **인명**
  - 한국 이름 영문을 Min-Jun에서 Min-jun으로 바꿨습니다(425개, KBO·언론 표기).
  - '잭'의 두 표기를 Jack으로 통일했습니다.
  - [확인 필요] 시드니 → Sidney, 하이트 → Hite, 이순신BC → Yi Sun-sin BC.

전체 표: 아래 2-3.

### 2-2. 코드·구조 변경

| 항목 | 내용 |
|---|---|
| `src/i18n/runtime.ts` (새 파일) | en/ja 런타임(화면 전용, 워커와 저장에는 들어가지 않음). 4장 참고 |
| `src/i18n/index.ts` | `t()`/`rich()`가 표시 언어를 따르고, 없는 키는 한국어로 대체합니다. `k()`는 늘 한국어 원문입니다 |
| `src/i18n/runtime.ts` 인명 | 대만 이름(붙여 쓰는 성+이름)이 성·이름 모두 이름표에 있으면, 게임에 등록되지 않은 사람(외국인 교체 후보)도 이름으로 읽습니다("우성허" → Wu Sheng-Ho). 두 부분이 다 이름표에 있는 한국어 낱말은 리소스에 없음을 확인했습니다 |
| `src/ui/LanguagePicker.tsx` | 언어 선택(한국어 / English / 日本語). 각 언어를 그 언어 이름으로 표시합니다 |
| `src/i18n/param-hints.json`, `scripts/i18n-hints.mjs` | 추출 메타데이터에서 뽑은 파라미터 단서(뒤에 붙는 조사, 가능한 값)로, 저장된 문장을 되짚을 때 씁니다 |
| 놓친 문구 48곳 | 키 47개 추가(라벨·오류 메시지·문자중계 줄). Lineup·Leaders·Decision·FaMarket의 끊긴 문장 5곳은 키 하나로 바꿈 |
| `src/league/playtext.ts` | 문자중계 한 줄(`이름: 결과 · N점`)을 템플릿 문자열 대신 키 두 개로 만듦(한국어 결과 동일). 전에는 화면에서 "Second Baseman Ground ball", "Infield Hits · 1 pts"처럼 낱말 단위로 잘못 읽혔습니다. 쓰이지 않게 된 ` · {runs}점` 키는 지움 |
| `src/draftroom/prospects.js` | RNG 시드 리터럴 복원(위) |
| `src/ui/styles.css` | `:lang(ja)`에서 일본어 글꼴 우선. 휴대폰 영어에서 대진표 단계 상자가 두 줄로 내려가게 함 |
| `scripts/i18n-check.mjs`, `src/i18n/glossary.json` | 검사 스크립트와 용어집(7장) |
| `tests/i18n.test.ts`, `tests/browser/locales.mjs` | 런타임 단위 테스트, en/ja 화면 점검·스크린샷 |

### 2-3. 번역 수정 전체 표

| # | 심각도 | 분류 | 키 | 언어 | 수정 전 | 수정 후 | 사유 |
|---|---|---|---|---|---|---|---|
| 1 | Critical | 로직 문자열 | `draftroom.prospects.schoolHonors.r.2147c880` | ko/en/ja | {seed}-school-event-전국 대학대회 | (key removed; literal restored in src/draftroom/prospects.js) | RNG seed string extracted as display text: a translation would change the generated players. Restored to the original code; the k() call returned the same string, so generation was unchanged either way |
| 2 | Critical | 로직 문자열 | `draftroom.prospects.schoolHonors.rj.91b38c0c` | ko/en/ja | {seed}-school-event-2년제 | (key removed; literal restored in src/draftroom/prospects.js) | RNG seed string extracted as display text: a translation would change the generated players. Restored to the original code; the k() call returned the same string, so generation was unchanged either way |
| 3 | Critical | 금액 | `ui.format.moneyShort.cd1481f0` | en | ₩{value}0K | {value} | "₩{value}0K" with value "3,000" read ₩3,0000K; the runtime formats the 만 원 amount (₩30M) |
| 4 | Critical | 금액 | `ui.format.money.cd1481f0` | en | ₩{value}0K | {value} | "₩{value}0K" with value "3,000" read ₩3,0000K; the runtime formats the 만 원 amount (₩30M) |
| 5 | Critical | 금액 | `ui.format.money.a0e34170` | en | {eok} ₩{value}0K | {eok}{value} | "1억 7,500만" is one amount: the runtime puts ₩175M in {eok} and empties {value} (was "1 ₩7,5000K") |
| 6 | Critical | 인명 | `league.parent.sURNAMES.6c0cd2af` | en |  | Lee | Surname 이 was emptied as if it were the particle 이 (same hash as league.josa.iga); owners' names lost their surname |
| 7 | Critical | 인명 | `league.parent.sURNAMES.6c0cd2af` | ja |  | イ | Surname 이 was emptied as if it were the particle 이; owners' names lost their surname |
| 8 | Critical | 플레이스홀더 | `draftroom.scouting.needLine.d447d0f3` | en | Just the '{label}' type we were looking for. {label2} at {value} {value2} the benchmark ({target}). | Just the "{label}" type we were looking for. {label2} at {value} {value2} the benchmark ({target}). | ICU treats '{…}' as quoted literal text: the page showed {label} instead of the type name |
| 9 | Major | 영어 복수형 | `draftroom.scouting.needLine.b6a1d748` | en | Not quite a "{label}": {label2}{value} is {value2} points short. | Not quite a "{label}": {label2}{value} is {value2, plural, one {# point} other {# points}} short. | English plural: {value2} is a count that can be 1 ("1 day", not "1 days") |
| 10 | Critical | 플레이스홀더 | `draftroom.voices.install.scoutAdvice.03dac186` | en | He fits the '{label}' type we've been looking for. {label2} {value}. | He fits the "{label}" type we've been looking for. {label2} {value}. | ICU treats '{…}' as quoted literal text: the page showed {label} instead of the type name |
| 11 | Critical | 플레이스홀더 | `draftroom.voices.install.scoutAdvice.79734b27` | en | As a '{label}', {label2} ({value}){value2} still falls short of the benchmark ({target}). | As a "{label}", {label2} ({value}){value2} still falls short of the benchmark ({target}). | ICU treats '{…}' as quoted literal text: the page showed {label} instead of the type name |
| 12 | Critical | 플레이스홀더 | `league.rival.foundRival.title.ef34c9f3` | en | 12th Club '{name}' Expansion Approved | 12th Club "{name}" Expansion Approved | ICU treats '{…}' as quoted literal text: the page showed {name} instead of the club name |
| 13 | Critical | 플레이스홀더 | `league.rival.foundRival.body.b2c5a0f3` | en | The club announced a '{label}' operational model, and named {name} ({label2}) as inaugural manager. | The club announced a "{label}" operational model, and named {name} ({label2}) as inaugural manager. | ICU treats '{…}' as quoted literal text: the page showed {label} instead of the model name |
| 14 | Major | 야구 용어 | `league.alerts.awardAlert.1de783e9` | en | Our Gold Glove winners: {value} | Our Golden Glove winners: {value} | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 15 | Major | 야구 용어 | `league.alumni.fameOf.f2b151c4` | en | Gold Glove | Golden Glove | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 16 | Major | 야구 용어 | `league.alumni.alumnusLine.big.f2b151c4` | en | Gold Glove | Golden Glove | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 17 | Major | 야구 용어 | `league.alumni.alumnusLine.96b20ec5` | en |  · MVP/Gold Glove ×{big} |  · MVP/Golden Glove ×{big} | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 18 | Major | 야구 용어 | `league.awards.awardHonours.0d9ed90e` | en | Gold Glove ({pos}) | Golden Glove ({pos}) | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 19 | Major | 야구 용어 | `league.awards.hallOfFameCheck.big.f2b151c4` | en | Gold Glove | Golden Glove | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 20 | Major | 야구 용어 | `league.legacy.honoursOf.f2b151c4` | en | Gold Glove | Golden Glove | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 21 | Major | 야구 용어 | `league.offseason.awardInterview.pick.f2b151c4` | en | Gold Glove | Golden Glove | KBO award is the "Golden Glove" (KBO 골든글러브); "Gold Glove" is the MLB/Rawlings award. Glossary term |
| 22 | Major | 용어 일관성 | `ui.manual.yEAR.ae637c3d` | en | Winter decisions: National team call-ups, player growth, retirements, military service → Posting → FA → Salary arbitration/renewals → Rookie signings → KBO S… | Winter decisions: National team call-ups, player growth, retirements, military service → Posting → FA → Salary arbitration/renewals → Rookie signings → Secon… | Term consistency: 2차 드래프트 is "Second Draft" in the other 13 strings (and the Decision titles) |
| 23 | Major | 용어 일관성 | `ui.tutorial.secondProtect.title.45c66ae7` | en | KBO Secondary Draft Protected List | Second Draft Protected List | Term consistency: 2차 드래프트 is "Second Draft" in the other 13 strings (and the Decision titles) |
| 24 | Major | 용어 일관성 | `ui.tutorial.secondProtect.body.fc3a194a` | en | Select players to protect from being poached in the biennial KBO Secondary Draft. | Select players to protect from being poached in the biennial Second Draft. | Term consistency: 2차 드래프트 is "Second Draft" in the other 13 strings (and the Decision titles) |
| 25 | Major | 용어 일관성 | `ui.tutorial.rULES.body.a6fd79dd` | en | Winter follows the official KBO calendar: National team call-ups, player development, retirements, military service → Posting → Free Agency → Salary negotiat… | Winter follows the official KBO calendar: National team call-ups, player development, retirements, military service → Posting → Free Agency → Salary negotiat… | Term consistency: 2차 드래프트 is "Second Draft" in the other 13 strings (and the Decision titles) |
| 26 | Major | 오역·누락 | `ui.fantasyDraft.fantasyBoard.b1c1f810` | en | "Rating" is scout composite rank: public grade (blended with potential for young players) weighed against club positional needs, age, and luxury-tax penaltie… | "Rating" is scout composite rank: public grade (blended with potential for young players) weighed against club positional needs, age, and pay that would put … | Mistranslation: ko 샐러리캡을 넘는 연봉 (pay over the salary cap); the game has no luxury tax |
| 27 | Major | 오역·누락 | `ui.market.trade.39de664b` | en | Trades are allowed during the regular season until July 31, and re-open after the Korean Series. Other clubs judge trades by public ratings (current and pote… | Trades are allowed during the regular season until July 31, and re-open after the Korean Series. Other clubs judge trades by public ratings (current and pote… | Mistranslation: ko 샐러리캡을 넘기는 제안 (offers that push the club over the salary cap); glossary 샐러리캡 = Salary Cap |
| 28 | Major | 오역·누락 | `ui.tutorial.faRound.body.1e6a0ab5` | en | Signing bonuses are amortized evenly across the contract length against the payroll budget. Players favor large bonuses, but because salaries over ₩300M are … | As with the salary cap, signing bonuses are spread evenly over the contract years in the payroll budget. Players like big bonuses, but a player earning ₩300M… | Mistranslation/omission: dropped 샐러리캡처럼 (as with the salary cap) and 부진으로 (for poor play); "minor league" for 2군 (glossary: Futures) |
| 29 | Major | 오역·누락 | `ui.decision.decision.7680ee7b` | en |  Players graded Category 4 after major surgery fulfill their service as social service agents (21 months, ineligible for games); if drafted while rehabbing, … |  Players graded Category 4 after major surgery serve as social service agents instead of with Sangmu or on active duty (21 months, ineligible for games); if … | Omission: 상무·현역 대신 (instead of Sangmu or active duty) was dropped |
| 30 | Major | 금액 | `ui.decision.foreignCapLine.4f534145` | en |  — Exceeds by ${usd}. 50% luxury tax after season; 2 consecutive years incurs 100% tax and drops Round 2 pick by 9 slots. |  — Exceeds by {usd}. 50% luxury tax after season; 2 consecutive years incurs 100% tax and drops Round 2 pick by 9 slots. | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 31 | Major | 오역·누락 | `league.cap.settleCap.text.284072e6` | en |  (next draft's first-round pick drops to No. 9) |  (next draft's first-round pick drops 9 spots) | Mistranslation: KBO salary cap rule — the first-round pick moves down 9 places (9순위 하락), not to No. 9 |
| 32 | Major | 오역·누락 | `league.cap.settleCap.text.284072e6` | ja | （次回ドラフト1巡目が9位に降格） | （次回ドラフト1巡目の指名順位が9つ下がる） | Mistranslation: the pick moves down 9 places, not to 9th |
| 33 | Major | 오역·누락 | `league.views.statLine.text.ff11568e` | en | .AVG {fmt3} · {hr} HR · OPS {fmt32} | {fmt3} AVG · {hr} HR · {fmt32} OPS | Mistranslation: stray ".AVG" before the average (the value already starts with a dot: ".AVG .362"); stat after its value like the ERA line |
| 34 | Major | 오역·누락 | `ui.myClub.myClub.5b9daec2` | ja | 選手間 | 選手一覧 | Mistranslation: '선수단' as the roster tab is the squad, not 選手間 (that reading is only for 선수단 투표 = 選手間投票 in the All-Star keys, which stay) |
| 35 | Major | 오역·누락 | `ui.squad.squad.5b9daec2` | ja | 選手間 | 選手一覧 | Same as ui.myClub.myClub.5b9daec2 (roster heading) |
| 36 | Major | 오역·누락 | `ui.teamRoster.teamRoster.5b9daec2` | ja | 選手間 | 選手一覧 | Same as ui.myClub.myClub.5b9daec2 (another club's roster) |
| 37 | Major | 오역·누락 | `ui.tutorial.rULES.title.5b9daec2` | ja | 選手間 | 選手一覧 | Same as ui.myClub.myClub.5b9daec2 (help section on the roster) |
| 38 | Major | 금액 | `league.advice.adviceFor.picks.91e7eb3c` | en |  · Guaranteed {value} × $10K |  · Guaranteed {value} | Amount param ({value}만 달러): the runtime now shows the dollar amount ($400K); "× $10K" left the unit math to the player |
| 39 | Major | 금액 | `league.foreign.usd.f2e37495` | en | {value} × $10K | {value} | Amount param ({value}만 달러) is formatted by the runtime as $400K |
| 40 | Major | 금액 | `league.foreigncap.settleForeignCap.usd.f2e37495` | en | {value} × $10K | {value} | Amount param ({value}만 달러) is formatted by the runtime as $400K |
| 41 | Major | 금액 | `ui.manual.usd.f2e37495` | en | ${value}0K | {value} | "$" + value + "0K" only works for whole numbers (40 → $400K; 1,200 → $1,2000K); the runtime formats the amount |
| 42 | Major | 금액 | `ui.manual.gLOSSARY.0907383f` | en | A fictional event held annually on {number}/{number2} where top prospects ranked inside #{invited} are tested on velocity, spin rate, control, sprint speed, … | A fictional event held annually on {number}/{number2} where top prospects ranked inside #{invited} are tested on velocity, spin rate, control, sprint speed, … | Same "0K" suffix problem (a value with a comma gives ₩1,0000K); the runtime formats the 만 원 amount |
| 43 | Major | 금액 | `ui.newGame.newGame.e6bc2339` | en | Pop. {value}0K · Market {market} | Pop. {value} · Market {market} | Population in 만: "{value}0K" gives "1,1000K" for 1,100만; the runtime shows 11M |
| 44 | Major | 금액 | `ui.office.office.1310da3f` | en | Relative to league average ticket yield (₩{value}). Raising prices increases per-ticket yield but lowers attendance, reducing concessions and merchandise sal… | Relative to league average ticket yield ({value}). Raising prices increases per-ticket yield but lowers attendance, reducing concessions and merchandise sale… | Won amount param: the runtime adds the ₩ sign (avoid ₩₩) |
| 45 | Major | 금액 | `ui.office.office.c586fe06` | en | {value}% · ₩{value2} | {value}% · {value2} | Won amount param: the runtime adds the ₩ sign |
| 46 | Major | 금액 | `ui.playerPanel.playerPanel.c7b1ead1` | en | Internal Club Drug Test (₩{inspectCost}0K) | Internal Club Drug Test ({inspectCost}) | "0K" suffix breaks for values with commas; the runtime formats the 만 원 amount |
| 47 | Major | 금액 | `league.training.checkTrip.2e725bb1` | ja | 球団資金が不足しています（必要額：{eok}億ウォン）。 | 球団資金が不足しています（必要額：{eok}）。 | {eok} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 48 | Major | 금액 | `league.userclub.payForeignOptions.label.cc99a4b8` | en | Foreign Player Option · {name} (${usd}) | Foreign Player Option · {name} ({usd}) | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 49 | Major | 금액 | `league.userclub.payForeignOptions.label.cc99a4b8` | ja | 外国人選手オプション · {name}（{usd}ドル） | 外国人選手オプション · {name}（{usd}） | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 50 | Major | 금액 | `league.userclub.resolveAnnual.a10572f6` | en | Re-signed foreign player {name} (${usd}{value}) | Re-signed foreign player {name} ({usd}{value}) | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 51 | Major | 금액 | `league.userclub.resolveAnnual.a10572f6` | ja | 外国人選手 {name} 再契約（{usd}{value}ドル） | 外国人選手 {name} 再契約（{usd}{value}） | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 52 | Major | 금액 | `league.userclub.resolveAnnual.723a0593` | en | Failed to re-sign foreign player {name} (offered ${usd}{value}, demanded ${usd2}) | Failed to re-sign foreign player {name} (offered {usd}{value}, demanded {usd2}) | {usd}, {usd2} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 53 | Major | 금액 | `league.userclub.resolveAnnual.723a0593` | ja | 外国人選手 {name} 再契約交渉決裂（提示 {usd}{value}ドル、要求 {usd2}ドル） | 外国人選手 {name} 再契約交渉決裂（提示 {usd}{value}、要求 {usd2}） | {usd}, {usd2} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 54 | Major | 금액 | `ui.decision.foreignCapLine.4f534145` | en |  — Exceeds by ${usd}. 50% luxury tax after season; 2 consecutive years incurs 100% tax and drops Round 2 pick by 9 slots. |  — Exceeds by {usd}. 50% luxury tax after season; 2 consecutive years incurs 100% tax and drops Round 2 pick by 9 slots. | {usd} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 55 | Minor | 야구 용어 | `ui.decision.foreignCapLine.4f534145` | ja |  — {usd}超過。シーズン後に超過額の50%が課徴金となり、2年連続超過の場合は100%および2巡目指名権が9位分降格します。 |  — {usd}超過。シーズン後に超過額の50%が課徴金となり、2年連続超過の場合は100%および2巡目の指名順位が9つ下がります。 | 9순위 하락 = the pick moves 9 places down; 「9位分降格」 reads as a demotion of rank |
| 56 | Major | 금액 | `ui.decision.foreignCapLine.da9d4e52` | en | {next} Foreign Player Salary Cap: 3 Foreign Players Total (including options) ${usd} / Cap ${usd2} ($4.0M + $100K per re-signed player's tenure; Asian Quota … | {next} Foreign Player Salary Cap: 3 Foreign Players Total (including options) {usd} / Cap {usd2} ($4.0M + $100K per re-signed player's tenure; Asian Quota ex… | {usd}, {usd2} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 57 | Major | 금액 | `ui.decision.foreignCapLine.da9d4e52` | ja | {next}年 外国人枠サラリーキャップ: 外国人3名総額（オプション込）{usd}ドル / 上限 {usd2}ドル（400万ドル + 再契約選手の年数×10万ドル、アジア枠別）{value} | {next}年 外国人枠サラリーキャップ: 外国人3名総額（オプション込）{usd} / 上限 {usd2}（400万ドル + 再契約選手の年数×10万ドル、アジア枠別）{value} | {usd}, {usd2} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 58 | Major | 금액 | `ui.training.training.11afbd5f` | en | {value} · {weeks, plural, one{# Week} other{# Weeks}} · ₩{money} per player | {value} · {weeks, plural, one{# Week} other{# Weeks}} · {money} per player | {money} already hold(s) a formatted amount (usd()/eok()/money() → "40만 달러", "3억"); the unit added around it was doubled ("$$400K", "40万ドルドル") |
| 59 | Major | 인명 | `names/foreign-name-labels.json west.given 잭` | en/ja | Zack/ザック and Jack/ジャック (two rows) | Jack/ジャック | One Korean spelling had two renderings (the generator list has 잭 once); 잭 is the usual Korean spelling of Jack |
| 60 | Major | 인명 | `names/foreign-name-labels.json dutch.given 시드니` | en | Sicnarf | Sidney | [확인 필요] decided: 시드니 is the Korean spelling of Sidney (Aruban pitcher Sidney Ponson = 시드니 폰슨); Sicnarf would be 시크나르프. ja シドニー already matched |
| 61 | Major | 인명 | `names/foreign-name-labels.json dutch.given 하이트` | en | Curt | Hite | [확인 필요] decided: Curt would be 커트; Hite matches 하이트 and the ja ハイト. The generator only needs a plausible name |
| 62 | Major | 영어 복수형 | `draftroom.scouting.needLine.b6a1d748` | en | Not quite a "{label}": {label2}{value} is {value2} points short. | Not quite a "{label}": {label2}{value} is {value2, plural, one {# point} other {# points}} short. | English plural: {value2} is a count that can be 1 ("1 day", not "1 days") |
| 63 | Major | 영어 복수형 | `draftroom.season.rEASONS.3400fabd` | en | Missed {days} days with an injury. Spent most of the season in rehab. | Missed {days, plural, one {# day} other {# days}} with an injury. Spent most of the season in rehab. | English plural: {days} is a count that can be 1 ("1 day", not "1 days") |
| 64 | Major | 영어 복수형 | `draftroom.season.reasonText.849aa2c6` | en |  He missed {daysLost} days with an injury. |  He missed {daysLost, plural, one {# day} other {# days}} with an injury. | English plural: {daysLost} is a count that can be 1 ("1 day", not "1 days") |
| 65 | Major | 영어 복수형 | `draftroom.writer.amateurFact.8fd19c89` | en | {where}, he posted a {value} ERA with {value2} strikeouts over {ip} innings in {games, plural, one{# game} other{# games}}. | {where}, he posted a {value} ERA with {value2, plural, one {# strikeout} other {# strikeouts}} over {ip, plural, one {# inning} other {# innings}} in {games,… | English plural: {ip}, {value2} is a count that can be 1 ("1 day", not "1 days") |
| 66 | Major | 영어 복수형 | `league.allstar.electNews.body.9c0db210` | en | Voting has ended, and the Best 12 for the Dream and Nanum All-Stars are set. Including manager's picks, each team has {squad} players. {value} | Voting has ended, and the Best 12 for the Dream and Nanum All-Stars are set. Including manager's picks, each team has {squad, plural, one {# player} other {#… | English plural: {squad} is a count that can be 1 ("1 day", not "1 days") |
| 67 | Major | 영어 복수형 | `league.alumni.alumniDay.body.fdf55e8b` | en | {club} under Manager {name} ran off {run} straight wins. Fans are thrilled, recalling {name2} from his playing days. | {club} under Manager {name} ran off {run, plural, one {# straight win} other {# straight wins}}. Fans are thrilled, recalling {name2} from his playing days. | English plural: {run} is a count that can be 1 ("1 day", not "1 days") |
| 68 | Major | 영어 복수형 | `league.alumni.alumniDay.title.dcef795b` | en | 'Legend Magic' Lifts {club} to {run} Straight Wins | 'Legend Magic' Lifts {club} to {run, plural, one {# Straight Win} other {# Straight Wins}} | English plural: {run} is a count that can be 1 ("1 day", not "1 days") |
| 69 | Major | 영어 복수형 | `league.briefing.briefing.facts.3aa05999` | en | {games} games, {w}-{l}{value} | {games, plural, one {# game} other {# games}}, {w}-{l}{value} | English plural: {games} is a count that can be 1 ("1 day", not "1 days") |
| 70 | Major | 영어 복수형 | `league.briefing.briefing.facts.5683c8af` | en | {rank, selectordinal, one{#st} two{#nd} few{#rd} other{#th}} · within about {value} wins of 5th-place {short} | {rank, selectordinal, one{#st} two{#nd} few{#rd} other{#th}} · within about {value, plural, one {# win} other {# wins}} of 5th-place {short} | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 71 | Major | 영어 복수형 | `league.combine.checkWorkout.35a057be` | en | The limit is {workouts} players per year. | The limit is {workouts, plural, one {# player} other {# players}} per year. | English plural: {workouts} is a count that can be 1 ("1 day", not "1 days") |
| 72 | Major | 영어 복수형 | `league.entry.canMove.65a191aa` | en | Keep at least {mIN_FIRST_TEAM} players on the first team. | Keep at least {mIN_FIRST_TEAM, plural, one {# player} other {# players}} on the first team. | English plural: {mIN_FIRST_TEAM} is a count that can be 1 ("1 day", not "1 days") |
| 73 | Major | 영어 복수형 | `league.entry.canMove.80107525` | en | The first-team roster is full at {firstTeamSize} players. Remove one first. | The first-team roster is full at {firstTeamSize, plural, one {# player} other {# players}}. Remove one first. | English plural: {firstTeamSize} is a count that can be 1 ("1 day", not "1 days") |
| 74 | Major | 영어 복수형 | `league.entry.canMove.a9a51986` | en | A player can't be re-registered until {rEREGISTER_DAYS} days after being removed (from {addDays}). | A player can't be re-registered until {rEREGISTER_DAYS, plural, one {# day} other {# days}} after being removed (from {addDays}). | English plural: {rEREGISTER_DAYS} is a count that can be 1 ("1 day", not "1 days") |
| 75 | Major | 영어 복수형 | `league.entry.canRegister.c85619fe` | en | The registered roster is full at {rosterLimit} players. | The registered roster is full at {rosterLimit, plural, one {# player} other {# players}}. | English plural: {rosterLimit} is a count that can be 1 ("1 day", not "1 days") |
| 76 | Major | 영어 복수형 | `league.expansion.checkDecision.3c960698` | en | You can sign up to {max} players. | You can sign up to {max, plural, one {# player} other {# players}}. | English plural: {max} is a count that can be 1 ("1 day", not "1 days") |
| 77 | Major | 영어 복수형 | `league.expansion.checkDecision.a1e081c4` | en | To meet the registered roster limit of {limit}, you need to cut {release} players. | To meet the registered roster limit of {limit}, you need to cut {release, plural, one {# player} other {# players}}. | English plural: {release} is a count that can be 1 ("1 day", not "1 days") |
| 78 | Major | 영어 복수형 | `league.fa.checkRound.db8686c6` | en | You can sign up to {userLimit} free agents from other clubs this winter ({value} spots left). | You can sign up to {userLimit} free agents from other clubs this winter ({value, plural, one {# spot} other {# spots}} left). | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 79 | Major | 영어 복수형 | `league.fa.fitOf.b5b67806` | en | Wants at least {min} years guaranteed. | Wants at least {min, plural, one {# year} other {# years}} guaranteed. | English plural: {min} is a count that can be 1 ("1 day", not "1 days") |
| 80 | Major | 영어 복수형 | `league.fa.tell.bd73c0e4` | en | {name} has received offers from {n} clubs. We haven't made an offer yet. | {name} has received offers from {n, plural, one {# club} other {# clubs}}. We haven't made an offer yet. | English plural: {n} is a count that can be 1 ("1 day", not "1 days") |
| 81 | Major | 영어 복수형 | `league.foreign.careerText.2b4bbc6a` | en | Japan NPB: {value, plural, one{# season} other{# seasons}}, {value2} games with the top team | Japan NPB: {value, plural, one{# season} other{# seasons}}, {value2, plural, one {# game} other {# games}} with the top team | English plural: {value2} is a count that can be 1 ("1 day", not "1 days") |
| 82 | Major | 영어 복수형 | `league.foreign.careerText.ffaf1aff` | en | Japan NPB: {value, plural, one{# season} other{# seasons}}, mostly in the minors ({value2} games with the top team) | Japan NPB: {value, plural, one{# season} other{# seasons}}, mostly in the minors ({value2, plural, one {# game} other {# games}} with the top team) | English plural: {value2} is a count that can be 1 ("1 day", not "1 days") |
| 83 | Major | 영어 복수형 | `league.gamedetail.gameDetail.b0900d9e` | en |  ({innings} innings) |  ({innings, plural, one {# inning} other {# innings}}) | English plural: {innings} is a count that can be 1 ("1 day", not "1 days") |
| 84 | Major | 영어 복수형 | `league.interviews.firstQuestion.b8f7d3b4` | en | You hit {hr} home runs in a single game. How do you feel? | You hit {hr, plural, one {# home run} other {# home runs}} in a single game. How do you feel? | English plural: {hr} is a count that can be 1 ("1 day", not "1 days") |
| 85 | Major | 영어 복수형 | `league.interviews.firstQuestion.c5f0e76b` | en | You struck out {value} batters. How was your stuff today? | You struck out {value, plural, one {# batter} other {# batters}}. How was your stuff today? | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 86 | Major | 영어 복수형 | `league.national.pickAlert.lines.ab84a82e` | en | Of the {length} players on the national team, {length2} are ours. | Of the {length, plural, one {# player} other {# players}} on the national team, {length2} are ours. | English plural: {length} is a count that can be 1 ("1 day", not "1 days") |
| 87 | Major | 영어 복수형 | `league.news.gameNews.2a5aed28` | en | {name} Racks Up {value} Hits | {name} Racks Up {value, plural, one {# Hit} other {# Hits}} | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 88 | Major | 영어 복수형 | `league.news.gameNews.454600c1` | en | {me} Win in {innings} Innings | {me} Win in {innings, plural, one {# Inning} other {# Innings}} | English plural: {innings} is a count that can be 1 ("1 day", not "1 days") |
| 89 | Major | 영어 복수형 | `league.news.gameNews.9a289915` | en | {name} led the way with {value} hits and {value2} RBI. | {name} led the way with {value, plural, one {# hit} other {# hits}} and {value2} RBI. | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 90 | Major | 영어 복수형 | `league.news.gameNews.a0c0d280` | en | {me} surrendered {rt} runs to {opp} as the pitching collapsed. | {me} surrendered {rt, plural, one {# run} other {# runs}} to {opp} as the pitching collapsed. | English plural: {rt} is a count that can be 1 ("1 day", not "1 days") |
| 91 | Major | 영어 복수형 | `league.news.gameNews.c4da58d0` | en | Starter {name} allowed {value2} runs over {value} innings. | Starter {name} allowed {value2, plural, one {# run} other {# runs}} over {value, plural, one {# inning} other {# innings}}. | English plural: {value}, {value2} is a count that can be 1 ("1 day", not "1 days") |
| 92 | Major | 영어 복수형 | `league.news.gameNews.f39f77d8` | en | {name} struck out {value2} over {value} innings against the {opp} lineup, allowing {value3} runs. The team {value4} {rs}–{rt}. | {name} struck out {value2} over {value, plural, one {# inning} other {# innings}} against the {opp} lineup, allowing {value3, plural, one {# run} other {# ru… | English plural: {value}, {value3} is a count that can be 1 ("1 day", not "1 days") |
| 93 | Major | 영어 복수형 | `league.news.gameNews.f9e7ccc7` | en | The {me} lineup pounded {opp} pitching, scoring {rs} runs on {value} hits. | The {me} lineup pounded {opp} pitching, scoring {rs, plural, one {# run} other {# runs}} on {value, plural, one {# hit} other {# hits}}. | English plural: {rs}, {value} is a count that can be 1 ("1 day", not "1 days") |
| 94 | Major | 영어 복수형 | `league.news.gameNews.fa0a0d6a` | en | In the lineup, {name} recorded {value} hits and {value2} RBI. | In the lineup, {name} recorded {value, plural, one {# hit} other {# hits}} and {value2} RBI. | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 95 | Major | 영어 복수형 | `league.news.seasonNews.body.ceefa5de` | en | {w, plural, one{# win} other{# wins}}, {value} strikeouts | {w, plural, one{# win} other{# wins}}, {value, plural, one {# strikeout} other {# strikeouts}} | English plural: {value} is a count that can be 1 ("1 day", not "1 days") |
| 96 | Major | 영어 복수형 | `league.trade.checkTrade.8d3f3e84` | en | Partner club's roster limit would exceed {limit} players. | Partner club's roster limit would exceed {limit, plural, one {# player} other {# players}}. | English plural: {limit} is a count that can be 1 ("1 day", not "1 days") |
| 97 | Major | 영어 복수형 | `league.trade.checkTrade.9366b66d` | en | Roster limit would exceed {limit} players. | Roster limit would exceed {limit, plural, one {# player} other {# players}}. | English plural: {limit} is a count that can be 1 ("1 day", not "1 days") |
| 98 | Major | 영어 복수형 | `league.training.finishTrips.body.3ec5d66e` | en | {name} completed {weeks} weeks of training at {name2} in {place}. Club measurements report {text}.{value} | {name} completed {weeks, plural, one {# week} other {# weeks}} of training at {name2} in {place}. Club measurements report {text}.{value} | English plural: {weeks} is a count that can be 1 ("1 day", not "1 days") |
| 99 | Major | 영어 복수형 | `league.training.finishTrips.lines.f0265be6` | en | {name} ({place}) completed {weeks} weeks of training: {text}. | {name} ({place}) completed {weeks, plural, one {# week} other {# weeks}} of training: {text}. | English plural: {weeks} is a count that can be 1 ("1 day", not "1 days") |
| 100 | Major | 영어 복수형 | `ui.allStar.allStar.202e5be2` | en | Combining fan voting (70%) and player voting (30%), Best 12 per position are selected from {md} to {md2}, {value}. Together with manager selections, {squad} … | Combining fan voting (70%) and player voting (30%), Best 12 per position are selected from {md} to {md2}, {value}. Together with manager selections, {squad, … | English plural: {squad} is a count that can be 1 ("1 day", not "1 days") |
| 101 | Major | 영어 복수형 | `ui.boxScore.boxScore.c0c99b3b` | en |  · {innings} Innings (Extra) |  · {innings, plural, one {# Inning} other {# Innings}} (Extra) | English plural: {innings} is a count that can be 1 ("1 day", not "1 days") |
| 102 | Major | 영어 복수형 | `ui.decision.decision.9ae171b1` | en | {year} Second Draft. Select {protect} players to protect (currently {size}). Unprotected players can be picked by other clubs, awarding round-based compensat… | {year} Second Draft. Select {protect, plural, one {# player} other {# players}} to protect (currently {size}). Unprotected players can be picked by other clu… | English plural: {protect} is a count that can be 1 ("1 day", not "1 days") |
| 103 | Major | 영어 복수형 | `ui.decision.decision.b176e269` | en | Signed Grade {grade} FA {name} from {shortName}. Select {protect} players to protect (currently {size}). {shortName2} may select 1 unprotected player plus co… | Signed Grade {grade} FA {name} from {shortName}. Select {protect, plural, one {# player} other {# players}} to protect (currently {size}). {shortName2} may s… | English plural: {protect} is a count that can be 1 ("1 day", not "1 days") |
| 104 | Major | 영어 복수형 | `ui.decision.decision.b82fa189` | en | Expansion draft for 12th club {name}. Select {protect} players to protect (currently {size}). If an unprotected player is selected, you receive {money} in co… | Expansion draft for 12th club {name}. Select {protect, plural, one {# player} other {# players}} to protect (currently {size}). If an unprotected player is s… | English plural: {protect} is a count that can be 1 ("1 day", not "1 days") |
| 105 | Major | 영어 복수형 | `ui.manual.gLOSSARY.3720f353` | en | Held every 2 years. Each club protects {protected} players, and remaining players can be selected through {rounds} rounds with transfer fees. | Held every 2 years. Each club protects {protected, plural, one {# player} other {# players}}, and remaining players can be selected through {rounds, plural, … | English plural: {protected}, {rounds} is a count that can be 1 ("1 day", not "1 days") |
| 106 | Major | 영어 복수형 | `ui.manual.gLOSSARY.8d92a7f4` | en | System allowing players with {seasons} completed seasons to post for MLB clubs. Up to {perClubPerWinter} player per club each winter; a successful contract a… | System allowing players with {seasons} completed seasons to post for MLB clubs. Up to {perClubPerWinter, plural, one {# player} other {# players}} per club e… | English plural: {perClubPerWinter} is a count that can be 1 ("1 day", not "1 days") |
| 107 | Major | 영어 복수형 | `ui.manual.gLOSSARY.b2a6ec7c` | en | Each club may have up to {rosterLimit} registered players; the first team registers {registered} players, with {active} active for each game. | Each club may have up to {rosterLimit} registered players; the first team registers {registered, plural, one {# player} other {# players}}, with {active} act… | English plural: {registered} is a count that can be 1 ("1 day", not "1 days") |
| 108 | Major | 영어 복수형 | `ui.manual.gLOSSARY.bea0fd90` | en | Days registered on the first-team roster. {daysPerSeason} days count as one full season; high school draftees qualify for FA after {seasonsHighSchool} season… | Days registered on the first-team roster. {daysPerSeason, plural, one {# day} other {# days}} count as one full season; high school draftees qualify for FA a… | English plural: {daysPerSeason} is a count that can be 1 ("1 day", not "1 days") |
| 109 | Major | 영어 복수형 | `ui.manual.gLOSSARY.c5a480d5` | en | The ceiling on total payroll for the top {topPlayers} highest-paid players ({season}: {eok}). Exceeding it incurs a {value} penalty on the overage (depending… | The ceiling on total payroll for the top {topPlayers} highest-paid players ({season}: {eok}). Exceeding it incurs a {value} penalty on the overage (depending… | English plural: {pickDrop}, {pickDropFrom} is a count that can be 1 ("1 day", not "1 days") |
| 110 | Major | 영어 복수형 | `ui.office.office.fe9a9481` | en |  · {streak} consecutive years exceeding |  · {streak, plural, one {# consecutive year} other {# consecutive years}} exceeding | English plural: {streak} is a count that can be 1 ("1 day", not "1 days") |
| 111 | Major | 영어 복수형 | `ui.playerPanel.playerPanel.75a95895` | en | Career {length} times, {hurtDays} days | Career {length, plural, one {# time} other {# times}}, {hurtDays, plural, one {# day} other {# days}} | English plural: {hurtDays}, {length} is a count that can be 1 ("1 day", not "1 days") |
| 112 | Major | 영어 복수형 | `ui.playerPanel.playerPanel.e1aa3431` | en | {days} Days | {days, plural, one {# Day} other {# Days}} | English plural: {days} is a count that can be 1 ("1 day", not "1 days") |
| 113 | Major | 스타일 | `league.views.pitching.title.90e5e4d2` | en | Victory | Wins | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases); 승리 here is the wins leaderboard, not "Victory" |
| 114 | Minor | 야구 용어 | `ui.decision.foreignCapLine.4f534145` | ja |  — {usd}超過。シーズン後に超過額の50%が課徴金となり、2年連続超過の場合は100%および2巡目指名権が9位分降格します。 |  — {usd}超過。シーズン後に超過額の50%が課徴金となり、2年連続超過の場合は100%および2巡目の指名順位が9つ下がります。 | 9순위 하락 = the pick moves 9 places down; 「9位分降格」 reads as a demotion of rank |
| 115 | Minor | 야구 용어 | `league.gamedetail.dEC.s.a3fa83d2` | en | saves | Save | Pitcher decision next to Win/Loss: singular Save/Hold |
| 116 | Minor | 야구 용어 | `league.gamedetail.dEC.h.9329045a` | en | Holds | Hold | Pitcher decision next to Win/Loss: singular Save/Hold |
| 117 | Minor | 야구 용어 | `ui.playerPanel.splitTable.19d72883` | en | Plate Appearances | BF | Pitcher split header: 상대 타석 is batters faced (MLB abbreviation BF); the column next to it uses abbreviations and the batter version is PA |
| 118 | Minor | 야구 용어 | `league.playtext.dOUBLES.445b7482` | en | Double down left field line | Double down the left-field line | Play-by-play wording (MLB Gameday: 'doubles down the left-field line') |
| 119 | Minor | 야구 용어 | `league.playtext.dOUBLES.18052849` | en | Double down right field line | Double down the right-field line | Same as league.playtext.dOUBLES.445b7482 |
| 120 | Minor | 야구 용어 | `league.playtext.tRIPLES.d6447363` | en | Triple down right field line | Triple down the right-field line | Same as league.playtext.dOUBLES.445b7482 |
| 121 | Minor | 용어 일관성 | `league.movenews.moveNews.title.1de39ecc` | ja | {club}、{name}をウェイバー公示 | {club}、{name}をウェーバー公示 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 122 | Minor | 용어 일관성 | `league.movenews.moveNews.body.c7192411` | ja | ウェイバー公示とした。1週間以内に獲得する球団がなければ自由契約選手となる。 | ウェーバー公示とした。1週間以内に獲得する球団がなければ自由契約選手となる。 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 123 | Minor | 용어 일관성 | `league.movenews.facts.type.29e07476` | ja | ウェイバー公示 | ウェーバー公示 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 124 | Minor | 용어 일관성 | `league.movenews.moveNews.title.bf84b148` | ja | {club}、ウェイバーで{name}を獲得 | {club}、ウェーバーで{name}を獲得 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 125 | Minor | 용어 일관성 | `league.movenews.moveNews.body.e68b1c4a` | ja | {club}は{from}がウェイバー公示した{name}を獲得した。残りの契約も引き継ぐ。{value} | {club}は{from}がウェーバー公示した{name}を獲得した。残りの契約も引き継ぐ。{value} | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 126 | Minor | 용어 일관성 | `league.movenews.facts.type.f49fc0c2` | ja | ウェイバー獲得 | ウェーバー獲得 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 127 | Minor | 용어 일관성 | `league.scenarios.sCENARIOS.story.c27a09fe` | ja | 初期ロスターは引退選手とドラフト外選手のみで構成されます（特別指名なし）。ベテランは長く持ちません。その間に新人や無名選手を育て上げてください。5年以内の優勝で奇跡を完成させましょう。 | 初期ロースターは引退選手とドラフト外選手のみで構成されます（特別指名なし）。ベテランは長く持ちません。その間に新人や無名選手を育て上げてください。5年以内の優勝で奇跡を完成させましょう。 | Katakana consistency: ロースター elsewhere (and in NPB/MLB coverage) |
| 128 | Minor | 용어 일관성 | `league.trade.releasePlayer.text.3ced2e91` | ja | {name} ウェイバー公示（{addDays}まで） | {name} ウェーバー公示（{addDays}まで） | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 129 | Minor | 용어 일관성 | `league.trade.releasePlayer.aa556b10` | ja | ウェイバー公示：{shortOf} {name} | ウェーバー公示：{shortOf} {name} | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 130 | Minor | 용어 일관성 | `league.trade.processWaivers.9638f882` | ja | ウェイバー獲得：{shortOf}が{name}を獲得（{shortOf2}より） | ウェーバー獲得：{shortOf}が{name}を獲得（{shortOf2}より） | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 131 | Minor | 용어 일관성 | `league.trade.processWaivers.text.c28e2c38` | ja | {name} ウェイバーにより{shortOf}へ移籍 | {name} ウェーバーにより{shortOf}へ移籍 | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 132 | Minor | 용어 일관성 | `story.prompt.sTORY_SYSTEM.51449bc3` | ja | あなたは架空の韓国プロ野球リーグを担当するスポーツ新聞記者です。このリーグの選手・指導者・ファン・記録はすべてゲーム内の架空設定です。⏎⏎執筆ルール:⏎- 与えられた事実（facts）、詳細データ（detail）、草案（draft）に記載された内容のみ記述すること。数値（スコア、成績、日付、順位、金額、観客動員数… | あなたは架空の韓国プロ野球リーグを担当するスポーツ新聞記者です。このリーグの選手・指導者・ファン・記録はすべてゲーム内の架空設定です。⏎⏎執筆ルール:⏎- 与えられた事実（facts）、詳細データ（detail）、草案（draft）に記載された内容のみ記述すること。数値（スコア、成績、日付、順位、金額、観客動員数… | Katakana consistency: ウェーバー (NPB ウェーバー公示) is used in 7 other strings |
| 133 | Minor | 용어 일관성 | `story.errors.message.quota.4221ee17` | ja | 本日の利用可能リクエスト数を使い切りました（{status}）。1日の上限は翌日にリセットされます。プロバイダ公式サイトでプランや請求状況をご確認ください。 | 本日の利用可能リクエスト数を使い切りました（{status}）。1日の上限は翌日にリセットされます。プロバイダー公式サイトでプランや請求状況をご確認ください。 | Katakana consistency: プロバイダー (long vowel, as in the settings label) |
| 134 | Minor | 용어 일관성 | `story.errors.message.quota.c0f826d5` | ja | アカウントの利用上限またはクレジット残高が枯渇しました（{status}）。時間経過では解決しませんので、プロバイダ側で請求・限度額をご確認ください。 | アカウントの利用上限またはクレジット残高が枯渇しました（{status}）。時間経過では解決しませんので、プロバイダー側で請求・限度額をご確認ください。 | Katakana consistency: プロバイダー (long vowel, as in the settings label) |
| 135 | Minor | 용어 일관성 | `story.errors.message.busy.65759cb4` | ja | プロバイダサーバーが混雑または一時停止しています（{status}）。{wait}再試行するか、別のモデルを選択してください。 | プロバイダーサーバーが混雑または一時停止しています（{status}）。{wait}再試行するか、別のモデルを選択してください。 | Katakana consistency: プロバイダー (long vowel, as in the settings label) |
| 136 | Minor | 용어 일관성 | `ui.manual.sCREENS.fcf2f2ae` | ja | 試合結果、スコアテーブル、一球速報テキスト（最初から再生）。 | 試合結果、スコアテーブル、一球速報（最初から再生）。 | Term consistency: 一球速報 alone, as in the tab label |
| 137 | Minor | 용어 일관성 | `ui.manual.gLOSSARY.ac98c0d6` | ja | 設定→画面→試合で有効にすると、試合タブで未観戦の自軍のスコアが伏せられ、試合を開くと1回から一球速報テキストが再生されます（その間はスコアテーブルや記事がロックされます）。最後まで再生するか「結果を今すぐ見る」を押すと全開示されます。順位表やニュースには通常通り結果が反映されます。 | 設定→画面→試合で有効にすると、試合タブで未観戦の自軍のスコアが伏せられ、試合を開くと1回から一球速報が再生されます（その間はスコアテーブルや記事がロックされます）。最後まで再生するか「結果を今すぐ見る」を押すと全開示されます。順位表やニュースには通常通り結果が反映されます。 | Term consistency: 一球速報 alone, as in the tab label |
| 138 | Minor | 용어 일관성 | `ui.displaySettings.displayOptions.b16957fc` | ja | 自球団の試合結果を隠す — 試合タブでスコアを隠し、開くと1回から文字中継が流れます | 自球団の試合結果を隠す — 試合タブでスコアを隠し、開くと1回から一球速報が流れます | Term consistency: 문자중계 is 一球速報 in the other 5 strings (the box score tab included) |
| 139 | Minor | 금액 | `league.fa.eok.a1ab0842` | en | {e} {value} | {e}{value} | One amount in two params ({e}억 {value}만): shown as ₩175M without a stray space |
| 140 | Minor | 금액 | `league.userclub.money.a0e34170` | en | {eok} {value} | {eok}{value} | One amount in two params ({eok}억 {value}만): shown as ₩175M without a stray space |
| 141 | Minor | 금액 | `league.movenews.won.39a51a17` | en | {value}{value2} KRW | {value}{value2} | The runtime formats won amounts with ₩; "KRW" doubled the unit |
| 142 | Minor | 인명 | `league.parent.sURNAMES.c596d452` | ja | チュェ | チェ | 최 is チェ in the Korean name table (korean-name-labels) and in Japanese media; one rendering |
| 143 | Minor | 인명 | `draftroom.catalog.institutions.46a2bacb` | en | Isunsin BC | Yi Sun-sin BC | [확인 필요] decided: named after Admiral Yi Sun-sin, whose established English spelling is "Yi Sun-sin" |
| 144 | Minor | 인명 | `draftroom.catalog.institutions.46a2bacb` | ja | イスンシンBC | イ・スンシンBC | [확인 필요] decided: person's name, family and given name separated with ・ as in the other Korean names (no kanji, per the rules) |
| 145 | Minor | 인명 | `names/korean-name-labels.json givenNames[*]` | en | Min-Jun, Seo-Jun, Do-Yoon … (425 names) | Min-jun, Seo-jun, Do-yoon … | Korean given names in English are written with a lowercase second syllable (Revised Romanization for personal names; KBO and press style: Lee Jung-hoo, Kim Ha-seong) |
| 146 | Minor | 스타일 | `league.views.recordRoom.season.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 147 | Minor | 스타일 | `league.views.recordRoom.season.1822db88` | en | hits | Hits | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 148 | Minor | 스타일 | `league.views.recordRoom.season.3b1908b7` | en | wins | Wins | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 149 | Minor | 스타일 | `league.views.recordRoom.season.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 150 | Minor | 스타일 | `league.views.recordRoom.career.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 151 | Minor | 스타일 | `league.views.recordRoom.career.1822db88` | en | hits | Hits | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 152 | Minor | 스타일 | `league.views.recordRoom.career.3b1908b7` | en | wins | Wins | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 153 | Minor | 스타일 | `league.views.recordRoom.career.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 154 | Minor | 스타일 | `league.views.pitching.title.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 155 | Minor | 스타일 | `league.poststats.boards.1822db88` | en | hits | Hits | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 156 | Minor | 스타일 | `league.poststats.boards.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 157 | Minor | 스타일 | `league.poststats.boards.3b1908b7` | en | wins | Wins | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 158 | Minor | 스타일 | `league.poststats.boards.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 159 | Minor | 스타일 | `league.views.careerHighs.out.3b1908b7` | en | wins | Wins | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 160 | Minor | 스타일 | `league.views.careerHighs.out.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 161 | Minor | 스타일 | `league.views.careerHighs.out.1822db88` | en | hits | Hits | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 162 | Minor | 스타일 | `league.views.careerHighs.out.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 163 | Minor | 스타일 | `league.awards.computeAwards.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 164 | Minor | 스타일 | `league.awards.computeAwards.1822db88` | en | hits | Hits | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 165 | Minor | 스타일 | `league.awards.computeAwards.a3fa83d2` | en | saves | Saves | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |
| 166 | Minor | 스타일 | `league.views.batting.title.9162d3a3` | en | home runs | Home Runs | Leaderboard/record label: Title Case like the other labels in the same list (Holds, Strikeouts, Stolen Bases) |

## 3. 판단 보류 항목과 권장안

| # | 항목 | 현재 상태 | 권장안 |
|---|---|---|---|
| 1 | **코드에서 조각을 이어 붙인 기사 문장.** 트레이드 기사의 선수 소개("김건준은 20세 선발투수로 2026 시즌 …"), 컴바인 기사 본문, 선수 일상 기사 일부("유찬용이 새벽 6시에 …"), 인터뷰 제목의 인용 조각, 도움말의 성장 유형 설명(유형 이름을 이어 붙인 단락) | 번역할 수 없는 문장은 한국어 그대로 둡니다. 한 문장 안에서 일부만 번역하지는 않지만, 여러 문장이나 쉼표로 이어진 조각이 한 단락이면 번역되는 조각만 바뀌어 한 단락에 두 언어가 섞입니다(예: "박현수는 21세 선발투수로 … Shim Sun-jae is a 21-year-old Shortstop.", 컴바인 기사의 "30m Sprint Kim Chan-jun (4.20 sec)"). 저장 문자열 기준으로 시즌 중 저장 494개 중 488개(98.8%)를 번역합니다 | (A, 권장) 해당 문장을 키 하나로 만들도록 코드를 고칩니다(`league/movenews.ts` about, `league/combine.ts`, `league/life.ts`, `league/interviews.ts`, 도움말의 성장 유형 단락). 이번 PR에서는 같은 방식으로 문자중계 줄만 고쳤습니다. (B) 한국어 원문으로 둡니다 |
| 2 | **사용자가 입력한 구단 이름**(예: "울산 고래단"), 모기업 이름 | 입력한 그대로 표시합니다(인계 메모의 "사용자 구단명 보존"). en/ja 화면에서도 한글로 보입니다 | (A) 그대로 둡니다. (B) 창단 화면에 영문/일문 표시 이름 칸을 추가합니다 |
| 3 | 엔진 오류 문구 26개(`draftroom/engine.js`, `press.js`, `draft-ai.js`) | 원본 드래프트룸 이식 코드로, 게임에서 불리지 않아 화면에 나오지 않습니다 | 그대로 둡니다. 드래프트룸 UI를 들일 때 번역합니다 |
| 4 | 외국인 이름 [확인 필요] 중 근거가 약한 것: 다샤 → Dashenko, 엘리 → Eli(イーライ, 한글 음은 Elly에 가까움) | 그대로 둡니다 | 원저자가 의도한 원어를 확인합니다. 엘리는 Elly/エリー가 한글 음에 맞습니다 |
| 5 | 일본어에서 가상의 한국 학교명을 가타카나로 쓸지 한자로 쓸지(`draftroom.catalog.institutions.*` 약 340개) | 가타카나 + 高校/大学(배치 노트 방식) | 그대로 권장합니다(한국인에게 한자를 지어내지 않는다는 규칙과 맞음) |
| 6 | 대만 선수 이름 | 영어는 병음(+ 웨이드-자일스 혼용), 일본어는 가타카나 | 한자 표기는 원문이 없어 쓰지 않습니다. 그대로 둡니다 |
| 7 | 짧은 UI 라벨 길이 후보 628개(en > ko×1.5, ja > ko×1.3) | 점검한 화면에서 잘림·넘침 없음 | 참고 목록으로만 둡니다. 새 화면을 추가할 때 다시 봅니다 |
| 8 | 숫자만 남은 개수("198개") | 무엇을 센 것인지 문장에 남아 있지 않아 숫자만 보입니다("(198)") | 1번의 코드 수정과 함께 해결합니다 |
| 9 | 한국어 날짜·순위 표기(10/9, 1위)가 영어 서수와 섞인 몇 곳 | 대체로 자연스럽습니다 | 화면별로 다시 확인합니다 |
| 10 | ja 'イニング'와 '回'가 섞여 있음(스카우팅 문장은 イニング, 기록 줄은 回) | 문맥상 둘 다 자연스럽습니다 | 기록 줄만 回로 맞추는 것을 권합니다(Minor) |

## 4. 한국어 원문 오탈자·모순 (수정하지 않음, 기록만)

| 키 | 원문 | 문제 |
|---|---|---|
| `league.national.resolveNational.body.1b443c11` 외 1 | `{short}이 …` | 구단 약칭 뒤에 조사 '이'를 고정했습니다. LG·SSG·KIA처럼 모음으로 끝나면 "LG이"가 됩니다. `iga()`를 써야 합니다 |
| `league.rival.rivalSpecialDraft.lines.e32dfd3e` | `{name}가 …{name2}을(를) …` | 구단명 뒤 '가' 고정("울산 고래단가")과 '을(를)' 병기가 섞여 있습니다 |
| `league.expansion.checkDecision.b75d2c42`, `league.expansion.resolveForeign.794d9cc2` | `{usd}을 넘습니다`, `보장 {usd}을 역제안` | usd()는 "40만 달러"를 돌려주므로 "달러을"이 됩니다(→ 를) |
| `league.fa.checkRound.0fb348ae` | `{eok}가 구단 자금 …` | "3억가"가 됩니다(→ 이) |
| `league.alerts.postingAlert.lines.3b73ea6a` | `이적료 {fee}를` | 값이 "…억"이면 "억를"이 됩니다 |
| `league.parent.sponsorReview.lines.51296435` | `목표 {goalText}을` | 목표 문구가 모음으로 끝나면 어색합니다 |
| `draftroom.biography.history.note.3cf890ad` | `{country}으로` | "미국으로"는 맞지만 받침 없는 나라("캐나다으로")에서 틀립니다 |
| 9곳 (`league.rivalry.crossing.*`, `league.training.checkTrip.*` 등) | `{name}이(가)`, `{name}은(는)` | 조사 병기. 다른 곳은 josa 함수를 씁니다 |
| 전체 | '2군'(20곳)과 '퓨처스'(72곳) | 같은 대상을 두 이름으로 부릅니다. 번역은 Futures/二軍으로 맞췄습니다 |
| 전체 | '등급' | FA 등급(A·B·C)과 20–80 능력 등급에 함께 씁니다. 번역은 FA → Grade/ランク, 능력 → Rating/評価로 나눴습니다 |
| `league.gamedetail` DEC | `S: '세이브'` | 다른 결정(W/L/H)은 k()로 추출됐는데 세이브만 리터럴로 남았습니다(표시 결과는 같음) |

## 5. 화면 점검 결과

방법은 `tests/browser/locales.mjs`입니다.

- **저장:** 시즌 중 저장(2027년 4월)과 FA 시장 저장(2027 겨울 1차 FA 라운드)을 불러왔습니다.
- **크기:** en·ja 각각 데스크톱 1440×1000과 휴대폰 390×844로 봤습니다.
- **돌아본 화면:**
  - 모든 탭과 하위 화면(소식·라인업·선수단·이적 시장·기록·역사·드래프트 후보·설정·도움말)
  - 팝업
  - 선수 상세(탭 전체)
  - 박스스코어 → 문자중계 → 기사
  - FA 협상창
- **기록한 것:** 남은 한국어, 잘린 라벨, 가로 스크롤.

| 항목 | 첫 점검 | 최종 |
|---|---|---|
| 화면에 남은 한국어(시즌 중 저장, en) | 179 문자열, 깨진 혼합 번역 다수 | 6 (모두 판단 보류 1의 이어 붙인 기사와 도움말 단락) |
| 화면에 남은 한국어(시즌 중 저장, ja) | — | 6 (같음) |
| 화면에 남은 한국어(FA 시장 저장, en/ja) | 185 / 196 | 6 / 8 (같음. ja는 인터뷰 제목 인용 2건 추가) |
| 잘린 라벨 | 0 | 0 |
| 가로 스크롤 | 1 (en 휴대폰 순위표: 포스트시즌 대진표 "Champion" 상자 +3px) | 0 (CSS: 영어에서 상자 폭을 넓혀 두 줄로 내림) |
| 두부(□) | 0 (일본어 글꼴은 Hiragino/Yu Gothic/Meiryo/Noto Sans JP 순, 점검 환경은 WenQuanYi로 가나·한자 모두 표시) | 0 |

스크린샷(문제가 있던 화면과 대표 화면)은 `docs/localization/screens/`에 있습니다.

- `en-phone-standings-before.png`: 대진표가 3px 넘치던 화면(수정 전).
- `en-phone-standings.png`: 수정 후.
- `en-desktop-my-club-news.png`, `ja-desktop-my-club-news.png`: 기사 목록. 이어 붙인 문장 일부가 한국어로 남은 예(판단 보류 1).
- `en-desktop-boxscore-pbp.png`, `ja-desktop-boxscore-pbp.png`: 문자중계.
- `en-desktop-fa-talk.png`, `ja-desktop-fa-talk.png`: FA 협상(연봉 협상).
- `en-desktop-player.png`, `ja-desktop-player.png`: 선수 상세.
- `ja-desktop-roster.png`: 일본어 선수단(選手一覧, 이번에 고친 탭 이름).
- `ja-phone-my-club.png`: 일본어 휴대폰 구단 화면(GM 브리핑).
- `en-desktop-trade.png`: 이적 시장(트레이드).
- `ja-desktop-foreign-market.png`: 외국인 교체 후보(대만 이름 포함).
- `en-desktop-draft-pool.png`, `ja-desktop-draft-pool.png`: 드래프트 후보.

## 6. 런타임 동작 (2단계 코드 검사 5–8 결과)

- **언어 전환**
  - 즉시 반영됩니다. 페이지를 그 자리에서 다시 그리고 게임 상태와 열린 화면은 유지합니다.
  - 선택은 `localStorage`의 `kbo.display.locale`에 저장되며 저장 파일과는 무관합니다.
- **없는 키:** 그 키의 한국어로 보입니다.
- **번역 실패:** 완전히 번역할 수 없는 문장은 원문 한국어 그대로 보입니다. 반쯤 섞인 문장은 내보내지 않습니다.
- **금액**
  - 저장 단위(만 원)와 입력 단위(억)는 그대로입니다.
  - 영어는 ₩175M, $400K로 보입니다.
  - 일본어는 1億7,500万ウォン으로 보입니다.
  - 키가 `{x}억`, `{x}만 원`, `{x}만 달러`, `{x}원`이면 영어 값의 `{x}`는 런타임이 금액으로 바꿉니다.
- **복수형·서수:** ICU plural/selectordinal을 씁니다. "5 2/3"처럼 숫자가 아닌 값이면 other 형태로 값을 그대로 보여 줍니다.
- **날짜:** 리소스 패턴을 따릅니다(en 7/31, ja 7月31日).
- **인명**
  - 한국인: 성 + 이름 표로 바꿉니다(Kim Min-jun / キム・ミンジュン). 표에 없는 이름은 그 게임에 실제로 있는 사람일 때만 로마자·가타카나로 옮깁니다. 그래서 '정원', '조건' 같은 낱말은 이름으로 오인하지 않습니다.
  - 외국인: 생성기 풀 표를 씁니다. 대만 이름은 붙여 쓴 형태도 처리합니다.
- **이전 저장 파일:** 키·저장 형식이 바뀌지 않았고 언어 정보는 저장에 들어가지 않습니다. compat 테스트(0.11~1.4 저장)가 통과합니다.
- **일본어 글꼴:** `html:lang(ja)`에서 일본어 글꼴을 먼저 씁니다. 한국어 글꼴이 앞에 오면 한자가 한국식 자형으로 보이기 때문입니다. 한글(구단명 등)은 뒤의 한국어 글꼴로 보입니다.
- **로직 문자열:** 비교·switch·객체 키·RNG에 쓰는 한국어 리터럴 189곳은 바꾸지 않았습니다. `t()`/`rich()`를 비교·저장에 쓰는 곳은 0곳입니다(자동 검사).

## 7. 갱신한 용어집

검사 스크립트가 쓰는 용어집은 `src/i18n/glossary.json`입니다. 아래는 이번 검토로 확정하거나 바꾼 항목을 포함한 주요 용어입니다.

| 한국어 | English | 日本語 | 비고 |
|---|---|---|---|
| 단장 | GM | GM | 플레이어를 가리킬 때는 you |
| 감독 | Manager | 監督 | |
| 1군 / 1군 엔트리 | First Team / First-Team Roster | 一軍 / 一軍登録 | |
| 말소 | Removed from the first-team roster / Demote to Futures | 登録抹消 | KBO에는 옵션 제도가 없어 optioned는 쓰지 않음 |
| 콜업 | Call-up | 昇格 | |
| 퓨처스(2군) | Futures (Futures League) | 二軍 | 2군·퓨처스 모두 이렇게 |
| 잔류군 | Reserve Squad | 残留組 | |
| 선발 / 중계 / 마무리 | Starter / Reliever / Closer | 先発 / 中継ぎ / 抑え | 선발(선수 선출) = Selection / 選出 |
| 불펜 | Bullpen (조직) · Reliever (보직) | ブルペン · リリーフ | |
| 필승조 / 추격조 / 원 포인트 | High-Leverage Reliever / Trailing-Game Reliever / One-Batter Specialist | 勝ちパターン / ビハインド要員 / ワンポイント | [확인 필요] 결정: 유지 |
| 대타 / 대주자 | Pinch Hitter / Pinch Runner | 代打 / 代走 | |
| 타석 / 타수 / 상대 타석 | PA / AB / BF | 打席 / 打数 / 対戦打席 | |
| 볼넷 / 사구 / 삼진 | BB (Walk) / HBP / SO·K | 四球 / 死球 / 三振 | 표 머리글은 SO, 문장은 K |
| 홀드 / 세이브 / 블론세이브 | HLD (Hold) / SV (Save) / Blown Save | ホールド / セーブ / セーブ失敗 | 투수 결정 W/L/S/H = Win/Loss/Save/Hold |
| 끝내기 | Walk-off | サヨナラ | |
| 평균자책점 / 타율 / 출루율 / 장타율 | ERA / AVG / OBP / SLG | 防御率 / 打率 / 出塁率 / 長打率 | |
| 문자중계 | Play-by-play | 一球速報 | ja 통일 |
| 골든글러브 | **Golden Glove** | ゴールデングラブ賞 | Gold Glove(MLB)에서 변경 |
| 2차 드래프트 | **Second Draft** | 2次ドラフト | Secondary Draft 4곳 통일 |
| 보상선수 | Compensation Player | 人的補償 | NPB 용어 |
| 샐러리캡 / 경쟁균형세 / 제재금 | Salary Cap / Competitive Balance Tax / Penalty | サラリーキャップ / 戦力均衡税 / 制裁金 | luxury tax 금지 |
| 웨이버 | Waivers | **ウェーバー** | ウェイバー에서 변경 |
| 로스터 | Roster | **ロースター** | |
| 연봉 / 계약금 / 옵션 | Salary / Signing Bonus / Incentives | 年俸 / 契約金 / オプション | |
| 등급 (FA) / 등급 (능력) | Grade / Rating | ランク / 評価 | |
| 상무 / 병역 | Sangmu / Military Service | 尚武 / 兵役 | |
| 한국시리즈 / 포스트시즌 | Korean Series / Postseason | 韓国シリーズ / ポストシーズン | |
| 금액 | ₩350M, $400K (런타임) | 3億5,000万ウォン, 40万ドル | 7장 앞 6장 참고 |
| 한국 인명 | Kim Min-jun (성 이름, 이름 둘째 음절 소문자) | キム・ミンジュン | 한자 표기 만들지 않음 |

## 8. 검사 스크립트 사용법

```bash
npm run i18n:check                   # 요약 출력. Critical이 있으면 종료 코드 1
npm run i18n:check -- --list 30      # 항목마다 예시 30개까지 출력
npm run i18n:check -- --json out.json  # 전체 결과를 JSON으로 저장
npm run i18n:check -- --strict       # Major가 있어도 실패 처리
node scripts/i18n-hints.mjs          # 추출을 다시 하면 파라미터 단서(param-hints.json) 갱신
```

- **리소스 검사**
  - JSON 유효성과 키 일치.
  - 빈 값과 원문 복사(의도한 조사 조각은 info로 분리).
  - en/ja에 남은 한글.
  - 변수 이름·개수·legacy 조사 토큰(ICU 파서로 확인).
  - 줄바꿈·태그, 영어 복수형, 짧은 UI 라벨 길이.
  - 일본어 표기(반각 문장부호, 반각 가나, 장음, 가타카나 표기 흔들림).
  - 용어집(`src/i18n/glossary.json`), 인명 표의 중복·빈칸·커버리지.
- **코드 검사**
  - 코드가 쓰는 키가 리소스에 있는지, 쓰이지 않는 키.
  - 추출이 놓친 한국어.
  - 남겨 둔 한국어 중 표시용인데 리소스가 없는 것.
  - 비교·switch·객체 키에 쓰인 한국어 로직 문자열.
  - `t()`/`rich()`를 비교·저장에 쓰는지.
- **화면 점검** (빌드 후)

  ```bash
  CHROMIUM_BIN=/opt/pw-browsers/chromium node tests/browser/locales.mjs [저장 파일.json.gz]
  ```

  결과는 `tests/browser/screenshots/locales.json`과 PNG로 나옵니다. 저장 파일을 주지 않으면 가장 최근 fixture를 씁니다.
- **단위 테스트:** `npx vitest run tests/i18n.test.ts`
