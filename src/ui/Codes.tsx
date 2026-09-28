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
import { useT } from '../i18n';

const TABS: { id: DeepLinkKind; label: string; hint: string }[] = [
  { id: 'checkin', label: 'Check-in', hint: 'One code per participant — scanning marks them present.' },
  { id: 'match', label: 'Match', hint: 'Opens the result screen for exactly that match.' },
  { id: 'station', label: 'Station', hint: 'Opens the schedule of one court, table or station.' },
];

export default function Codes() {
  const t = useT();
  const { domain, update, go } = useApp();
  const resources = useMemo(() => resourcesOf(domain), [domain]);
  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const [tab, setTab] = useState<DeepLinkKind>('checkin');
  const [selected, setSelected] = useState<string>('');
  const [img, setImg] = useState<string>('');
  const [err, setErr] = useState('');

  const items = useMemo(() => {
    if (tab === 'checkin') return domain.participants.map(p => ({ id: p.id, label: p.name, sub: p.active ? t('codes.subActive') : t('codes.subWithdrawn') }));
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
      .catch(e => { if (alive) setErr(t('codes.renderErrorBody', { message: e.message })); });
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
          <h1>{t('codes.title')}</h1>
          <p className="page-sub">{t('codes.sub')}</p>
        </div>
      </header>
      {err && <Alert tone="err" title={t('codes.renderError')}>{err}</Alert>}

      <Toolbar>
        <Segmented
          value={tab}
          onChange={v => { setTab(v); setSelected(''); }}
          options={TABS.map(t => ({ id: t.id, label: t.label }))}
          label={t('codes.type')}
        />
        <span className="muted">{TABS.find(t => t.id === tab)?.hint}</span>
      </Toolbar>

      {items.length === 0 ? (
        <Empty
          title={tab === 'station' ? t('codes.emptyPlaces')
            : tab === 'match' ? t('codes.emptyMatches')
              : t('codes.emptyParticipants')}
          hint={tab === 'station'
            ? t('codes.emptyPlacesHint')
            : tab === 'match'
              ? t('codes.emptyMatchesHint')
              : t('codes.emptyParticipantsHint')}
          action={tab === 'station'
            ? <button className="btn primary" onClick={() => go('schedule')}>{t('codes.addPlaces')}</button>
            : tab === 'match'
              ? <button className="btn primary" onClick={() => go('rules')}>{t('codes.generateSchedule')}</button>
              : <button className="btn primary" onClick={() => go('participants')}>{t('codes.addParticipants')}</button>}
        />
      ) : (
        <div className="grid2">
          <Panel title={tab === 'checkin' ? t('codes.who') : tab === 'match' ? t('codes.whichMatch') : t('codes.whichPlace')}
            sub={t('codes.pickRow')}>
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
              ? <img src={img} alt={t('codes.alt', { label: current?.label ?? '' })} style={{ width: 260, height: 260 }} />
              : <div className="empty" style={{ padding: 20 }}>{t('codes.noCode')}</div>}
            <div className="code-link">{text}</div>
            <div className="row">
              <button className="btn" onClick={() => window.print()}>{t('codes.printCode')}</button>
              {tab === 'checkin' && current && (
                <button className="btn primary" onClick={() => checkIn(current.id, current.label)}>{t('codes.markCheckedIn')}</button>
              )}
              {tab === 'match' && <button className="btn" onClick={() => go('matches')}>{t('codes.goResults')}</button>}
              {tab === 'station' && <button className="btn" onClick={() => go('schedule')}>{t('codes.goSchedule')}</button>}
            </div>
            <p className="table-note">{t('codes.note')}</p>
          </section>
        </div>
      )}
    </div>
  );
}
