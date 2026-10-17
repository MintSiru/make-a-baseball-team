import { display as __i18n_display, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* One game (V0.7): the line score, both clubs' batting and pitching, and for the user's games the text
   relay, which can be replayed play by play (관전 모드). */
import { fenceAt, type ParkLayout } from '../league/layout';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import type { LeagueState } from '../league/state';
import { boxView } from '../league/views';
import type { Action } from '../league/actions';
import { NewsCard } from './Story';
import type { StoryHooks } from './MyClub';
import { markWatched, spoilerHidden } from './display';
import { pitchFeed, type PitchFrame, type PitchLoc } from '../league/pitchfeed';

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
  live: watching = false,
}: {
  league: LeagueState;
  id: string;
  onClose: () => void;
  onPlayer: (id: string) => void;
  onAct?: (a: Action) => void;
  story?: StoryHooks;
  /** 1.7.1: opened to watch our game live — the score hidden, a pitch at a time from the first pitch. */
  live?: boolean;
}) {
  const v = useMemo(() => boxView(league, id), [league, id]);
  const ours = !!league.user && !!v && (v.home.teamId === league.user.teamId || v.away.teamId === league.user.teamId);
  // 1.6.0: with the score hidden, our unseen game opens as a relay from the first pitch.
  const [hidden] = useState(() => (watching && !!v?.plays) || spoilerHidden(id, ours, !!v?.plays));
  const [tab, setTab] = useState<Tab>(hidden ? 'pbp' : 'box');
  const [shown, setShown] = useState<number | null>(hidden ? 0 : null);
  const [speed, setSpeed] = useState(1100);
  // 1.7.0: the relay a plate appearance or a pitch at a time.
  const [mode, setMode] = useState<'pa' | 'pitch'>(watching ? 'pitch' : 'pa');
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  // Replay: one more play every tick until the end (then the game counts as seen).
  useEffect(() => {
    if (v?.plays && (shown === null || shown >= v.plays.length) && ours) markWatched(id);
    // A pitch at a time, the relay below moves the score (onAt).
    if (shown === null || !v?.plays || shown >= v.plays.length || mode === 'pitch') return;
    const t = setTimeout(() => setShown(shown + 1), speed);
    return () => clearTimeout(t);
  }, [shown, speed, v, mode]);
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
        {tab === 'pbp' && v.plays && mode === 'pitch' && <PitchRelay league={league} id={id} away={v.away.short} home={v.home.short} ours={ours} onAt={shown === null ? undefined : (play, done) => setShown(done ? v.plays!.length : play)} />}
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
function PitchRelay({ league, id, away, home, ours, onAt }: { league: LeagueState; id: string; away: string; home: string; ours: boolean; onAt?: (play: number, done: boolean) => void }) {
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
  // The score above follows the relay while it is hidden (1.7.1): the plays before this one.
  useEffect(() => {
    if (frames.length) onAt?.(frames[at]!.play + (frames[at]!.kind === 'result' ? 1 : 0), at >= frames.length - 1);
  }, [at, frames]);
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
        <StrikeZone pitches={frames.slice(start, at + 1).flatMap((x) => (x.loc ? [x.loc] : []))} />
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

/** 1.7.1: the field, metres from home plate to the board's units (home at the bottom, centre field up). Distances are
    drawn compressed (the 0.75th power) so the infield is not lost in a 120 m outfield. */
const HOME: [number, number] = [100, 172];
const spotAt = (dist: number, angle: number): [number, number] => {
  const a = (angle * Math.PI) / 180,
    r = 146 * Math.pow(Math.max(0, dist) / 125, 0.75);
  return [HOME[0] + r * Math.sin(a), HOME[1] - r * Math.cos(a)];
};
/** Fence distances: 100 m down the lines, 122 m to centre; 2.0.2: the home park's own when the relay knows it. */
const fenceOf = (park?: ParkLayout) => (angle: number) => (park ? fenceAt(park, angle).dist : 100 + 22 * Math.cos((angle * Math.PI) / 90));
const pts = (xs: [number, number][]) => xs.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** The whole field with a go stone on each occupied base, and where the ball came down on the play. */
function PitchDiamond({ f }: { f: PitchFrame }) {
  const fence = fenceOf(f.park);
  const outfield: [number, number][] = [HOME, ...Array.from({ length: 19 }, (_, i) => spotAt(fence(-45 + i * 5), -45 + i * 5))];
  const dirt: [number, number][] = [HOME, ...Array.from({ length: 19 }, (_, i) => spotAt(44, -45 + i * 5))];
  const bases = [spotAt(27.4, 45), spotAt(38.8, 0), spotAt(27.4, -45)];
  const hit = f.kind === 'result' ? f.hit : undefined;
  const land = hit ? spotAt(Math.min(hit.dist, 140), hit.angle) : null;
  // A fly ball or a home run arcs; a grounder or a liner runs straight.
  const path = hit && land ? (hit.kind === 'fly' || hit.kind === 'hr' ? `M${HOME[0]},${HOME[1]} Q${((HOME[0] + land[0]) / 2).toFixed(1)},${(Math.min(HOME[1], land[1]) - hit.dist * 0.35).toFixed(1)} ${land[0].toFixed(1)},${land[1].toFixed(1)}` : `M${HOME[0]},${HOME[1]} L${land[0].toFixed(1)},${land[1].toFixed(1)}`) : null;
  const label = __i18n_t("ui.boxScore.text.7fedac48", { value: f.bases.map((b, i) => (b ? `${i + 1}` : '')).filter(Boolean).join(', ') || __i18n_t("ui.boxScore.text.d58fa73a") });
  return (
    <svg viewBox="0 0 200 182" class="board-diamond" role="img" aria-label={hit ? `${label} · ${__i18n_t("ui.boxScore.text.6d7d5b05", { text: f.text })}` : label}>
      <polygon points={pts(outfield)} class="grass" />
      <polygon points={pts(dirt)} class="dirt" />
      <polyline points={pts([spotAt(fence(-45), -45), HOME, spotAt(fence(45), 45)])} class="line" />
      <polygon points={pts([HOME, ...bases.slice(0, 1), bases[1]!, bases[2]!])} class="infield" />
      <rect x={HOME[0] - 3.5} y={HOME[1] - 3.5} width="7" height="7" class="home" transform={`rotate(45 ${HOME[0]} ${HOME[1]})`} />
      {bases.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 3.5} y={y - 3.5} width="7" height="7" class="bag" transform={`rotate(45 ${x} ${y})`} />
          {f.bases[i] && <circle cx={x} cy={y} r="6" class="stone" />}
        </g>
      ))}
      {path && land && (
        <g class={`hit ${hit!.out ? 'out' : 'safe'} ${hit!.kind}`}>
          <path d={path} class="trail" />
          <circle cx={land[0]} cy={land[1]} r={hit!.kind === 'hr' ? 5 : 4} class="spot" />
        </g>
      )}
    </svg>
  );
}

