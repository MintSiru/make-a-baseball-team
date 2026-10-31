/* Browser smoke test: opens the built dist/index.html from file:// in real Chromium.
   Founds an expansion club (afterFutures), makes every decision up to its first first-team season,
   visits every screen, reloads to check the autosave, then checks layouts at four sizes and the
   spectator path on a phone-sized screen.
   Run `npm run build` first. Uses CHROMIUM_BIN when set, else Playwright's own browser lookup.
   Screenshots go to tests/browser/screenshots/ (git-ignored). */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(join(root, 'dist', 'index.html')).href;
const shots = join(root, 'tests', 'browser', 'screenshots');
mkdirSync(shots, { recursive: true });

const SIZES = [
  [1440, 1000],
  [820, 1180],
  [390, 844],
  [320, 740],
];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
const status = (page) => page.locator('.status').first().textContent();
const waitStatus = (page, text, timeout = 120_000) => page.waitForFunction((t) => document.querySelector('.status')?.textContent?.includes(t), text, { timeout });
// 2.0.30: a season opens with its spring games (시범경기) before the regular season.
// 2.0.59: or (`orDecision`) a decision waiting in the season — the status line then says so instead.
const waitSeason = (page, year = '', timeout = 120_000, orDecision = false) =>
  page.waitForFunction(
    ([y, d]) => [`${y} 정규시즌`, `${y} 시범경기`, ...(d ? ['결정할 일이 있습니다'] : [])].some((t) => document.querySelector('.status')?.textContent?.includes(t.trim())),
    [String(year), orDecision],
    { timeout },
  );
const noOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${label}: page scrolls sideways by ${overflow}px`);
};

/** Batch choices (V0.7.6) are tried once each: the select-all box and a row of one-click settings. */
const batch = { all: false, bar: false, fa: false, stops: 0 };
// 0.15: axe-core (WCAG 2 A/AA) on a screen; serious and critical findings fail the run.
const AXE = join(root, 'node_modules', 'axe-core', 'axe.min.js');
async function axeCheck(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
  const found = await page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`),
  );
  check(found.length === 0, `accessibility ${label}: ${found.join('; ')}`);
}

/** Makes every pending decision the way the scouts suggest (draft picks: the first one by hand). */
/** 1.9.9: a decision left short asks before it is sent (Decision.tsx omission); the run confirms and keeps the question. */
const warned = [];
async function decideAll(page, log) {
  const onDialog = (d) => {
    warned.push(d.message());
    void d.accept();
  };
  page.on('dialog', onDialog);
  try {
    await decideEach(page, log);
  } finally {
    page.off('dialog', onDialog);
  }
}

async function decideEach(page, log) {
  let handPicked = false;
  for (let i = 0; i < 80; i++) {
    const decision = page.locator('#decision-title');
    // 2.0.59: a decision that came while another tab was opened (the season's run of days stops for it and its
    // screen comes forward, but the run may have gone to the games since): back to it first.
    if (!(await decision.count()) && (await page.locator('.tabs .tab-waiting').count())) {
      await page.locator('.tabs .tab-waiting').click();
      await decision.waitFor({ timeout: 10_000 });
    }
    if (!(await decision.count())) return;
    const title = (await decision.textContent()) ?? '';
    log.push(title);
    if (title === '2차 드래프트') {
      await page.getByRole('button', { name: '스카우트에게 맡기기' }).click();
    } else if (title.startsWith('FA 시장')) {
      // The negotiation (V0.8): one talk by hand the first time (his terms, the reaction, an offer, withdrawn),
      // then the scouts keep our own free agents and the market runs to its end.
      if (!batch.fa) {
        batch.fa = true;
        // 0.10.1: the name opens his profile (grades and stats are in the list too); talks open from the button.
        check(/\d/.test((await page.locator('.fa-table tbody tr').first().locator('td').nth(4).textContent()) ?? ''), 'the free-agent list shows his grade');
        // 0.16: what the foreign players, signed after the market, will need from the same budget.
        check(/외국인 몫/.test((await page.locator('.fa-summary').textContent()) ?? ''), 'the market keeps the foreign players in view');
        await page.locator('.fa-table tbody .link').first().click();
        await page.locator('.dialog.profile').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.fa-table tbody .talk-button').first().click();
        await page.getByRole('button', { name: '요구 수준', exact: true }).click();
        // A typed amount with a decimal point (a phone keyboard types "12." on the way to "12.5").
        const bonus = page.getByRole('textbox', { name: '계약금 (억)' });
        await bonus.fill('');
        await bonus.pressSequentially('12.5');
        check((await bonus.inputValue()) === '12.5', 'a decimal amount can be typed');
        await page.getByRole('button', { name: '바로 사인 수준' }).click();
        check(((await page.locator('.fa-reaction strong').textContent()) ?? '').length > 0, 'the free agent reacts to an offer');
        await page.getByRole('button', { name: /^제안 (넣기|고치기)$/ }).click();
        check((await page.locator('.fa-talk').textContent())?.includes('보낼 제안'), 'an offer waits for the next round');
        await page.screenshot({ path: join(shots, 'fa-market.png'), fullPage: false });
        await page.getByRole('button', { name: '제안 철회' }).click();
      }
      await page.getByRole('button', { name: /스카우트 추천/ }).click();
      const close = page.getByRole('button', { name: '시장 끝까지' });
      if (await close.isDisabled()) {
        failures.push(`${title}: the scouts' offers are not valid (${await page.locator('.notice.inline').textContent()})`);
        return;
      }
      await close.click();
    } else if (title === '신인 드래프트') {
      if (!handPicked) {
        const name = await page.locator('.pick-table .link').first().textContent();
        await page.locator('button.pick').first().click();
        handPicked = true;
        await page.waitForFunction((n) => !document.querySelector('.pick-table .link') || document.querySelector('.decision')?.textContent?.includes(n), name);
      } else await page.getByRole('button', { name: '스카우트에게 맡기기' }).click();
    } else {
      const all = page.locator('.decision th input[type=checkbox]').first();
      if (!batch.all && (await all.count())) {
        batch.all = true;
        const rows = page.locator('.decision tbody input[type=checkbox]');
        const total = await rows.count();
        await all.check();
        const picked = await page.locator('.decision tbody input[type=checkbox]:checked').count();
        check(picked > 0 && picked <= total, `${title}: select-all picks players (${picked}/${total})`);
        await all.uncheck();
        check((await page.locator('.decision tbody input[type=checkbox]:checked').count()) === 0, `${title}: select-all clears the picks`);
      }
      const bar = page.locator('.bulk-bar button').first();
      if (!batch.bar && (await bar.count())) {
        batch.bar = true;
        await bar.click();
        check((await page.locator('.decision select').count()) > 0, `${title}: one-click setting leaves the per-player choices`);
      }
      await page.getByRole('button', { name: /추천으로 채우기/ }).click();
      // 1.5.0: the recommendation comes with its reasons.
      if (await page.locator('.decision .advice').count()) adviceSeen.push(title);
      const confirm = page.getByRole('button', { name: '확정' });
      if (await confirm.isDisabled()) {
        failures.push(`${title}: scout recommendation is not a valid decision (${await page.locator('.notice.inline').textContent()})`);
        return;
      }
      await confirm.click();
    }
    await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
    await page.waitForTimeout(50);
  }
  failures.push('too many decisions');
}

const adviceSeen = [];

