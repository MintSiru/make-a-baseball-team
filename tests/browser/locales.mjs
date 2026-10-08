/* Display-language check (en/ja localization): opens the built dist/index.html in Chromium in each language,
   loads a save (the newest fixture, or the file given as the first argument), visits every tab, a player's
   profile, a box score and the news, and reports
   - Korean text still on the page (text nodes and title/placeholder/aria-label), with where it was seen,
   - labels cut off or spilling out of their box (buttons, tabs, table headers),
   - pages that scroll sideways,
   and takes screenshots on a desktop and a phone screen.
   Run `npm run build` first. Uses CHROMIUM_BIN when set. Writes tests/browser/screenshots/locale-*.png and
   tests/browser/screenshots/locales.json; exits 1 when a page scrolls sideways. */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(join(root, 'dist', 'index.html')).href;
const shots = join(root, 'tests', 'browser', 'screenshots');
mkdirSync(shots, { recursive: true });
const fixtures = join(root, 'tests', 'fixtures');
const save = process.argv[2] ?? join(fixtures, readdirSync(fixtures).filter((f) => f.startsWith('save-')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1));
const LOCALES = (process.env.LOCALES ?? 'en,ja').split(',');
const PREFIX = process.env.SHOT_PREFIX ?? 'locale';
/** What the player typed when founding the club in the fixture saves (shown as typed in every language). */
const TYPED = (process.env.TYPED ?? '울산 고래단,고래증권,고래').split(',');

/** Korean on the page: text nodes (not what the player typed) and the attributes a reader hears or sees. */
const collect = (typed) => {
  const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
  const where = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) parts.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    return parts.join(' > ');
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(el.tagName)) continue;
    if (el.closest('.language-picker') || n.textContent.includes('Language · 言語')) continue;
    const text = n.textContent.trim();
    if (text && HANGUL.test(typed.reduce((t, x) => t.split(x).join(' '), text))) out.push({ text: text.slice(0, 200), where: where(el) });
  }
  for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]'))
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && HANGUL.test(typed.reduce((t, x) => t.split(x).join(' '), v)) && !v.includes('언어')) out.push({ text: v.slice(0, 200), where: `${where(el)} @${a}` });
    }
  for (const el of document.querySelectorAll('input[value]')) if (HANGUL.test(el.value) && el.type !== 'text') out.push({ text: el.value, where: where(el) + ' @value' });
  return out;
};
/** Labels that do not fit: text wider than its box where the box clips, or a button/tab taller than one line. */
const overflow = () => {
  const out = [];
  for (const el of document.querySelectorAll('button, th, .tabs button, .segmented button, label, .tag, dt, .card-value')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.textContent.trim()) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && (s.overflow === 'hidden' || s.overflowX === 'hidden' || s.textOverflow === 'ellipsis' || s.whiteSpace === 'nowrap'))
      out.push({ text: el.textContent.trim().slice(0, 80), kind: 'clipped', tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), by: el.scrollWidth - el.clientWidth });
  }
  return out;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
