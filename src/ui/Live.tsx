// Live scorer — the screen a referee uses at the table.
//
// Two people, two big +/− pairs, the running set and the sets already won. Every
// tap is written through the ordinary result choke-point, so there is no "save"
// button and no separate draft: the match *is* the score.
//
// While a match is running its result is stored as `unfinished`, which keeps a
// half-played score out of tables and brackets until it is decided.
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { recordResult, EditSpec } from '../engine/result';
import {
  addPoint, removePoint, liveStateOf, liveEdit, finishEdit, decide, emptyLive,
  pointsPerPeriod, periodsToWin,
} from '../engine/live';
import { matchLabel } from '../engine/discipline';
import { Alert, Empty, Page, Panel, Segmented, StatusPill } from './kit';
import { useT } from '../i18n';

const OPEN = new Set(['scheduled', 'unfinished', 'interrupted']);
const KNOCKOUT = new Set(['single-elimination', 'double-elimination']);

export default function Live() {
  const t = useT();
  const { domain, update, settings } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [publicView, setPublicView] = useState(false);
  const [err, setErr] = useState('');
  const rules = domain.tournament.rules;
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? t('common.unknown') : t('common.tbd'));

  const candidates = domain.matches.filter(m => m.homeId && m.awayId);
  const current = candidates.find(m => m.id === selected)
    ?? candidates.find(m => OPEN.has(m.result.status))
    ?? candidates[0]
    ?? null;

  const apply = (m: Match, spec: EditSpec) => {
    const knockout = KNOCKOUT.has(domain.tournament.format) || m.bracket?.eliminatedOnLoss === true;
    const r = recordResult(domain.matches, m.id, spec, rules, { knockout });
    if (r.issues.length) { setErr(r.issues[0]); return; }
    setErr('');
    update(d => ({ ...d, matches: r.matches }), `result.edit ${pn(m.homeId)}-${pn(m.awayId)}`);
  };

  const tap = (m: Match, side: 'home' | 'away', dir: 1 | -1) => {
    const state = liveStateOf(m);
    apply(m, liveEdit(m, dir > 0 ? addPoint(state, side, rules) : removePoint(state, side), rules));
  };
  const reset = (m: Match) => {
    if (settings.confirmDestructive !== false && !window.confirm(t('live.resetConfirm'))) return;
    apply(m, { status: 'scheduled', clearScores: true });
  };
  const finish = (m: Match) => apply(m, finishEdit(m, liveStateOf(m)));

  const per = pointsPerPeriod(rules);
  const need = periodsToWin(rules);
  const state = current ? liveStateOf(current) : emptyLive();
  const d = decide(state, rules);
  const live = state.sets[state.sets.length - 1] ?? { home: 0, away: 0 };

  return (
    <Page title={t('live.title')} sub={t('live.sub')}
      actions={<Segmented value={publicView ? 'public' : 'judge'} onChange={v => setPublicView(v === 'public')}
        options={[{ id: 'judge', label: t('live.judge') }, { id: 'public', label: t('live.public') }]}
        label={t('live.title')} />}>
      {err && <Alert tone="err">{err}</Alert>}
      {d.decided && <Alert tone="ok" title={t('live.finished')}>{t('live.winner')}: {d.winner === 'away' ? pn(current?.awayId ?? null) : pn(current?.homeId ?? null)}</Alert>}

      {!current ? (
        <Empty title={t('live.empty')} hint={t('live.emptyHint')} />
      ) : (
        <>
          {!publicView && (
            <Panel title={t('live.pick')}>
              <select value={current.id} onChange={e => setSelected(e.target.value)}>
                {candidates.map(m => (
                  <option key={m.id} value={m.id}>{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</option>
                ))}
              </select>
            </Panel>
          )}

          <Panel>
            <div className="mcard-head" style={{ marginBottom: 10 }}>
              <span className="round">{current.roundName}</span>
              <span className="sp" />
              <StatusPill status={current.result.status} />
            </div>
            <div className="live-board">
              {(['home', 'away'] as const).map(side => {
                const id = side === 'home' ? current.homeId : current.awayId;
                const won = side === 'home' ? d.periodsWon.home : d.periodsWon.away;
                return (
                  <div className="live-side" key={side}>
                    <div className="live-name">{pn(id)}</div>
                    <div className="live-set">{live[side]}</div>
                    <div className="live-sets">{t('live.sets')}: <b>{won}</b></div>
                    {!publicView && (
                      <div className="live-buttons">
                        <button className="btn primary live-plus" aria-label={t('live.plus')}
                          onClick={() => tap(current, side, 1)} disabled={d.decided}>+</button>
                        <button className="btn live-minus" aria-label={t('live.minus')}
                          onClick={() => tap(current, side, -1)}>-</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="table-note">
              {t('live.currentSet')}: {live.home}–{live.away}
              {per > 0 ? ` · ${t('live.formatHint', { points: per })}` : ` · ${matchLabel(domain.tournament)}`}
              {publicView ? ` · ${t('live.publicHint')}` : ''}
            </p>
          </Panel>

          <Panel title={t('live.sets')}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>{pn(current.homeId)}</th><th>{pn(current.awayId)}</th></tr></thead>
                <tbody>
                  {state.sets.map((s, i) => (
                    <tr key={i} className={i === state.sets.length - 1 ? 'champion' : ''}>
                      <td className="num">{i + 1}</td>
                      <td className="num">{s.home}</td>
                      <td className="num">{s.away}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {per > 0 && <p className="table-note">{`${need} × ${matchLabel(domain.tournament)}`}</p>}
          </Panel>

          {!publicView && (
            <div className="footbar">
              {d.decided ? <span className="muted">{t('live.over')}</span> : null}
              <span className="sp" />
              <button className="btn" onClick={() => tap(current, d.periodsWon.away > d.periodsWon.home ? 'away' : 'home', -1)}>
                {t('live.undo')}
              </button>
              <button className="btn" onClick={() => reset(current)}>{t('live.reset')}</button>
              <button className="btn primary" onClick={() => finish(current)} disabled={d.decided}>{t('live.end')}</button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
