import { useApp } from '../state/store';
import { useMemo, useState } from 'react';
import { computeStandings } from '../engine/standings';
import { pickQualifiers, seedKnockout, QualifierPick } from '../engine/generate';
import { genSingleElim } from '../engine/elim';
import { recomputeBracket } from '../engine/recompute';

export default function Standings() {
  const { domain, standings, update, go } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const isGroups = domain.tournament.format === 'groups-knockout' && domain.groups.length > 0;
  const [perGroup, setPerGroup] = useState(domain.tournament.rules.advancePerGroup ?? 2);
  const [wildcards, setWildcards] = useState(0);
  const [err, setErr] = useState('');
  const groupTables = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeStandings>>();
    if (!isGroups) return m;
    const byId = new Map(domain.participants.map(p => [p.id, p]));
    for (const g of domain.groups) {
      const members = g.participantIds.map(id => byId.get(id)!).filter(Boolean);
      const ms = domain.matches.filter(x => x.groupId === g.id);
      m.set(g.id, computeStandings(members, ms, domain.tournament.rules));
    }
    return m;
  }, [domain, isGroups]);
  const preview: QualifierPick[] = useMemo(() => {
    if (!isGroups) return [];
    return pickQualifiers(domain.groups, groupTables, { perGroup, wildcards });
  }, [domain.groups, groupTables, isGroups, perGroup, wildcards]);
  const groupDone = (gid: string) =>
    domain.matches.filter(m => m.groupId === gid && ['played','draw','walkover','overtime'].includes(m.result.status)).length;
  const groupTotal = (gid: string) => domain.matches.filter(m => m.groupId === gid && m.result.status !== 'bye').length;
  const advance = () => {
    setErr('');
    if (preview.length < 2) { setErr('Need at least 2 qualifiers to build a knockout stage.'); return; }
    const existingKo = domain.matches.filter(m => !m.groupId && m.bracket?.kind === 'winners');
    if (existingKo.some(m => ['played','draw','walkover','overtime'].includes(m.result.status))) {
      if (!window.confirm('A knockout stage already exists with entered results. Re-seeding will discard them. Continue?')) return;
    }
    const seeded = seedKnockout(preview, domain.participants);
    const ko = genSingleElim(seeded, domain.tournament.rules, { order: 'given' });
    const groupMatches = domain.matches.filter(m => m.groupId);
    const roundOffset = groupMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
    // offset KO rounds past group rounds so schedule/bracket grouping never mixes them
    const koMatches = ko.matches.map(m => ({ ...m, round: m.round + roundOffset, roundName: 'KO ' + m.roundName }));
    const matches = recomputeBracket([...groupMatches, ...koMatches]);
    update(() => ({ tournament: domain.tournament, participants: domain.participants, groups: domain.groups, matches, audit: domain.audit }),
      `knockout.seed groups(${domain.groups.length}) perGroup=${perGroup} wild=${wildcards} qualifiers=${preview.length}`);
    go('bracket');
  };
  const finish = () => {
    if (!window.confirm('Archive this tournament as finished? You can still reopen it.')) return;
    update(d => ({ ...d, tournament: { ...d.tournament, archived: true } }), 'tournament.finished');
  };
  return (
    <div className="wrap">
      <h1>Standings &amp; final ranking</h1>
      {err && <div className="err">{err}</div>}
      {isGroups && (
        <div className="card">
          <h3>Group stage → knockout</h3>
          {domain.groups.map(g => (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <b>{g.name}</b> <span className="muted">({groupDone(g.id)}/{groupTotal(g.id)} played)</span>
              <table><thead><tr><th>#</th><th>Who</th><th>P</th><th>W-D-L</th><th>±</th><th>Pts</th><th>Q</th></tr></thead>
              <tbody>{(groupTables.get(g.id) ?? []).map(s => (
                <tr key={s.participantId} style={preview.some(q => q.participantId === s.participantId) ? { background: '#f0f7ff' } : undefined}>
                  <td>#{s.rank}</td><td>{names.get(s.participantId)}</td><td>{s.played}</td>
                  <td>{s.wins}-{s.draws}-{s.losses}</td><td>{s.diff}</td><td><b>{s.points}</b></td>
                  <td>{preview.some(q => q.participantId === s.participantId) ? '✓' : ''}</td>
                </tr>))}
              </tbody></table>
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <label className="f" style={{ maxWidth: 130 }}>Advance per group<input type="number" min={0} max={8} value={perGroup} onChange={e => setPerGroup(Number(e.target.value))} /></label>
            <label className="f" style={{ maxWidth: 130 }}>Wildcards<input type="number" min={0} max={8} value={wildcards} onChange={e => setWildcards(Number(e.target.value))} /></label>
            <span className="muted">Qualifiers: {preview.length ? preview.map(q => names.get(q.participantId)).join(', ') : '—'}</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={advance} disabled={preview.length < 2}>Seed knockout from standings</button>
            <span className="muted">Group results are kept; KO bracket is appended as “KO …” rounds.</span>
          </div>
        </div>
      )}
      <div className="card"><table><thead><tr><th>#</th><th>Who</th><th>P</th><th>W</th><th>D</th><th>L</th><th>+</th><th>−</th><th>±</th><th>Pts</th></tr></thead>
      <tbody>{standings.map(s => <tr key={s.participantId}><td>#{s.rank}</td><td><b>{names.get(s.participantId) ?? '?'}</b></td><td>{s.played}</td><td>{s.wins}</td><td>{s.draws}</td><td>{s.losses}</td><td>{s.scored}</td><td>{s.conceded}</td><td>{s.diff}</td><td><b>{s.points}</b></td></tr>)}</tbody></table>
      {standings.length === 0 && <div className="empty">No standings yet — enter results first.</div>}</div>
      <div className="row">
        {!domain.tournament.archived && <button className="btn primary" onClick={finish}>Finish &amp; archive</button>}
        {domain.tournament.archived && <span className="pill played">archived — read-only history kept, you can still edit</span>}
      </div>
    </div>
  );
}
