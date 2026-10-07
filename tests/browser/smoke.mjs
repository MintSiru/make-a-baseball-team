/* Browser smoke test: opens the built dist/index.html from file:// in real Chromium.
   Founds an expansion club (afterFutures), makes every decision up to its first first-team season,
   visits every screen, reloads to check the autosave, then checks layouts at four sizes and the
   spectator path on a phone-sized screen.
   Run `npm run build` first. Uses CHROMIUM_BIN when set, else Playwright's own browser lookup.
   Screenshots go to tests/browser/screenshots/ (git-ignored). */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const noOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${label}: page scrolls sideways by ${overflow}px`);
};

/** Batch choices (V0.7.6) are tried once each: the select-all box and a row of one-click settings. */
const batch = { all: false, bar: false, fa: false };
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
async function decideAll(page, log) {
  let handPicked = false;
  for (let i = 0; i < 80; i++) {
    const decision = page.locator('#decision-title');
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

async function playSeason(page, log = []) {
  // V0.12: the season can stop for a decision (a national-team call-up, a disciplined player); answer and go on.
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: '정규시즌 끝까지' }).click();
    const post = page.getByRole('button', { name: '포스트시즌 시작' });
    const decision = page.locator('#decision-title');
    await post.or(decision).first().waitFor({ timeout: 90_000 });
    if (await post.count()) break;
    await decideAll(page, log);
  }
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
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => (errors.push(e.message), console.log('page error:', e.message)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 0. 1.4.1: getting a game back. A save whose league is cut short brings up the recovery choices (it used to leave
  // the page on "불러오는 중"), and a seed changed while the default league is being built is the one that opens.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
  check((await page.locator('.choice-grid').first().locator('.choice').count()) >= 10, 'candidate cities listed');
  await page.getByLabel('구단명').fill('울산 고래단');
  await page.getByLabel('약칭').fill('고래');
  await page.getByLabel('모기업 이름').fill('가상그룹');
  check((await page.locator('.stars').textContent())?.includes('★'), 'felt difficulty shown');
  check((await page.getByRole('button', { name: /^튜토리얼 · 퓨처스부터/ }).getAttribute('aria-pressed')) === 'true', 'tutorial mode is the default');
  // V0.9: a twelfth club, the rival, founded in a set winter.
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
  await page.addLocatorHandler(page.getByRole('alertdialog'), async (dialog) => {
    const all = dialog.getByRole('button', { name: '모두 확인' });
    await ((await all.count()) ? all : dialog.getByRole('button', { name: '확인', exact: true })).click();
  });
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
  await waitStatus(page, '2027 정규시즌');
  await page.getByRole('button', { name: '1주', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  await page.getByRole('button', { name: '개요', exact: true }).click();
  check((await page.locator('.cards').first().textContent())?.includes('퓨처스'), 'futures record shown in 2027');
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
  await waitStatus(page, '2028 정규시즌');

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
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
  await page.getByRole('button', { name: '경기', exact: true }).click();
  await page.getByRole('button', { name: '기록지 · 중계' }).first().click();
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
  await page.getByRole('button', { name: '해외 연수', exact: true }).click();
  check((await page.locator('.training .choice').count()) === 4, 'three American centres and one Japanese');
  await page.getByRole('button', { name: /^도쿄 모션 베이스 일본/ }).click();
  const tripPick = page.getByLabel('보낼 선수');
  await tripPick.selectOption({ index: 1 });
  await page.getByRole('button', { name: '도쿄 모션 베이스에 보내기' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.training .record-table tbody tr').length >= 1);
  check((await page.locator('.training .record-table').textContent())?.includes('연수 중'), 'the player is away on his programme');

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
  const storyBlock = page.locator('#settings-story');
  await storyBlock.getByLabel('제공자').selectOption('gemini');
  const SECRET = 'test-key-never-saved-0130';
  await storyBlock.getByLabel('API 키').fill(SECRET);
  await storyBlock.getByRole('button', { name: '저장', exact: true }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '순위', exact: true }).click();
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#settings-save').getByRole('button', { name: '진행 파일 저장' }).click()]);
  const file = readFileSync(await download.path(), 'utf8');
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
  await page.screenshot({ path: join(shots, 'national.png'), fullPage: false });
  await page.getByRole('group', { name: '역대' }).getByRole('button', { name: '영구결번', exact: true }).click();
  check((await page.locator('.retired-card').count()) > 0 || (await page.locator('main').textContent())?.includes('아직 영구결번이 없습니다'), 'the retired numbers page opens');
  await page.getByRole('group', { name: '역대' }).getByRole('button', { name: '기록실', exact: true }).click();
  await page.screenshot({ path: join(shots, 'records.png'), fullPage: false });

  // 5. The market: trade screen with a live verdict, the other views.
  await page.getByRole('button', { name: '이적시장', exact: true }).click();
  await page.locator('.pick-table').first().locator('input[type=checkbox]').first().check();
  await page.locator('.pick-table').nth(1).locator('input[type=checkbox]').first().check();
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
  for (const v of ['방출 · 자유계약', '외국인 교체', '이적 소식']) await page.getByRole('button', { name: v, exact: true }).click();

  // 1.2.0: the All-Star page (the years before ours are on record), and the optional foreign veteran rule.
  await page.locator('nav.tabs').getByRole('button', { name: '기록', exact: true }).click();
  await page.getByRole('group', { name: '보기' }).getByRole('button', { name: '올스타', exact: true }).click();
  check((await page.getByRole('heading', { name: '역대 올스타전' }).count()) === 1, 'the All-Star page lists the years before');
  await page.screenshot({ path: join(shots, 'allstar.png'), fullPage: false });
  await page.locator('nav.tabs').getByRole('button', { name: '설정', exact: true }).click();
  check((await page.getByRole('group', { name: '외국인 장기 근속 규정' }).count()) === 1, 'settings offer the foreign veteran rule');

  // 6. Every screen, the player dialog, reload.
  for (const tab of ['기록', '구단', '역대', '드래프트 후보', '우리 구단']) await page.getByRole('button', { name: tab, exact: true }).click();
  await page.getByRole('button', { name: '선수단', exact: true }).click();
  await page.locator('.squad-table .link').first().click();
  await page.getByRole('dialog').waitFor();
  check((await page.locator('.velocity').count()) === 1, 'pitcher profile shows velocity');
  // 1.4.0: one part at a time; 1.1.0: our coaches' read of his hidden side, and the growth type among it.
  check((await page.locator('.trait-report').count()) === 0, 'the player page shows one part at a time');
  await page.getByRole('tab', { name: '코치 평가' }).click();
  const report = page.locator('.trait-report');
  check((await report.getByRole('heading', { name: '코치 평가' }).count()) === 1, 'our player shows the coaches\' report');
  check(((await report.textContent()) ?? '').includes('성장 타입'), 'the report reads his growth type');
  // 0.12: the general manager gives him a number (a teammate wearing it swaps).
  await page.getByRole('tab', { name: '정보' }).click();
  const numberBox = page.getByRole('spinbutton', { name: '등번호' });
  await numberBox.fill('77');
  await page.locator('.number-form button').click();
  await page.waitForFunction(() => document.querySelector('.profile-number')?.textContent === '77');
  check((await page.locator('.profile-number').textContent()) === '77', 'the uniform number can be set');
  await page.screenshot({ path: join(shots, 'player.png') });
  await page.getByRole('tab', { name: '기록' }).click();
  const views = page.getByRole('group', { name: '기록 보기' });
  for (const t of ['포스트시즌', '커리어 하이', '좌우 기록', '정규시즌']) await views.getByRole('button', { name: t }).click();
  await page.getByRole('tab', { name: /^부상/ }).click();
  await page.getByRole('tab', { name: '기록' }).click();
  check((await page.locator('.dialog .record-table.career').count()) === 1, 'the records part shows the season table');
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
  await page.keyboard.press('Escape');
  const saved = await status(page);
  await page.reload();
  await waitStatus(page, '정규시즌', 60_000);
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
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();

  // 8. Phone: the founding form fits, and the spectator path works.
  const phone = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p2 = await phone.newPage();
  await p2.goto(url);
  await p2.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  await noOverflow(p2, '320 new game');
  await p2.screenshot({ path: join(shots, 'new-game-320.png'), fullPage: true });
  await p2.getByRole('button', { name: '구단 없이 리그만 관전' }).click();
  await waitStatus(p2, '2026 정규시즌');
  check((await p2.locator('.standings tbody tr').count()) === 10, 'spectator league has ten clubs');
  await phone.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`browser smoke passed (${SIZES.length} screen sizes)`);
