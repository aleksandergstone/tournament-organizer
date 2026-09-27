import { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { recordResult, EditSpec } from '../engine/result';
import { swissPairings } from '../engine/swiss';
import { computeStandings } from '../engine/standings';

const KNOCKOUT = new Set(['single-elimination', 'double-elimination']);


export default function Matches() {
  const { domain, update, go, focusMatch, setFocusMatch } = useApp();
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? '?' : 'TBD');
  const knockout = KNOCKOUT.has(domain.tournament.format);
  const isKoMatch = (m: Match) => knockout || m.bracket?.eliminatedOnLoss === true;
  let list = domain.matches;
  if (onlyOpen) list = list.filter(m => ['scheduled','unfinished','interrupted'].includes(m.result.status));
  if (q) list = list.filter(m => (pn(m.homeId)+' '+pn(m.awayId)+' '+m.roundName).toLowerCase().includes(q.toLowerCase()));
  const visible = list.slice(0, 200);
  // A QR code may point at a match hidden by the current filter — always show it.
  const focusM = focusMatch ? domain.matches.find(m => m.id === focusMatch) ?? null : null;
  const shown = focusM && !visible.includes(focusM) ? [focusM, ...visible] : visible;
  const apply = (m: Match, spec: EditSpec) => {
    const r = recordResult(domain.matches, m.id, spec, domain.tournament.rules, { knockout: isKoMatch(m) });
    if (r.issues.length) { setErr(r.issues[0]); return; }
    setErr('');
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
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, visible.length - 1)); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
  };
  return (
    <div className="wrap" onKeyDown={onKey}>
      <h1>Result entry</h1>
      {err && <div className="err">{err}</div>}
      <div className="toolbar">
        <input ref={searchRef} style={{ maxWidth: 260 }} placeholder="Search…  ( / )" value={q} onChange={e => { setQ(e.target.value); setSel(0); }} />
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> open only</label>
        {domain.tournament.format === 'swiss' && <button className="btn" onClick={nextSwiss}>Generate next Swiss round</button>}
        <span className="muted"><span className="kbd">j</span>/<span className="kbd">k</span> move · <span className="kbd">Enter</span> in score = save · <span className="kbd">/</span> search</span>
      </div>
      {focusM && (
        <div className="ok row" style={{ justifyContent: 'space-between' }}>
          <span>Showing the match from the QR code: {pn(focusM.homeId)} vs {pn(focusM.awayId)}</span>
          <button className="btn sm" onClick={() => setFocusMatch(null)}>Clear</button>
        </div>
      )}
      {domain.matches.length === 0 && (
        <div className="empty">
          No matches yet — generate the schedule first.
          <div style={{ marginTop: 10 }}><button className="btn primary" onClick={() => go('rules')}>Go to Rules → generate</button></div>
        </div>
      )}
      {domain.matches.length > 0 && shown.length === 0 && (
        <div className="empty">
          {list.length === 0 && q
            ? 'No matches match your search.'
            : 'Nothing open here — every match in this filter is finished. Great progress!'}
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setQ(''); setOnlyOpen(false); }}>Show all matches</button>
          </div>
        </div>
      )}
      {shown.map((m, i) => (
        <div
          className="card"
          key={m.id}
          style={{
            ...(i === sel ? { borderColor: '#1f5eff' } : undefined),
            ...(focusM && m.id === focusM.id ? { borderColor: '#15803d', boxShadow: '0 0 0 2px #d1fae5' } : undefined),
          }}
          onClick={() => setSel(i)}>
          <div className="row"><b>{pn(m.homeId)}</b><span className="muted">vs</span><b>{pn(m.awayId)}</b><span className="pill">{m.roundName}</span><span className="pill">{m.result.status}</span></div>
          <div className="row" style={{ marginTop: 8 }}>
            <input type="number" min={0} style={{ width: 90 }} value={m.result.homeScore ?? ''} onChange={e => setScore(m, e.target.value === '' ? null : Number(e.target.value), m.result.awayScore)} onKeyDown={e => { if (e.key === 'Enter') commitPlayed(m); e.stopPropagation(); }} placeholder="home" />
            <span>:</span>
            <input type="number" min={0} style={{ width: 90 }} value={m.result.awayScore ?? ''} onChange={e => setScore(m, m.result.homeScore, e.target.value === '' ? null : Number(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') commitPlayed(m); e.stopPropagation(); }} placeholder="away" />
            <button className="btn sm primary" onClick={() => commitPlayed(m)}>Save played</button>
            {!isKoMatch(m) && <button className="btn sm" onClick={() => commitPlayed(m, 'draw')}>Draw</button>}
            {domain.tournament.rules.overtimeAllowed && <button className="btn sm" onClick={() => commitPlayed(m, 'overtime')}>OT result</button>}
            <select value={m.result.walkoverWinnerId ?? m.homeId ?? ''} onChange={e => setStatus(m, 'walkover', e.target.value)} style={{ width: 170 }}>
              <option value={m.homeId ?? ''}>WO: {pn(m.homeId)}</option>
              <option value={m.awayId ?? ''}>WO: {pn(m.awayId)}</option>
            </select>
            <button className="btn sm" onClick={() => setStatus(m, 'unfinished')}>Unfinished</button>
            <button className="btn sm" onClick={() => setStatus(m, 'interrupted')}>Interrupted</button>
            <button className="btn sm" onClick={() => setStatus(m, 'scheduled')}>Reset</button>
          </div>
        </div>
      ))}
    </div>
  );
}
