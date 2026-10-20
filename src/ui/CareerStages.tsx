/* 2.0.27 (the user's request): a prospect's road to the draft as a table — each stage (high school, college,
   independent league, the leagues abroad) with its years and its record (league/amateur.ts). 2.0.28: a high school's
   senior year event by event beneath it — the regional weekend league and the three national tournaments. */
import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
import type { AmateurRecord } from '../draftroom';
import type { Player } from '../model/types';
import { careerStages } from '../league/amateur';
import { innings } from './format';

const n = (x: unknown) => (typeof x === 'number' ? x : 0);
const rate3 = (x: unknown) => (typeof x === 'number' ? x.toFixed(3).replace(/^0/, '') : '-');

function Stats({ r, pitcher }: { r: AmateurRecord; pitcher: boolean }) {
  return pitcher ? (
    <>
      <td class="num">{n(r.games)}</td>
      <td class="num">{innings(n(r.outs))}</td>
      <td class="num">{n(r.wins)}</td>
      <td class="num strong">{typeof r.era === 'number' ? r.era.toFixed(2) : '-'}</td>
      <td class="num">{n(r.k)}</td>
      <td class="num">{n(r.bb)}</td>
    </>
  ) : (
    <>
      <td class="num">{n(r.games)}</td>
      <td class="num">{rate3(r.avg)}</td>
      <td class="num strong">{rate3(r.ops)}</td>
      <td class="num">{n(r.hr)}</td>
      <td class="num">{n(r.rbi)}</td>
      <td class="num">{n(r.sb)}</td>
    </>
  );
}

export function CareerStages({ player, seed }: { player: Pick<Player, 'id' | 'role' | 'scouting' | 'education' | 'amateur' | 'origin'>; seed?: string }) {
  const stages = careerStages(player, seed);
  if (!stages.length) return null;
  const pitcher = stages[0]!.record.kind === 'pitcher';
  return (
    <>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career-stages">
          <thead>
            <tr>
              <th>{__i18n_t('ui.careerStages.text.af2feed6')}</th>
              <th>{__i18n_t('ui.careerStages.text.5d24a2fc')}</th>
              <th class="num">{__i18n_t('ui.careerStages.text.e0cee61a')}</th>
              {pitcher ? (
                <>
                  <th class="num">{__i18n_t('ui.careerStages.text.639a1f2f')}</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.3b1908b7')}</th>
                  <th class="num">ERA</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.3f349ed1')}</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.21e0537f')}</th>
                </>
              ) : (
                <>
                  <th class="num">{__i18n_t('ui.careerStages.text.1eb19e0a')}</th>
                  <th class="num">OPS</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.9162d3a3')}</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.fed1c588')}</th>
                  <th class="num">{__i18n_t('ui.careerStages.text.91e54831')}</th>
                </>
              )}
            </tr>
          </thead>
          {stages.map((s, i) => (
            <tbody key={i} class="stage">
              <tr>
                <td>
                  <strong>{__i18n_display(s.label)}</strong>
                  <span class="muted small stage-period">{__i18n_display(s.period)}</span>
                </td>
                <td>
                  {__i18n_display(s.name)}
                  <span class="muted small stage-period">{__i18n_display(s.status)}</span>
                </td>
                <Stats r={s.record} pitcher={pitcher} />
              </tr>
              {s.events?.map((e) => (
                <tr key={e.kind} class="stage-event">
                  <td colSpan={1}>
                    <span class="stage-event-name">{__i18n_display(e.label)}</span>
                  </td>
                  <td>
                    <span class={e.result === '우승' ? 'tag' : 'muted small'}>{__i18n_display(e.result)}</span>
                  </td>
                  <Stats r={e.record} pitcher={pitcher} />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {stages.some((s) => s.note) && (
        <ul class="stage-notes muted small">
          {stages
            .filter((s) => s.note)
            .map((s, i) => (
              <li key={i}>
                {__i18n_display(s.name)}: {__i18n_display(s.note)}
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
