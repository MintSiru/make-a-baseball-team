/* A league player's page (V0.5.1 layout): who he is and what he throws at a glance, scouting grades as
   bars, then tabs for season records (with career totals), career highs, left/right splits and
   injuries. Everything shown is public: grades are scouting reports, velocity is the radar gun. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { TOOL_LABELS } from '../draftroom';
import type { Split, Splits } from '../league/engine/types';
import type { LeagueState } from '../league/state';
import { playerCard, positionLabel, rateContextFor, rates, type PlayerCard } from '../league/views';
import { usdTotal } from '../league/contracts';
import { usd } from '../league/foreign';
import { handedness, militaryLabel, money, toolKeysFor } from './format';

const POSITION_NAMES: Record<string, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' };

type Tab = 'seasons' | 'highs' | 'splits' | 'injuries';
const TABS: { key: Tab; label: string }[] = [
  { key: 'seasons', label: '연도별 기록' },
  { key: 'highs', label: '통산 · 커리어 하이' },
  { key: 'splits', label: '좌우 기록' },
  { key: 'injuries', label: '부상 이력' },
];

/** A 20–80 grade as a bar, with the projected grade as a tick. */
function GradeBar({ label, now, future, note }: { label: string; now: number | undefined; future?: number; note?: string }) {
  const pct = (g: number) => `${((Math.max(20, Math.min(80, g)) - 20) / 60) * 100}%`;
  return (
    <div class="gradebar">
      <span class="gradebar-label">{label}</span>
      <span class="gradebar-track" aria-hidden="true">
        {now != null && <span class={`gradebar-fill${now >= 60 ? ' plus' : now < 40 ? ' minus' : ''}`} style={{ width: pct(now) }} />}
        {future != null && future > (now ?? 0) && <span class="gradebar-future" style={{ left: pct(future) }} />}
      </span>
      <span class="gradebar-num">
        {now ?? '-'}
        {future != null && future !== now && <span class="muted"> → {future}</span>}
      </span>
      {note && <span class="gradebar-note muted">{note}</span>}
    </div>
  );
}

const splitRates = (x: Split) => ({
  avg: x.ab ? x.h / x.ab : 0,
  obp: x.pa ? (x.h + x.bb + x.hbp) / Math.max(1, x.ab + x.bb + x.hbp + x.sf) : 0,
  slg: x.ab ? x.tb / x.ab : 0,
});

