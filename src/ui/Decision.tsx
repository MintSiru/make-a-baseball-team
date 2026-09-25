import { useEffect, useMemo, useState } from 'preact/hooks';
import { autoDecision, checkDecision, faAsk, projectedPayroll, type DecisionInput } from '../league/expansion';
import { ageIn, isPitcher, keepValue } from '../league/players';
import type { Decision as DecisionT, LeagueState } from '../league/state';
import { positionLabel, shortName } from '../league/views';
import type { Player, PlayerId, TeamId } from '../model/types';
import { money } from './format';
import { salaryIn } from '../league/contracts';

interface Props {
  league: LeagueState;
  onSubmit: (input: DecisionInput) => void;
  onPlayer: (id: PlayerId) => void;
}

const TITLES: Record<DecisionT['kind'], string> = {
  military: '병역',
  ownFreeAgents: 'FA 재계약',
  rookieBonus: '신인 계약금 협상',
  development: '육성선수 계약',
  camp: '스프링캠프',
  tryout: '창단 트라이아웃',
  draftPick: '신인 드래프트',
  freeAgents: 'FA 영입 (신생구단 특례)',
  specialDraft: '특별지명',
  released: '방출선수 영입',
  foreign: '외국인 선수 계약',
  roster: '소속선수 정리',
};

const lastWar = (p: Player) => p.career.filter((c) => !c.level).at(-1)?.war;

