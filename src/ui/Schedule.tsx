// Venue scheduling — courts, tables, stations. Assign a place and a time to
// matches, see conflicts immediately, or let the planner fill the day for you.
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { resourcesOf } from '../engine/model';
import { disciplineOf, venueLabel } from '../engine/discipline';
import { detectConflicts, suggestSlots, toEntries, DEFAULT_DURATION_MIN } from '../engine/schedule';
import { ResourceKind, uid } from '../engine/types';
import { Alert, Empty, Field, Page, Panel, Segmented } from './kit';
import { useT, type Dict } from '../i18n';

const KINDS: ResourceKind[] = ['court', 'table', 'station', 'board', 'lane', 'other'];
/** Labels are looked up per render, so they follow the chosen language. */
const KIND_KEYS: Record<ResourceKind, keyof Dict> = {
  court: 'sch.kindCourt', table: 'sch.kindTable', station: 'sch.kindStation',
  board: 'sch.kindBoard', lane: 'sch.kindLane', other: 'sch.kindOther',
};

function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Schedule() {
  const t = useT();
  const { domain, update, go, settings } = useApp();
  const resources = useMemo(() => resourcesOf(domain), [domain]);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const pn = (id: string | null) => (id ? names.get(id) ?? t('common.unknown') : t('common.tbd'));

  const [name, setName] = useState('');
  /**
   * The kind of place follows the discipline until the organizer picks one:
   * a regatta adds starts, a tennis event adds courts, table tennis adds
   * tables. A manual choice always wins — `null` means "not chosen", not "none".
   */
  const [chosenKind, setChosenKind] = useState<ResourceKind | null>(null);
  const kind = chosenKind ?? disciplineOf(domain.tournament).venueKind;
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
    if (!n) { setErr(t('sch.errName')); return; }
    if (resources.some(r => r.name.toLowerCase() === n.toLowerCase())) { setErr(t('sch.errExists', { name: n })); return; }
    setErr('');
    update(d => ({ ...d, resources: [...(d.resources ?? []), { id: uid('r'), name: n, kind }] }), `resource.add ${n}`);
    setName('');
  };
  const removeResource = (id: string, n: string) => {
    // Matches keep their time but lose the assignment — never silently kept.
    if (settings.confirmDestructive && !window.confirm(t('sch.removePlaceConfirm', { name: n }))) return;
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
    if (resources.length === 0) { setErr(t('sch.errNoPlaces')); return; }
    if (unscheduled.length === 0) { setMsg(t('sch.msgAllScheduled')); setErr(''); return; }
    const plan = suggestSlots(domain.matches, resources, {
      dayStart: new Date(dayStart).toISOString(),
      defaultDurationMin: DEFAULT_DURATION_MIN,
    });
    if (plan.length === 0) { setErr(t('sch.errNoSlot')); return; }
    setErr(''); setMsg(t(plan.length === 1 ? 'sch.autofilledOne' : 'sch.autofilled', { n: plan.length }));
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
      title={t('sch.titleFull')}
      sub={t('sch.sub')}
    >
      {msg && <Alert tone="ok" title={t('sch.updated')}>{msg}</Alert>}
      {err && <Alert tone="err" title={t('common.nothingChanged')}>{err}</Alert>}

      {conflicts.length > 0 && (
        <Alert tone="err" title={t(conflicts.length === 1 ? 'sch.conflictCountOne' : 'sch.conflictCount', { n: conflicts.length })}>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
          </ul>
        </Alert>
      )}

      {/* The discipline's own word for a place: courts, tables, boards or starts.
          The sub-line stays neutral, because it explains what the list is for
          rather than naming it. */}
      <Panel title={venueLabel(domain.tournament)} sub={t('sch.placesSub')}>
        <div className="row">
          <input className="search" style={{ maxWidth: 240 }} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addResource()} placeholder={t('sch.placePlaceholder')} aria-label={t('sch.placeName')} />
          <select style={{ maxWidth: 150 }} value={kind} onChange={e => setChosenKind(e.target.value as ResourceKind)} aria-label={t('sch.placeType')}>
            {KINDS.map(k => <option key={k} value={k}>{t(KIND_KEYS[k])}</option>)}
          </select>
          <button className="btn primary" onClick={addResource}>{t('sch.addPlace')}</button>
        </div>
        {resources.length === 0 ? (
          <Empty
            title={t('sch.noPlaces')}
            hint={t('sch.noPlacesHint')}
          />
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>{t('common.place')}</th><th>{t('sch.colType')}</th><th className="num">{t('common.matches')}</th><th /></tr></thead>
              <tbody>{resources.map(r => (
                <tr key={r.id}>
                  <td className="name">{r.name}</td>
                  <td className="muted">{t(KIND_KEYS[r.kind])}</td>
                  <td className="num muted">{domain.matches.filter(m => m.resourceId === r.id).length}</td>
                  <td className="actions">
                    <button className="btn sm quiet" onClick={() => removeResource(r.id, r.name)}>{t('common.remove')}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {resources.length > 0 && (
        <Panel title={t('sch.planned')} sub={t('sch.minutesPerMatch', { n: DEFAULT_DURATION_MIN })}>
          <div className="row">
            <Field label={t('sch.dayStart')}>
              <input type="datetime-local" value={dayStart} onChange={e => setDayStart(e.target.value)} />
            </Field>
            <span className="sp" />
            <button className="btn primary" onClick={autoFill} disabled={unscheduled.length === 0}>
              {t('sch.fillSlots', { n: unscheduled.length })}
            </button>


          </div>
          <p className="table-note">
            {unscheduled.length === 0
              ? t('sch.allHaveTime')
              : t('sch.pending', { n: unscheduled.length, total: playable.length })}
          </p>
        </Panel>
      )}
      <Panel
        title={t('common.matches')}
        sub={t('sch.assignmentsSub')}
        actions={playable.length > 0 ? (
          <Segmented
            value={onlyFree ? 'free' : 'all'}
            onChange={v => setOnlyFree(v === 'free')}
            options={[{ id: 'all', label: t('res.all') }, { id: 'free', label: t('sch.noTime', { n: unscheduled.length }) }]}
            label={t('common.matchFilter')}
          />
        ) : undefined}
      >
        {playable.length === 0 ? (
          <Empty
            title={t('sch.noMatches')}
            hint={t('sch.noMatchesHint')}
            action={<button className="btn primary" onClick={() => go('rules')}>{t('bracket.goRules')}</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>{t('sch.matchCol')}</th><th style={{ width: 170 }}>{t('common.place')}</th><th style={{ width: 210 }}>{t('sch.startCol')}</th>
                <th className="num" style={{ width: 80 }}>{t('sch.minCol')}</th><th />
              </tr></thead>
              <tbody>{rows.map(m => (
                <tr key={m.id}>
                  <td className="name">{m.roundName}: {pn(m.homeId)} vs {pn(m.awayId)}</td>
                  <td>
                    <select value={m.resourceId ?? ''} aria-label={t('sch.placeFor', { home: pn(m.homeId), away: pn(m.awayId) })}
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
                    <input type="datetime-local" aria-label={t('sch.startFor', { home: pn(m.homeId), away: pn(m.awayId) })}
                      value={m.scheduledAt ? toLocalInput(m.scheduledAt) : ''}
                      onChange={ev => {
                        if (!ev.target.value) { patch(m.id, { scheduledAt: null }, `schedule.time ${m.id}`); return; }
                        const iso = new Date(ev.target.value).toISOString();
                        if (m.resourceId) assign(m.id, m.resourceId, iso, m.durationMin ?? DEFAULT_DURATION_MIN);
                        else patch(m.id, { scheduledAt: iso }, `schedule.time ${m.id}`);
                      }} />
                  </td>
                  <td className="num">
                    <input type="number" min={5} step={5} style={{ width: 72, textAlign: 'right' }} aria-label={t('common.duration')}
                      value={m.durationMin ?? DEFAULT_DURATION_MIN}
                      onChange={ev => patch(m.id, { durationMin: Number(ev.target.value) || DEFAULT_DURATION_MIN }, `schedule.duration ${m.id}`)} />
                  </td>
                  <td className="actions">
                    {scheduledById.has(m.id)
                      ? <button className="btn sm quiet" onClick={() => clearSlot(m.id)}>{t('sch.clearTime')}</button>
                      : <span className="muted" style={{ fontSize: 12 }}>{t('sch.notScheduled')}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {entries.length > 0 && (
        <Panel title={t('sch.orderOfPlay')} sub={t('sch.orderOfPlaySub')}>
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 100 }}>{t('common.time')}</th><th style={{ width: 170 }}>{t('common.place')}</th><th>{t('sch.matchCol')}</th><th className="num">{t('sch.minCol')}</th></tr></thead>
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
