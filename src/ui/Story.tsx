import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The club's story (V0.7): news with quotes (a language model's version when there is one), the club
   timeline, achievements and the clubhouse mood. */
import { useState } from 'preact/hooks';
import { ACHIEVEMENTS } from '../league/milestones';
import type { NewsItem } from '../league/news';
import type { LeagueState } from '../league/state';
import { clubhouse } from '../league/views';
import { AlertList } from './Alerts';

type View = 'news' | 'timeline' | 'achievements' | 'alerts';
type Filter = 'all' | 'game' | 'move' | 'injury' | 'review' | 'interview' | 'allstar';
const FILTERS: [Filter, string, NewsItem['kind'][]][] = [
  ['all', __i18n_k("ui.story.fILTERS.934dd25e"), []],
  ['game', __i18n_k("ui.story.fILTERS.e0cee61a"), ['game']],
  ['move', __i18n_k("ui.story.fILTERS.b16017b2"), ['move']],
  ['injury', __i18n_k("ui.story.fILTERS.501fb802"), ['injury']],
  ['review', __i18n_k("ui.story.fILTERS.b7fd1782"), ['month', 'season', 'award', 'milestone']],
  ['interview', __i18n_k("ui.story.fILTERS.bc6034c8"), ['interview']],
  ['allstar', '올스타', ['allstar']],
];

const KIND: Record<NewsItem['kind'], string> = { game: __i18n_k("ui.story.kIND.game.e0cee61a"), milestone: __i18n_k("ui.story.kIND.milestone.d84b6f4b"), month: __i18n_k("ui.story.kIND.month.e81e0fc4"), season: __i18n_k("ui.story.kIND.season.b3000412"), award: __i18n_k("ui.story.kIND.award.d95a37a4"), interview: __i18n_k("ui.story.kIND.interview.bc6034c8"), move: __i18n_k("ui.story.kIND.move.b16017b2"), injury: __i18n_k("ui.story.kIND.injury.501fb802"), allstar: '올스타' };

export function NewsCard({ item, onRewrite, onRevert, busy }: { item: NewsItem; onRewrite?: (item: NewsItem) => void; onRevert?: (item: NewsItem) => void; busy?: boolean }) {
  const [original, setOriginal] = useState(false);
  const text = item.ai && !original ? item.ai : item;
  return (
    <article class="news-card">
      <p class="muted small">
        {__i18n_display(item.date)} · <span class="tag">{__i18n_display(KIND[item.kind])}</span>
        {__i18n_display(item.ai && !original && (
          <span class="tag" title={__i18n_displayText(`${item.ai.provider} · ${item.ai.model}`)}>
            AI
          </span>
        ))}
      </p>
      <h4>{__i18n_display(text.title)}</h4>
      {__i18n_display(text.body
        .split('\n')
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} class={line.startsWith('— ') ? 'question' : undefined}>
            {__i18n_display(line)}
          </p>
        )))}
      {__i18n_display(text.quotes.length > 0 && (
        <ul class="quotes">
          {__i18n_display(text.quotes.map((q, i) => (
            <li key={i} class={`quote-${q.role}`}>
              <strong>{__i18n_display(q.who)}</strong> “{__i18n_display(q.text)}”
            </li>
          )))}
        </ul>
      ))}
      {__i18n_display(!!item.detail?.length && (
        <details class="news-facts">
          <summary>{__i18n_t("ui.story.newsCard.1b51f1c3", { length: item.detail.length })}</summary>
          <ul>
            {__i18n_display(item.detail.map((d, i) => (
              <li key={i}>{__i18n_display(d)}</li>
            )))}
          </ul>
        </details>
      ))}
      <div class="row-actions">
        {__i18n_display(item.ai && (
          <button type="button" onClick={() => setOriginal(!original)}>
            {__i18n_display(original ? __i18n_k("ui.story.newsCard.827c4326") : __i18n_k("ui.story.newsCard.adb2bbbf"))}
          </button>
        ))}
        {__i18n_display(onRewrite && (
          <button type="button" disabled={busy} onClick={() => onRewrite(item)}>
            {__i18n_display(busy ? __i18n_k("ui.story.newsCard.87563ae4") : item.ai ? __i18n_k("ui.story.newsCard.e56bf303") : __i18n_k("ui.story.newsCard.fd500e42"))}
          </button>
        ))}
        {__i18n_display(item.ai && onRevert && (
          <button type="button" onClick={() => onRevert(item)}>{__i18n_t("ui.story.newsCard.b94ae051")}</button>
        ))}
      </div>
    </article>
  );
}

