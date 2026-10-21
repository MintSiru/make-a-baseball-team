import { t as __i18n_t } from '../i18n/index';
/* 2.0.34 (the user's request: 계약 탭): our club's contracts — the kind, the term and the money in each, sortable,
   with the details of any one (bonus, salaries by season, incentives, options, promises) a click away
   (contractbook.ts). */
import { useMemo, useState } from 'preact/hooks';
import { contractBook } from '../league/contractbook';
import { heldPlayers } from '../league/voluntary';
import { usd } from '../league/foreign';
import type { LeagueState } from '../league/state';
import { moneyShort } from './format';
import { positionKey, useSort } from './sort';

export function Contracts({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const book = useMemo(() => contractBook(league, u.teamId), [league]);
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<string>('all');
  const kinds = useMemo(() => [...new Set(book.rows.map((r) => r.kind))], [book]);
  const rows = kind === 'all' ? book.rows : book.rows.filter((r) => r.kind === kind);
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      kind: { value: (r) => r.kind },
      term: { value: (r) => r.until ?? 0, first: 1 },
      left: { value: (r) => r.left },
      total: { value: (r) => (r.foreign ? r.total * 0.14 : r.total) },
      pay: { value: (r) => (r.foreign ? r.pay * 0.14 : r.pay) },
      fa: { value: (r) => r.fa },
    },
    { key: 'total', dir: -1 },
  );
  const money = (r: (typeof rows)[number], n: number) => (r.foreign ? usd(n) : n ? moneyShort(n, book.season) : '-');
  const held = heldPlayers(league);
  return (
    <div class="contracts">
      <p class="muted">{__i18n_t("ui.contracts.text.8878c252", { season: book.season })}</p>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.contracts.text.f18b58fa")}>
        <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
          {__i18n_t("ui.contracts.text.704a24f7", { n: book.rows.length })}
        </button>
        {kinds.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k} {book.rows.filter((r) => r.kind === k).length}
          </button>
        ))}
      </div>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table contract-table">
          <thead>
            <tr>
              {th('name', __i18n_t("ui.contracts.text.9aa18e50"))}
              {th('pos', __i18n_t("ui.contracts.text.81922a91"))}
              {th('age', __i18n_t("ui.contracts.text.6c620e5c"), true)}
              {th('kind', __i18n_t("ui.contracts.text.b4116369"))}
              {th('term', __i18n_t("ui.contracts.text.2622331e"), true)}
              {th('left', __i18n_t("ui.contracts.text.9e882df0"), true)}
              {th('total', __i18n_t("ui.contracts.text.5c241048"), true)}
              {th('pay', __i18n_t("ui.contracts.text.cbf383ec"), true)}
              {th('fa', 'FA')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <>
                <tr key={r.id} class="player-row">
                  <td>
                    <button type="button" class="link toggle" aria-expanded={open === r.id} aria-label={__i18n_t("ui.contracts.text.197c9826", { name: r.name })} onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? '▾' : '▸'}
                    </button>{' '}
                    <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.pos}</td>
                  <td class="num">{r.age}</td>
                  <td>{r.kind}</td>
                  <td class="num">{r.signedIn && r.until ? `${r.signedIn}–${r.until}` : (r.until ?? '-')}</td>
                  <td class="num">{r.left || '-'}</td>
                  <td class="num">{money(r, r.total)}</td>
                  <td class="num">{money(r, r.pay)}</td>
                  <td title={r.faText}>{r.fa}</td>
                </tr>
                {open === r.id && (
                  <tr key={`${r.id}-detail`} class="contract-detail">
                    <td colSpan={9}>
                      <ul>
                        {r.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                        <li>{r.faText}</li>
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {/* 2.0.37: our players held off the roster — the voluntary retired list and another sport (voluntary.ts). */}
      {held.length > 0 && (
        <div class="held-list">
          <h3>{__i18n_t("ui.contracts.text.b789e35e")}</h3>
          <ul>
            {held.map((h) => (
              <li key={h.id}>
                <button type="button" class="link" onClick={() => onPlayer(h.id)}>
                  {league.players[h.id]?.name ?? '?'}
                </button>{' '}
                <span class="muted">
                  {h.kind === 'voluntary' ? __i18n_t("ui.contracts.text.4dcbc6f2", { since: h.since, back: h.back ?? '' }) : __i18n_t("ui.contracts.text.4b875b79", { since: h.since.slice(0, 4) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