const report = { save, locales: {} };
let failed = false;
for (const lc of LOCALES) {
  const seen = new Map();
  const clipped = new Map();
  const sideways = [];
  for (const [w, h, tag] of [
    [1440, 1000, 'desktop'],
    [390, 844, 'phone'],
  ]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, locale: lc === 'ja' ? 'ja-JP' : 'en-US' });
    await context.addInitScript((l) => localStorage.setItem('kbo.display.locale', l), lc);
    const page = await context.newPage();
    page.on('pageerror', (e) => {
      failed = true;
      console.error(`${lc} ${tag}: page error`, e.message);
    });
    await page.goto(url);
    await page.locator('.masthead').first().waitFor();
    const record = async (label) => {
      await page.waitForTimeout(250);
      for (const x of await page.evaluate(collect, TYPED)) {
        const e = seen.get(x.text) ?? { text: x.text, where: x.where, screens: new Set() };
        e.screens.add(label);
        seen.set(x.text, e);
      }
      if (tag === 'desktop' || label.includes('club') || label.includes('player')) for (const x of await page.evaluate(overflow)) clipped.set(`${x.text}|${x.cls}`, { ...x, screen: `${tag}:${label}` });
      const side = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (side > 0) sideways.push(`${tag}:${label} +${side}px`);
    };
    await record('start');
    await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-00-start.png`), fullPage: false });
    await page.locator('input[type=file]').first().setInputFiles(save);
    await page.locator('nav.tabs').waitFor({ timeout: 120_000 });
    await page.waitForTimeout(800);
    // Event pop-ups waiting after the load: read and closed.
    for (let i = 0; i < 20 && (await page.locator('.alert-overlay').count()); i++) {
      await record('popup');
      if (i === 0) await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-popup.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    const tabs = page.locator('nav.tabs button');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(500);
      const label = `${String(i + 1).padStart(2, '0')}-${((await tabs.nth(i).textContent()) ?? '').trim().replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 20)}`;
      await record(label);
      await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-${label}.png`), fullPage: tag === 'desktop' });
      // Inside a tab: the segmented sub-views (records, market, history...) one by one.
      const subs = page.locator('main .segmented').first().locator('button');
      const m = Math.min(await subs.count(), 8);
      for (let j = 1; j < m; j++) {
        await subs.nth(j).click().catch(() => {});
        await record(`${label}/${j}`);
        if (tag === 'desktop') await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-${label}-${j}.png`), fullPage: true });
      }
    }
    // A game: the box score, then the play-by-play and the story.
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      const game = page.locator('main table tr:not(.player-row) button.link').first();
      if (!(await game.count())) continue;
      await game.click().catch(() => {});
      await page.waitForTimeout(300);
      if (!(await page.locator('.box-dialog').count())) {
        await page.keyboard.press('Escape');
        continue;
      }
      {
        await record('boxscore');
        await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-boxscore.png`) });
        const btabs = page.locator('.box-dialog [role=tab]');
        for (let j = 1; j < (await btabs.count()); j++) {
          if (await btabs.nth(j).isDisabled()) continue;
          await btabs.nth(j).click();
          await record(`boxscore/${j}`);
          await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-boxscore-${j}.png`) });
        }
        await page.keyboard.press('Escape');
        break;
      }
    }
    // A free-agent talk, when the save is at the market.
    const talk = page.locator('.fa-table tbody .talk-button').first();
    if (await talk.count()) {
      await talk.click();
      await record('fa-talk');
      await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-fa-talk.png`), fullPage: tag === 'desktop' });
    }
    // A player's profile, from the first tab that lists players.
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      const link = page.locator('.player-row .link, .player-row button.link').first();
      if (await link.count()) {
        await link.click();
        await page.locator('.dialog.profile').waitFor({ timeout: 5000 }).catch(() => {});
        await record('player');
        await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-player.png`) });
        const ptabs = page.locator('.dialog.profile [role=tab], .dialog.profile .segmented button');
        for (let j = 1; j < Math.min(await ptabs.count(), 4); j++) {
          await ptabs.nth(j).click().catch(() => {});
          await record(`player/${j}`);
          await page.screenshot({ path: join(shots, `${PREFIX}-${lc}-${tag}-player-${j}.png`) });
        }
        await page.keyboard.press('Escape');
        break;
      }
    }
    await context.close();
  }
  const leftovers = [...seen.values()].map((e) => ({ ...e, screens: [...e.screens].slice(0, 4) })).sort((a, b) => a.where.localeCompare(b.where));
  report.locales[lc] = { leftovers, clipped: [...clipped.values()], sideways };
  if (sideways.length) failed = true;
  console.log(`${lc}: ${leftovers.length} Korean strings left, ${clipped.size} clipped labels, ${sideways.length} sideways pages`);
}
await browser.close();
writeFileSync(join(shots, `${PREFIX}s.json`), JSON.stringify(report, null, 1));
process.exit(failed ? 1 : 0);
