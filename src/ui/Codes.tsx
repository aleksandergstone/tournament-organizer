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
      <h1>QR codes</h1>
      <p className="muted">Codes are generated locally and only point at this project — nothing is uploaded.</p>
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'btn primary' : 'btn'} onClick={() => { setTab(t.id); setSelected(''); }}>
            {t.label}
          </button>
        ))}
        <span className="muted">{TABS.find(t => t.id === tab)?.hint}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          {tab === 'station'
            ? <>No places defined yet. <button className="btn primary" onClick={() => go('schedule')}>Add courts or stations</button></>
            : tab === 'match'
              ? <>No matches yet. <button className="btn primary" onClick={() => go('rules')}>Generate the schedule</button></>
              : <>No participants yet. <button className="btn primary" onClick={() => go('participants')}>Add participants</button></>}
        </div>
      ) : (
        <div className="grid2">
          <div className="card">
            <h3>Pick a target</h3>
            <table><tbody>{items.map(i => (
              <tr key={i.id} onClick={() => setSelected(i.id)} style={{ cursor: 'pointer', background: current?.id === i.id ? '#f0f7ff' : undefined }}>
                <td><b>{i.label}</b></td>
                <td className="muted" style={{ textAlign: 'right', width: 110 }}>{i.sub}</td>
              </tr>
            ))}</tbody></table>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>{current?.label}</h3>
            {img ? <img src={img} alt={`QR code for ${current?.label}`} style={{ width: 280, height: 280 }} /> : <p className="muted">No code.</p>}
            <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{text}</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn" onClick={() => window.print()}>Print</button>
              {tab === 'checkin' && current && (
                <button className="btn primary" onClick={() => checkIn(current.id, current.label)}>Mark checked in</button>
              )}
              {tab === 'match' && <button className="btn" onClick={() => go('matches')}>Go to results</button>}
              {tab === 'station' && <button className="btn" onClick={() => go('schedule')}>Go to schedule</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