function PlayerTable({
  league,
  players,
  selected,
  toggle,
  onPlayer,
  extra,
  name,
  radio,
}: {
  league: LeagueState;
  players: Player[];
  selected: Set<PlayerId>;
  toggle: (id: PlayerId) => void;
  onPlayer: (id: PlayerId) => void;
  extra?: { title: string; value: (p: Player) => string };
  name?: string;
  radio?: boolean;
}) {
  const year = league.offseason ? league.offseason.year + 1 : league.year + 1;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            <th aria-label="선택" />
            <th>이름</th>
            <th>포지션</th>
            <th class="num">나이</th>
            <th>경력</th>
            <th class="num">현재</th>
            <th class="num">미래</th>
            {extra && <th class="num">{extra.title}</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} class="player-row" aria-selected={selected.has(p.id)}>
              <td>
                <input
                  type={radio ? 'radio' : 'checkbox'}
                  name={name}
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  aria-label={`${p.name} 선택`}
                />
              </td>
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>
              </td>
              <td>{positionLabel(p)}</td>
              <td class="num">{ageIn(p, year)}</td>
              <td class="muted">{p.teamId ? shortName(league, p.teamId) : p.origin.kind === 'foreign' ? p.education.pathText : p.career.length ? '방출' : p.origin.pathway}</td>
              <td class="num">{p.scouting.current}</td>
              <td class="num strong">{p.scouting.futureValue}</td>
              {extra && <td class="num">{extra.value(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Decision({ league, onSubmit, onPlayer }: Props) {
  const d = league.pending!;
  const u = league.user!;
  const next = league.offseason ? league.offseason.year + 1 : league.year + 1;
  const [selected, setSelected] = useState<Set<PlayerId>>(new Set());
  const [special, setSpecial] = useState<Record<TeamId, PlayerId>>({});
  useEffect(() => {
    setSelected(new Set());
    setSpecial({});
  }, [d.kind, d.kind === 'draftPick' ? d.overall : 0]);

  const toggle = (id: PlayerId) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const input: DecisionInput | null = useMemo(() => {
    switch (d.kind) {
      case 'draftPick':
        return null;
      case 'specialDraft':
        return { kind: 'specialDraft', picks: special };
      default:
        return { kind: d.kind, ids: [...selected] } as DecisionInput;
    }
  }, [d, selected, special]);
  const problem = input ? checkDecision(league, input) : null;

  const recommend = () => {
    const a = autoDecision(league);
    if (!a) return;
    if (a.kind === 'specialDraft') setSpecial(a.picks);
    else if ('ids' in a) setSelected(new Set(a.ids));
  };

  const byValue = (ids: PlayerId[]) => ids.map((id) => league.players[id]!).sort((a, b) => keepValue(b, next) - keepValue(a, next));
  const budgetLine = (
    <p class="muted">
      창단 자금 {money(u.fund)} · {next}년 연봉 {money(projectedPayroll(league, u.teamId, next))} / 예산 {money(u.payrollBudget)}
    </p>
  );

  let body = null;
  switch (d.kind) {
    case 'tryout':
    case 'released':
      body = (
        <>
          <p>
            {d.kind === 'tryout'
              ? '독립리그·해외 복귀 선수와 최근 방출된 프로 선수들이 트라이아웃에 왔습니다. 계약할 선수를 고르세요.'
              : '다른 구단이 방출한 선수들입니다. 신생구단은 다른 구단보다 먼저 계약할 수 있습니다.'}{' '}
            최대 {d.max}명 · 선택 {selected.size}명
          </p>
          <PlayerTable league={league} players={byValue(d.candidates)} selected={selected} toggle={toggle} onPlayer={onPlayer} />
        </>
      );
      break;
    case 'draftPick': {
      const draft = league.offseason!.draft!;
      const pool = draft.pool.map((id) => league.players[id]!).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank);
      const mine = Object.values(league.players).filter((p) => p.teamId === u.teamId && p.origin.draftYear === draft.year && p.origin.overallPick);
      body = (
        <>
          <p>
            {d.label} · 전체 {d.overall}순위 차례입니다. 남은 후보 {pool.length}명. 지명한 선수 {mine.length}명:{' '}
            <span class="muted">{mine.map((p) => p.name).join(', ') || '없음'}</span>
          </p>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table pick-table">
              <thead>
                <tr>
                  <th class="num">순위</th>
                  <th>이름</th>
                  <th>포지션</th>
                  <th>구분</th>
                  <th class="num">현재</th>
                  <th class="num">미래</th>
                  <th class="num">구속</th>
                  <th aria-label="지명" />
                </tr>
              </thead>
              <tbody>
                {pool.slice(0, 120).map((p) => (
                  <tr key={p.id} class="player-row">
                    <td class="num">{p.amateur.draftRank}</td>
                    <td>
                      <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                        {p.name}
                      </button>
                    </td>
                    <td>{positionLabel(p)}</td>
                    <td class="muted">{p.origin.pathway}</td>
                    <td class="num">{p.scouting.current}</td>
                    <td class="num strong">{p.scouting.futureValue}</td>
                    <td class="num">{p.velocity ?? '-'}</td>
                    <td>
                      <button type="button" class="pick" onClick={() => onSubmit({ kind: 'draftPick', id: p.id })}>
                        지명
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
      break;
    }
    case 'freeAgents':
      body = (
        <>
          <p>
            1군 진입을 앞두고 FA를 최대 {d.max}명까지 보상선수 없이 영입할 수 있습니다. 선택 {selected.size}명
          </p>
          {budgetLine}
          <PlayerTable
            league={league}
            players={byValue(d.candidates)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '요구 연봉 · 최근 WAR', value: (p) => `${money(faAsk(league, p, next))} · ${lastWar(p)?.toFixed(1) ?? '-'}` }}
          />
        </>
      );
      break;
    case 'specialDraft': {
      const count = Object.keys(special).length;
      body = (
        <>
          <p>
            기존 구단이 보호선수 {d.protectedCount}명을 묶었습니다. 구단마다 보호되지 않은 선수 1명을 데려올 수 있고, 1명에 {money(d.fee)}을 원소속 구단에 냅니다. 선택{' '}
            {count}명 · 보상금 {money(count * d.fee)}
          </p>
          {budgetLine}
          {Object.entries(d.lists).map(([teamId, ids]) => (
            <details key={teamId} open={!special[teamId]}>
              <summary>
                {league.teams.find((t) => t.id === teamId)?.name}
                {special[teamId] && ` → ${league.players[special[teamId]!]!.name}`}
              </summary>
              <PlayerTable
                league={league}
                name={`special-${teamId}`}
                radio
                players={byValue(ids).slice(0, 12)}
                selected={new Set(special[teamId] ? [special[teamId]!] : [])}
                toggle={(id) => setSpecial((prev) => (prev[teamId] === id ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== teamId)) : { ...prev, [teamId]: id }))}
                onPlayer={onPlayer}
                extra={{ title: '연봉', value: (p) => money(salaryIn(p, next)) }}
              />
            </details>
          ))}
        </>
      );
      break;
    }
    case 'foreign': {
      const groups: [string, (p: Player) => boolean][] = [
        ['외국인 투수', (p) => !p.origin.asiaQuota && isPitcher(p)],
        ['외국인 타자', (p) => !p.origin.asiaQuota && !isPitcher(p)],
        ['아시아쿼터', (p) => !!p.origin.asiaQuota],
      ];
      const cands = d.candidates.map((id) => league.players[id]!);
      body = (
        <>
          <p>
            외국인 {d.regular}명{d.asia ? `, 아시아쿼터 ${d.asia}명` : ''}을 더 계약할 수 있습니다. 신규 외국인은 총액 100만 달러, 아시아쿼터는 20만 달러까지입니다.
          </p>
          {budgetLine}
          {groups.map(([title, test]) => (
            <div key={title}>
              <h4>{title}</h4>
              <PlayerTable
                league={league}
                players={cands.filter(test).sort((a, b) => b.scouting.current - a.scouting.current)}
                selected={selected}
                toggle={toggle}
                onPlayer={onPlayer}
                extra={{ title: '연봉', value: (p) => money(salaryIn(p, next)) }}
              />
            </div>
          ))}
        </>
      );
      break;
    }
    case 'roster':
      body = (
        <>
          <p>
            소속선수 한도는 {d.limit}명입니다. {d.release}명 이상 방출하세요. 선택 {selected.size}명
          </p>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!).sort((a, b) => keepValue(a, next) - keepValue(b, next))}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '연봉', value: (p) => money(salaryIn(p, next)) }}
          />
        </>
      );
      break;
  }

  return (
    <section class="decision" aria-labelledby="decision-title">
      <h2 id="decision-title">{TITLES[d.kind]}</h2>
      {body}
      <div class="actions">
        {d.kind === 'draftPick' ? (
          <button type="button" onClick={() => onSubmit({ kind: 'draftPick', id: null })}>
            스카우트에게 맡기기
          </button>
        ) : (
          <>
            <button type="button" class="primary" disabled={!!problem} onClick={() => input && onSubmit(input)}>
              확정
            </button>
            <button type="button" onClick={recommend}>
              스카우트 추천으로 채우기
            </button>
          </>
        )}
        {problem && <span class="notice inline">{problem}</span>}
      </div>
    </section>
  );
}
