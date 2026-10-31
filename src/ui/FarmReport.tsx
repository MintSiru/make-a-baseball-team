import { t as __i18n_t } from '../i18n/index';
/* 2.0.66 (the user's request): the coaches' monthly reports on our futures and reserve players (league/farmreport.ts),
   and a player's training — his programme and how hard he trains (league/drills.ts). */
import { useState } from 'preact/hooks';
import { TOOL_LABELS } from '../draftroom';
import type { Action } from '../league/actions';
import { farmGrade, type FarmAdvice, type FarmNote, type FarmRow } from '../league/farmreport';
import { INTENSITIES, intensityLabel, intensityOf, programLabel, programOf, programsFor } from '../league/drills';
import { isPitcher } from '../league/players';
import type { LeagueState } from '../league/state';
import { rates } from '../league/views';
import type { Player } from '../model/types';

const tool = (n: FarmNote) => (n.t ? ((TOOL_LABELS as Record<string, string>)[n.t] ?? n.t) : '');

/** A note in words. */
export function farmNoteText(n: FarmNote): string {
  switch (n.k) {
    case 'ops':
      return __i18n_t("ui.farmReport.text.11cfb1c3", { v: rates.fmt3((n.v ?? 0) / 1000) });
    case 'hr':
      return __i18n_t("ui.farmReport.text.efa10d9d", { v: n.v ?? 0 });
    case 'era':
      return __i18n_t("ui.farmReport.text.3cf37b2d", { v: ((n.v ?? 0) / 100).toFixed(2) });
    case 'kbb':
      return __i18n_t("ui.farmReport.text.0bd81dc2", { v: ((n.v ?? 0) / 10).toFixed(1) });
    case 'focus':
      return n.t ? __i18n_t("ui.farmReport.text.7dfa953f", { tool: tool(n) }) : __i18n_t("ui.farmReport.text.c421ec36");
    case 'rehab':
      return __i18n_t("ui.farmReport.text.d3df3a44", { v: n.v ?? 0 });
    case 'attitude':
      return __i18n_t("ui.farmReport.text.1c40d1e2");
    case 'weak':
      return __i18n_t("ui.farmReport.text.7eabc19f", { tool: tool(n) });
    case 'walks':
      return __i18n_t("ui.farmReport.text.4b63eba3", { v: ((n.v ?? 0) / 10).toFixed(1) });
    case 'strikeouts':
      return __i18n_t("ui.farmReport.text.3e60a121", { v: n.v ?? 0 });
    case 'slump':
      return __i18n_t("ui.farmReport.text.5d275756");
    case 'noGames':
      return __i18n_t("ui.farmReport.text.dd9d7abf");
    case 'tired':
      return __i18n_t("ui.farmReport.text.ec5769be");
    case 'steady':
      return __i18n_t("ui.farmReport.text.447a2411");
  }
}

export function farmAdviceText(a: FarmAdvice): string {
  switch (a) {
    case 'callUp':
      return __i18n_t("ui.farmReport.text.ae65cf02");
    case 'harder':
      return __i18n_t("ui.farmReport.text.806cdb05");
    case 'lighter':
      return __i18n_t("ui.farmReport.text.0d56f005");
    case 'patience':
      return __i18n_t("ui.farmReport.text.05d3ee71");
    case 'keep':
      return __i18n_t("ui.farmReport.text.ea65f0bb");
  }
}

const attitudeText = (x: number) => (x >= 72 ? __i18n_t("ui.farmReport.text.6407785c") : x >= 58 ? __i18n_t("ui.farmReport.text.5cd0d95b") : x >= 42 ? __i18n_t("ui.farmReport.text.2179da2c") : x >= 30 ? __i18n_t("ui.farmReport.text.454facad") : __i18n_t("ui.farmReport.text.c89bafa8"));

function lineText(r: FarmRow): string {
  const l = r.line;
  if (!l) return '-';
  if (l.bat) return __i18n_t("ui.farmReport.text.d1f7fe19", { g: l.g, pa: l.bat[0], h: l.bat[1], hr: l.bat[2], ops: rates.fmt3(l.bat[3] / 1000) });
  if (l.pit) return __i18n_t("ui.farmReport.text.e371fe76", { g: l.g, ip: rates.ip(l.pit[0]), era: l.pit[0] ? ((27 * l.pit[1]) / l.pit[0]).toFixed(2) : '-', k: l.pit[2], bb: l.pit[3] });
  return '-';
}

