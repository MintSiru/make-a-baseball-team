/* 2.0.71 (the user's request: 「내가 보낸 내새끼들 잘하고 있나 보게」): the players a line of text names — a trade in the
   transfer news, the other side of a trade in a player's moves — as links to their player panels. A line written
   since 2.0.71 carries the players' ids; an older one links each name only one player in the league has. */
import type { ComponentChildren } from 'preact';
import { displayText } from '../i18n/index';
import type { PlayerId } from '../model/types';
import type { LeagueState } from '../league/state';

const unique = new WeakMap<object, Map<string, PlayerId | null>>();

/** Each name to its one player (null when two or more share it). */
function namesOf(league: LeagueState) {
  let m = unique.get(league.players);
  if (!m) {
    m = new Map();
    for (const p of Object.values(league.players)) {
      if (!p.name || p.name.length < 2) continue;
      m.set(p.name, m.has(p.name) ? null : p.id);
    }
    unique.set(league.players, m);
  }
  return m;
}

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text, its players' names as links (as plain text when nothing opens a player). */
export function NameLinks({ league, text, ids, onPlayer }: { league: LeagueState; text: string; ids?: PlayerId[]; onPlayer?: (id: string) => void }) {
  const shown = displayText(text);
  if (!onPlayer) return <>{shown}</>;
  const byName = new Map<string, PlayerId>();
  const add = (name: string, id: PlayerId) => {
    if (name && name.length >= 2 && !byName.has(name)) byName.set(name, id);
  };
  if (ids?.length) {
    for (const id of ids) {
      const p = league.players[id];
      if (!p) continue;
      add(p.name, id);
      add(displayText(p.name), id);
    }
  } else {
    const all = namesOf(league);
    for (const [name, id] of all) {
      if (!id) continue;
      if (shown.includes(name)) add(name, id);
      else {
        const d = displayText(name);
        if (d !== name && shown.includes(d)) add(d, id);
      }
    }
  }
  if (!byName.size) return <>{shown}</>;
  const re = new RegExp(`(${[...byName.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})`, 'g');
  const out: ComponentChildren[] = [];
  let at = 0;
  for (const m of shown.matchAll(re)) {
    if (m.index! > at) out.push(shown.slice(at, m.index));
    const id = byName.get(m[0])!;
    out.push(
      <button key={`${m.index}`} type="button" class="link name-link" onClick={() => onPlayer(id)}>
        {m[0]}
      </button>,
    );
    at = m.index! + m[0].length;
  }
  if (at < shown.length) out.push(shown.slice(at));
  return <>{out}</>;
}
