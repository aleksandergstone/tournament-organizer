// QR codes — generated on this machine, no service involved.
//
// A code carries a local identifier (to://<project>/<kind>/<id>). Scanning it
// on a phone that has the desktop app pointed at this machine, or opening the
// text, jumps straight to the participant, match or station.
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state/store';
import { resourcesOf } from '../engine/model';
import { formatDeepLink, DeepLinkKind } from '../engine/deeplink';
import { nowIso } from '../engine/types';
import { Alert, Empty, Panel, Segmented, Toolbar, statusLabel } from './kit';

const TABS: { id: DeepLinkKind; label: string; hint: string }[] = [
  { id: 'checkin', label: 'Check-in', hint: 'One code per participant — scanning marks them present.' },
  { id: 'match', label: 'Match', hint: 'Opens the result screen for exactly that match.' },
  { id: 'station', label: 'Station', hint: 'Opens the schedule of one court, table or station.' },
];

export default function Codes() {
  const { domain, update, go } = useApp();
  const resources = useMemo(() => resourcesOf(domain), [domain]);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const [tab, setTab] = useState<DeepLinkKind>('checkin');
  const [selected, setSelected] = useState<string>('');
  const [img, setImg] = useState<string>('');
  const [err, setErr] = useState('');

  const items = useMemo(() => {
    if (tab === 'checkin') return domain.participants.map(p => ({ id: p.id, label: p.name, sub: p.active ? 'active' : 'withdrawn' }));
    if (tab === 'match') return domain.matches.filter(m => m.homeId && m.awayId).map(m => ({
      id: m.id,
      label: `${m.roundName}: ${names.get(m.homeId!) ?? 'TBD'} vs ${names.get(m.awayId!) ?? 'TBD'}`,
      sub: m.result.status,
    }));
    return resources.map(r => ({ id: r.id, label: r.name, sub: r.kind }));
  }, [tab, domain.participants, domain.matches, resources, names]);

  const current = items.find(i => i.id === selected) ?? items[0];
  const text = current ? formatDeepLink({ projectId: domain.tournament.id, kind: tab, id: current.id }) : '';

  useEffect(() => {
    let alive = true;
    if (!text) { setImg(''); return; }
    QRCode.toDataURL(text, { margin: 1, width: 320 })
      .then(url => { if (alive) { setImg(url); setErr(''); } })
      .catch(e => { if (alive) setErr(`Could not render the code: ${e.message}`); });
    return () => { alive = false; };
  }, [text]);

  const checkIn = (id: string, name: string) => {
    update(d => ({
      ...d,
      participants: d.participants.map(p => (p.id === id
        ? { ...p, active: true, withdrawnRound: null, modifiedAt: nowIso() }
        : p)),
    }), `checkin ${name}`);
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <div className="page-head-text">
          <h1>QR codes</h1>
          <p className="page-sub">Codes are generated on this computer and only point at this project — nothing is uploaded.</p>
        </div>
      </header>
      {err && <Alert tone="err" title="The code could not be drawn">{err}</Alert>}

      <Toolbar>
        <Segmented
          value={tab}
          onChange={v => { setTab(v); setSelected(''); }}
          options={TABS.map(t => ({ id: t.id, label: t.label }))}
          label="Code type"
        />
        <span className="muted">{TABS.find(t => t.id === tab)?.hint}</span>
      </Toolbar>

      {items.length === 0 ? (
        <Empty
          title={tab === 'station' ? 'No places defined yet'
            : tab === 'match' ? 'No matches yet'
              : 'No participants yet'}
          hint={tab === 'station'
            ? 'Add your courts, tables or stations first — each one gets its own code.'
            : tab === 'match'
              ? 'Generate the bracket first, then every match can get a code that opens exactly that match.'
              : 'Add the players or teams first, then each one gets a check-in code.'}
          action={tab === 'station'
            ? <button className="btn primary" onClick={() => go('schedule')}>Add courts or stations</button>
            : tab === 'match'
              ? <button className="btn primary" onClick={() => go('rules')}>Generate the schedule</button>
              : <button className="btn primary" onClick={() => go('participants')}>Add participants</button>}
        />
      ) : (
        <div className="grid2">
          <Panel title={tab === 'checkin' ? 'Who to check in' : tab === 'match' ? 'Which match' : 'Which place'}
            sub="Pick a row to see its code.">
            <div className="table-wrap pick-list">
              <table>
                <tbody>{items.map(i => (
                  <tr key={i.id} className={'selectable' + (current?.id === i.id ? ' selected' : '')}
                    onClick={() => setSelected(i.id)}>
                    <td className="name">{i.label}</td>
                    <td className="muted" style={{ textAlign: 'right', width: 120 }}>{statusLabel(i.sub)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Panel>

          <section className="card code-card">
            <div className="code-title">{current?.label}</div>
            {img
              ? <img src={img} alt={`QR code for ${current?.label}`} style={{ width: 260, height: 260 }} />
              : <div className="empty" style={{ padding: 20 }}>No code for this target yet.</div>}
            <div className="code-link">{text}</div>
            <div className="row">
              <button className="btn" onClick={() => window.print()}>Print code</button>
              {tab === 'checkin' && current && (
                <button className="btn primary" onClick={() => checkIn(current.id, current.label)}>Mark checked in</button>
              )}
              {tab === 'match' && <button className="btn" onClick={() => go('matches')}>Go to results</button>}
              {tab === 'station' && <button className="btn" onClick={() => go('schedule')}>Go to schedule</button>}
            </div>
            <p className="table-note">Scanning opens this project on the same computer. Print the code and stick it to the court or the desk.</p>
          </section>
        </div>
      )}
    </div>
  );
}
