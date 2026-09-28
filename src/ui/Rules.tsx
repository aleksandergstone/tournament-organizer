import { useApp } from '../state/store';
import { RuleSet } from '../engine/types';
import { genSingleElim } from '../engine/elim';
import { genDoubleElim } from '../engine/double';
import { recomputeBracket } from '../engine/recompute';
import { genRoundRobin, genGroupsKnockout, genLeague, describeFormat } from '../engine/generate';
import { swissPairings } from '../engine/swiss';
import { Alert, Field, Page, Panel, Switch } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Rules() {
  const { domain, update, go } = useApp();
  const t = useT();
  const r = domain.tournament.rules;
  const set = (patch: Partial<RuleSet>) =>
    update(d => ({ ...d, tournament: { ...d.tournament, rules: { ...d.tournament.rules, ...patch } } }), 'rules.edit');
  const currentFormat = domain.tournament.format;
  const generate = () => {
    if (domain.matches.some(m => ['played','draw','walkover','overtime'].includes(m.result.status))) {
      if (!window.confirm(t('rules.regenerateConfirm', { format: describeFormat(currentFormat) }))) return;
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
    <Page title={t('rules.title')} sub={t('rules.sub')}>
      <Panel title={t('wizard.format')}>
        <div className="grid2">
          <Field label={t('wizard.format')} hint={t('rules.formatHint')}>
            <select value={domain.tournament.format} onChange={e => update(d => ({ ...d, tournament: { ...d.tournament, format: e.target.value as never } }), 'format.change')}>
              {['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'groups-knockout', 'league', 'team-match', 'individual-match', 'custom']
                .map(x => <option key={x} value={x}>{describeFormat(x)}</option>)}
            </select>
          </Field>
          <Field label={t('rules.seeding')} hint={t('rules.seedingHint')}>
            <select value={r.seeding} onChange={e => set({ seeding: e.target.value as RuleSet['seeding'] })}>
              <option value="seeded">{t('rules.seedingSeeded')}</option>
              <option value="random">{t('rules.seedingRandom')}</option>
              <option value="manual">{t('rules.seedingManual')}</option>
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title={t('rules.scoring')} sub={t('rules.scoringSub')}>
        <div className="grid2">
          <Field label={t('rules.win')}><input type="number" value={r.winPoints} onChange={e => set({ winPoints: Number(e.target.value) })} /></Field>
          <Field label={t('rules.draw')}><input type="number" value={r.drawPoints} onChange={e => set({ drawPoints: Number(e.target.value) })} /></Field>
          <Field label={t('rules.loss')}><input type="number" value={r.lossPoints} onChange={e => set({ lossPoints: Number(e.target.value) })} /></Field>
          <Field label={t('rules.walkoverWin')}><input type="number" value={r.walkoverWinnerPoints} onChange={e => set({ walkoverWinnerPoints: Number(e.target.value) })} /></Field>
        </div>
        <div style={{ marginTop: 4 }}>
          <Switch checked={r.allowDraws} onChange={v => set({ allowDraws: v })} label={t('rules.allowDraws')} hint={t('rules.allowDrawsHint')} />
          <Switch checked={!!r.overtimeAllowed} onChange={v => set({ overtimeAllowed: v })} label={t('rules.overtime')} hint={t('rules.overtimeHint')} />
          <Switch checked={!!r.homeAway} onChange={v => set({ homeAway: v })} label={t('rules.homeAway')} hint={t('rules.homeAwayHint')} />
        </div>
      </Panel>

      <Panel title={t('rules.structure')} sub={t('rules.structureSub')}>
        <div className="grid3">
          <Field label={t('common.groups')}><input type="number" min={2} value={r.groupCount ?? 2} onChange={e => set({ groupCount: Number(e.target.value) })} /></Field>
          <Field label={t('rules.advance')}><input type="number" min={1} value={r.advancePerGroup ?? 2} onChange={e => set({ advancePerGroup: Number(e.target.value) })} /></Field>
          <Field label={t('rules.swissRounds')}><input type="number" min={1} value={r.swissRounds ?? 5} onChange={e => set({ swissRounds: Number(e.target.value) })} /></Field>
          <Field label={t('rules.byePoints')}><input type="number" value={r.byePoints ?? 3} onChange={e => set({ byePoints: Number(e.target.value) })} /></Field>
        </div>
      </Panel>

      {n < 2 && <Alert tone="warn" title={t('rules.notEnough')}>{t('rules.notEnoughBody', { n })}</Alert>}
      {hasResults && <Alert tone="warn" title={t('rules.resultsLost')}>{t('rules.resultsLostBody')}</Alert>}

      <div className="footbar">
        <span className="muted">
          {n < 2 ? t('rules.addFirst') : t('rules.willGenerate', { n })}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('participants')}>{t('rules.backToParticipants')}</button>
        <button className="btn primary" disabled={n < 2} onClick={generate}>{t('rules.generate')}</button>
      </div>
    </Page>
  );
}
