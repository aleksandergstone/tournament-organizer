import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { applyWithdrawals } from '../engine/result';
import { Participant, uid } from '../engine/types';
import { Alert, Empty, Page, Panel, Toolbar } from './kit';
import { useT } from '../i18n';

export default function Participants() {
  const { domain, update, go, settings } = useApp();
  const t = useT();
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) { setErr(t('part.errName')); return; }
    setErr('');
    update(d => ({ ...d, participants: [...d.participants, { id: uid('p'), name: n, kind: d.tournament.individualOrTeam === 'team' ? 'team' : 'player', tags: [], seed: d.participants.length + 1, active: true, withdrawnRound: null, avatar: null }] }), 'participant.add ' + n);
    setName('');
  };
  const addBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) { setErr(t('part.errBulk')); return; }
    setErr('');
    update(d => ({ ...d, participants: [...d.participants, ...names.map((n, i) => ({ id: uid('p'), name: n, kind: (d.tournament.individualOrTeam === 'team' ? 'team' : 'player') as Participant['kind'], tags: [], seed: d.participants.length + i + 1, active: true as boolean, withdrawnRound: null, avatar: null }))] }), `participants.bulk ${names.length}`);
    setBulk('');
    setShowBulk(false);
  };
  const edit = (id: string, patch: Partial<Participant>) =>
    update(d => {
      const participants = d.participants.map(p => p.id === id ? { ...p, ...patch } : p);
      // Withdrawal ejects the occupant from unplayed matches (walkover for the
      // opponent); re-activation does NOT auto-restore — organizer re-seeds or
      // edits explicitly. Played history is always kept (identity is id-based).
      if (patch.active === false) {
        const w = applyWithdrawals(d.matches, new Set([id]));
        return { ...d, participants, matches: w.matches };
      }
      return { ...d, participants };
    }, 'participant.edit');
  const remove = (id: string, n: string) => {
    if (settings.confirmDestructive && !window.confirm(t('part.removeConfirm', { name: n }))) return;
    update(d => ({ ...d, participants: d.participants.filter(p => p.id !== id) }), 'participant.remove ' + n);
  };

  const active = domain.participants.filter(p => p.active).length;
  const dupes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of domain.participants) {
      const k = p.name.trim().toLowerCase();
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return [...seen.values()].filter(c => c > 1).reduce((a, c) => a + c, 0);
  }, [domain.participants]);
  const shown = q
    ? domain.participants.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.tags.join(' ').toLowerCase().includes(q.toLowerCase()))
    : domain.participants;
  return (
    <Page
      title={t('part.title')}
      sub={t('part.sub', { active, total: domain.participants.length, bracket: domain.matches.length ? t('part.subBracket') : '' })}
      actions={<button className="btn primary" disabled={domain.participants.length < 2} onClick={() => go('rules')}>{t('part.continueRules')}</button>}
    >
      {err && <Alert tone="err" title={t('part.notAdded')}>{err}</Alert>}

      <Panel title={t('part.addPanel')} sub={t('part.addPanelSub')}>
        <div className="row">
          <input className="search" style={{ maxWidth: 320 }} value={name} autoFocus
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={t('part.namePlaceholder')} aria-label={t('part.namePlaceholder')} />
          <button className="btn primary" onClick={add}>{t('part.add')}</button>
          <span className="sp" />
          <button className="btn quiet" onClick={() => setShowBulk(v => !v)} aria-expanded={showBulk}>
            {showBulk ? t('common.close') : t('part.pasteList')}
          </button>
        </div>
        {showBulk && (
          <div style={{ marginTop: 12 }}>
            <textarea rows={5} value={bulk} onChange={e => setBulk(e.target.value)}
              placeholder={t('part.bulkPlaceholder')} aria-label={t('part.bulkTitle')} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={addBulk}>{t('part.bulkAdd')}</button>
              <span className="muted">{t('part.bulkSub')}</span>
            </div>
          </div>
        )}
      </Panel>

      {/* Titled for what it shows. It used to carry the paste-a-list heading and its
          "one name per line" sub-line, which described a feature that lives in
          the panel above — a heading that lies about its own contents is worse
          than no heading. */}
      <Panel title={t('part.listTitle')}>
        {domain.participants.length === 0 ? (
          <Empty
            title={t('part.emptyTitle')}
            hint={t('part.emptyHint')}
            action={<button className="btn" onClick={() => setShowBulk(true)}>{t('part.pasteList')}</button>}
          />
        ) : (
          <>
            <Toolbar>
              <input className="search" type="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder={t('part.filter')} aria-label={t('part.filter')} />
              <span className="sp" />
              <span className="count">{t('part.shown', { shown: shown.length, total: domain.participants.length })}</span>
            </Toolbar>
            {dupes > 0 && (
              <Alert tone="warn" title={dupes > 1 ? t('part.dupesPlural', { n: dupes }) : t('part.dupes', { n: dupes })}>
                {t('part.dupesHint')}
              </Alert>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th className="rank">#</th><th>{t('common.name')}</th><th className="num" style={{ width: 84 }}>{t('common.seed')}</th>
                  <th style={{ width: 150 }}>{t('common.tags')}</th><th style={{ width: 110 }}>{t('common.status')}</th><th />
                </tr></thead>
                <tbody>{shown.map(p => {
                  const i = domain.participants.indexOf(p);
                  return (
                    <tr key={p.id} className={p.active ? '' : 'dim'}>
                      <td className="rank">{i + 1}</td>
                      <td><input className="cell-input" value={p.name} aria-label={t('part.nameOf', { name: p.name })}
                        onChange={e => edit(p.id, { name: e.target.value })} /></td>
                      <td className="num"><input className="cell-input" type="number" style={{ width: 66, textAlign: 'right' }}
                        value={p.seed ?? ''} aria-label={t('part.seedOf', { name: p.name })}
                        onChange={e => edit(p.id, { seed: e.target.value ? Number(e.target.value) : undefined })} /></td>
                      <td><input className="cell-input" value={p.tags.join(', ')} placeholder="—" aria-label={t('part.tagsOf', { name: p.name })}
                        onChange={e => edit(p.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></td>
                      <td>{p.active
                        ? <span className="pill pill-ok">{t('status.active')}</span>
                        : <span className="pill pill-warn">{t('status.withdrawn')}</span>}</td>
                      <td className="actions">
                        <button className="btn sm" onClick={() => edit(p.id, { active: !p.active })}
                          title={p.active ? t('part.ejectTitle') : t('part.reactivateTitle')}>
                          {p.active ? t('part.withdraw') : t('part.reactivate')}
                        </button>{' '}
                        <button className="btn sm quiet" onClick={() => remove(p.id, p.name)}>{t('common.remove')}</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {shown.length === 0 && <p className="table-note">{t('part.nothingMatches', { q })}</p>}
          </>
        )}
      </Panel>

      <div className="footbar">
        <span className="muted">
          {domain.participants.length < 2
            ? t('part.needTwo')
            : t('part.nextHint')}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('overview')}>{t('nav.overview')}</button>
        <button className="btn primary" disabled={domain.participants.length < 2} onClick={() => go('rules')}>{t('part.continueRules')}</button>
      </div>
    </Page>
  );
}