async function playSeason(page, log = []) {
  // V0.12: the season can stop for a decision (a national-team call-up, a disciplined player); answer and go on.
  // 1.6.0: it also stops at the moments that matter (a long injury, the deadline, the debut, the race): go on.
  let stops = 0;
  for (let i = 0; i < 30; i++) {
    // 2.0.27: a slow runner may still be simulating the last days, or a decision may have come up meanwhile (CI once
    // timed out on the click): wait for the controls, answer what is pending, then go on.
    await page.waitForFunction(() => !!document.querySelector('#decision-title') || !document.querySelector('fieldset.controls')?.disabled, null, { timeout: 90_000 });
    if (await page.locator('#decision-title').count()) {
      await decideAll(page, log);
      continue;
    }
    const before = (await page.locator('.status').textContent()) ?? '';
    await page.getByRole('button', { name: '정규시즌 끝까지' }).click({ timeout: 90_000 });
    const post = page.getByRole('button', { name: '포스트시즌 시작' });
    const decision = page.locator('#decision-title');
    await page.waitForFunction(
      (was) => !!document.querySelector('#decision-title') || [...document.querySelectorAll('button')].some((b) => b.textContent === '포스트시즌 시작') || (!document.querySelector('fieldset.controls')?.disabled && document.querySelector('.status')?.textContent !== was),
      before,
      { timeout: 90_000 },
    );
    if (await post.count()) break;
    if (await decision.count()) await decideAll(page, log);
    else stops++;
  }
  batch.stops += stops;
  // 1.3.0: the postseason goes game by game: the bracket, one game day, then the rest.
  await page.getByRole('button', { name: '포스트시즌 시작' }).click();
  await page.getByRole('button', { name: '다음 경기' }).click();
  await page.waitForFunction(() => document.querySelector('.status')?.textContent?.includes('포스트시즌') && !document.querySelector('fieldset.controls')?.disabled, null, { timeout: 90_000 });
  check(((await page.locator('.status').textContent()) ?? '').includes('포스트시즌'), 'the postseason goes a game day at a time');
  // 1.4.0: the bracket on the standings tab shows the round being played and the games so far.
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  check((await page.locator('.bracket-steps li.live').count()) === 1, 'the bracket marks the round being played');
  check((await page.locator('.bracket .game-chip').count()) >= 1, 'the bracket shows the games played');
  await page.screenshot({ path: join(shots, 'bracket.png'), fullPage: false });
  await page.getByRole('button', { name: '포스트시즌 끝까지' }).click();
  await page.getByRole('button', { name: '다음 시즌으로' }).waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: '다음 시즌으로' }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled && !document.querySelector('.status')?.textContent?.includes('진행 중'), null, { timeout: 90_000 });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
/** 2.0.62: the run walks the legacy screens (its checks were written for them) unless the page was switched; the new
    screens get their own section on the same league (7b). */
