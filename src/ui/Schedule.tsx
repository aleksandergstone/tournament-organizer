// Venue scheduling — courts, tables, stations. Assign a place and a time to
// matches, see conflicts immediately, or let the planner fill the day for you.
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { resourcesOf } from '../engine/model';
import { detectConflicts, suggestSlots, toEntries, DEFAULT_DURATION_MIN } from '../engine/schedule';
import { ResourceKind, uid } from '../engine/types';

const KINDS: ResourceKind[] = ['court', 'table', 'station', 'board', 'lane', 'other'];

function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Schedule() {
  const { domain, update, go } = useApp();
  const resources = useMemo(() => resourcesOf(domain), [domain]);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? 'Unknown' : 'TBD');

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ResourceKind>('court');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [dayStart, setDayStart] = useState(() => toLocalInput(null));

  const conflicts = useMemo(() => detectConflicts(domain.matches, resources), [domain.matches, resources]);
  const entries = useMemo(() => toEntries(domain.matches, resources), [domain.matches, resources]);
  const playable = useMemo(() => domain.matches.filter(m => m.homeId && m.awayId), [domain.matches]);
  const unscheduled = useMemo(() => playable.filter(m => !m.scheduledAt), [playable]);
  const scheduledById = new Map(entries.map(e => [e.matchId, e]));

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
  const patch = (matchId: string, p: Record<string, unknown>, msg: string) =>
    update(d => ({ ...d, matches: d.matches.map(m => (m.id === matchId ? { ...m, ...p } : m)) }), msg);

  const autoFill = () => {
    if (resources.length === 0) { setErr('Add at least one court, table or station first.'); return; }
    if (unscheduled.length === 0) { setMsg('Every match already has a time.'); setErr(''); return; }
    const plan = suggestSlots(domain.matches, resources, {
      dayStart: new Date(dayStart).toISOString(),
      defaultDurationMin: DEFAULT_DURATION_MIN,
    });
    if (plan.length === 0) { setErr('No free slot found — add more places or start later.'); return; }
    setErr(''); setMsg(`Planned ${plan.length} match(es) without overlaps.`);
    update(d => ({
      ...d,
      matches: d.matches.map(m => {
        const p = plan.find(x => x.matchId === m.id);
        return p ? { ...m, resourceId: p.resourceId, venue: p.resourceName, scheduledAt: p.start, durationMin: p.durationMin } : m;
      }),
    }), `schedule.autofill ${plan.length}`);
  };

  return (
    <div className="wrap">
      <h1>Schedule — courts, tables, stations</h1>
      <p className="muted">Give every match a place and a time. Double-booking is reported, never hidden.</p>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h3>Places</h3>
        <div className="row">
          <input style={{ maxWidth: 220 }} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addResource()} placeholder="Court 1, Table 2, Ref station…" />
          <select style={{ maxWidth: 140 }} value={kind} onChange={e => setKind(e.target.value as ResourceKind)}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="btn primary" onClick={addResource}>Add place</button>
        </div>
        {resources.length === 0
          ? <div className="empty">No places yet. Add the courts, tables or stations this venue uses.</div>
          : (
            <table><tbody>{resources.map(r => (
              <tr key={r.id}>
                <td><b>{r.name}</b> <span className="muted">({r.kind})</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn sm danger" onClick={() => removeResource(r.id, r.name)}>Remove</button>
                </td>
              </tr>
            ))}</tbody></table>
          )}
      </div>

      {resources.length > 0 && (
        <div className="card">
          <h3>Plan the day</h3>
          <div className="row">
            <label className="f" style={{ maxWidth: 230 }}>Day starts at
              <input type="datetime-local" value={dayStart} onChange={e => setDayStart(e.target.value)} />
            </label>
            <button className="btn primary" onClick={autoFill} disabled={unscheduled.length === 0}>
              Fill free slots ({unscheduled.length} without a time)
            </button>
            <span className="muted">{DEFAULT_DURATION_MIN} min per match, never two matches at once on one place.</span>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="card">
          <h3>Conflicts ({conflicts.length})</h3>
          {conflicts.map((c, i) => <div key={i} className="err">{c.message}</div>)}
        </div>
      )}

      <div className="card">
        <h3>Matches</h3>
        {playable.length === 0
          ? <div className="empty">No matches yet. <button className="btn primary" onClick={() => go('rules')}>Generate the schedule first</button></div>
          : (
            <table>
              <thead><tr><th>Match</th><th>Place</th><th>Start</th><th>Min</th><th></th></tr></thead>
              <tbody>
                {playable.map(m => (
                  <tr key={m.id}>
                    <td>{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</td>
                    <td>
                      <select value={m.resourceId ?? ''} onChange={ev => {
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
                      <input type="datetime-local" value={m.scheduledAt ? toLocalInput(m.scheduledAt) : ''} onChange={ev => {
                        if (!ev.target.value) { patch(m.id, { scheduledAt: null }, `schedule.time ${m.id}`); return; }
                        const iso = new Date(ev.target.value).toISOString();
                        if (m.resourceId) assign(m.id, m.resourceId, iso, m.durationMin ?? DEFAULT_DURATION_MIN);
                        else patch(m.id, { scheduledAt: iso }, `schedule.time ${m.id}`);
                      }} />
                    </td>
                    <td>
                      <input type="number" min={5} step={5} style={{ width: 80 }} value={m.durationMin ?? DEFAULT_DURATION_MIN}
                        onChange={ev => patch(m.id, { durationMin: Number(ev.target.value) || DEFAULT_DURATION_MIN }, `schedule.duration ${m.id}`)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {scheduledById.has(m.id)
                        ? <button className="btn sm" onClick={() => clearSlot(m.id)}>Clear time</button>
                        : <span className="muted">not scheduled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {entries.length > 0 && (
        <div className="card">
          <h3>Order of play</h3>
          <table><tbody>{entries.map(e => {
            const m = domain.matches.find(x => x.id === e.matchId);
            if (!m) return null;
            return (
              <tr key={e.matchId}>
                <td style={{ width: 90 }}><b>{new Date(e.start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></td>
                <td style={{ width: 150 }}>{e.resourceName || '—'}</td>
                <td>{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</td>
                <td style={{ width: 70 }} className="muted">{e.durationMin}′</td>
              </tr>
            );
          })}</tbody></table>
        </div>
      )}
    </div>
  );
}