/** 1.7.1: the strike zone from the catcher's view, with this plate appearance's pitches numbered in order. */
function StrikeZone({ pitches }: { pitches: PitchLoc[] }) {
  // The zone is −1…1 each way: 60 wide and 72 tall on the board, with room around it for balls.
  const X = (x: number) => 60 + x * 30;
  const Y = (y: number) => 75 - y * 36;
  const CALL: Record<PitchLoc['call'], string> = { ball: __i18n_t("ui.boxScore.text.c72996aa"), strike: __i18n_t("ui.boxScore.text.4a03be0a"), swing: __i18n_t("ui.boxScore.text.6145417a"), foul: __i18n_t("ui.boxScore.text.1bd463ff"), play: __i18n_t("ui.boxScore.text.74b03362"), hbp: __i18n_t("ui.boxScore.text.58ef970a") };
  return (
    <figure class="zone-wrap">
      <svg viewBox="0 0 120 150" class="strike-zone" role="img" aria-label={__i18n_t("ui.boxScore.text.442c081e", { value: pitches.map((p, i) => `${i + 1} ${CALL[p.call]}`).join(', ') || __i18n_t("ui.boxScore.text.d58fa73a") })}>
        <rect x={X(-1)} y={Y(1)} width="60" height="72" class="zone" />
        {[-1 / 3, 1 / 3].map((t) => (
          <g key={t}>
            <line x1={X(t)} y1={Y(1)} x2={X(t)} y2={Y(-1)} class="grid" />
            <line x1={X(-1)} y1={Y(t)} x2={X(1)} y2={Y(t)} class="grid" />
          </g>
        ))}
        <polygon points={pts([[X(-0.85), 142], [X(0.85), 142], [X(0.85), 146], [60, 149], [X(-0.85), 146]])} class="plate" />
        {pitches.map((p, i) => (
          <g key={i} class={`pitch ${p.call}${i === pitches.length - 1 ? ' last' : ''}`}>
            <circle cx={X(Math.max(-1.9, Math.min(1.9, p.x)))} cy={Y(Math.max(-1.85, Math.min(1.85, p.y)))} r="7.5" />
            <text x={X(Math.max(-1.9, Math.min(1.9, p.x)))} y={Y(Math.max(-1.85, Math.min(1.85, p.y))) + 3.4}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption class="zone-key small">
        <span class="key ball">{__i18n_t("ui.boxScore.text.c72996aa")}</span> <span class="key strike">{__i18n_t("ui.boxScore.text.4a03be0a")}</span> <span class="key swing">{__i18n_t("ui.boxScore.text.6145417a")}</span> <span class="key foul">{__i18n_t("ui.boxScore.text.1bd463ff")}</span> <span class="key play">{__i18n_t("ui.boxScore.text.74b03362")}</span>
      </figcaption>
    </figure>
  );
}