const LEGACY_FIRST = () => {
  try {
    const key = 'kbo-expansion-display';
    const v = JSON.parse(localStorage.getItem(key) || '{}');
    if (!v.ui) localStorage.setItem(key, JSON.stringify({ ...v, ui: 'legacy' }));
  } catch {
    // No storage: the page's own default.
  }
};
/** 2.0.59: the main page, for what it showed when a step failed (the run's random league is gone with it). */
let main = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(LEGACY_FIRST);
  const page = await context.newPage();
  main = page;
  const errors = [];
  page.on('pageerror', (e) => (errors.push(e.message), console.log('page error:', e.message)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 0. 1.4.1: getting a game back. A save whose league is cut short brings up the recovery choices (it used to leave
  // the page on "불러오는 중"), and a seed changed while the default league is being built is the one that opens.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(LEGACY_FIRST);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => (errors.push(e.message), console.log('page error:', e.message)));
    await p.goto(url);
    await p.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
    check((await p.locator('header .file-button').filter({ hasText: '진행 파일 불러오기' }).count()) === 1, 'the founding screen can open a save file');
    const sim = readFileSync(join(root, 'src', 'core', 'version.ts'), 'utf8').match(/SIM_VERSION = '([^']+)'/)[1];
    const planted = await p.evaluate(async (sim) => {
      try {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('kbo-expansion', 1);
          r.onupgradeneeded = () => r.result.objectStoreNames.contains('saves') || r.result.createObjectStore('saves', { keyPath: 'slot' });
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const save = { format: 'kbo-expansion-save', version: 1, sim, release: sim, seed: 'broken', savedAt: new Date().toISOString(), snapshot: { at: { year: 2027, phase: 'regularSeason' }, state: { teams: [{ id: 'kia' }], rosters: {} } }, inputs: [] };
        await new Promise((res, rej) => {
          const r = db.transaction('saves', 'readwrite').objectStore('saves').put({ slot: 'auto', seed: 'broken', savedAt: save.savedAt, text: JSON.stringify(save) });
          r.onsuccess = res;
          r.onerror = () => rej(r.error);
        });
        db.close();
        return true;
      } catch {
        return false;
      }
    }, sim);
    if (planted) {
      await p.reload();
      await p.locator('.recovery').waitFor({ timeout: 30_000 });
      check(((await p.locator('.notice').first().textContent()) ?? '').includes('자동 저장을 열지 못했습니다'), 'a damaged autosave is reported, not left loading');
      check((await p.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).count()) === 1, 'the founding screen stays usable beside the recovery choices');
      await p.screenshot({ path: join(shots, 'recovery.png'), fullPage: false });
    } else console.log('(IndexedDB not available on this page: damaged-autosave check skipped)');
    await p.locator('details.advanced > summary').click();
    await p.getByLabel('시드').fill('smoke-seed-race');
    await p.getByRole('button', { name: '구단 없이 리그만 관전' }).click();
    await p.waitForFunction(() => document.body.textContent?.includes('관전 모드'), null, { timeout: 180_000 });
    check(((await p.locator('body').textContent()) ?? '').includes('시드 smoke-seed-race'), 'the league opens with the seed typed while the default one was being built');
    await ctx.close();
  }

  // 1. Found a club.
  const t0 = Date.now();
  await page.goto(url);
  await page.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  check((await page.locator('section[aria-labelledby="ng-city"] .choice').count()) >= 10, 'candidate cities listed');
  // 1.6.0: scenarios fix some conditions and lock them; going back to a free founding frees them again.
  check((await page.getByRole('radiogroup', { name: '시나리오' }).getByRole('radio').count()) === 16, 'fifteen scenarios beside the free founding');
  await page.getByRole('radio', { name: /돌격대의 귀환/ }).click();
  check((await page.getByLabel('구단명').inputValue()) === '쌍방울 레이더스' && (await page.getByLabel('구단명').isDisabled()), 'a scenario fixes and locks the club name');
  check(((await page.locator('.scenario-brief').textContent()) ?? '').includes('목표'), 'the scenario tells its story and goal');
  await page.getByRole('radio', { name: /섬그늘에 야구하러 가면/ }).click();
  check(((await page.locator('section[aria-labelledby="ng-city"]').textContent()) ?? '').includes('울릉'), 'the island scenario starts in 울릉');
  check(((await page.locator('.risks').textContent()) ?? '').includes('시장 규모'), 'the risks of the combination are spelled out');
  await page.screenshot({ path: join(shots, 'scenario.png'), fullPage: false });
  await page.getByRole('radio', { name: /자유 창단/ }).click();
  check((await page.getByLabel('구단명').inputValue()) === '' && !(await page.getByLabel('구단명').isDisabled()), 'a free founding frees the name again');
  await page.getByLabel('구단명').fill('울산 고래단');
  await page.getByLabel('약칭').fill('고래');
  await page.getByLabel('모기업 이름').fill('가상그룹');
  check((await page.locator('.summary .stars').textContent())?.includes('★'), 'felt difficulty shown');
  // 1.5.0: the start time and the guide are chosen apart; a futures year with the guide is the default.
  check((await page.getByRole('group', { name: '1군 진입' }).getByRole('button', { name: /^퓨처스 1년 뒤/ }).getAttribute('aria-pressed')) === 'true', 'a futures year first is the default');
  check((await page.getByRole('group', { name: '안내' }).getByRole('button', { name: /^튜토리얼 안내 받기/ }).getAttribute('aria-pressed')) === 'true', 'the guide is on by default');
  check((await page.getByRole('button', { name: '추천 조건으로 바로 시작' }).count()) === 1, 'a quick start with the recommended setup is offered');
  // V0.9: a twelfth club, the rival, founded in a set winter (1.5.0: under the folded advanced settings).
  await page.locator('details.advanced > summary').click();
  await page.getByRole('group', { name: '12구단 창단' }).getByRole('button', { name: '연도 지정' }).click();
  check((await page.getByLabel('창단 연도').inputValue()) === '2030', 'the rival comes in the winter of 2030 by default');
  await page.screenshot({ path: join(shots, 'new-game.png'), fullPage: true });
  await page.getByRole('button', { name: '창단 신청' }).click();
  await page.locator('#decision-title').waitFor({ timeout: 120_000 });
  console.log(`founded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check((await page.locator('#decision-title').textContent()) === '창단 트라이아웃', 'tryout comes first');
  const founded = page.getByRole('alertdialog');
  await founded.waitFor();
  check((await founded.textContent())?.includes('창단'), 'the founding pops up as an achievement');
  await page.screenshot({ path: join(shots, 'alert.png'), fullPage: false });
  // From here on, event pop-ups (V0.7.4) are closed whenever one is in the way.
  // Pop-ups can keep coming while the season runs on (a new one opens as the last is closed): close them as they come
  // and do not wait for the dialog to be gone for good before the next action (2.0.2: CI timed out waiting so).
  await page.addLocatorHandler(
    page.getByRole('alertdialog'),
    async (dialog) => {
      // 2.0.7: the new-game warning is the test's own to answer.
      if ((await dialog.getAttribute('aria-labelledby').catch(() => null)) === 'new-game-title') return;
      for (let k = 0; k < 20 && (await dialog.isVisible().catch(() => false)); k++) {
        const all = dialog.getByRole('button', { name: '모두 확인' });
        const one = dialog.getByRole('button', { name: '확인', exact: true });
        const button = (await all.count()) ? all : (await one.count()) ? one : dialog.getByRole('button').first();
        await button.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(50);
      }
    },
    { noWaitAfter: true },
  );
  // Tutorial mode (V0.7.5): the guide opens with the founding and moves on as lessons are read.
  check((await page.locator('.tutorial h2').textContent())?.includes('환영합니다'), 'the tutorial welcomes the new general manager');
  await page.screenshot({ path: join(shots, 'tutorial.png'), fullPage: false });
  await page.locator('.tutorial').getByRole('button', { name: '알겠어요' }).click();
  await page.waitForFunction(() => document.querySelector('.tutorial h2')?.textContent === '결정할 일');
  check((await page.locator('.decision details.help summary').first().textContent()) === '이 결정은?', 'a decision explains itself (이 결정은?)');
  check((await page.locator('h1').textContent()) === '울산 고래단', 'masthead shows the club');
  // Display settings (V0.7.6): the bar colours by grade tier, kept in this browser. Since 0.13 they live in
  // the settings tab, opened from the masthead.
  await page.locator('.masthead').getByRole('button', { name: '설정', exact: true }).click();
  await page.locator('#settings-display').waitFor();
  await page.getByRole('radio', { name: /등급별 색/ }).check();
  check((await page.evaluate(() => document.documentElement.style.getPropertyValue('--grade-4'))) !== '', 'bar colours by grade tier are applied');
  await page.getByRole('checkbox', { name: /선수 표의 현재·미래 능력치/ }).check();
  check((await page.evaluate(() => document.documentElement.dataset.gradeTables)) === 'on', 'grades in the tables can be coloured');
  // 1.6.0: our games can open as a relay with the score hidden.
  check((await page.getByRole('checkbox', { name: /우리 경기 결과 가리기/ }).count()) === 1, 'the score of our games can be hidden');
  // 0.11: the articles about our club pop up too, with a switch of their own.
  const articles = page.getByRole('checkbox', { name: /우리 구단 기사/ });
  check(await articles.isChecked(), 'articles about our club pop up by default');
  await page.screenshot({ path: join(shots, 'display-settings.png'), fullPage: false });
  // 0.13: the clubs can take the fictional names (and back); the standings follow.
  await page.getByRole('button', { name: '가상 이름 세트 넣기' }).click();
  await page.getByRole('button', { name: '이름 적용' }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  check((await page.locator('.standings').first().textContent())?.includes('솔빛'), 'standings show the renamed clubs');
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  await page.locator('#settings-clubs').screenshot({ path: join(shots, 'club-names.png') });
  await page.getByRole('button', { name: '실제 이름 넣기' }).click();
  await page.getByRole('button', { name: '이름 적용' }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  check((await page.locator('.standings').first().textContent())?.includes('KIA'), 'the real names come back');
  // 0.14: the difficulty can change mid-game (confirmed, then noted on the timeline).
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('group', { name: '난이도' }).getByRole('button', { name: '어려움', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="난이도"] [aria-pressed="true"]')?.textContent === '어려움');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('group', { name: '난이도' }).getByRole('button', { name: '보통', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="난이도"] [aria-pressed="true"]')?.textContent === '보통');
  check(true, 'difficulty switches back and forth');
  // 1.6.0: the moments a run of days stops for, all on to begin with (1.7.1: and before our postseason games; 1.9.0: and for our postseason entry; 2.0.42: and the national team's games; 2.0.53: and a trade offer).
  const stopsBox = page.getByRole('group', { name: '진행 중 멈출 순간' });
  check((await stopsBox.getByRole('checkbox').count()) === 8 && (await stopsBox.getByRole('checkbox').first().isChecked()), 'the stops are listed and on');
  await page.getByRole('button', { name: /결정할 일/ }).click();
  const log = [];
  await decideAll(page, log);

  // 2. The rest of 2026, the first draft, then the futures year.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '선수단', exact: true }).click();
  check((await page.locator('.squad-table tbody tr').count()) > 0, 'tryout signings on the roster');
  await playSeason(page);
  await decideAll(page, log);
  check(log.filter((t) => t === '신인 드래프트').length >= 15, `first draft gives many picks (${log.filter((t) => t === '신인 드래프트').length})`);
  await waitSeason(page, 2027);
  // 2.0.53: the spring games to the last in one go; the next day is opening day.
  const spring = page.getByRole('button', { name: '시범경기 끝까지', exact: true });
  check((await spring.count()) === 1, 'the spring games can be played to the last');
  if (await spring.count()) {
    await spring.click();
    await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
    check((await spring.count()) === 0 && ((await status(page)) ?? '').includes('2027 정규시즌'), `the spring games are over (${await status(page)})`);
  }
  await page.getByRole('button', { name: '1주', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '개요', exact: true }).click();
  check((await page.locator('.cards').first().textContent())?.includes('퓨처스'), 'futures record shown in 2027');
  // 1.5.0: the general manager's briefing on top of the overview.
  check((await page.getByRole('heading', { name: '단장 브리핑' }).count()) === 1, 'the overview opens with the briefing');
  await page.screenshot({ path: join(shots, 'my-club-futures.png'), fullPage: false });

  // 3. Into the first team: free agents, special draft, foreign players.
  const before = log.length;
  await playSeason(page);
  await page.screenshot({ path: join(shots, 'decision.png'), fullPage: false });
  // The winter: the front office stays open beside the decision, and ballpark work can start.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '구단 운영', exact: true }).click();
  await page.getByRole('group', { name: '구단 운영' }).getByRole('button', { name: '구장', exact: true }).click();
  check(!(await page.locator('.page').textContent())?.includes('공사는 비시즌에만'), 'ballpark work can start during the winter');
  // 2.0.2: the layout editor draws the park and prices a change.
  check((await page.locator('.layout-field').count()) > 0, 'the layout editor draws the park');
  await page.locator('.layout-editor select').selectOption('fenway');
  check((await page.locator('.layout-table tbody tr').count()) === 19, 'a major-league park loads on the fine grid');
  await page.locator('.layout-editor').screenshot({ path: join(shots, 'layout-fenway.png') });
  await page.locator('.layout-editor button', { hasText: '지금 펜스로 되돌리기' }).click();
  const start = page.locator('.page button:not([disabled])', { hasText: /^시작$/ });
  if (await start.count()) {
    await start.first().click();
    await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
    check((await page.locator('.page').textContent())?.includes('완공 예정'), 'started ballpark work is listed');
  }
  await page.screenshot({ path: join(shots, 'winter-ballpark.png'), fullPage: false });
  await page.getByRole('button', { name: /결정할 일/ }).click();
  await decideAll(page, log);
  const winter = log.slice(before);
  for (const t of ['특별지명', '외국인 선수 계약']) check(winter.includes(t), `winter before the first team includes ${t} (${winter.filter((x) => x !== '신인 드래프트').join(', ')})`);
  for (const t of ['신인 계약금 협상', '스프링캠프', '코칭스태프 · 프런트']) check(log.includes(t), `yearly decisions include ${t}`);
  await waitSeason(page, 2028);

  // 3b. The front office: every section, a ticket price change, the futures year's accounts.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '구단 운영', exact: true }).click();
  for (const sec of ['모기업', '재정', '관중 · 티켓', '스태프', '구장', '시설', '12구단 · 라이벌', '자금 내역', '요약']) {
    await page.getByRole('group', { name: '구단 운영' }).getByRole('button', { name: sec, exact: true }).click();
    if (sec === '재정') {
      check((await page.locator('.report-table').count()) === 1, 'the futures year was settled');
      await page.screenshot({ path: join(shots, 'office-money.png'), fullPage: false });
    }
    if (sec === '시설') check((await page.locator('.record-table.facilities tbody tr').count()) >= 10, 'every facility can be built in levels');
    if (sec === '관중 · 티켓') check((await page.locator('.favourites li').count()) >= 3, 'the fans have favourites');
    if (sec === '12구단 · 라이벌') check((await page.getByLabel('창단 연도').inputValue()) === '2030', 'the twelfth-club setting carries over to the front office');
    if (sec === '관중 · 티켓') {
      await page.getByLabel('티켓 가격').selectOption('1.20');
      await page.waitForFunction(() => document.querySelector('select[aria-label="티켓 가격"]')?.value === '1.20');
      // 0.12: season tickets for the next opening.
      await page.getByLabel('시즌권 할인율').selectOption('0.2');
      await page.waitForFunction(() => document.querySelector('select[aria-label="시즌권 할인율"]')?.value === '0.2');
    }
  }
  await page.getByRole('button', { name: '순위', exact: true }).click();
  check((await page.locator('.standings tbody tr').count()) === 11, 'eleven clubs in 2028');
  check((await page.locator('.standings').textContent())?.includes('울산 고래단'), 'our club in the standings');

  // 4. Sorting and running the first team by hand.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.screenshot({ path: join(shots, 'overview.png'), fullPage: false });
  // V0.7.7: the club at a glance in the sidebar, the overview as panels (standings, injuries, upcoming games…).
  check((await page.locator('.club-summary').textContent())?.includes('부상'), 'the sidebar sums up the club');
  check((await page.locator('.dash-grid .panel').count()) >= 6, 'the overview shows its panels side by side');
  await page.getByRole('button', { name: '선수단', exact: true }).click();
  const firstTeam = page.locator('.squad-table').first();
  await firstTeam.getByRole('button', { name: /^현재/ }).click();
  const grades = (await firstTeam.locator('tbody tr td:nth-child(4)').allTextContents()).map(Number);
  check(grades.every((g, i) => i === 0 || grades[i - 1] >= g), `현재 heading sorts high to low (${grades.join(',')})`);
  await firstTeam.getByRole('button', { name: /^나이/ }).click();
  const ages = (await firstTeam.locator('tbody tr td:nth-child(3)').allTextContents()).map(Number);
  check(ages.every((a, i) => i === 0 || ages[i - 1] <= a), `나이 heading sorts young to old (${ages.join(',')})`);
  await page.getByRole('button', { name: '직접 관리' }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
  const rowsNow = () => page.evaluate(() => document.querySelectorAll('.squad-table tbody tr').length);
  const before1 = await rowsNow();
  await page.locator('.squad-table').first().getByLabel(/관리$/).first().selectOption('futures');
  await page.waitForFunction((n) => document.querySelectorAll('.squad-table tbody tr').length === n - 1, before1);
  await page.getByRole('button', { name: /^퓨처스/ }).click();
  await page.locator('.squad-table select[aria-label$="관리"]:has(option[value="active"])').first().selectOption('active');
  await page.getByRole('group', { name: '선수단' }).getByRole('button', { name: /^1군/ }).click();
  await page.getByLabel(/불펜 보직$/).first().selectOption('CL');
  await page.waitForFunction(() => [...document.querySelectorAll('.squad-table td')].some((td) => (td.querySelector('select')?.value === 'CL')));
  await page.getByLabel(/플래툰$/).first().selectOption('L');
  await page.screenshot({ path: join(shots, 'manual-entry.png'), fullPage: false });

  // 4b. Lineup at a glance, and a game's box score with the text relay.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '라인업', exact: true }).click();
  check((await page.locator('svg.diamond .spot').count()) === 9, 'nine players on the diamond');
  // 0.16: the tutorial (still on) explains the part of the club screen that is open, once the lessons before it are read.
  const lessonNow = () => page.evaluate(() => document.querySelector('.tutorial h2')?.textContent ?? '');
  for (let i = 0; i < 6; i++) {
    const title = await lessonNow();
    if (!title || title === '라인업') break;
    await page.locator('.tutorial').getByRole('button', { name: '알겠어요' }).click();
    await page.waitForFunction((t) => (document.querySelector('.tutorial h2')?.textContent ?? '') !== t, title, { timeout: 10_000 }).catch(() => {});
  }
  check((await lessonNow()) === '라인업', `the tutorial explains the lineup view when it is opened (${await lessonNow()})`);
  await page.getByRole('button', { name: '상대 좌완 선발' }).click();
  // The general manager's lineup card (V0.8): fix today's lineup, save it, and play a week with it.
  await page.getByRole('button', { name: '직접 짜기' }).click();
  await page.getByRole('button', { name: '지금 라인업 그대로 고정' }).click();
  await page.getByRole('button', { name: '카드 저장' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.lineup table .tag').length >= 9);
  check((await page.locator('.lineup-card').textContent())?.includes('좌완 상대 9'), 'lineup card saved with nine fixed spots');
  await page.screenshot({ path: join(shots, 'lineup.png'), fullPage: false });
  await page.getByRole('button', { name: '1주', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled, null, { timeout: 90_000 });
  // 2.0.30: past the spring games into the season, until we have a regular-season game of our own to watch (a run of
  // days may stop early, at opening day or for a decision).
  await page.getByRole('button', { name: '경기', exact: true }).click();
  const ourGames = page.locator('.split .panel').first().getByRole('button', { name: '기록지 · 중계' });
  for (let i = 0; i < 5 && !(await ourGames.count()); i++) {
    await decideAll(page, log);
    await page.getByRole('button', { name: '1주', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled, null, { timeout: 90_000 });
    await page.getByRole('button', { name: '경기', exact: true }).click();
  }
  await ourGames.first().click();
  await page.getByRole('dialog').waitFor();
  check((await page.locator('.linescore tbody tr').count()) === 2, 'line score has two clubs');
  await page.getByRole('tab', { name: '문자중계' }).click();
  check((await page.locator('.relay li').count()) > 20, 'text relay has plays');
  await page.getByRole('button', { name: '처음부터 관전' }).click();
  await page.getByRole('button', { name: '끝까지 보기' }).waitFor();
  await page.screenshot({ path: join(shots, 'boxscore.png'), fullPage: false });
  await page.getByRole('button', { name: '끝까지 보기' }).click();
  await page.getByRole('tab', { name: '기사' }).click();
  const write = page.getByRole('button', { name: '기사로 쓰기' });
  if (await write.count()) await write.click();
  await page.locator('.box-dialog .news-card').waitFor();
  check((await page.locator('.box-dialog .news-facts li').count()) > 5, 'game article carries its fact lines');
  await page.keyboard.press('Escape');

  // 4c. V0.10: a player to a training centre abroad during the season.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '훈련·연수', exact: true }).click();
  // 2.0.31: each programme on its own tab.
  await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: '해외 연수', exact: true }).click();
  check((await page.locator('.training .trip-sites .choice').count()) === 4, 'three American centres and one Japanese');
  for (const v of ['가을 교육리그', '호주 리그(ABL) 유학', '해외 마무리캠프']) {
    await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: v, exact: true }).click();
    check((await page.locator('.training .dev-programs h3', { hasText: v }).count()) === 1, `the training view shows ${v} on its tab`);
  }
  // 2.0.66: every player's programme and intensity, and the farm coaches' reports.
  await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: '훈련 계획', exact: true }).click();
  check((await page.locator('.training select[aria-label$="훈련 강도"]').count()) > 10, 'the training plans list every player with an intensity');
  await axeCheck(page, 'training plans');
  await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: '2군 리포트', exact: true }).click();
  check((await page.locator('.training .farm-report, .training p.muted').count()) > 0, 'the farm reports show (or say there are none yet)');
  await axeCheck(page, 'farm reports');
  await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: '해외 연수', exact: true }).click();
  await page.getByRole('button', { name: /^도쿄 모션 베이스 일본/ }).click();
  // 2.0.10: the players in a sortable table, one button each.
  const pickTable = page.locator('.trip-pick');
  check((await pickTable.locator('tbody tr').count()) > 3, 'the training view lists the players to send');
  // 2.0.24: the first team, the futures and the reserves apart.
  const all = await pickTable.locator('tbody tr').count();
  await page.getByRole('group', { name: '소속' }).getByRole('button', { name: /^퓨처스/ }).click();
  check((await pickTable.locator('tbody tr').count()) < all, 'the training view shows the futures apart');
  await page.getByRole('group', { name: '소속' }).getByRole('button', { name: /^전체/ }).click();
  await pickTable.getByRole('button', { name: '나이', exact: false }).click();
  await pickTable.locator('tbody button.primary:not([disabled])').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('.training .record-table')].some((t) => t.textContent?.includes('연수 중')), null, { timeout: 10_000 }).catch(() => undefined);
  check(await page.evaluate(() => [...document.querySelectorAll('.training .record-table')].some((t) => t.textContent?.includes('연수 중'))), 'the player is away on his programme');
  // 2.0.10: the payroll at a glance.
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '연봉표', exact: true }).click();
  check((await page.locator('.payroll-table tbody tr').count()) > 20, 'the payroll lists the whole club');
  check((await page.locator('.payroll-table tfoot').count()) === 1, 'the payroll shows the totals');
  await page.locator('.payroll-table thead').getByRole('button', { name: 'FA 시기' }).click();
  await page.screenshot({ path: join(shots, 'payroll.png') });
  // 2.0.34: every contract in full, a row opened for its details.
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '계약', exact: true }).click();
  check((await page.locator('.contract-table tbody tr.player-row').count()) > 20, 'the contracts tab lists the whole club');
  await page.locator('.contract-table .toggle').first().click();
  check((await page.locator('.contract-detail li').count()) > 0, 'a contract opens to its details');
  await page.screenshot({ path: join(shots, 'contracts.png') });
  // 2.0.34: star a player from his screen; he shows on the overview's favourites.
  await page.locator('.contract-table tbody tr.player-row button.link:not(.toggle)').first().click();
  await page.locator('.fav-star').click();
  await page.waitForFunction(() => document.querySelector('.fav-star')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5_000 }).catch(() => undefined);
  check((await page.locator('.fav-star').getAttribute('aria-pressed')) === 'true', 'the star marks a favourite');
  await page.keyboard.press('Escape');
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '개요', exact: true }).click();
  check((await page.locator('.favorites tbody tr').count()) === 1, 'the favourite shows on the overview');
  // 2.0.35: the ability editor, off until turned on in the settings.
  await page.locator('.favorites tbody button.link').first().click();
  await page.getByRole('tab', { name: '정보' }).click();
  check((await page.locator('.player-editor').count()) === 1 && (await page.locator('.ability-editor').count()) === 0, 'the ability editor is off by default');
  await page.getByRole('tab', { name: '능력치' }).click();
  await page.keyboard.press('Escape');
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('group', { name: '능력치 에디터' }).getByRole('button', { name: '켜기' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="능력치 에디터"] button[aria-pressed="true"]')?.textContent?.includes('켜기'), null, { timeout: 5_000 }).catch(() => undefined);
  await page.locator('nav.tabs').getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '개요', exact: true }).click();
  await page.locator('.favorites tbody button.link').first().click();
  await page.getByRole('tab', { name: '정보' }).click();
  await page.locator('.ability-editor summary').click();
  const first = page.locator('.ability-editor .ability-table input').first();
  // 2.0.41: one point below what he has — always a change, and never above his potential (77 could be either).
  const was = Number(await first.inputValue());
  const want = String(was > 20 ? was - 1 : was + 1);
  await first.fill(want);
  await page.locator('.ability-editor').getByRole('button', { name: '능력치 적용' }).click();
  await page.waitForFunction((v) => document.querySelector('.ability-editor .ability-table input')?.value === v && document.querySelector('.ability-editor button.primary')?.hasAttribute('disabled'), want, { timeout: 5_000 }).catch(() => undefined);
  check((await first.inputValue()) === want && (await page.locator('.ability-editor button.primary').isDisabled()), 'the ability editor applies a grade');
  // The player screen remembers its tab: back to the first for the checks below.
  await page.getByRole('tab', { name: '능력치' }).click();
  await page.keyboard.press('Escape');

  // 4d. The club's story, the AI article settings (no key: nothing is sent), the record room.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '소식', exact: true }).click();
  for (const v of ['연표', '업적', '알림']) await page.getByRole('group', { name: '이야기' }).getByRole('button', { name: v, exact: true }).click();
  check((await page.locator('.alert-list > li').count()) >= 3, 'alerts are kept in the club news');
  await page.getByRole('group', { name: '이야기' }).getByRole('button', { name: '뉴스', exact: true }).click();
  for (const v of ['이적', '경기', '전체']) await page.getByRole('group', { name: '기사 종류' }).getByRole('button', { name: v, exact: true }).click();
  await page.screenshot({ path: join(shots, 'story.png'), fullPage: false });
  // 0.13: AI settings in the settings tab. A key typed there must never reach a save (the autosave or a file).
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  // 2.0.13: with the board off, the rules by hand.
  if (!(await page.locator('#settings-board input[type=checkbox]').isChecked().catch(() => true))) check((await page.locator('#settings-board .rule-editor select').count()) > 10, 'the board off, the rules can be set by hand');
  const storyBlock = page.locator('#settings-story');
  await storyBlock.getByLabel('제공자').selectOption('gemini');
  const SECRET = 'test-key-never-saved-0130';
  await storyBlock.getByLabel('API 키').fill(SECRET);
  await storyBlock.getByRole('button', { name: '저장', exact: true }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#settings-save').getByRole('button', { name: '진행 파일 저장' }).click()]);
  // 2.0.61: the file comes packed (gzip) where the browser can.
  const raw = readFileSync(await download.path());
  const file = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8');
  check(/\.json(\.gz)?$/.test(download.suggestedFilename()) && file.includes('"kbo-expansion-save"'), 'an exported save opens as a save');
  check(file.length > 1000 && !file.includes(SECRET), 'an exported save holds no API key');
  const stored = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('kbo-expansion');
        open.onsuccess = () => {
          const req = open.result.transaction('saves').objectStore('saves').getAll();
          req.onsuccess = () => resolve(JSON.stringify(req.result));
          req.onerror = () => resolve('');
        };
        open.onerror = () => resolve('');
      }),
  );
  check(!stored.includes(SECRET), 'the autosave holds no API key');
  check((await page.locator('#settings-save').textContent())?.includes('마지막 진행 파일 저장'), 'the settings show the last export');
  await storyBlock.getByRole('button', { name: '키 지우기' }).click();
  await page.getByRole('button', { name: '역대', exact: true }).click();
  for (const v of ['시상', '기록실', '명예의 전당', '시즌']) await page.getByRole('group', { name: '역대' }).getByRole('button', { name: v, exact: true }).click();
  // 1.0.1: the national team's tournaments and the clubs' retired numbers have pages of their own.
  await page.getByRole('group', { name: '역대' }).getByRole('button', { name: '국가대표', exact: true }).click();
  check((await page.locator('table:has(caption) tbody tr').count()) > 0, 'the national team page lists the tournaments');
  // 2.0.11: each tournament's best hitter and pitcher, and a player's national-team lines.
  check((await page.locator('table:has(caption) thead').textContent())?.includes('대표팀 활약'), 'the national team page shows its best players');
  const star = page.locator('table:has(caption) tbody td:last-child .link').first();
  if (await star.count()) {
    await star.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('tab', { name: '기록' }).click();
    await page.getByRole('group', { name: '기록 보기' }).getByRole('button', { name: '국가대표', exact: true }).click();
    check((await page.locator('.dialog .national-lines').count()) === 1, 'a player shows his national-team lines');
    // The panel remembers its part and record view: leave them as the later checks expect.
    await page.getByRole('group', { name: '기록 보기' }).getByRole('button', { name: '정규시즌', exact: true }).click();
    await page.getByRole('tab', { name: '능력치' }).click();
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: join(shots, 'national.png'), fullPage: false });
  await page.getByRole('group', { name: '역대' }).getByRole('button', { name: '영구결번', exact: true }).click();
  check((await page.locator('.retired-card').count()) > 0 || (await page.locator('main').textContent())?.includes('아직 영구결번이 없습니다'), 'the retired numbers page opens');
  await page.getByRole('group', { name: '역대' }).getByRole('button', { name: '기록실', exact: true }).click();
  await page.screenshot({ path: join(shots, 'records.png'), fullPage: false });

  // 5. The market: trade screen with a live verdict, the other views.
  await page.getByRole('button', { name: '이적시장', exact: true }).click();
  await page.locator('.pick-table').first().locator('input[type=checkbox]').first().check();
  // 2.0.46: their not-for-sale players are refused with the reason; anyone else gets the club's verdict.
  const theirRows = page.locator('.pick-table').nth(1).locator('tbody tr');
  const kept = theirRows.filter({ has: page.locator('.tag.nfs') }).first();
  check((await theirRows.filter({ has: page.locator('.tag.nfs') }).count()) === 3, 'the other club keeps three not for sale');
  await kept.locator('input[type=checkbox]').check();
  check((await page.locator('.trade-bar').textContent())?.includes('NFS'), 'a not-for-sale player is refused');
  await kept.locator('input[type=checkbox]').uncheck();
  await theirRows.filter({ hasNot: page.locator('.tag.nfs') }).first().locator('input[type=checkbox]').check();
  check((await page.locator('.trade-bar').textContent())?.includes('상대 구단'), 'trade verdict shown');
  await page.screenshot({ path: join(shots, 'market.png'), fullPage: false });
  // 0.10.1: find a right fielder anywhere in the league and take him to a trade proposal.
  await page.getByRole('button', { name: '선수 찾기', exact: true }).click();
  await page.getByRole('combobox', { name: '포지션', exact: true }).selectOption('RF');
  await page.getByLabel('트레이드할 수 있는 선수만').check();
  const found = page.locator('.search-table tbody tr');
  check((await found.count()) > 5, `right fielders across the league (${await found.count()})`);
  const target = (await found.first().locator('td').nth(1).textContent())?.trim() ?? '';
  await found.first().getByRole('button', { name: '트레이드', exact: true }).click();
  check((await page.locator('.trade-bar').textContent())?.includes('받음: 선수 1명'), `the search puts ${target} into a trade proposal`);
  await page.screenshot({ path: join(shots, 'search.png'), fullPage: false });
  for (const v of ['방출 · 자유계약', '외국인 교체']) await page.getByRole('button', { name: v, exact: true }).click();
  // 2.0.19 (the user's report): a foreign candidate not yet signed opens in the player window too (preview.ts).
  const candidate = page.locator('.pick-table .link').last();
  if (await candidate.count()) {
    const who = ((await candidate.textContent()) ?? '').trim();
    await candidate.click();
    await page.getByRole('dialog').waitFor({ timeout: 10_000 }).catch(() => undefined);
    check((await page.locator('.dialog h2').first().textContent())?.includes(who) ?? false, `a foreign market candidate (${who}) opens in the player window`);
    await page.keyboard.press('Escape');
    // 2.0.23: on a slow runner the window may still be open: wait, or close it with its button.
    await page.locator('.overlay').waitFor({ state: 'detached', timeout: 5_000 }).catch(async () => {
      await page.locator('.dialog .close').first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.locator('.overlay').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined);
    });
  }
  await page.getByRole('button', { name: '이적 소식', exact: true }).click();

  // 1.2.0: the All-Star page (the years before ours are on record), and the optional foreign veteran rule.
  await page.locator('nav.tabs').getByRole('button', { name: '기록', exact: true }).click();
  await page.getByRole('group', { name: '보기' }).getByRole('button', { name: '올스타', exact: true }).click();
  check((await page.getByRole('heading', { name: '역대 올스타전' }).count()) === 1, 'the All-Star page lists the years before');
  await page.screenshot({ path: join(shots, 'allstar.png'), fullPage: false });
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  check((await page.getByRole('group', { name: '외국인 장기 근속 규정' }).count()) === 1, 'settings offer the foreign veteran rule');

  // 6. Every screen, the player dialog, reload.
  // 2.0.4: the records room's detail table, and the clubs' head-to-head on the standings.
  await page.locator('nav.tabs').getByRole('button', { name: '기록', exact: true }).click();
  await page.getByRole('group', { name: '보기' }).getByRole('button', { name: '타자 전체', exact: true }).click();
  await page.getByRole('group', { name: '기록 종류' }).getByRole('button', { name: '세부', exact: true }).click();
  check(((await page.locator('.stats-table thead').textContent()) ?? '').includes('xwOBA'), 'the batters\' detail table shows xwOBA');
  await page.screenshot({ path: join(shots, 'records-detail.png'), fullPage: false });
  await page.getByRole('group', { name: '기록 종류' }).getByRole('button', { name: '기본', exact: true }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  await page.locator('details.h2h summary').click();
  check((await page.locator('.h2h-table tbody tr').count()) > 0, 'the standings show the clubs\' head-to-head');
  // 2.0.5: our club's all-time records.
  await page.locator('nav.tabs').getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '역대 기록', exact: true }).click();
  check((await page.locator('.club-records').count()) === 1, 'our club\'s all-time records open');
  for (const v of ['구단 통산 순위', '구단 단일 시즌 기록', '영구결번·명예의 전당', '연도별 성적']) await page.getByRole('group', { name: '역대 기록 보기' }).getByRole('button', { name: v, exact: true }).click();
  await page.screenshot({ path: join(shots, 'club-records.png'), fullPage: false });
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '개요', exact: true }).click().catch(() => undefined);
  // 2.0.8: the winter's new pitches, planned from the training view.
  await page.locator('nav.tabs').getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: '훈련·연수', exact: true }).click();
  await page.getByRole('group', { name: '훈련·연수 보기' }).getByRole('button', { name: '새 구종 익히기 (겨울)', exact: true }).click();
  check((await page.locator('.learn-pitch').count()) === 1, 'the training view plans new pitches');
  // 2.0.7: a new game asks to save this one first; cancelling keeps the game.
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  const ask = page.getByRole('alertdialog', { name: '새 게임을 시작하기 전에 저장하세요' });
  check((await ask.count()) === 1, 'a new game asks to save first');
  await ask.getByRole('button', { name: '취소', exact: true }).click();
  check((await page.locator('nav.tabs').count()) === 1, 'cancelling a new game keeps the game');
  for (const tab of ['기록', '구단', '역대', '드래프트 후보', '우리 구단']) await page.getByRole('button', { name: tab, exact: true }).click();
  await page.getByRole('button', { name: '선수단', exact: true }).click();
  await page.locator('.squad-table .link').first().click();
  await page.getByRole('dialog').waitFor();
  check((await page.locator('.velocity').count()) === 1, 'pitcher profile shows velocity');
  // 2.0.12: our player's other side, to turn him around or start two-way play.
  check((await page.locator('.two-way-side').count()) === 1, 'our player shows his other side');
  // 1.4.0: one part at a time; 1.1.0: our coaches' read of his hidden side, and the growth type among it.
  check((await page.locator('.trait-report').count()) === 0, 'the player page shows one part at a time');
  await page.getByRole('tab', { name: '코치 평가' }).click();
  const report = page.locator('.trait-report');
  check((await report.getByRole('heading', { name: '코치 평가' }).count()) === 1, 'our player shows the coaches\' report');
  check(((await report.textContent()) ?? '').includes('성장 타입'), 'the report reads his growth type');
  // 0.12: the general manager gives him a number (a teammate wearing it swaps).
  await page.getByRole('tab', { name: '정보' }).click();
  const numberBox = page.getByRole('spinbutton', { name: '등번호' });
  // The league's seed is random: the number may be his already or retired by the club, so try until one is free.
  let wanted = null;
  for (const n of ['77', '78', '79', '86', '87', '88', '93', '94', '95', '96']) {
    await numberBox.fill(n);
    if (await page.locator('.number-form button').isEnabled()) {
      wanted = n;
      break;
    }
  }
  check(wanted !== null, 'a free uniform number can be chosen');
  if (wanted) {
    await page.locator('.number-form button').click();
    await page.waitForFunction((n) => document.querySelector('.jersey-number')?.textContent === n, wanted);
    check((await page.locator('.jersey-number').textContent()) === wanted, 'the uniform number can be set');
  }
  // 2.0.9: the editor — his hometown changes, his abilities do not.
  await page.locator('.player-editor:not(.ability-editor) summary').click();
  const town = page.locator('.player-editor:not(.ability-editor) .editor-fields input').nth(1);
  await town.fill('한양');
  await page.locator('.player-editor:not(.ability-editor) .row-actions .primary').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.dialog dd')].some((d) => d.textContent === '한양'), null, { timeout: 10_000 }).catch(() => undefined);
  check(await page.evaluate(() => [...document.querySelectorAll('.dialog dd')].some((d) => d.textContent === '한양')), 'the editor changes his hometown');
  check((await page.locator('.player-editor:not(.ability-editor)[open]').count()) === 1, 'the editor stays open after applying');
  await page.screenshot({ path: join(shots, 'player.png') });
  await page.getByRole('tab', { name: '기록' }).click();
  const views = page.getByRole('group', { name: '기록 보기' });
  // 2.0.4: the Savant page and the head-to-head records.
  await views.getByRole('button', { name: '분석', exact: true }).click();
  check((await page.locator('.dialog .savant').count()) === 1, 'the analysis view shows');
  await views.getByRole('button', { name: '상대 전적', exact: true }).click();
  check((await page.locator('.dialog .meetings').count()) === 1, 'the head-to-head view shows');
  // 2.0.15: home and road, and each ballpark.
  await views.getByRole('button', { name: '홈·원정·구장', exact: true }).click();
  check((await page.locator('.dialog .record-table.venues').count()) === 2, 'the venues view shows the season and the career');
  for (const t of ['포스트시즌', '커리어 하이', '상황별 기록', '정규시즌']) await views.getByRole('button', { name: t }).click();
  await page.getByRole('tab', { name: /^부상/ }).click();
  await page.getByRole('tab', { name: '기록' }).click();
  // 1.9.2: wait for the part to render before counting (the count raced the click on CI). 1.9.4: wait for the
  // count itself — the first table showing was not enough once (the part was still being redrawn).
  // 2.0.18: a two-way (or turned-around) player has a second table for his other side (2.0.12): one or two.
  // 2.0.31: the first player on the list may be a rookie with no season yet (the league's seed is random): then the
  // part says so instead of a table.
  const seasonPart = () => ({
    tables: document.querySelectorAll('.dialog .record-table.career').length,
    empty: [...document.querySelectorAll('.dialog p.muted')].some((x) => x.textContent === '기록이 없습니다.'),
  });
  await page.waitForFunction(() => document.querySelectorAll('.dialog .record-table.career').length >= 1 || [...document.querySelectorAll('.dialog p.muted')].some((x) => x.textContent === '기록이 없습니다.'), null, { timeout: 10_000 }).catch(() => undefined);
  const { tables: seasonTables, empty } = await page.evaluate(seasonPart);
  check((seasonTables >= 1 && seasonTables <= 2) || (seasonTables === 0 && empty), 'the records part shows the season table');
  // 0.15: the keyboard stays inside the dialog, and Escape hands the focus back to the name that opened it.
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'Tab stays inside the player dialog');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !!document.activeElement?.closest('.squad-table')), 'closing the dialog returns the focus to the list');
  // A hitter's profile, and the bullpen role / platoon controls under manual entry.
  await page.locator('.squad-table').nth(1).locator('.link').first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('group', { name: '기록 보기' }).getByRole('button', { name: '포스트시즌' }).click();
  await page.screenshot({ path: join(shots, 'hitter.png') });
  await page.getByRole('group', { name: '기록 보기' }).getByRole('button', { name: '분석', exact: true }).click();
  await page.screenshot({ path: join(shots, 'hitter-savant.png') });
  await page.keyboard.press('Escape');
  const saved = await status(page);
  await page.reload();
  await waitSeason(page, '', 60_000, true);
  const autosave = (await page.locator('.save-actions .muted').textContent()) ?? '';
  if (autosave.includes('자동 저장됨')) check((await status(page)) === saved, `reload restores the game (${saved} → ${await status(page)})`);

  // 7. Layouts.
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    for (const tab of ['우리 구단', '이적시장', '경기', '순위', '기록', '구단', '역대', '드래프트 후보', '설정', '도움말']) {
      await page.locator('nav.tabs').getByRole('button', { name: tab, exact: true }).click();
      await noOverflow(page, `${width}x${height} ${tab}`);
      if (width === 1440 || width === 390) await axeCheck(page, `${width}x${height} ${tab}`);
    }
    await page.getByRole('button', { name: '우리 구단', exact: true }).click();
    await page.screenshot({ path: join(shots, `${width}x${height}.png`) });
    console.log(`ok ${width}x${height}`);
  }
  // 7b. 2.0.62: the new screens (새 UI) on the same league — every menu entry and our club's views fit and pass the
  // accessibility checks, and the legacy screens come back from the settings.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('group', { name: '화면 디자인' }).getByRole('button', { name: '새 UI', exact: true }).click();
  check((await page.evaluate(() => document.documentElement.dataset.ui)) === 'new', 'the settings switch to the new screens');
  check(((await page.locator('.hud-card').textContent()) ?? '').includes('부상'), 'the new sidebar sums up the club');
  const NEW_MENU = ['우리 구단', '이적시장', '드래프트 후보', '경기 · 일정', '순위표', '리그 기록실', '통산 기록', '구단 이야기', '타 구단 보기', '역대 기록'];
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const name of NEW_MENU) {
      await page.locator('nav.tabs').getByRole('button', { name, exact: true }).click();
      await noOverflow(page, `new ${width} ${name}`);
      await axeCheck(page, `new ${width} ${name}`);
    }
    // 2.0.66 (the user's report): 우리 구단 after 통산 기록 (the same screen's other view) opens on its overview.
    await page.locator('nav.tabs').getByRole('button', { name: '통산 기록', exact: true }).click();
    await page.locator('nav.tabs').getByRole('button', { name: '우리 구단', exact: true }).click();
    const clubCurrent = await page
      .locator('nav.tabs button[aria-current="page"]', { hasText: /^우리 구단$/ })
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check(clubCurrent, `new ${width}: 우리 구단 is the page after 통산 기록`);
    check((await page.getByRole('group', { name: '우리 구단 보기' }).getByRole('button', { name: /^개요/ }).getAttribute('aria-pressed')) === 'true', `new ${width}: 우리 구단 opens on its overview after 통산 기록`);
    for (const name of ['설정', '도움말']) {
      await page.locator('.sidebar-foot').getByRole('button', { name, exact: true }).click();
      await noOverflow(page, `new ${width} ${name}`);
      await axeCheck(page, `new ${width} ${name}`);
    }
    // The help as cards: a word looked up narrows them; the settings as cards too.
    const allCards = await page.locator('.manual-card').count();
    await page.getByRole('searchbox', { name: '용어·규칙 찾기' }).fill('샐러리캡');
    const found = await page.locator('.manual-card').count();
    check(found > 0 && found < allCards, `new ${width}: the help finds a word (${found} of ${allCards})`);
    await page.getByRole('searchbox', { name: '용어·규칙 찾기' }).fill('');
    await page.locator('.sidebar-foot').getByRole('button', { name: '설정', exact: true }).click();
    check((await page.locator('.opt-card').count()) >= 8, `new ${width}: the display settings as cards`);
    await page.locator('nav.tabs').getByRole('button', { name: '우리 구단', exact: true }).click();
    const views = page.getByRole('group', { name: '우리 구단 보기' });
    for (const name of ['선수단', '라인업 · 로테이션', '훈련', '프런트 · 재정', '개요 · 브리핑']) {
      await views.getByRole('button', { name }).first().click();
      await noOverflow(page, `new ${width} club ${name}`);
      if (name === '프런트 · 재정') for (const sub of ['연봉표', '계약']) await page.getByRole('group', { name: '프런트 · 재정' }).getByRole('button', { name: sub, exact: true }).click();
    }
    // 2.0.63: the squad's detail in two pages; the lineup's spots fixed and freed from the table.
    await views.getByRole('button', { name: '선수단' }).first().click();
    await page.getByRole('group', { name: '표 보기' }).getByRole('button', { name: '상세', exact: true }).click();
    await page.getByRole('group', { name: '상세 기록 쪽' }).getByRole('button', { name: '2 / 2' }).click();
    check(((await page.locator('.squad-table thead').first().textContent()) ?? '').includes('FIP'), `new ${width}: the squad's second detail page`);
    await noOverflow(page, `new ${width} squad detail`);
    await page.getByRole('group', { name: '표 보기' }).getByRole('button', { name: '시즌', exact: true }).click();
    await views.getByRole('button', { name: '라인업 · 로테이션' }).click();
    const third = page.locator('.bat-sheet tbody tr').nth(2).locator('.fix-toggle');
    if (await third.count()) {
      const before = await third.getAttribute('aria-pressed');
      await third.click();
      await page.waitForFunction((b) => document.querySelectorAll('.bat-sheet tbody tr')[2]?.querySelector('.fix-toggle')?.getAttribute('aria-pressed') !== b, before);
      await page.locator('.bat-sheet tbody tr').nth(2).locator('.fix-toggle').click();
      await page.waitForFunction((b) => document.querySelectorAll('.bat-sheet tbody tr')[2]?.querySelector('.fix-toggle')?.getAttribute('aria-pressed') === b, before);
    }
    await axeCheck(page, `new ${width} lineup`);
    await views.getByRole('button', { name: '개요 · 브리핑' }).first().click();
    check((await page.getByRole('heading', { name: '단장 브리핑' }).count()) === 1, `new ${width}: the overview opens with the briefing`);
    check((await page.locator('.dash-3 .sheet-box').count()) >= 3, `new ${width}: the overview's three boards`);
    await page.screenshot({ path: join(shots, `new-${width}.png`) });
    // A player's page: the grades in boxed numbers, the staff's read beside the grades under 리포트, each part fits.
    await views.getByRole('button', { name: '선수단' }).first().click();
    await page.locator('.squad-table .link').first().click();
    const pp = page.getByRole('dialog');
    await pp.waitFor();
    check((await pp.locator('.pp-summary .pp-grade').count()) >= 2, `new ${width}: a player's page opens with his grades boxed`);
    for (const name of ['리포트', '기록', '이력', '몸 상태']) {
      // A part's name may carry a count (몸 상태 2).
      await pp.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
      await noOverflow(page, `new ${width} player ${name}`);
      await axeCheck(page, `new ${width} player ${name}`);
    }
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.sidebar-foot').getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('group', { name: '화면 디자인' }).getByRole('button', { name: '레거시 UI', exact: true }).click();
  check((await page.locator('.club-summary').count()) === 1, 'the legacy screens come back from the settings');
  console.log('ok new screens');

  // 0.15: the dark page (the system's, then the player's own pick in the settings) passes the same checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const tab of ['우리 구단', '이적시장', '순위', '구단', '설정']) {
    await page.locator('nav.tabs').getByRole('button', { name: tab, exact: true }).click();
    await axeCheck(page, `dark ${tab}`);
  }
  await page.screenshot({ path: join(shots, 'dark-390.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('group', { name: '밝기' }).getByRole('button', { name: '어둡게' }).click();
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'the player can pick dark over the system');
  await axeCheck(page, 'picked dark settings');
  await page.getByRole('group', { name: '글자 크기' }).getByRole('button', { name: '크게' }).click();
  await noOverflow(page, '390 large text settings');
  await page.screenshot({ path: join(shots, 'dark-large-390.png') });
  await page.getByRole('group', { name: '밝기' }).getByRole('button', { name: '기기 설정 따르기' }).click();
  await page.getByRole('group', { name: '글자 크기' }).getByRole('button', { name: '보통' }).click();
  // 1.0.1: on a phone the settings show one subject at a time, picked from the bar.
  check(!(await page.locator('#settings-save').isVisible()), 'a phone shows one settings subject at a time');
  await page.getByRole('group', { name: '설정 항목' }).getByRole('button', { name: '저장', exact: true }).click();
  check((await page.locator('#settings-save').isVisible()) && !(await page.locator('#settings-display').isVisible()), 'the bar switches the settings subject');
  check(adviceSeen.length > 3, `scout recommendations explain themselves (${adviceSeen.length} decisions)`);
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();

  // 7c. 2.0.62: the new founding sheet founds a club as it opens — the names left empty take the ones shown.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => (errors.push(e.message), console.log('page error:', e.message)));
    await p.goto(url);
    await p.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
    const shown = (await p.locator('#ng-receipt-name').textContent()) ?? '';
    await noOverflow(p, '1440 new founding sheet');
    await axeCheck(p, 'new founding sheet');
    await p.locator('.ng-receipt').getByRole('button', { name: '창단 신청' }).click();
    await p.locator('.next-sidebar .club-brand h1').waitFor({ timeout: 180_000 });
    check(((await p.locator('.next-sidebar .club-brand h1').textContent()) ?? '') === shown, `the new sheet founds the club it shows (${shown})`);
    await ctx.close();
  }

  // 8. Phone: the founding form fits, and the spectator path works.
  const phone = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p2 = await phone.newPage();
  await p2.goto(url);
  await p2.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  await noOverflow(p2, '320 new game');
  await p2.screenshot({ path: join(shots, 'new-game-320.png'), fullPage: true });
  // 2.0.62: the new founding sheet (the page's default) — the league alone from its 관전 card.
  await p2.getByRole('button', { name: /^관전/ }).click();
  await waitSeason(p2, 2026);
  check((await p2.locator('.standings tbody tr').count()) === 10, 'spectator league has ten clubs');
  await phone.close();
} catch (e) {
  // 2.0.59: what the screen showed — the status line, any dialog, the day controls — and a picture of it.
  if (main)
    try {
      await main.screenshot({ path: join(shots, 'failure.png') });
      const seen = await main.evaluate(() => ({
        status: document.querySelector('.status')?.textContent ?? null,
        controls: document.querySelector('fieldset.controls')?.textContent?.slice(0, 400) ?? null,
        disabled: !!document.querySelector('fieldset.controls')?.disabled,
        decision: document.querySelector('#decision-title')?.textContent ?? null,
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((d) => (d.textContent ?? '').slice(0, 300)),
        headings: [...document.querySelectorAll('h1, h2')].map((h) => h.textContent).slice(0, 8),
      }));
      console.log('on failure:', JSON.stringify(seen, null, 1));
    } catch {
      // The page itself may be what failed.
    }
  // On CI, as an annotation too: the job log is not the only place the reason shows.
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=browser smoke::${String(e?.stack ?? e).slice(0, 4000).replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
  throw e;
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  if (process.env.GITHUB_ACTIONS) for (const f of failures) console.log(`::error title=browser smoke::${f.slice(0, 4000).replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
  process.exit(1);
}
console.log(`browser smoke passed (${SIZES.length} screen sizes)`);
