// Standings, the group → knockout preview, and the final ranking.
import { useApp } from '../state/store';
import { useMemo, useState } from 'react';
import { computeStandings } from '../engine/standings';
import { pickQualifiers, describeFormat } from '../engine/generate';
import { planKnockout, applyPlan, KnockoutPlan } from '../engine/ko-plan';
import { uid } from '../engine/types';
import { Alert, Empty, Field, Page, Panel, StatusPill } from './kit';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Standings() {
  const { domain, standings, update, go, settings } = useApp();
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
    domain.matches.filter(m => m.groupId === gid && FINISHED.has(m.result.status)).length;
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
    if (settings.confirmDestructive && !window.confirm('Mark this tournament as finished?\n\nIt stays fully editable — you can reopen it at any time.')) return;
    update(d => ({ ...d, tournament: { ...d.tournament, archived: true } }), 'tournament.finished');
  };
  const rounds = plan ? [...new Set(plan.matches.map(m => m.round))].sort((a, b) => a - b) : [];
  const played = domain.matches.filter(m => FINISHED.has(m.result.status)).length;


  return (
    <Page
      title="Standings & final ranking"
      sub={`${describeFormat(domain.tournament.format)} · ${played} of ${domain.matches.length} matches played`}
      actions={domain.tournament.archived
        ? <span className="pill pill-info">Finished — still editable</span>
        : <button className="btn" onClick={finish}>Finish tournament</button>}
    >
      {err && <Alert tone="err" title="Knockout stage not created">{err}</Alert>}

      {isGroups && (
        <Panel
          title="Group stage → knockout"
          sub="Choose who advances, preview the bracket, then confirm. Nothing is created before you confirm."
          actions={<button className="btn primary" onClick={buildPlan} disabled={preview.length < 2}
            title={preview.length < 2 ? 'At least 2 qualifiers are needed' : undefined}>Preview knockout stage</button>}
        >
          <div className="grid2">
            <div>
              {domain.groups.map(g => (
                <div key={g.id} style={{ marginBottom: 14 }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <b>{g.name}</b>
                    <span className="muted">{groupDone(g.id)}/{groupTotal(g.id)} played</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th className="rank">#</th><th>Who</th><th className="num">P</th>
                        <th className="num">W-D-L</th><th className="num">±</th><th className="num">Pts</th><th /></tr></thead>
                      <tbody>{(groupTables.get(g.id) ?? []).map(s => (
                        <tr key={s.participantId} className={preview.some(q => q.participantId === s.participantId) ? 'selected' : ''}>
                          <td className="rank">{s.rank}</td>
                          <td className="name">{names.get(s.participantId)}</td>
                          <td className="num">{s.played}</td>
                          <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
                          <td className="num">{s.diff}</td>
                          <td className="num"><b>{s.points}</b></td>
                          <td>{preview.some(q => q.participantId === s.participantId)
                            ? <span className="pill pill-ok">Advances</span> : null}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="grid2" style={{ gap: 10 }}>
                <Field label="Advance per group" hint="0 means the whole group.">
                  <input type="number" min={0} max={8} value={perGroup} onChange={e => setPerGroup(Number(e.target.value))} />
                </Field>
                <Field label="Wildcards" hint="Best remaining teams.">
                  <input type="number" min={0} max={8} value={wildcards} onChange={e => setWildcards(Number(e.target.value))} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>Qualifiers ({preview.length})</h4>
                {preview.length === 0
                  ? <p className="f-hint">No qualifiers yet — set “advance per group” above.</p>
                  : <ol style={{ paddingLeft: 18, margin: '6px 0 0', fontSize: 13 }}>
                    {preview.map(q => <li key={q.participantId}>{names.get(q.participantId)} <span className="muted">({q.points} pts)</span></li>)}
                  </ol>}
              </div>
            </div>
          </div>
        </Panel>
      )}


      {plan && (
        <Panel
          title="Knockout preview"
          sub="Nothing is saved yet — review the qualifiers and the bracket, then confirm."
          actions={<div className="row">
            <button className="btn" onClick={() => setPlan(null)}>Cancel</button>
            <button className="btn primary" onClick={confirmPlan}>Create knockout stage</button>
          </div>}
        >
          {plan.droppedKoMatches > 0 && (
            <Alert tone="warn" title="This replaces existing knockout matches">
              {plan.droppedKoMatches} knockout match(es) will be recreated. Group results are never touched.
            </Alert>
          )}
          <div className="grid2">
            <div>
              <h4>Who advances ({plan.qualifiers.length})</h4>
              <div className="table-wrap">
                <table>
                  <thead><tr><th className="num">Seed</th><th>Who</th><th>From</th><th className="num">Pts</th></tr></thead>
                  <tbody>{plan.qualifiers.map(q => (
                    <tr key={q.participantId}>
                      <td className="num">#{q.seed}</td>
                      <td className="name">{q.name}</td>
                      <td className="muted">{q.fromGroup}{q.groupRank ? ` (${q.groupRank})` : ''}</td>
                      <td className="num">{q.points}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="table-note">
                Seeding is deterministic: points, wins, goal difference, goals scored, seed, name — then standard pairing.
              </p>
            </div>
            <div>
              <h4>Bracket that will be created</h4>
              {rounds.length === 0 && <p className="f-hint">No rounds.</p>}
              {rounds.map(r => (
                <div key={r} style={{ marginBottom: 12 }}>
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
        </Panel>
      )}

      <Panel title="Ranking" sub="Sorted by the tiebreak order in Format & rules.">
        {standings.length === 0 ? (
          <Empty
            title="No standings yet"
            hint="Standings appear as soon as the first result is entered."
            action={<button className="btn primary" onClick={() => go('matches')}>Go to result entry</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th className="rank">#</th><th>Who</th>
                <th className="num" title="Played">P</th><th className="num" title="Wins">W</th>
                <th className="num" title="Draws">D</th><th className="num" title="Losses">L</th>
                <th className="num" title="Goals scored">+</th><th className="num" title="Goals conceded">−</th>
                <th className="num" title="Goal difference">±</th><th className="num">Pts</th>
              </tr></thead>
              <tbody>{standings.map(s => (
                <tr key={s.participantId}>
                  <td className="rank">{s.rank}</td>
                  <td className="name">{names.get(s.participantId) ?? '?'}</td>
                  <td className="num">{s.played}</td><td className="num">{s.wins}</td>
                  <td className="num">{s.draws}</td><td className="num">{s.losses}</td>
                  <td className="num">{s.scored}</td><td className="num">{s.conceded}</td>
                  <td className="num">{s.diff}</td><td className="num"><b>{s.points}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="footbar">
        <span className="muted">
          {domain.tournament.archived
            ? 'This tournament is marked as finished — everything stays editable.'
            : 'Marking a tournament as finished never locks it; you can keep editing.'}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('matches')}>Result entry</button>
        {!domain.tournament.archived && <button className="btn" onClick={finish}>Finish tournament</button>}
        <button className="btn primary" onClick={() => go('export')}>Export & print</button>
      </div>
    </Page>
  );
}
