import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
/* 2.0.73 (the user's request: 「KBO판 래리버드룰」): our club's Larry Bird player — once the free agents have signed and
   the salaries are set, one player seven seasons or more with us counts half against next season's salary cap; he
   may be changed until spring camp ends (bird.ts). */
import type { Action } from '../league/actions';
import { BIRD, birdCandidates, birdOpen, birdPick, birdRuleOn, birdSaving, birdSeason, seasonsWith } from '../league/bird';
import { capPay } from '../league/contracts';
import { salaryCapOn } from '../league/features';
import type { LeagueState } from '../league/state';
import { money } from './format';

/** `box`: the 새 UI's sheet box beside the accounts, the card of the classic screen otherwise. */
export function BirdPick({ league, onAct, box = false }: { league: LeagueState; onAct?: (a: Action) => void; box?: boolean }) {
  const u = league.user;
  if (!u) return null;
  const season = birdSeason(league);
  if (!salaryCapOn(season) || !birdRuleOn(season)) return null;
  const me = u.teamId;
  const named = league.birdPicks?.[season] !== undefined;
  const id = birdPick(league, me, season);
  const p = id ? league.players[id] : undefined;
  const open = birdOpen(league, season);
  const options = open ? birdCandidates(league, me, season) : [];
  const Wrap = box ? 'section' : 'div';
  const title = __i18n_t("ui.birdPick.text.398a48b1", { season });
  return (
    <Wrap class={box ? 'sheet-box bird-pick' : 'card card-wide bird-pick'}>
      {box ? <h3>{title}</h3> : <p class="card-label">{title}</p>}
      {!named ? (
        <p class="card-sub">{__i18n_t("ui.birdPick.text.897e4f32", { n: BIRD.seasons })}</p>
      ) : (
        <>
          <p class="card-value">{__i18n_display(p ? p.name : '-')}</p>
          <p class="card-sub">
            {p
              ? __i18n_t("ui.birdPick.text.bf9b137d", { n: seasonsWith(p, me, season - 1), pay: money(capPay(p, season)), saving: money(birdSaving(p, season)) })
              : __i18n_t("ui.birdPick.text.9e07df19", { n: BIRD.seasons })}
          </p>
          {open && onAct && options.length > 0 && (
            <label class="inline-form small">
              <span>{__i18n_t("ui.birdPick.text.530b42c6")}</span>
              <select value={id ?? ''} onChange={(e) => onAct({ kind: 'birdPick', id: (e.currentTarget as HTMLSelectElement).value })}>
                {options.map((q) => (
                  <option key={q.id} value={q.id}>
                    {__i18n_t("ui.birdPick.text.08c74bfd", { name: q.name, n: seasonsWith(q, me, season - 1), saving: money(birdSaving(q, season)) })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p class="muted small">{open ? __i18n_t("ui.birdPick.text.4becf155") : __i18n_t("ui.birdPick.text.f14b4a47")}</p>
        </>
      )}
    </Wrap>
  );
}
