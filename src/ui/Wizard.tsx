import { useApp } from '../state/store';
import { CompetitionFormat } from '../engine/types';
import { useState } from 'react';
import { validateTournament, ValidationIssue } from '../engine/validate';
import { uid, nowIso } from '../engine/types';
import { Alert, Field, Page, Panel, StepBar } from './kit';

const FORMATS: { v: CompetitionFormat; label: string; hint: string }[] = [
  { v: 'single-elimination', label: 'Single elimination', hint: 'Lose once and you are out. Fastest for one-day cups.' },
  { v: 'double-elimination', label: 'Double elimination', hint: 'Two lives: winners + losers bracket, grand final (+reset).' },
  { v: 'round-robin', label: 'Round robin', hint: 'Everyone plays everyone. Best for small leagues.' },
  { v: 'swiss', label: 'Swiss', hint: 'Fixed rounds, paired by points. No elimination.' },
  { v: 'groups-knockout', label: 'Groups + knockout', hint: 'Group stage first, then top teams advance to KO bracket.' },
  { v: 'league', label: 'League season', hint: 'Full season table, optionally home & away.' },
  { v: 'team-match', label: 'Team match event', hint: 'Single team-vs-team fixture list.' },
  { v: 'individual-match', label: 'Individual match event', hint: 'Single player-vs-player fixture list.' },
  { v: 'custom', label: 'Custom', hint: 'Free schedule, manual structure.' },
];

export default function Wizard() {
  const { domain, newProject, go } = useApp();
  const [f, setF] = useState({ ...domain.tournament, name: domain.tournament.name || '', sport: domain.tournament.sport || 'Football' });
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const set = (k: string, v: unknown) => setF(s => ({ ...s, [k]: v }));
  const errOf = (field: string) => issues.find(i => i.field === field)?.message;
  const others = issues.filter(i => !['name', 'sport', 'dates'].includes(i.field));
  const format = FORMATS.find(x => x.v === f.format) ?? FORMATS[0];
  const submit = () => {
    const t = { ...f, id: f.id.startsWith('t_') ? f.id : uid('t'), createdAt: f.createdAt || nowIso(), updatedAt: nowIso(), archived: false };
    const bad = validateTournament(t);
    if (bad.length) { setIssues(bad); return; }
    newProject(t);
  };
  return (
    <Page title="New tournament" sub="Step 1 of 3 — details, then players, then the bracket.">
      <StepBar items={['Details', 'Players', 'Generate']} current={0} />

      {others.length > 0 && (
        <Alert tone="err" title="Fix this before creating the tournament">
          {others.map(i => <div key={i.field}>{i.message}</div>)}
        </Alert>
      )}

      <Panel title="Basics">
        <div className="grid2">
          <Field label="Tournament name" required error={errOf('name')}>
            <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Friday Cup" autoFocus />
          </Field>
          <Field label="Sport or game" required error={errOf('sport')} hint="Shown on the display screen and in exports.">
            <input value={f.sport} onChange={e => set('sport', e.target.value)} />
          </Field>
          <Field label="Competing as" hint="Sets the wording used everywhere else.">
            <select value={f.individualOrTeam} onChange={e => set('individualOrTeam', e.target.value)}>
              <option value="team">Teams</option>
              <option value="individual">Individual players</option>
            </select>
          </Field>
          <Field label="Expected number of players" hint="Optional — helps you plan courts and rounds.">
            <input type="number" min={2} value={f.participantCountExpected ?? ''}
              onChange={e => set('participantCountExpected', e.target.value ? Number(e.target.value) : null)} />
          </Field>
        </div>
      </Panel>

      <Panel title="Format" sub="You can change this any time on the Rules screen.">
        <div className="grid2">
          <Field label="Competition format">
            <select value={f.format} onChange={e => set('format', e.target.value)}>
              {FORMATS.map(x => <option key={x.v} value={x.v}>{x.label}</option>)}
            </select>
          </Field>
          <div className="f-hint" style={{ alignSelf: 'end', paddingBottom: 8 }}>{format.hint}</div>
        </div>
      </Panel>

      <Panel title="When and where" sub="Optional — used on the display screen and printouts.">
        <div className="grid3">
          <Field label="Start date" error={errOf('dates')}>
            <input type="date" value={f.dates.start ?? ''} onChange={e => set('dates', { ...f.dates, start: e.target.value || null })} />
          </Field>
          <Field label="End date">
            <input type="date" value={f.dates.end ?? ''} onChange={e => set('dates', { ...f.dates, end: e.target.value || null })} />
          </Field>
          <Field label="Venue">
            <input value={f.location ?? ''} onChange={e => set('location', e.target.value)} placeholder="Sports hall, 4 courts" />
          </Field>
        </div>
      </Panel>

      <div className="footbar">
        <span className="muted">
          Creates an empty <b>{f.name.trim() || 'new tournament'}</b> ({format.label.toLowerCase()}) — you add the players next.
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('home')}>Cancel</button>
        <button className="btn primary" onClick={submit}>Create tournament</button>
      </div>
    </Page>
  );
}
