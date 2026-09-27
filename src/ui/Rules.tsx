import { useApp } from '../state/store';
import { RuleSet } from '../engine/types';
import { genSingleElim } from '../engine/elim';
import { genDoubleElim } from '../engine/double';
import { recomputeBracket } from '../engine/recompute';
import { genRoundRobin, genGroupsKnockout, genLeague } from '../engine/generate';
import { swissPairings } from '../engine/swiss';

export default function Rules() {
  const { domain, update, go } = useApp();
  const r = domain.tournament.rules;
  const set = (patch: Partial<RuleSet>) =>
    update(d => ({ ...d, tournament: { ...d.tournament, rules: { ...d.tournament.rules, ...patch } } }), 'rules.edit');
  const generate = () => {
    if (domain.matches.some(m => ['played','draw','walkover','overtime'].includes(m.result.status))) {
      if (!window.confirm(`Regenerate ${domain.tournament.format}? All entered results will be lost. Export first if needed.`)) return;
    }
    const ps = domain.participants;
    const f = domain.tournament.format;
    let matches = domain.matches, groups = domain.groups;
    if (f === 'single-elimination') { const g = genSingleElim(ps, r); matches = g.matches; groups = []; }
    else if (f === 'round-robin' || f === 'team-match' || f === 'individual-match' || f === 'custom') { matches = genRoundRobin(ps, r); groups = []; }
    else if (f === 'league') { matches = genLeague(ps, r); groups = []; }
    else if (f === 'groups-knockout') { const g = genGroupsKnockout(ps, r); matches = g.matches; groups = g.groups; }
    else if (f === 'swiss') { const st = new Map(ps.map(p => [p.id, 0])); matches = swissPairings(ps, [], st, 1); groups = []; }
    else if (f === 'double-elimination') { const g = genDoubleElim(ps, r); matches = recomputeBracket(g.matches); groups = []; }
    update(() => ({ tournament: domain.tournament, participants: ps, groups, matches, audit: domain.audit, resources: domain.resources ?? [] }), `structure.generate ${f} (${matches.length} matches)`);
    go('bracket');
  };
  const n = domain.participants.filter(p => p.active).length;
  return (
    <div className="wrap">
      <h1>Format &amp; rules</h1>
      <div className="card"><div className="grid2">
        <label className="f">Format<select value={domain.tournament.format} onChange={e => update(d => ({ ...d, tournament: { ...d.tournament, format: e.target.value as never } }), 'format.change')}>{['single-elimination','double-elimination','round-robin','swiss','groups-knockout','league','team-match','individual-match','custom'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label className="f">Seeding<select value={r.seeding} onChange={e => set({ seeding: e.target.value as RuleSet['seeding'] })}><option value="seeded">Seeded</option><option value="random">Random draw</option><option value="manual">Manual order</option></select></label>
        <label className="f">Win points<input type="number" value={r.winPoints} onChange={e => set({ winPoints: Number(e.target.value) })} /></label>
        <label className="f">Draw points<input type="number" value={r.drawPoints} onChange={e => set({ drawPoints: Number(e.target.value) })} /></label>
        <label className="f">Loss points<input type="number" value={r.lossPoints} onChange={e => set({ lossPoints: Number(e.target.value) })} /></label>
        <label className="f">Walkover points<input type="number" value={r.walkoverWinnerPoints} onChange={e => set({ walkoverWinnerPoints: Number(e.target.value) })} /></label>
        <label className="f">Groups<input type="number" min={2} value={r.groupCount ?? 2} onChange={e => set({ groupCount: Number(e.target.value) })} /></label>
        <label className="f">Advance per group<input type="number" min={1} value={r.advancePerGroup ?? 2} onChange={e => set({ advancePerGroup: Number(e.target.value) })} /></label>
        <label className="f">Swiss rounds<input type="number" min={1} value={r.swissRounds ?? 5} onChange={e => set({ swissRounds: Number(e.target.value) })} /></label>
        <label className="f">Bye points<input type="number" value={r.byePoints ?? 3} onChange={e => set({ byePoints: Number(e.target.value) })} /></label>
      </div>
      <div className="row">
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={r.allowDraws} onChange={e => set({ allowDraws: e.target.checked })} /> draws allowed</label>
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={!!r.homeAway} onChange={e => set({ homeAway: e.target.checked })} /> home &amp; away (league)</label>
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={!!r.overtimeAllowed} onChange={e => set({ overtimeAllowed: e.target.checked })} /> overtime allowed</label>
      </div></div>
      {n < 2 && <div className="warn">Add at least 2 active participants before generating (now: {n}).</div>}
      <div className="row"><button className="btn primary" disabled={n < 2} onClick={generate}>Generate bracket / schedule</button><button className="btn" onClick={() => go('participants')}>Back</button></div>
    </div>
  );
}
