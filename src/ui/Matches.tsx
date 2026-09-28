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

const KNOCKOUT = new Set(['single-elimination', 'double-elimination']);
const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Matches() {
  const { domain, update, go, focusMatch, setFocusMatch } = useApp();
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [err, setErr] = useState('');
  const [corrected, setCorrected] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? 'Unknown' : 'TBD');
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
      title="Result entry"
      sub={`${openCount} open of ${domain.matches.length} matches`}
      actions={domain.tournament.format === 'swiss'
        ? <button className="btn" onClick={nextSwiss}>Generate next round</button>
        : undefined}
    >
      <div onKeyDown={onKey}>
      {err && <Alert tone="err" title="Result not saved">{err} Enter both scores, or use Walkover / Not finished instead.</Alert>}
      {corrected && (
        <Alert tone="ok" title="Result corrected"
          actions={<button className="btn sm quiet" onClick={() => setCorrected(null)}>Dismiss</button>}>
          {(() => { const m = domain.matches.find(x => x.id === corrected);
            return m ? `${pn(m.homeId)} vs ${pn(m.awayId)} was updated — every later round was recomputed from the new result.` : 'The match was updated.'; })()}
        </Alert>
      )}
      {focusM && (
        <Alert tone="ok" title="Match from the QR code"
          actions={<button className="btn sm quiet" onClick={() => setFocusMatch(null)}>Clear</button>}>
          {pn(focusM.homeId)} vs {pn(focusM.awayId)} is pinned to the top of this list.
        </Alert>
      )}

      {domain.matches.length === 0 ? (
        <Empty
          title="No matches to fill in yet"
          hint="Generate the bracket first — pick a format, then create the matches for your participants."
          action={<button className="btn primary" onClick={() => go('rules')}>Go to rules → generate</button>}
        />
      ) : (
        <>
          <Toolbar>
            <input className="search" ref={searchRef} type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Filter by name or round" aria-label="Filter matches" />
            <Segmented
              value={onlyOpen ? 'open' : 'all'}
              onChange={v => setOnlyOpen(v === 'open')}
              options={[{ id: 'open', label: 'Open only' }, { id: 'all', label: 'All matches' }]}
              label="Match filter"
            />
            <span className="sp" />
            <span className="count">{shown.length} shown</span>
          </Toolbar>

          {shown.length === 0 && (
            <Empty
              title={q ? 'Nothing matches that filter' : 'Everything here is finished'}
              hint={q
                ? 'Try a shorter name, or clear the filter to see every match.'
                : 'Switch to “All matches” to review or correct results that are already in.'}
              action={<button className="btn" onClick={() => { setQ(''); setOnlyOpen(false); }}>Show all matches</button>}
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
                    {done ? 'Correct result' : 'Save'}
                  </button>
                </div>
                <div className="mcard-extra" onClick={e => e.stopPropagation()}>
                  <details className="disclosure">
                    <summary>Other outcomes</summary>
                    <div className="row" style={{ marginTop: 8 }}>
                      {!isKoMatch(m) && <button className="btn sm" onClick={() => commitPlayed(m, 'draw')}>Draw</button>}
                      {domain.tournament.rules.overtimeAllowed && <button className="btn sm" onClick={() => commitPlayed(m, 'overtime')}>After extra time</button>}
                      <button className="btn sm" onClick={() => setStatus(m, 'unfinished')}>Not finished</button>
                      <button className="btn sm" onClick={() => setStatus(m, 'interrupted')}>Interrupted</button>
                      <select value={m.result.walkoverWinnerId ?? m.homeId ?? ''} aria-label="Walkover winner"
                        onChange={e => setStatus(m, 'walkover', e.target.value)}>
                        <option value={m.homeId ?? ''}>Walkover: {pn(m.homeId)}</option>
                        <option value={m.awayId ?? ''}>Walkover: {pn(m.awayId)}</option>
                      </select>
                      {done && <button className="btn sm quiet" onClick={() => setStatus(m, 'scheduled')}>Reset to unplayed</button>}
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
          <KeyHint>
            <span className="kbd">j</span>/<span className="kbd">k</span> move between matches ·{' '}
            <span className="kbd">Enter</span> in a score box saves the result · <span className="kbd">/</span> searches
          </KeyHint>
        </>
      )}
      </div>
    </Page>
  );
}
