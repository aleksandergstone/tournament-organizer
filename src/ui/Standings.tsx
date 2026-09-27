import { useApp } from '../state/store';
import { useMemo, useState } from 'react';
import { computeStandings } from '../engine/standings';
import { pickQualifiers } from '../engine/generate';
import { planKnockout, applyPlan, KnockoutPlan } from '../engine/ko-plan';
import { uid } from '../engine/types';

export default function Standings() {
  const { domain, standings, update, go } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const isGroups = domain.tournament.format === 'groups-knockout' && domain.groups.length > 0;
  const [perGroup, setPerGroup] = useState(domain.tournament.rules.advancePerGroup ?? 2);
  const [wildcards, setWildcards] = useState(0);
  const [err, setErr] = useState('');
  const [plan, setPlan] = useState<KnockoutPlan | null>(null);

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
  const preview = useMemo(() => {
    if (!isGroups) return [];
    return pickQualifiers(domain.groups, groupTables, { perGroup, wildcards });
  }, [domain.groups, groupTables, isGroups, perGroup, wildcards]);
  const groupDone = (gid: string) =>
    domain.matches.filter(m => m.groupId === gid && ['played','draw','walkover','overtime'].includes(m.result.status)).length;
  const groupTotal = (gid: string) => domain.matches.filter(m => m.groupId === gid && m.result.status !== 'bye').length;

  // Step 1 — build the plan and show it. Nothing in the project changes yet.
  const buildPlan = () => {
    setErr('');
    const p = planKnockout({
      groups: domain.groups,
      standingsByGroup: groupTables,
      participants: domain.participants,
      rules: domain.tournament.rules,
      options: { perGroup, wildcards },
      existingMatches: domain.matches,
    });
    if (p.reason) { setPlan(null); setErr(p.reason); return; }
    setPlan(p);
  };
  // Step 2 — the organizer confirms; cancelling simply closes the plan.
  const confirmPlan = () => {
    if (!plan) return;
    const next = applyPlan(domain, plan, domain.tournament.rules);
    update(() => ({
      tournament: { ...next.tournament, updatedAt: new Date().toISOString() },
      participants: next.participants, groups: next.groups, matches: next.matches,
      audit: [...domain.audit, { id: uid('a'), at: new Date().toISOString(), action: 'knockout.seeded', detail: `${plan.qualifiers.length} qualifiers` }],
      resources: domain.resources ?? [],
    }), `knockout.seed qualifiers=${plan.qualifiers.length}`);
    setPlan(null);
    go('bracket');
  };

  const finish = () => {
    if (!window.confirm('Archive this tournament as finished? You can still reopen it.')) return;
    update(d => ({ ...d, tournament: { ...d.tournament, archived: true } }), 'tournament.finished');
  };
  const rounds = plan ? [...new Set(plan.matches.map(m => m.round))].sort((a, b) => a - b) : [];

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
            <button className="btn primary" onClick={buildPlan} disabled={preview.length < 2}>Preview knockout stage</button>
            <span className="muted">Shows the qualifiers and the bracket first — nothing is created until you confirm.</span>
          </div>
        </div>
      )}

      {plan && (
        <div className="card">
          <h3>Knockout preview — nothing saved yet</h3>
          <div className="grid2">
            <div>
              <h4>Who advances ({plan.qualifiers.length})</h4>
              <table><thead><tr><th>Seed</th><th>Who</th><th>From</th><th>Pts</th></tr></thead>
                <tbody>{plan.qualifiers.map(q => (
                  <tr key={q.participantId}>
                    <td>#{q.seed}</td><td>{q.name}</td>
                    <td className="muted">{q.fromGroup}{q.groupRank ? ` (${q.groupRank})` : ''}</td>
                    <td>{q.points}</td>
                  </tr>
                ))}</tbody></table>
              <p className="muted" style={{ fontSize: 13 }}>
                Seeding is deterministic: qualifiers are ordered by their tiebreak order
                (points, wins, goal difference, goals scored, seed, name) and standard seeding
                pairs {plan.qualifiers.length > 1 ? `#1 vs #${plan.qualifiers.length}` : ''}.
              </p>
              {plan.droppedKoMatches > 0 && (
                <div className="warn">
                  This replaces the {plan.droppedKoMatches} existing knockout match(es) — group results are kept.
                </div>
              )}
            </div>
            <div>
              <h4>Bracket that will be created</h4>
              {rounds.length === 0 && <div className="muted">No rounds.</div>}
              {rounds.map(r => (
                <div key={r} style={{ marginBottom: 10 }}>
                  <b>{plan.matches.find(m => m.round === r)?.roundName ?? `KO round ${r}`}</b>
                  {plan.matches.filter(m => m.round === r).map(m => (
                    <div className="bmatch" key={m.id}>
                      <div className="nm">
                        <span>{m.homeId ? names.get(m.homeId) ?? 'Unknown' : 'TBD'}</span>
                        <span>{m.awayId ? names.get(m.awayId) ?? 'Unknown' : 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={confirmPlan}>Create knockout stage</button>
            <button className="btn" onClick={() => setPlan(null)}>Cancel</button>
            <span className="muted">Cancelling changes nothing — the plan is only a preview.</span>
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
