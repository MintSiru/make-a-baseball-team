import { display as __i18n_display, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* One game (V0.7): the line score, both clubs' batting and pitching, and for the user's games the text
   relay, which can be replayed play by play (관전 모드). */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import type { LeagueState } from '../league/state';
import { boxView } from '../league/views';
import type { Action } from '../league/actions';
import { NewsCard } from './Story';
import type { StoryHooks } from './MyClub';
import { markWatched, spoilerHidden } from './display';
import { pitchFeed, type PitchFrame } from '../league/pitchfeed';

type Tab = 'box' | 'pbp' | 'story';
const SPEEDS: [string, number][] = [
  [__i18n_k("ui.boxScore.sPEEDS.b8949c89"), 2200],
  ['보통', 1100],
  [__i18n_k("ui.boxScore.sPEEDS.de1ae880"), 450],
];

export function BoxScore({
  league,
  id,
  onClose,
  onPlayer,
  onAct,
  story = {},
}: {
  league: LeagueState;
  id: string;
  onClose: () => void;
  onPlayer: (id: string) => void;
  onAct?: (a: Action) => void;
  story?: StoryHooks;
}) {
  const v = useMemo(() => boxView(league, id), [league, id]);
  const ours = !!league.user && !!v && (v.home.teamId === league.user.teamId || v.away.teamId === league.user.teamId);
  // 1.6.0: with the score hidden, our unseen game opens as a relay from the first pitch.
  const [hidden] = useState(() => spoilerHidden(id, ours, !!v?.plays));
  const [tab, setTab] = useState<Tab>(hidden ? 'pbp' : 'box');
  const [shown, setShown] = useState<number | null>(hidden ? 0 : null);
  const [speed, setSpeed] = useState(1100);
  // 1.7.0: the relay a plate appearance or a pitch at a time.
  const [mode, setMode] = useState<'pa' | 'pitch'>('pa');
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  // Replay: one more play every tick until the end (then the game counts as seen).
  useEffect(() => {
    if (v?.plays && (shown === null || shown >= v.plays.length) && ours) markWatched(id);
    if (shown === null || !v?.plays || shown >= v.plays.length) return;
    const t = setTimeout(() => setShown(shown + 1), speed);
    return () => clearTimeout(t);
  }, [shown, speed, v]);
  if (!v) return null;
  const mine = !!league.user && (v.home.teamId === league.user.teamId || v.away.teamId === league.user.teamId);
  const article = league.news?.find((n) => n.id === `g-${id}`);
  const innings = Math.max(v.away.line.length, v.home.line.length, 9);
  const plays = v.plays ? (shown === null ? v.plays : v.plays.slice(0, shown)) : null;
  const live = shown !== null && v.plays && shown < v.plays.length;
  const last = plays?.filter((p) => p.ev.k === 'pa').at(-1)?.ev;
  const liveScore = last && last.k === 'pa' ? last.score : [0, 0];
  // Group the relay by half inning, newest first while replaying.
  const halves: { half: string; lines: string[] }[] = [];
  for (const p of plays ?? []) {
    if (!halves.length || halves[halves.length - 1]!.half !== p.half) halves.push({ half: p.half, lines: [] });
    halves[halves.length - 1]!.lines.push(p.text);
  }
  const Link = ({ pid, name }: { pid: string; name: string }) => (
    <button type="button" class="link" onClick={() => onPlayer(pid)}>
      {__i18n_display(name)}
    </button>
  );
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog box-dialog" role="dialog" aria-modal="true" aria-labelledby="box-title" ref={box}>
        <button type="button" class="close" onClick={onClose} aria-label={__i18n_t("ui.boxScore.boxScore.94b7dba1")}>{__i18n_t("ui.boxScore.boxScore.94b7dba1")}</button>
        <p class="muted">
          {__i18n_display(v.date)}
          {__i18n_display(v.att ? __i18n_k("ui.boxScore.boxScore.d6a1dfb9", { value: v.att.toLocaleString('ko-KR') }) : '')}
          {__i18n_display(v.innings > 9 ? __i18n_k("ui.boxScore.boxScore.c0c99b3b", { innings: v.innings }) : '')}
        </p>
        <h2 id="box-title" tabIndex={-1} ref={heading}>
          {__i18n_display(v.away.short)} {__i18n_display(live ? liveScore[0] : v.away.rhe[0])} : {__i18n_display(live ? liveScore[1] : v.home.rhe[0])} {__i18n_display(v.home.short)}
        </h2>
        <div class="table-wrap">
          <table class="record-table linescore">
            <thead>
              <tr>
                <th />
                {__i18n_display(Array.from({ length: innings }, (_, i) => (
                  <th key={i} class="num">
                    {__i18n_display(i + 1)}
                  </th>
                )))}
                <th class="num">R</th>
                <th class="num">H</th>
                <th class="num">E</th>
              </tr>
            </thead>
            <tbody>
              {__i18n_display([v.away, v.home].map((t) => (
                <tr key={t.teamId}>
                  <th scope="row">
                    <span class="swatch" style={{ background: t.color }} aria-hidden="true" /> {__i18n_display(t.short)}
                  </th>
                  {__i18n_display(Array.from({ length: innings }, (_, i) => (
                    <td key={i} class="num">
                      {__i18n_display(live ? '' : (t.line[i] ?? (i < t.line.length ? 0 : 'X')))}
                    </td>
                  )))}
                  <td class="num strong">{__i18n_display(live ? '' : t.rhe[0])}</td>
                  <td class="num">{__i18n_display(live ? '' : t.rhe[1])}</td>
                  <td class="num">{__i18n_display(live ? '' : t.rhe[2])}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        <div class="segmented profile-tabs" role="tablist" aria-label={__i18n_t("ui.boxScore.boxScore.e0cee61a")}>
          <button type="button" role="tab" aria-selected={tab === 'box'} aria-pressed={tab === 'box'} disabled={!!live && hidden} onClick={() => setTab('box')}>{__i18n_t("ui.boxScore.boxScore.8fcc8f9a")}</button>
          <button type="button" role="tab" aria-selected={tab === 'pbp'} aria-pressed={tab === 'pbp'} disabled={!v.plays} onClick={() => setTab('pbp')}>{__i18n_t("ui.boxScore.boxScore.a1298173")}</button>
          {__i18n_display(mine && (
            <button type="button" role="tab" aria-selected={tab === 'story'} aria-pressed={tab === 'story'} disabled={!!live && hidden} onClick={() => setTab('story')}>{__i18n_t("ui.boxScore.boxScore.9df02808")}</button>
          ))}
        </div>

        {__i18n_display(tab === 'story' &&
          (article ? (
            <NewsCard item={article} onRewrite={story.onRewrite} onRevert={story.onRevert} busy={story.busyId === article.id} />
          ) : (
            <p>{__i18n_rich("ui.boxScore.boxScore.adfc2dbd", { value: ' ', value2: <button type="button" onClick={() => onAct?.({ kind: 'gameStory', id })}>{__i18n_t("ui.boxScore.boxScore.3a97e58f")}</button>, value3: ' ', value4: <span class="muted small">{__i18n_t("ui.boxScore.boxScore.963925fa")}</span> })}</p>
          )))}

        {__i18n_display(tab === 'box' &&
          [v.away, v.home].map((t) => (
            <section key={t.teamId}>
              <h3>{__i18n_display(t.name)}</h3>
              <div class="table-wrap" tabIndex={0}>
                <table class="record-table career">
                  <thead>
                    <tr>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.790bde97")}</th>
                      <th>{__i18n_t("ui.boxScore.boxScore.5db174c6")}</th>
                      <th>{__i18n_t("ui.boxScore.boxScore.3d9d982d")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.6e593a9b")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.4b4a98b9")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.1822db88")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.fed1c588")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.9162d3a3")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.283fc12a")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.3f349ed1")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {__i18n_display(t.bat.map((b) => (
                      <tr key={b.id} class={b.sub ? 'sub-row' : undefined}>
                        <td class="num">{__i18n_display(b.order ?? '')}</td>
                        <td>
                          <Link pid={b.id} name={b.name} />
                          {__i18n_display(b.d + b.t > 0 && <span class="muted small"> {__i18n_display(b.d ? __i18n_k("ui.boxScore.boxScore.63657cf0", { value: b.d > 1 ? `×${b.d}` : '' }) : '')}{__i18n_display(b.t ? __i18n_k("ui.boxScore.boxScore.0ee51e47") : '')}</span>)}
                          {__i18n_display(b.sb > 0 && <span class="muted small">{__i18n_t("ui.boxScore.boxScore.01db2d3a", { sb: b.sb })}</span>)}
                        </td>
                        <td>{__i18n_display(b.pos)}</td>
                        <td class="num">{__i18n_display(b.ab)}</td>
                        <td class="num">{__i18n_display(b.r)}</td>
                        <td class="num strong">{__i18n_display(b.h)}</td>
                        <td class="num">{__i18n_display(b.rbi)}</td>
                        <td class="num">{__i18n_display(b.hr || '')}</td>
                        <td class="num">{__i18n_display(b.bb || '')}</td>
                        <td class="num">{__i18n_display(b.k || '')}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
              <div class="table-wrap" tabIndex={0}>
                <table class="record-table career">
                  <thead>
                    <tr>
                      <th>{__i18n_t("ui.boxScore.boxScore.ef406667")}</th>
                      <th>{__i18n_t("ui.boxScore.boxScore.71d855ac")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.639a1f2f")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.b68b86a7")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.de9718e1")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.b768863e")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.283fc12a")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.3f349ed1")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.bf21ab80")}</th>
                      <th class="num">{__i18n_t("ui.boxScore.boxScore.5390f3ce")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {__i18n_display(t.pit.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link pid={p.id} name={p.name} />
                        </td>
                        <td>{__i18n_display(p.dec && <span class="tag">{__i18n_display(p.dec)}</span>)}</td>
                        <td class="num">{__i18n_display(p.ip)}</td>
                        <td class="num">{__i18n_display(p.h)}</td>
                        <td class="num">{__i18n_display(p.r)}</td>
                        <td class="num strong">{__i18n_display(p.er)}</td>
                        <td class="num">{__i18n_display(p.bb)}</td>
                        <td class="num">{__i18n_display(p.k)}</td>
                        <td class="num">{__i18n_display(p.hr || '')}</td>
                        <td class="num">{__i18n_display(p.pitches)}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </section>
          )))}

        {tab === 'pbp' && v.plays && (
          <div class="segmented" role="group" aria-label={__i18n_t("ui.boxScore.text.093867f4")}>
            <button type="button" aria-pressed={mode === 'pa'} onClick={() => setMode('pa')}>
              {__i18n_t("ui.boxScore.text.4cf59d5c")}
            </button>
            <button type="button" aria-pressed={mode === 'pitch'} onClick={() => setMode('pitch')}>
              {__i18n_t("ui.boxScore.text.534c9a1c")}
            </button>
          </div>
        )}
        {tab === 'pbp' && v.plays && mode === 'pitch' && <PitchRelay league={league} id={id} away={v.away.short} home={v.home.short} ours={ours} />}
        {__i18n_display(tab === 'pbp' && v.plays && mode === 'pa' && (
          <>
            <div class="relay-bar">
              {__i18n_display(shown === null || !live ? (
                <button type="button" onClick={() => setShown(0)}>{__i18n_t("ui.boxScore.boxScore.f4eeef62")}</button>
              ) : (
                <button type="button" onClick={() => setShown(null)}>
                  {__i18n_display(hidden ? __i18n_k("ui.boxScore.boxScore.98faec4b") : __i18n_k("ui.boxScore.boxScore.b2137956"))}
                </button>
              ))}
              <label>
                {__i18n_t("ui.boxScore.text.e8a20d8c")}{' '}
                <select value={String(speed)} onChange={(e) => setSpeed(Number((e.currentTarget as HTMLSelectElement).value))}>
                  {__i18n_display(SPEEDS.map(([label, ms]) => (
                    <option key={ms} value={String(ms)}>
                      {__i18n_display(label)}
                    </option>
                  )))}
                </select>
              </label>
              {__i18n_display(live && (
                <span class="muted">
                  {__i18n_display(v.away.short)} {__i18n_display(liveScore[0])} : {__i18n_display(liveScore[1])} {__i18n_display(v.home.short)}
                </span>
              ))}
            </div>
            <div class="relay" aria-live="polite">
              {__i18n_display((live ? [...halves].reverse() : halves).map((h, i) => (
                <section key={h.half + i}>
                  <h4>{__i18n_display(h.half)}</h4>
                  <ol class="plain">
                    {__i18n_display((live && i === 0 ? [...h.lines].reverse() : h.lines).map((line, j) => (
                      <li key={j}>{__i18n_display(line)}</li>
                    )))}
                  </ol>
                </section>
              )))}
            </div>
          </>
        ))}
      </div>
    </div>
  );
}

/** 1.7.0: the relay a pitch at a time, on a board like the old FM's: the bases as go stones, the count as lamps. */
function PitchRelay({ league, id, away, home, ours }: { league: LeagueState; id: string; away: string; home: string; ours: boolean }) {
  const frames = useMemo(() => pitchFeed(league, id) ?? [], [league, id]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(700);
  useEffect(() => {
    if (!playing || at >= frames.length - 1) {
      if (at >= frames.length - 1 && ours) markWatched(id);
      return;
    }
    const f = frames[at]!;
    // A beat longer on the play itself and on the batter coming up.
    const t = setTimeout(() => setAt(at + 1), f.kind === 'result' ? speed * 2.2 : f.kind === 'up' || f.kind === 'change' ? speed * 1.3 : speed);
    return () => clearTimeout(t);
  }, [at, playing, speed, frames]);
  if (!frames.length) return <p class="muted">{__i18n_t("ui.boxScore.text.b66f68ea")}</p>;
  const f = frames[at]!;
  const nextUp = () => {
    const i = frames.findIndex((x, k) => k > at && (x.kind === 'up' || x.kind === 'change'));
    setAt(i < 0 ? frames.length - 1 : i);
  };
  const nextHalf = () => {
    const i = frames.findIndex((x, k) => k > at && x.half !== f.half);
    setAt(i < 0 ? frames.length - 1 : i);
  };
  // This plate appearance so far, newest first.
  const start = (() => {
    for (let k = at; k >= 0; k--) if (frames[k]!.kind === 'up' || frames[k]!.kind === 'change') return k;
    return 0;
  })();
  const recent = frames.slice(start, at + 1).reverse();
  return (
    <div class="pitch-relay">
      <div class="relay-bar">
        <button type="button" onClick={() => setPlaying(!playing)}>
          {playing ? __i18n_t("ui.boxScore.text.c42a26f8") : __i18n_t("ui.boxScore.text.df123839")}
        </button>
        <button type="button" onClick={nextUp} disabled={at >= frames.length - 1}>
          {__i18n_t("ui.boxScore.text.ad3f5845")}
        </button>
        <button type="button" onClick={nextHalf} disabled={at >= frames.length - 1}>
          {__i18n_t("ui.boxScore.text.5c5cf885")}
        </button>
        <button type="button" onClick={() => setAt(frames.length - 1)} disabled={at >= frames.length - 1}>
          {__i18n_t("ui.boxScore.text.fd376da5")}
        </button>
        <button type="button" onClick={() => setAt(0)} disabled={at === 0}>
          {__i18n_t("ui.boxScore.text.8ee63bce")}
        </button>
        <label>
          {__i18n_t("ui.boxScore.text.e8a20d8c")}{' '}
          <select value={String(speed)} onChange={(e) => setSpeed(Number((e.currentTarget as HTMLSelectElement).value))}>
            <option value="1400">{__i18n_t("ui.boxScore.text.b8949c89")}</option>
            <option value="700">{__i18n_t("ui.boxScore.text.2179da2c")}</option>
            <option value="250">{__i18n_t("ui.boxScore.text.de1ae880")}</option>
          </select>
        </label>
      </div>
      <div class="pitch-board" aria-live="polite">
        <PitchDiamond f={f} />
        <div class="board-side">
          <p class="board-score">
            <strong>{away}</strong> {f.score[0]} : {f.score[1]} <strong>{home}</strong>
          </p>
          <p class="board-half">{f.half}</p>
          <Lamps label="B" n={f.balls} of={3} cls="ball" />
          <Lamps label="S" n={f.strikes} of={2} cls="strike" />
          <Lamps label="O" n={f.outs} of={2} cls="out" />
          <p class="small">
            {__i18n_t("ui.boxScore.text.ef406667")} <strong>{f.pitcher}</strong>
            {f.batter && (
              <>
                {' · '}
                {__i18n_t("ui.boxScore.text.5db174c6")} <strong>{f.batter}</strong>
              </>
            )}
          </p>
        </div>
      </div>
      <ol class="plain pitch-log" reversed>
        {recent.map((x, k) => (
          <li key={k} class={x.kind === 'result' ? 'strong' : x.kind === 'up' || x.kind === 'change' ? 'muted' : undefined}>
            {x.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Count lamps: balls (three lit at most before ball four), strikes, outs. */
function Lamps({ label, n, of, cls }: { label: string; n: number; of: number; cls: string }) {
  return (
    <p class={`lamps ${cls}`} aria-label={`${label} ${n}`}>
      <span class="lamp-label">{label}</span>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} class={`lamp${i < Math.min(n, of) ? ' on' : ''}`} aria-hidden="true" />
      ))}
    </p>
  );
}

/** The diamond with a go stone on each occupied base. */
function PitchDiamond({ f }: { f: PitchFrame }) {
  const at: [number, number][] = [
    [150, 90],
    [100, 40],
    [50, 90],
  ];
  return (
    <svg viewBox="0 0 200 150" class="board-diamond" role="img" aria-label={__i18n_t("ui.boxScore.text.7fedac48", { value: f.bases.map((b, i) => (b ? `${i + 1}` : '')).filter(Boolean).join(', ') || __i18n_t("ui.boxScore.text.d58fa73a") })}>
      <polygon points="100,140 150,90 100,40 50,90" class="field" />
      <rect x="95" y="135" width="10" height="10" class="home" transform="rotate(45 100 140)" />
      {at.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 6} y={y - 6} width="12" height="12" class="bag" transform={`rotate(45 ${x} ${y})`} />
          {f.bases[i] && <circle cx={x} cy={y} r="9" class="stone" />}
        </g>
      ))}
    </svg>
  );
}
