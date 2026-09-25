/* The club's story (V0.7): news with quotes (a language model's version when there is one), the club
   timeline, achievements and the clubhouse mood. */
import { useState } from 'preact/hooks';
import { ACHIEVEMENTS } from '../league/milestones';
import type { NewsItem } from '../league/news';
import type { LeagueState } from '../league/state';
import { clubhouse } from '../league/views';

type View = 'news' | 'timeline' | 'achievements';

const KIND: Record<NewsItem['kind'], string> = { game: '경기', milestone: '기록', month: '월간', season: '시즌', award: '시상', interview: '인터뷰', move: '이적' };

export function NewsCard({ item, onRewrite, onRevert, busy }: { item: NewsItem; onRewrite?: (item: NewsItem) => void; onRevert?: (item: NewsItem) => void; busy?: boolean }) {
  const [original, setOriginal] = useState(false);
  const text = item.ai && !original ? item.ai : item;
  return (
    <article class="news-card">
      <p class="muted small">
        {item.date} · <span class="tag">{KIND[item.kind]}</span>
        {item.ai && !original && (
          <span class="tag" title={`${item.ai.provider} · ${item.ai.model}`}>
            AI
          </span>
        )}
      </p>
      <h4>{text.title}</h4>
      {text.body
        .split('\n')
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} class={line.startsWith('— ') ? 'question' : undefined}>
            {line}
          </p>
        ))}
      {text.quotes.length > 0 && (
        <ul class="quotes">
          {text.quotes.map((q, i) => (
            <li key={i} class={`quote-${q.role}`}>
              <strong>{q.who}</strong> “{q.text}”
            </li>
          ))}
        </ul>
      )}
      {!!item.detail?.length && (
        <details class="news-facts">
          <summary>기사에 쓴 기록 ({item.detail.length})</summary>
          <ul>
            {item.detail.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}
      <div class="row-actions">
        {item.ai && (
          <button type="button" onClick={() => setOriginal(!original)}>
            {original ? 'AI 기사 보기' : '원문 보기'}
          </button>
        )}
        {onRewrite && (
          <button type="button" disabled={busy} onClick={() => onRewrite(item)}>
            {busy ? '쓰는 중…' : item.ai ? 'AI로 다시 쓰기' : 'AI로 쓰기'}
          </button>
        )}
        {item.ai && onRevert && (
          <button type="button" onClick={() => onRevert(item)}>
            AI 기사 지우기
          </button>
        )}
      </div>
    </article>
  );
}

export function Story({ league, onRewrite, onRevert, busyId }: { league: LeagueState; onRewrite?: (item: NewsItem) => void; onRevert?: (item: NewsItem) => void; busyId?: string | null }) {
  const [view, setView] = useState<View>('news');
  const u = league.user!;
  const mood = clubhouse(league, u.teamId);
  const news = [...(league.news ?? [])].reverse();
  const done = new Map((u.achievements ?? []).map((a) => [a.id, a.year]));
  return (
    <>
      <div class="cards">
        <div class="card">
          <p class="card-label">클럽하우스 분위기</p>
          <p class="card-value">{mood.label}</p>
          <p class="card-sub">{mood.notes.join(' · ')}</p>
          {mood.form.length > 0 && (
            <p class="form-dots" aria-label="최근 경기">
              {mood.form.map((r, i) => (
                <span key={i} class={`dot dot-${r}`}>
                  {r === 'W' ? '승' : r === 'L' ? '패' : '무'}
                </span>
              ))}
            </p>
          )}
        </div>
        <div class="card">
          <p class="card-label">업적</p>
          <p class="card-value">
            {done.size} / {ACHIEVEMENTS.length}
          </p>
        </div>
      </div>
      <div class="segmented" role="group" aria-label="이야기">
        {(
          [
            ['news', '뉴스'],
            ['timeline', '연표'],
            ['achievements', '업적'],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'news' &&
        (news.length ? (
          <div class="news-list">
            {news.slice(0, 60).map((n) => (
              <NewsCard key={n.id} item={n} onRewrite={onRewrite} onRevert={onRevert} busy={busyId === n.id} />
            ))}
          </div>
        ) : (
          <p class="muted">아직 기사가 없습니다. 끝내기·대승·대기록 같은 경기와 월간 결산, 시즌 결산이 기사로 나옵니다.</p>
        ))}
      {view === 'timeline' && (
        <ol class="plain timeline">
          {[...(u.timeline ?? [])].reverse().map((t, i) => (
            <li key={i}>
              <span class="num strong">{t.year}</span> {t.text}
            </li>
          ))}
        </ol>
      )}
      {view === 'achievements' && (
        <div class="achievements">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} class={`achievement ${done.has(a.id) ? 'done' : ''}`}>
              <strong>{a.label}</strong>
              <span class="muted small">{a.note}</span>
              {done.has(a.id) && <div class="small">{done.get(a.id)}년 달성</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
