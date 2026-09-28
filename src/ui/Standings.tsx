// Standings, the group → knockout preview, and the final ranking.
import { useApp } from '../state/store';
import { useMemo, useState } from 'react';
import { computeStandings } from '../engine/standings';
import { pickQualifiers, describeFormat, hasPointTable } from '../engine/generate';
import { knockoutPlaces } from '../engine/bracket-view';
import { planKnockout, applyPlan, KnockoutPlan } from '../engine/ko-plan';
import { uid } from '../engine/types';
import { Alert, Empty, Field, Page, Panel, StatusPill } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Standings() {
  const t = useT();
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
  // Points decide a league, a Swiss run or a group stage — never a knockout.
  const points = hasPointTable(domain.tournament.format);
  const koMs = domain.matches.filter(m => !m.groupId);
  const places = knockoutPlaces(koMs, id => (id ? names.get(id) ?? t('common.unknown') : ''));
  const rounds = plan ? [...new Set(plan.matches.map(m => m.round))].sort((a, b) => a - b) : [];
  const played = domain.matches.filter(m => FINISHED.has(m.result.status)).length;


  return (
    <Page
      title={t('st.titlePage')}
      sub={t('bracket.subPlayed', { format: describeFormat(domain.tournament.format), played, total: domain.matches.length })}
      actions={domain.tournament.archived
        ? <span className="pill pill-info">{t('st.archivedPill')}</span>
        : <button className="btn" onClick={finish}>{t('st.finish')}</button>}
    >
      {err && <Alert tone="err" title={t('st.koNotCreated')}>{err}</Alert>}

      {isGroups && (
        <Panel
          title={t('st.groupsKo')}
          sub={t('st.planSub')}
          actions={<button className="btn primary" onClick={buildPlan} disabled={preview.length < 2}
            title={preview.length < 2 ? t('st.needTwoQualifiers') : undefined}>{t('st.createKo')}</button>}
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
                      <thead><tr><th className="rank">#</th><th>{t('st.colWho')}</th><th className="num">P</th>
                        <th className="num">W-D-L</th><th className="num">±</th><th className="num">{t('st.colPts')}</th><th /></tr></thead>
                      <tbody>{(groupTables.get(g.id) ?? []).map(s => (
                        <tr key={s.participantId} className={preview.some(q => q.participantId === s.participantId) ? 'selected' : ''}>
                          <td className="rank">{s.rank}</td>
                          <td className="name">{names.get(s.participantId)}</td>
                          <td className="num">{s.played}</td>
                          <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
                          <td className="num">{s.diff}</td>
                          <td className="num"><b>{s.points}</b></td>
                          <td>{preview.some(q => q.participantId === s.participantId)
                            ? <span className="pill pill-ok">{t('st.advances')}</span> : null}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="grid2" style={{ gap: 10 }}>
                <Field label={t('st.perGroup')} hint={t('st.perGroupHint')}>
                  <input type="number" min={0} max={8} value={perGroup} onChange={e => setPerGroup(Number(e.target.value))} />
                </Field>
                <Field label={t('st.wildcards')} hint={t('st.wildcardsHint')}>
                  <input type="number" min={0} max={8} value={wildcards} onChange={e => setWildcards(Number(e.target.value))} />
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>{t('st.qualifiers')} ({preview.length})</h4>
                {preview.length === 0
                  ? <p className="f-hint">{t('st.needQualifiers')}</p>
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
          title={t('st.koTitle')}
          sub={t('st.koSub')}
          actions={<div className="row">
            <button className="btn" onClick={() => setPlan(null)}>{t('common.cancel')}</button>
            <button className="btn primary" onClick={confirmPlan}>{t('st.confirmKo')}</button>
          </div>}
        >
          {plan.droppedKoMatches > 0 && (
            <Alert tone="warn" title={t('st.replacesKo')}>
              {t('st.replacesKoBody', { n: plan.droppedKoMatches })}
            </Alert>
          )}
          <div className="grid2">
            <div>
              <h4>Who advances ({plan.qualifiers.length})</h4>
              <div className="table-wrap">
                <table>
                  <thead><tr><th className="num">{t('common.seed')}</th><th>{t('st.colWho')}</th><th>{t('st.from')}</th><th className="num">{t('st.colPts')}</th></tr></thead>
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
              <h4>{t('st.bracketToCreate')}</h4>
              {rounds.length === 0 && <p className="f-hint">{t('st.noRounds')}</p>}
              {rounds.map(r => (
                <div key={r} style={{ marginBottom: 12 }}>
                  <b>{plan.matches.find(m => m.round === r)?.roundName ?? t('bracket.koRoundN', { n: r })}</b>
                  {plan.matches.filter(m => m.round === r).map(m => (
                    <div className="bmatch" key={m.id}>
                      <div className="nm">
                        <span>{m.homeId ? names.get(m.homeId) ?? t('common.unknown') : 'TBD'}</span>
                        <span>{m.awayId ? names.get(m.awayId) ?? t('common.unknown') : 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {points ? (
      <Panel title={t('st.ranking')} sub={t('st.rankingSub')}>
        {standings.length === 0 ? (
          <Empty
            title={t('st.emptyTitle')}
            hint={t('st.emptyHint')}
            action={<button className="btn primary" onClick={() => go('matches')}>{t('st.goResults')}</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th className="rank">#</th><th>{t('st.colWho')}</th>
                <th className="num" title={t('st.colPlayed')}>P</th><th className="num" title={t('st.colWins')}>W</th>
                <th className="num" title={t('st.colDraws')}>D</th><th className="num" title={t('st.colLosses')}>L</th>
                <th className="num" title={t('st.colScored')}>+</th><th className="num" title={t('st.colConceded')}>−</th>
                <th className="num" title={t('st.colDiff')}>±</th><th className="num">{t('st.colPts')}</th>
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
      ) : (
        <Panel title={t('st.finalTitle')} sub={t('st.finalSub')}>
          {places.length === 0 ? (
            <Empty
              title={t('st.noChampionYet')}
              hint={t('st.enterResultsFirst')}
              action={<button className="btn primary" onClick={() => go('matches')}>{t('st.entry')}</button>}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th className="num">{t('doc.place')}</th><th>{t('st.colWho')}</th></tr></thead>
                <tbody>{places.map(p => (
                  <tr key={p.place} className={p.place === 1 ? 'champion' : ''}>
                    <td className="rank num">{p.place}</td>
                    <td className="name">{p.name}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="footbar">
        <span className="muted">
          {domain.tournament.archived
            ? t('st.archivedNote')
            : t('st.finishedNote')}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('matches')}>{t('st.entry')}</button>
        {!domain.tournament.archived && <button className="btn" onClick={finish}>{t('st.finish')}</button>}
        <button className="btn primary" onClick={() => go('export')}>{t('st.exportPrint')}</button>
      </div>
    </Page>
  );
}