/** The month's reports, one row a player (the best first). */
export function FarmReportView({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const farm = league.user?.farm;
  const months = farm?.months ?? [];
  const [at, setAt] = useState<string | null>(null);
  const [squad, setSquad] = useState<'all' | 'futures' | 'third'>('all');
  if (!months.length) return <p class="muted">{__i18n_t("ui.farmReport.text.06d8c1d8")}</p>;
  const month = months.find((m) => m.month === at) ?? months.at(-1)!;
  const rows = month.rows.filter((r) => squad === 'all' || r.squad === squad);
  return (
    <>
      <div class="row-actions">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.farmReport.text.f743af38")}>
          {months.map((m) => (
            <button key={m.month} type="button" aria-pressed={m === month} onClick={() => setAt(m.month)}>
              {__i18n_t("ui.farmReport.text.49f9f294", { n: Number(m.month.slice(5, 7)) })}
            </button>
          ))}
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.farmReport.text.5d24a2fc")}>
          {(['all', 'futures', 'third'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={squad === k} onClick={() => setSquad(k)}>
              {k === 'all' ? __i18n_t("ui.farmReport.text.934dd25e") : k === 'futures' ? __i18n_t("ui.farmReport.text.1345128f") : __i18n_t("ui.farmReport.text.0dce8d6b")}
            </button>
          ))}
        </div>
      </div>
      <p class="muted small">{__i18n_t("ui.farmReport.text.f91dd337")}</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table farm-report">
          <caption class="sr-only">{__i18n_t("ui.farmReport.text.3782e056", { n: Number(month.month.slice(5, 7)) })}</caption>
          <thead>
            <tr>
              <th scope="col">{__i18n_t("ui.farmReport.text.c37450d6")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.5d24a2fc")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.7262eacd")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.71d8e2f2")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.a61ad788")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.d3a4a038")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.d2c8fb18")}</th>
              <th scope="col">{__i18n_t("ui.farmReport.text.74fa69bb")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = league.players[r.id];
              const g = farmGrade(r.score);
              return (
                <tr key={r.id}>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                      {p?.name ?? r.id}
                    </button>
                  </td>
                  <td>{r.squad === 'futures' ? __i18n_t("ui.farmReport.text.1345128f") : __i18n_t("ui.farmReport.text.0dce8d6b")}</td>
                  <td class={g === 'A' ? 'strong plus' : g === 'E' || g === 'D' ? 'minus' : undefined}>{g}</td>
                  <td>{attitudeText(r.attitude)}</td>
                  <td class="small">{lineText(r)}</td>
                  <td class="small">{r.good.length ? r.good.map(farmNoteText).join(' · ') : '-'}</td>
                  <td class="small">
                    {r.work.length ? r.work.map(farmNoteText).join(' · ') : '-'}
                    {r.hurt ? ` · ${__i18n_t("ui.farmReport.text.2c72faf4", { n: r.hurt })}` : ''}
                  </td>
                  <td class={r.advice === 'callUp' ? 'strong' : undefined}>{farmAdviceText(r.advice)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** One of ours: his programme and intensity to set, and the coaches' latest word on him. */
export function PlayerTraining({ league, p, onAct }: { league: LeagueState; p: Player; onAct: (a: Action) => void }) {
  const focus = programOf(p);
  const intensity = intensityOf(p);
  const months = league.user?.farm?.months ?? [];
  const last = [...months].reverse().find((m) => m.rows.some((r) => r.id === p.id));
  const row = last?.rows.find((r) => r.id === p.id);
  return (
    <section class="sheet-box pp-training">
      <h3>{__i18n_t("ui.farmReport.text.6c9264ab")}</h3>
      <div class="row-actions">
        <label>
          {__i18n_t("ui.farmReport.text.14bf7f79")}{' '}
          <select value={focus} onChange={(e) => onAct({ kind: 'trainingPlan', id: p.id, focus: (e.currentTarget as HTMLSelectElement).value })}>
            {programsFor(isPitcher(p)).map((k) => (
              <option key={k} value={k}>
                {programLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {__i18n_t("ui.farmReport.text.6d471e8d")}{' '}
          <select value={intensity} onChange={(e) => onAct({ kind: 'trainingPlan', id: p.id, intensity: (e.currentTarget as HTMLSelectElement).value as typeof intensity })}>
            {INTENSITIES.map((k) => (
              <option key={k} value={k}>
                {intensityLabel(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p class="muted small">{__i18n_t("ui.farmReport.text.dc77649a")}</p>
      {row && last && (
        <p class="small">
          {__i18n_t("ui.farmReport.text.e9fbf278", { n: Number(last.month.slice(5, 7)), g: farmGrade(row.score), a: attitudeText(row.attitude), advice: farmAdviceText(row.advice) })}
          {row.good.length ? ` · ${row.good.map(farmNoteText).join(', ')}` : ''}
        </p>
      )}
    </section>
  );
}
