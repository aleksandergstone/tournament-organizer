// Venue scheduling — courts, tables, stations. Assign a place and a time to
// matches, see conflicts immediately, or let the planner fill the day for you.
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { resourcesOf } from '../engine/model';
import { detectConflicts, suggestSlots, toEntries, DEFAULT_DURATION_MIN } from '../engine/schedule';
import { ResourceKind, uid } from '../engine/types';
import { Alert, Empty, Field, Page, Panel, Segmented } from './kit';

const KINDS: ResourceKind[] = ['court', 'table', 'station', 'board', 'lane', 'other'];
const KIND_LABELS: Record<string, string> = {
  court: 'Court', table: 'Table', station: 'Station', board: 'Scoreboard', lane: 'Lane', other: 'Other',
};

function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Schedule() {
  const { domain, update, go, settings } = useApp();
  const resources = useMemo(() => resourcesOf(domain), [domain]);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? 'Unknown' : 'TBD');

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ResourceKind>('court');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [dayStart, setDayStart] = useState(() => toLocalInput(null));
  const [onlyFree, setOnlyFree] = useState(false);

  const conflicts = useMemo(() => detectConflicts(domain.matches, resources), [domain.matches, resources]);
  const entries = useMemo(() => toEntries(domain.matches, resources), [domain.matches, resources]);
  const playable = useMemo(() => domain.matches.filter(m => m.homeId && m.awayId), [domain.matches]);
  const unscheduled = useMemo(() => playable.filter(m => !m.scheduledAt), [playable]);
  const scheduledById = new Map(entries.map(e => [e.matchId, e]));
  const rows = onlyFree ? unscheduled : playable;

  const addResource = () => {
    const n = name.trim();
    if (!n) { setErr('Give the place a name, e.g. "Court 1".'); return; }
    if (resources.some(r => r.name.toLowerCase() === n.toLowerCase())) { setErr(`"${n}" already exists.`); return; }
    setErr('');
    update(d => ({ ...d, resources: [...(d.resources ?? []), { id: uid('r'), name: n, kind }] }), `resource.add ${n}`);
    setName('');
  };
  const removeResource = (id: string, n: string) => {
    // Matches keep their time but lose the assignment — never silently kept.
    if (settings.confirmDestructive && !window.confirm(`Remove the place "${n}"?\n\nMatches assigned to it stay in the schedule, but without a place.`)) return;
    update(d => ({
      ...d,
      resources: (d.resources ?? []).filter(r => r.id !== id),
      matches: d.matches.map(m => (m.resourceId === id ? { ...m, resourceId: null } : m)),
    }), `resource.remove ${n}`);
  };
  const assign = (matchId: string, resourceId: string, startIso: string, durationMin: number) => {
    const res = resources.find(r => r.id === resourceId);
    update(d => ({
      ...d,
      matches: d.matches.map(m => (m.id === matchId ? {
        ...m, resourceId, venue: res?.name ?? m.venue ?? null,
        scheduledAt: startIso, durationMin: durationMin > 0 ? durationMin : null,
      } : m)),
    }), `schedule.assign ${matchId}`);
  };
  const clearSlot = (matchId: string) => {
    update(d => ({ ...d, matches: d.matches.map(m => (m.id === matchId ? { ...m, scheduledAt: null } : m)) }), `schedule.clear ${matchId}`);
  };
  const patch = (matchId: string, p: Record<string, unknown>, msg2: string) =>
    update(d => ({ ...d, matches: d.matches.map(m => (m.id === matchId ? { ...m, ...p } : m)) }), msg2);

  const autoFill = () => {
    if (resources.length === 0) { setErr('Add at least one court, table or station first.'); return; }
    if (unscheduled.length === 0) { setMsg('Every match already has a time.'); setErr(''); return; }
    const plan = suggestSlots(domain.matches, resources, {
      dayStart: new Date(dayStart).toISOString(),
      defaultDurationMin: DEFAULT_DURATION_MIN,
    });
    if (plan.length === 0) { setErr('No free slot found — add more places or start later in the day.'); return; }
    setErr(''); setMsg(`Planned ${plan.length} match${plan.length > 1 ? 'es' : ''} without overlaps.`);
    update(d => ({
      ...d,
      matches: d.matches.map(m => {
        const p = plan.find(x => x.matchId === m.id);
        return p ? { ...m, resourceId: p.resourceId, venue: p.resourceName, scheduledAt: p.start, durationMin: p.durationMin } : m;
      }),
    }), `schedule.autofill ${plan.length}`);
  };


  return (
    <Page
      title="Schedule — courts, tables, stations"
      sub="Give every match a place and a time. Double-booking is reported, never hidden."
    >
      {msg && <Alert tone="ok" title="Schedule updated">{msg}</Alert>}
      {err && <Alert tone="err" title="Nothing was changed">{err}</Alert>}

      {conflicts.length > 0 && (
        <Alert tone="err" title={`${conflicts.length} scheduling conflict${conflicts.length > 1 ? 's' : ''}`}>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
          </ul>
        </Alert>
      )}

      <Panel title="Places" sub="The courts, tables or stations this venue uses.">
        <div className="row">
          <input className="search" style={{ maxWidth: 240 }} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addResource()} placeholder="Court 1, Table 2…" aria-label="New place name" />
          <select style={{ maxWidth: 150 }} value={kind} onChange={e => setKind(e.target.value as ResourceKind)} aria-label="Place type">
            {KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>)}
          </select>
          <button className="btn primary" onClick={addResource}>Add place</button>
        </div>
        {resources.length === 0 ? (
          <Empty
            title="No places yet"
            hint="Add the courts, tables or stations first — matches can then be assigned a place and a time."
          />
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Place</th><th>Type</th><th className="num">Matches</th><th /></tr></thead>
              <tbody>{resources.map(r => (
                <tr key={r.id}>
                  <td className="name">{r.name}</td>
                  <td className="muted">{KIND_LABELS[r.kind] ?? r.kind}</td>
                  <td className="num muted">{domain.matches.filter(m => m.resourceId === r.id).length}</td>
                  <td className="actions">
                    <button className="btn sm quiet" onClick={() => removeResource(r.id, r.name)}>Remove</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {resources.length > 0 && (
        <Panel title="Plan the day" sub={`${DEFAULT_DURATION_MIN} minutes per match — never two matches at once on one place.`}>
          <div className="row">
            <Field label="Day starts at">
              <input type="datetime-local" value={dayStart} onChange={e => setDayStart(e.target.value)} />
            </Field>
            <span className="sp" />
            <button className="btn primary" onClick={autoFill} disabled={unscheduled.length === 0}>
              Fill free slots ({unscheduled.length} without a time)
            </button>


          </div>
          <p className="table-note">
            {unscheduled.length === 0
              ? 'Every match already has a place and a time.'
              : `${unscheduled.length} of ${playable.length} matches still need a time. The planner fills them in order, skipping busy places.`}
          </p>
        </Panel>
      )}
      <Panel
        title="Matches"
        sub="Pick a place and a time for each match. Times are optional."
        actions={playable.length > 0 ? (
          <Segmented
            value={onlyFree ? 'free' : 'all'}
            onChange={v => setOnlyFree(v === 'free')}
            options={[{ id: 'all', label: 'All' }, { id: 'free', label: `Without a time (${unscheduled.length})` }]}
            label="Match filter"
          />
        ) : undefined}
      >
        {playable.length === 0 ? (
          <Empty
            title="No matches yet"
            hint="Generate the bracket first, then every match can get a place and a time here."
            action={<button className="btn primary" onClick={() => go('rules')}>Go to rules → generate</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Match</th><th style={{ width: 170 }}>Place</th><th style={{ width: 210 }}>Start</th>
                <th className="num" style={{ width: 80 }}>Min</th><th />
              </tr></thead>
              <tbody>{rows.map(m => (
                <tr key={m.id}>
                  <td className="name">{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</td>
                  <td>
                    <select value={m.resourceId ?? ''} aria-label={`Place for ${pn(m.homeId)} against ${pn(m.awayId)}`}
                      onChange={ev => {
                        const v = ev.target.value;
                        if (!v) { patch(m.id, { resourceId: null }, `schedule.unassign ${m.id}`); return; }
                        const start = m.scheduledAt
                          ?? new Date(new Date(dayStart).getTime() + entries.length * DEFAULT_DURATION_MIN * 60_000).toISOString();
                        assign(m.id, v, start, m.durationMin ?? DEFAULT_DURATION_MIN);
                      }}>
                      <option value="">— none —</option>
                      {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="datetime-local" aria-label={`Start time for ${pn(m.homeId)} against ${pn(m.awayId)}`}
                      value={m.scheduledAt ? toLocalInput(m.scheduledAt) : ''}
                      onChange={ev => {
                        if (!ev.target.value) { patch(m.id, { scheduledAt: null }, `schedule.time ${m.id}`); return; }
                        const iso = new Date(ev.target.value).toISOString();
                        if (m.resourceId) assign(m.id, m.resourceId, iso, m.durationMin ?? DEFAULT_DURATION_MIN);
                        else patch(m.id, { scheduledAt: iso }, `schedule.time ${m.id}`);
                      }} />
                  </td>
                  <td className="num">
                    <input type="number" min={5} step={5} style={{ width: 72, textAlign: 'right' }} aria-label="Duration in minutes"
                      value={m.durationMin ?? DEFAULT_DURATION_MIN}
                      onChange={ev => patch(m.id, { durationMin: Number(ev.target.value) || DEFAULT_DURATION_MIN }, `schedule.duration ${m.id}`)} />
                  </td>
                  <td className="actions">
                    {scheduledById.has(m.id)
                      ? <button className="btn sm quiet" onClick={() => clearSlot(m.id)}>Clear time</button>
                      : <span className="muted" style={{ fontSize: 12 }}>not scheduled</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {entries.length > 0 && (
        <Panel title="Order of play" sub="What the hall marshals should call out.">
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 100 }}>Time</th><th style={{ width: 170 }}>Place</th><th>Match</th><th className="num">Min</th></tr></thead>
              <tbody>{entries.map(e => {
                const m = domain.matches.find(x => x.id === e.matchId);
                if (!m) return null;
                return (
                  <tr key={e.matchId}>
                    <td className="name">{new Date(e.start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="muted">{e.resourceName || '—'}</td>
                    <td>{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</td>
                    <td className="num muted">{e.durationMin}′</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Panel>
      )}
    </Page>
  );
}
