// Result entry — the screen an organizer uses most during an event.
//
// One match per card: the score is the only thing that must be obvious. Rare
// outcomes (draw, extra time, walkover, interrupted, reset) live behind a
// disclosure so the list stays scannable. Corrections are announced, because a
// changed result re-computes the downstream bracket.
import { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { recordResult, EditSpec } from '../engine/result';
import { swissPairings } from '../engine/swiss';
import { computeStandings } from '../engine/standings';
import { Alert, Empty, KeyHint, Page, Segmented, StatusPill, Toolbar } from './kit';
import { useT } from '../i18n';

const KNOCKOUT = new Set(['single-elimination', 'double-elimination']);
const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Matches() {
  const t = useT();
  const { domain, update, go, focusMatch, setFocusMatch } = useApp();
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [err, setErr] = useState('');
  const [corrected, setCorrected] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? t('common.unknown') : t('common.tbd'));
  const knockout = KNOCKOUT.has(domain.tournament.format);
  const isKoMatch = (m: Match) => knockout || m.bracket?.eliminatedOnLoss === true;
  let list = domain.matches;
  if (onlyOpen) list = list.filter(m => !FINISHED.has(m.result.status));
  if (q) list = list.filter(m => (pn(m.homeId) + ' ' + pn(m.awayId) + ' ' + m.roundName).toLowerCase().includes(q.toLowerCase()));
  const visible = list.slice(0, 200);
  // A QR code may point at a match hidden by the current filter — always show it.
  const focusM = focusMatch ? domain.matches.find(m => m.id === focusMatch) ?? null : null;
  const shown = focusM && !visible.includes(focusM) ? [focusM, ...visible] : visible;

  const apply = (m: Match, spec: EditSpec) => {
    const wasFinished = FINISHED.has(m.result.status);
    const r = recordResult(domain.matches, m.id, spec, domain.tournament.rules, { knockout: isKoMatch(m) });
    if (r.issues.length) { setErr(r.issues[0]); return; }
    setErr('');
    setCorrected(wasFinished ? m.id : null);
    update(() => ({ tournament: domain.tournament, participants: domain.participants, groups: domain.groups, matches: r.matches, audit: domain.audit, resources: domain.resources ?? [] }), `result.edit ${pn(m.homeId)}-${pn(m.awayId)}`);
  };
  const setScore = (m: Match, hs: number | null, as: number | null) => {
    update(d => ({ ...d, matches: d.matches.map(x => x.id === m.id ? { ...x, result: { ...x.result, homeScore: hs, awayScore: as } } : x) }), 'result.score-draft');
  };
  const commitPlayed = (m: Match, status: 'played' | 'draw' | 'overtime' = 'played') =>
    apply(m, { homeScore: m.result.homeScore, awayScore: m.result.awayScore, status });
  const setStatus = (m: Match, status: Match['result']['status'], winnerId?: string | null) =>
    apply(m, status === 'walkover' ? { status, walkoverWinnerId: winnerId ?? undefined } : { status, clearScores: status !== 'played' && status !== 'overtime' && status !== 'draw' });
  const nextSwiss = () => {
    update(d => {
      const st = computeStandings(d.participants, d.matches, d.tournament.rules);
      const pts = new Map(st.map(s => [s.participantId, s.points]));
      const pr = Math.max(0, ...d.matches.map(x => x.round));
      return { ...d, matches: [...d.matches, ...swissPairings(d.participants, d.matches, pts, pr + 1)] };
    }, 'swiss.next-round');
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, shown.length - 1)); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
  };
  const openCount = domain.matches.filter(m => !FINISHED.has(m.result.status)).length;


  return (
    <Page
      title={t('res.title')}
      sub={t('res.openOf', { open: openCount, total: domain.matches.length })}
      actions={domain.tournament.format === 'swiss'
        ? <button className="btn" onClick={nextSwiss}>{t('res.nextRoundGo')}</button>
        : undefined}
    >
      <div onKeyDown={onKey}>
      {err && <Alert tone="err" title={t('res.notSaved')}>{err} {t('engine.scorePair')}</Alert>}
      {corrected && (
        <Alert tone="ok" title={t('res.corrected')}
          actions={<button className="btn sm quiet" onClick={() => setCorrected(null)}>{t('common.dismiss')}</button>}>
          {(() => { const m = domain.matches.find(x => x.id === corrected);
            return m ? t('res.correctedBody', { home: pn(m.homeId), away: pn(m.awayId) }) : t('res.correctedOne'); })()}
        </Alert>
      )}
      {focusM && (
        <Alert tone="ok" title={t('res.fromCode')}
          actions={<button className="btn sm quiet" onClick={() => setFocusMatch(null)}>{t('common.clear')}</button>}>
          {t('res.pinned', { home: pn(focusM.homeId), away: pn(focusM.awayId) })}
        </Alert>
      )}

      {domain.matches.length === 0 ? (
        <Empty
          title={t('res.emptyFill')}
          hint={t('res.emptyFillHint')}
          action={<button className="btn primary" onClick={() => go('rules')}>{t('bracket.goRules')}</button>}
        />
      ) : (
        <>
          <Toolbar>
            <input className="search" ref={searchRef} type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('res.filter')} aria-label={t('res.filterLabel')} />
            <Segmented
              value={onlyOpen ? 'open' : 'all'}
              onChange={v => setOnlyOpen(v === 'open')}
              options={[{ id: 'open', label: t('res.onlyOpen') }, { id: 'all', label: t('res.allMatches') }]}
              label={t('common.matchFilter')}
            />
            <span className="sp" />
            <span className="count">{t('res.shownCount', { n: shown.length })}</span>
          </Toolbar>

          {shown.length === 0 && (
            <Empty
              title={q ? t('res.nothingFound', { q }) : t('res.allDone')}
              hint={q ? t('res.tryShorter') : t('res.allDoneHint')}
              action={<button className="btn" onClick={() => { setQ(''); setOnlyOpen(false); }}>{t('res.showAll')}</button>}
            />
          )}


          {shown.map((m, i) => {
            const done = FINISHED.has(m.result.status);
            const winner = m.result.winnerId;
            return (
              <div
                key={m.id}
                className={'card mcard ' + (i === sel && !done ? 'current' : '') + (done ? ' done' : '')
                  + (focusM && m.id === focusM.id ? ' from-code' : '')}
                onClick={() => setSel(i)}
              >
                <div className="mcard-head">
                  <span className="round">{m.roundName}</span>
                  {m.venue ? <span className="venue">{m.venue}</span> : null}
                  <span className="sp" />
                  <StatusPill status={m.result.status} />
                </div>
                <div className="mcard-body">
                  <div className="mcard-sides">
                    <span className={'side' + (winner && winner === m.homeId ? ' win' : '')}>{pn(m.homeId)}</span>
                    <span className="vs">vs</span>
                    <span className={'side' + (winner && winner === m.awayId ? ' win' : '')}>{pn(m.awayId)}</span>
                  </div>
                  <div className="mcard-score" onClick={e => e.stopPropagation()}>
                    <input type="number" min={0} value={m.result.homeScore ?? ''} aria-label={`${pn(m.homeId)} score`}
                      onChange={e => setScore(m, e.target.value === '' ? null : Number(e.target.value), m.result.awayScore)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitPlayed(m); } e.stopPropagation(); }} />
                    <span className="sep">:</span>
                    <input type="number" min={0} value={m.result.awayScore ?? ''} aria-label={`${pn(m.awayId)} score`}
                      onChange={e => setScore(m, m.result.homeScore, e.target.value === '' ? null : Number(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitPlayed(m); } e.stopPropagation(); }} />
                  </div>
                  <button className={'btn' + (i === sel && !done ? ' primary' : '')} onClick={() => commitPlayed(m)}>
                    {done ? t('res.correct') : t('res.save')}
                  </button>
                </div>
                <div className="mcard-extra" onClick={e => e.stopPropagation()}>
                  <details className="disclosure">
                    <summary>{t('res.otherOutcomes')}</summary>
                    <div className="row" style={{ marginTop: 8 }}>
                      {!isKoMatch(m) && <button className="btn sm" onClick={() => commitPlayed(m, 'draw')}>{t('status.draw')}</button>}
                      {domain.tournament.rules.overtimeAllowed && <button className="btn sm" onClick={() => commitPlayed(m, 'overtime')}>{t('status.overtime')}</button>}
                      <button className="btn sm" onClick={() => setStatus(m, 'unfinished')}>{t('res.notFinished')}</button>
                      <button className="btn sm" onClick={() => setStatus(m, 'interrupted')}>{t('res.interrupted')}</button>
                      <select value={m.result.walkoverWinnerId ?? m.homeId ?? ''} aria-label={t('res.walkoverWinner')}
                        onChange={e => setStatus(m, 'walkover', e.target.value)}>
                        <option value={m.homeId ?? ''}>{t('res.walkoverFor', { name: pn(m.homeId) })}</option>
                        <option value={m.awayId ?? ''}>{t('res.walkoverFor', { name: pn(m.awayId) })}</option>
                      </select>
                      {done && <button className="btn sm quiet" onClick={() => setStatus(m, 'scheduled')}>{t('res.reset')}</button>}
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
          <KeyHint>
            {t('res.keyhint', { down: 'j', up: 'k', enter: 'Enter', slash: '/' })}
          </KeyHint>
        </>
      )}
      </div>
    </Page>
  );
}
