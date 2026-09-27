import { useApp } from '../state/store';
import { CompetitionFormat } from '../engine/types';
import { useState } from 'react';
import { validateTournament } from '../engine/validate';
import { uid, nowIso } from '../engine/types';

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
  const [errs, setErrs] = useState<string[]>([]);
  const set = (k: string, v: unknown) => setF(s => ({ ...s, [k]: v }));
  const submit = () => {
    const t = { ...f, id: f.id.startsWith('t_') ? f.id : uid('t'), createdAt: f.createdAt || nowIso(), updatedAt: nowIso(), archived: false };
    const bad = validateTournament(t);
    if (bad.length) { setErrs(bad.map(b => b.message)); return; }
    newProject(t);
  };
  return (
    <div className="wrap">
      <h1>New tournament</h1>
      {errs.map((e,i) => <div key={i} className="err">{e}</div>)}
      <div className="card"><div className="grid2">
        <label className="f">Tournament name*<input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Friday Cup" /></label>
        <label className="f">Sport / game*<input value={f.sport} onChange={e => set('sport', e.target.value)} /></label>
        <label className="f">Individual or team<select value={f.individualOrTeam} onChange={e => set('individualOrTeam', e.target.value)}><option value="team">Team</option><option value="individual">Individual</option></select></label>
        <label className="f">Format<select value={f.format} onChange={e => set('format', e.target.value)}>{FORMATS.map(x => <option key={x.v} value={x.v}>{x.label}</option>)}</select></label>
        <label className="f">Expected players<input type="number" min={2} value={f.participantCountExpected ?? ''} onChange={e => set('participantCountExpected', e.target.value ? Number(e.target.value) : null)} /></label>
        <label className="f">Location (optional)<input value={f.location ?? ''} onChange={e => set('location', e.target.value)} /></label>
        <label className="f">Start<input type="date" value={f.dates.start ?? ''} onChange={e => set('dates', { ...f.dates, start: e.target.value || null })} /></label>
        <label className="f">End<input type="date" value={f.dates.end ?? ''} onChange={e => set('dates', { ...f.dates, end: e.target.value || null })} /></label>
      </div></div>
      <div className="row"><button className="btn primary" onClick={submit}>Create → add participants</button><button className="btn" onClick={() => go('home')}>Cancel</button></div>
      <p className="muted">{FORMATS.find(x => x.v === f.format)?.hint ?? ''} Next: add players → set rules → generate.</p>
    </div>
  );
}