function SplitTable({ title, splits, pitcher }: { title: string; splits: Splits | null; pitcher: boolean }) {
  if (!splits) return null;
  const rows: [string, Split][] = pitcher
    ? [
        ['좌타자 상대', splits.L],
        ['우타자 상대', splits.R],
      ]
    : [
        ['좌투수 상대', splits.L],
        ['우투수 상대', splits.R],
      ];
  return (
    <>
      <h4>{title}</h4>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career">
          <thead>
            <tr>
              <th>구분</th>
              <th class="num">{pitcher ? '상대 타석' : '타석'}</th>
              <th class="num">{pitcher ? '피안타율' : '타율'}</th>
              <th class="num">출루율</th>
              <th class="num">장타율</th>
              <th class="num">OPS</th>
              <th class="num">홈런</th>
              <th class="num">볼넷</th>
              <th class="num">삼진</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, x]) => {
              const r = splitRates(x);
              return (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td class="num">{x.pa}</td>
                  <td class="num">{x.ab ? rates.fmt3(r.avg) : '-'}</td>
                  <td class="num">{x.pa ? rates.fmt3(r.obp) : '-'}</td>
                  <td class="num">{x.ab ? rates.fmt3(r.slg) : '-'}</td>
                  <td class="num strong">{x.pa ? rates.fmt3(r.obp + r.slg) : '-'}</td>
                  <td class="num">{x.hr}</td>
                  <td class="num">{x.bb}</td>
                  <td class="num">{x.k}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SeasonTable({ league, card, pitcher }: { league: LeagueState; card: PlayerCard; pitcher: boolean }) {
  const rows = card.career;
  if (!rows.length) return <p class="muted">기록이 없습니다.</p>;
  const t = card.totals;
  if (pitcher)
    return (
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career">
          <thead>
            <tr>
              <th class="num">연도</th>
              <th>구단</th>
              <th class="num">경기</th>
              <th class="num">승</th>
              <th class="num">패</th>
              <th class="num">세</th>
              <th class="num">홀</th>
              <th class="num">이닝</th>
              <th class="num">삼진</th>
              <th class="num">볼넷</th>
              <th class="num">ERA</th>
              <th class="num">WHIP</th>
              <th class="num">FIP</th>
              <th class="num">K/9</th>
              <th class="num">WAR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rc = rateContextFor(league, r.year);
              return (
                <tr key={r.year + r.team + r.futures} class={r.futures ? 'futures-row' : undefined}>
                  <td class="num">{r.year}</td>
                  <td>
                    {r.team}
                    {r.futures && <span class="tag">퓨처스</span>}
                  </td>
                  <td class="num">{r.pit?.g ?? 0}</td>
                  <td class="num">{r.pit?.w ?? 0}</td>
                  <td class="num">{r.pit?.l ?? 0}</td>
                  <td class="num">{r.pit?.sv ?? 0}</td>
                  <td class="num">{r.pit?.hld ?? 0}</td>
                  <td class="num">{rates.ip(r.pit?.outs ?? 0)}</td>
                  <td class="num">{r.pit?.k ?? 0}</td>
                  <td class="num">{r.pit?.bb ?? 0}</td>
                  <td class="num strong">{r.pit?.outs ? rates.era(r.pit).toFixed(2) : '-'}</td>
                  <td class="num">{r.pit?.outs ? rates.whip(r.pit).toFixed(2) : '-'}</td>
                  <td class="num">{r.pit?.outs && rc ? rates.fip(r.pit, rc).toFixed(2) : '-'}</td>
                  <td class="num">{r.pit?.outs ? rates.per9(r.pit.k, r.pit.outs).toFixed(1) : '-'}</td>
                  <td class="num">{r.current || r.futures ? '-' : r.war.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
          {t.pit && (
            <tfoot>
              <tr>
                <th colSpan={2}>1군 통산 ({t.seasons}시즌)</th>
                <td class="num">{t.pit.g}</td>
                <td class="num">{t.pit.w}</td>
                <td class="num">{t.pit.l}</td>
                <td class="num">{t.pit.sv}</td>
                <td class="num">{t.pit.hld}</td>
                <td class="num">{rates.ip(t.pit.outs)}</td>
                <td class="num">{t.pit.k}</td>
                <td class="num">{t.pit.bb}</td>
                <td class="num strong">{t.pit.outs ? rates.era(t.pit).toFixed(2) : '-'}</td>
                <td class="num">{t.pit.outs ? rates.whip(t.pit).toFixed(2) : '-'}</td>
                <td class="num">-</td>
                <td class="num">{t.pit.outs ? rates.per9(t.pit.k, t.pit.outs).toFixed(1) : '-'}</td>
                <td class="num">{t.war.toFixed(1)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table career">
        <thead>
          <tr>
            <th class="num">연도</th>
            <th>구단</th>
            <th class="num">경기</th>
            <th class="num">타석</th>
            <th class="num">안타</th>
            <th class="num">타율</th>
            <th class="num">출루율</th>
            <th class="num">장타율</th>
            <th class="num">홈런</th>
            <th class="num">타점</th>
            <th class="num">도루</th>
            <th class="num">OPS</th>
            <th class="num">wRC+</th>
            <th class="num">WAR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rc = rateContextFor(league, r.year);
            return (
              <tr key={r.year + r.team + r.futures} class={r.futures ? 'futures-row' : undefined}>
                <td class="num">{r.year}</td>
                <td>
                  {r.team}
                  {r.futures && <span class="tag">퓨처스</span>}
                </td>
                <td class="num">{r.bat?.g ?? 0}</td>
                <td class="num">{r.bat?.pa ?? 0}</td>
                <td class="num">{r.bat?.h ?? 0}</td>
                <td class="num">{r.bat?.ab ? rates.fmt3(rates.avg(r.bat)) : '-'}</td>
                <td class="num">{r.bat?.pa ? rates.fmt3(rates.obp(r.bat)) : '-'}</td>
                <td class="num">{r.bat?.ab ? rates.fmt3(rates.slg(r.bat)) : '-'}</td>
                <td class="num">{r.bat?.hr ?? 0}</td>
                <td class="num">{r.bat?.rbi ?? 0}</td>
                <td class="num">{r.bat?.sb ?? 0}</td>
                <td class="num strong">{r.bat?.pa ? rates.fmt3(rates.ops(r.bat)) : '-'}</td>
                <td class="num">{r.bat?.pa && rc && !r.futures ? rates.wrcPlus(r.bat, rc) : '-'}</td>
                <td class="num">{r.current || r.futures ? '-' : r.war.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
        {t.bat && (
          <tfoot>
            <tr>
              <th colSpan={2}>1군 통산 ({t.seasons}시즌)</th>
              <td class="num">{t.bat.g}</td>
              <td class="num">{t.bat.pa}</td>
              <td class="num">{t.bat.h}</td>
              <td class="num">{t.bat.ab ? rates.fmt3(rates.avg(t.bat)) : '-'}</td>
              <td class="num">{t.bat.pa ? rates.fmt3(rates.obp(t.bat)) : '-'}</td>
              <td class="num">{t.bat.ab ? rates.fmt3(rates.slg(t.bat)) : '-'}</td>
              <td class="num">{t.bat.hr}</td>
              <td class="num">{t.bat.rbi}</td>
              <td class="num">{t.bat.sb}</td>
              <td class="num strong">{t.bat.pa ? rates.fmt3(rates.ops(t.bat)) : '-'}</td>
              <td class="num">-</td>
              <td class="num">{t.war.toFixed(1)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function PlayerPanel({ league, id, onClose, onInterview }: { league: LeagueState; id: string; onClose: () => void; onInterview?: (id: string) => void }) {
  const card = playerCard(league, id);
  const heading = useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = useState<Tab>('seasons');
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id]);
  if (!card) return null;
  const p = card.player,
    s = p.scouting;
  const pitcher = p.role === 'SP' || p.role === 'RP';
  const foreign = p.origin.kind === 'foreign';
  const wearing = p.number != null && p.numberTeam === p.teamId ? p.number : null;
  const hurtDays = card.injuries.reduce((a, x) => a + x.days, 0);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog profile" role="dialog" aria-modal="true" aria-labelledby="player-name">
        <button type="button" class="close" onClick={onClose} aria-label="닫기">
          닫기
        </button>
        <div class="profile-head">
          {wearing != null && <span class="profile-number">{wearing}</span>}
          <div>
            <p class="muted">
              {card.team} · {positionLabel(p)} · {handedness(p)}
              {foreign ? ` · ${p.origin.asiaQuota ? '아시아쿼터' : '외국인'} (${p.origin.nationality})` : ''}
            </p>
            <h2 id="player-name" tabIndex={-1} ref={heading}>
              {p.name}
              {p.contract?.kind === 'development' && <span class="tag">육성</span>}
            </h2>
          </div>
        </div>
        {card.status && <p class="notice">{card.status}</p>}
        {onInterview && league.user && p.teamId === league.user.teamId && (
          <p>
            <button type="button" onClick={() => onInterview(p.id)}>
              인터뷰 요청
            </button>{' '}
            <span class="muted small">우리 구단 → 소식 → 뉴스에 실립니다.</span>
          </p>
        )}

        <div class="profile-grid">
          <section>
            <h3>기본 정보</h3>
            <dl class="facts one">
              <div>
                <dt>나이</dt>
                <dd>
                  만 {card.age}세 ({p.birthday.slice(0, 4)}년생)
                </dd>
              </div>
              <div>
                <dt>체격</dt>
                <dd>
                  {p.height}cm · {p.weight}kg
                </dd>
              </div>
              <div>
                <dt>{p.contract?.usd ? '계약' : '연봉'}</dt>
                <dd>
                  {p.contract?.usd
                    ? `총액 ${usd(usdTotal(p.contract))} (계약금 ${usd(p.contract.usd.bonus)} · 연봉 ${usd(p.contract.usd.salary)} · 옵션 ${usd(p.contract.usd.options)})`
                    : money(card.salary)}
                </dd>
              </div>
              <div>
                <dt>입단</dt>
                <dd>
                  {p.origin.overallPick
                    ? `${p.origin.draftYear} 드래프트 전체 ${p.origin.overallPick}순위`
                    : foreign
                      ? `${p.proSince}년`
                      : p.origin.draftYear
                        ? `${p.origin.draftYear} 육성선수`
                        : '-'}
                </dd>
              </div>
              <div>
                <dt>병역</dt>
                <dd>{militaryLabel[p.service.military]}</dd>
              </div>
              <div>
                <dt>FA 등록 시즌</dt>
                <dd>{foreign ? '-' : `${p.service.creditedSeasons}시즌`}</dd>
              </div>
              <div>
                <dt>통산 WAR</dt>
                <dd>{card.totals.seasons ? card.totals.war.toFixed(1) : '-'}</dd>
              </div>
            </dl>
            <p class="muted small">{p.education.pathText}</p>
            {!!p.honors?.length && (
              <div class="honors">
                {[...p.honors].reverse().map((h) => (
                  <span key={h} class="tag">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3>스카우팅 등급</h3>
            <div class="gradebars">
              {toolKeysFor(p.role).map((k) => (
                <GradeBar key={k} label={TOOL_LABELS[k]} now={s.tools[k]} future={s.futureTools[k]} />
              ))}
              <GradeBar label="종합" now={s.current} future={s.futureValue} />
            </div>
            <p class="muted small">막대는 현재 등급, 눈금은 스카우트가 보는 미래 등급입니다 (20~80).</p>
          </section>
        </div>

        {!pitcher && card.positions.length > 0 && (
          <section class="pitch-box">
            <h3>포지션 적성</h3>
            <div class="gradebars">
              {card.positions.map((x) => (
                <GradeBar key={x.pos} label={`${POSITION_NAMES[x.pos]}${x.main ? ' (주)' : ''}`} now={x.grade} note={x.games ? `1군 ${x.games}경기 선발` : undefined} />
              ))}
            </div>
            <p class="muted small">수비 등급에서 포지션 차이만큼 빠집니다. 한 포지션에서 1군 30경기를 넘게 뛰면 그 포지션의 손해가 절반으로 줄어듭니다.</p>
          </section>
        )}

        {pitcher && (
          <section class="pitch-box">
            <h3>구속 · 구종</h3>
            {card.velocity && (
              <p class="velocity">
                <span>
                  최고 <strong>{card.velocity.top}</strong>km/h
                </span>
                <span>
                  평균 <strong>{card.velocity.average}</strong>km/h
                </span>
              </p>
            )}
            <div class="gradebars">
              <GradeBar label="직구" now={s.tools.stuff} note={`구사율 ${Math.round((1 - card.pitches.reduce((a, x) => a + x.usage, 0)) * 100)}%`} />
              {card.pitches.map((x) => (
                <GradeBar key={x.type} label={x.label} now={x.grade} note={`구사율 ${Math.round(x.usage * 100)}%`} />
              ))}
            </div>
          </section>
        )}

        <div class="segmented profile-tabs" role="tablist" aria-label="기록">
          {TABS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} aria-pressed={tab === x.key} onClick={() => setTab(x.key)}>
              {x.label}
              {x.key === 'injuries' && card.injuries.length > 0 && <span class="count">{card.injuries.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'seasons' && (
          <>
            <SeasonTable league={league} card={card} pitcher={pitcher} />
            <p class="muted small">WAR·FIP·wRC+는 게임 내 추정치입니다 (구장 보정 없음). 올해 WAR은 시즌이 끝나면 계산됩니다. 퓨처스 기록은 통산에 넣지 않습니다.</p>
          </>
        )}

        {tab === 'highs' &&
          (card.highs.length ? (
            <dl class="highs">
              {card.highs.map((h) => (
                <div key={h.label}>
                  <dt>{h.label}</dt>
                  <dd>
                    <strong>{h.value}</strong> <span class="muted">({h.year})</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p class="muted">1군 기록이 없습니다.</p>
          ))}

        {tab === 'splits' &&
          (card.splits.season || card.splits.career ? (
            <>
              <SplitTable title={`${league.year} 시즌`} splits={card.splits.season} pitcher={pitcher} />
              <SplitTable title="1군 통산" splits={card.splits.career} pitcher={pitcher} />
              <p class="muted small">좌우 기록은 0.5.1 이후 치른 1군 경기부터 쌓입니다. 양타자는 투수 반대편 타석으로 셉니다.</p>
            </>
          ) : (
            <p class="muted">좌우 기록이 없습니다 (0.5.1 이후 1군 경기부터 기록).</p>
          ))}

        {tab === 'injuries' &&
          (card.injuries.length ? (
            <>
              <p class="muted">
                통산 {card.injuries.length}회, {hurtDays}일
              </p>
              <div class="table-wrap" tabIndex={0}>
                <table class="record-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>부위</th>
                      <th class="num">기간</th>
                      <th>구분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.injuries.map((x) => (
                      <tr key={x.date + x.part}>
                        <td>{x.date}</td>
                        <td>{x.part}</td>
                        <td class="num">{x.days}일</td>
                        <td>{x.futures ? '퓨처스' : '1군 부상자 명단'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p class="muted">부상 기록이 없습니다.</p>
          ))}
      </div>
    </div>
  );
}