export function Story({ league, onRewrite, onRevert, busyId }: { league: LeagueState; onRewrite?: (item: NewsItem) => void; onRevert?: (item: NewsItem) => void; busyId?: string | null }) {
  const [view, setView] = useState<View>('news');
  const [filter, setFilter] = useState<Filter>('all');
  const kinds = FILTERS.find((f) => f[0] === filter)![2];
  const u = league.user!;
  const mood = clubhouse(league, u.teamId);
  // Newest first by date (the winter's moves are written in the order the offseason runs them).
  const news = [...(league.news ?? [])]
    .reverse()
    .filter((n) => !kinds.length || kinds.includes(n.kind))
    .sort((a, b) => b.date.localeCompare(a.date));
  const done = new Map((u.achievements ?? []).map((a) => [a.id, a.year]));
  return (
    <>
      <div class="cards">
        <div class="card">
          <p class="card-label">{__i18n_t("ui.story.story.967e82d5")}</p>
          <p class="card-value">{__i18n_display(mood.label)}</p>
          <p class="card-sub">{__i18n_display(mood.notes.join(' · '))}</p>
          {__i18n_display(mood.form.length > 0 && (
            <p class="form-dots" aria-label={__i18n_t("ui.story.story.8eaf05a2")}>
              {__i18n_display(mood.form.map((r, i) => (
                <span key={i} class={`dot dot-${r}`}>
                  {__i18n_display(r === 'W' ? '승' : r === 'L' ? '패' : __i18n_k("ui.story.story.56c5af5b"))}
                </span>
              )))}
            </p>
          ))}
        </div>
        <div class="card">
          <p class="card-label">{__i18n_t("ui.story.story.62850cd4")}</p>
          <p class="card-value">
            {__i18n_display(done.size)} / {__i18n_display(ACHIEVEMENTS.length)}
          </p>
        </div>
      </div>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.story.story.f7b3b85c")}>
        {__i18n_display((
          [
            ['news', __i18n_k("ui.story.story.3a465d8d")],
            ['timeline', __i18n_k("ui.story.story.77b369cb")],
            ['achievements', __i18n_k("ui.story.story.62850cd4")],
            ['alerts', __i18n_k("ui.story.story.e29d147e")],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>
      {__i18n_display(view === 'news' && (
        <div class="segmented" role="group" aria-label={__i18n_t("ui.story.story.fa08f409")}>
          {__i18n_display(FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {__i18n_display(label)}
            </button>
          )))}
        </div>
      ))}
      {__i18n_display(view === 'news' &&
        (news.length ? (
          <div class="news-list">
            {__i18n_display(news.slice(0, 60).map((n) => (
              <NewsCard key={n.id} item={n} onRewrite={onRewrite} onRevert={onRevert} busy={busyId === n.id} />
            )))}
          </div>
        ) : (
          <p class="muted">{__i18n_t("ui.story.story.1daaa090")}</p>
        )))}
      {__i18n_display(view === 'alerts' && <AlertList alerts={league.alerts ?? []} />)}
      {__i18n_display(view === 'timeline' && (
        <ol class="plain timeline">
          {__i18n_display([...(u.timeline ?? [])].reverse().map((t, i) => (
            <li key={i}>
              <span class="num strong">{__i18n_display(t.year)}</span> {__i18n_display(t.text)}
            </li>
          )))}
        </ol>
      ))}
      {__i18n_display(view === 'achievements' && (
        <div class="achievements">
          {__i18n_display(ACHIEVEMENTS.map((a) => (
            <div key={a.id} class={`achievement ${done.has(a.id) ? 'done' : ''}`}>
              <strong>{__i18n_display(a.label)}</strong>
              <span class="muted small">{__i18n_display(a.note)}</span>
              {__i18n_display(done.has(a.id) && <div class="small">{__i18n_t("ui.story.story.181d850b", { value: done.get(a.id) })}</div>)}
            </div>
          )))}
        </div>
      ))}
    </>
  );
}
