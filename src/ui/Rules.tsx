import { useApp } from '../state/store';
import { RuleSet } from '../engine/types';
import { genSingleElim } from '../engine/elim';
import { genDoubleElim } from '../engine/double';
import { recomputeBracket } from '../engine/recompute';
import { genRoundRobin, genGroupsKnockout, genLeague, describeFormat } from '../engine/generate';
import { swissPairings } from '../engine/swiss';
import { Alert, Field, Page, Panel, Switch } from './kit';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

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
  const hasResults = domain.matches.some(m => FINISHED.has(m.result.status));
  return (
    <Page title="Format & rules" sub="Decide how the tournament is scored, then generate the matches.">
      <Panel title="Format">
        <div className="grid2">
          <Field label="Competition format" hint="Changing this does not change matches until you generate again.">
            <select value={domain.tournament.format} onChange={e => update(d => ({ ...d, tournament: { ...d.tournament, format: e.target.value as never } }), 'format.change')}>
              {['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'groups-knockout', 'league', 'team-match', 'individual-match', 'custom']
                .map(x => <option key={x} value={x}>{describeFormat(x)}</option>)}
            </select>
          </Field>
          <Field label="Seeding" hint="How players are placed in the first round.">
            <select value={r.seeding} onChange={e => set({ seeding: e.target.value as RuleSet['seeding'] })}>
              <option value="seeded">Seeded (by seed order)</option>
              <option value="random">Random draw</option>
              <option value="manual">Manual order</option>
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title="Scoring" sub="Points a participant collects for each result.">
        <div className="grid2">
          <Field label="Win"><input type="number" value={r.winPoints} onChange={e => set({ winPoints: Number(e.target.value) })} /></Field>
          <Field label="Draw"><input type="number" value={r.drawPoints} onChange={e => set({ drawPoints: Number(e.target.value) })} /></Field>
          <Field label="Loss"><input type="number" value={r.lossPoints} onChange={e => set({ lossPoints: Number(e.target.value) })} /></Field>
          <Field label="Walkover win"><input type="number" value={r.walkoverWinnerPoints} onChange={e => set({ walkoverWinnerPoints: Number(e.target.value) })} /></Field>
        </div>
        <div style={{ marginTop: 4 }}>
          <Switch checked={r.allowDraws} onChange={v => set({ allowDraws: v })} label="Draws are allowed" hint="When off, a drawn result is rejected and the match must be decided." />
          <Switch checked={!!r.overtimeAllowed} onChange={v => set({ overtimeAllowed: v })} label="Extra time is possible" hint="Adds the “After extra time” outcome on the result screen." />
          <Switch checked={!!r.homeAway} onChange={v => set({ homeAway: v })} label="Home & away (league only)" hint="Every pair meets twice with switched venues." />
        </div>
      </Panel>

      <Panel title="Structure" sub="How many groups, who advances, how many Swiss rounds.">
        <div className="grid3">
          <Field label="Groups"><input type="number" min={2} value={r.groupCount ?? 2} onChange={e => set({ groupCount: Number(e.target.value) })} /></Field>
          <Field label="Advance per group"><input type="number" min={1} value={r.advancePerGroup ?? 2} onChange={e => set({ advancePerGroup: Number(e.target.value) })} /></Field>
          <Field label="Swiss rounds"><input type="number" min={1} value={r.swissRounds ?? 5} onChange={e => set({ swissRounds: Number(e.target.value) })} /></Field>
          <Field label="Bye points"><input type="number" value={r.byePoints ?? 3} onChange={e => set({ byePoints: Number(e.target.value) })} /></Field>
        </div>
      </Panel>

      {n < 2 && <Alert tone="warn" title="Not enough participants">Add at least 2 active participants before generating — there are {n} right now.</Alert>}
      {hasResults && <Alert tone="warn" title="Results will be lost">Generating again replaces every match, including results already entered. Export a backup first if you need them.</Alert>}

      <div className="footbar">
        <span className="muted">
          {n < 2 ? 'Add participants first.' : `Generates the matches for ${n} active participants.`}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('participants')}>Back to participants</button>
        <button className="btn primary" disabled={n < 2} onClick={generate}>Generate bracket / schedule</button>
      </div>
    </Page>
  );
}
