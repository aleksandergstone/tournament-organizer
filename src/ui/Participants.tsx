import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { applyWithdrawals } from '../engine/result';
import { Participant, uid } from '../engine/types';
import { Alert, Empty, Page, Panel, Toolbar } from './kit';

export default function Participants() {
  const { domain, update, go, settings } = useApp();
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) { setErr('Type a name first, then press Add.'); return; }
    setErr('');
    update(d => ({ ...d, participants: [...d.participants, { id: uid('p'), name: n, kind: d.tournament.individualOrTeam === 'team' ? 'team' : 'player', tags: [], seed: d.participants.length + 1, active: true, withdrawnRound: null, avatar: null }] }), 'participant.add ' + n);
    setName('');
  };
  const addBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) { setErr('Paste at least one name — one name per line.'); return; }
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
    if (settings.confirmDestructive && !window.confirm(`Remove "${n}" from the participant list?\n\nMatches already played keep their history.`)) return;
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
      title="Participants"
      sub={`${active} active of ${domain.participants.length}${domain.matches.length ? ' · the bracket is already generated' : ''}`}
      actions={<button className="btn primary" disabled={domain.participants.length < 2} onClick={() => go('rules')}>Continue → rules</button>}
    >
      {err && <Alert tone="err" title="Nothing was added">{err}</Alert>}

      <Panel title="Add players" sub="Type a name and press Enter — or paste a whole list at once.">
        <div className="row">
          <input className="search" style={{ maxWidth: 320 }} value={name} autoFocus
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Player or team name + Enter" aria-label="New participant name" />
          <button className="btn primary" onClick={add}>Add</button>
          <span className="sp" />
          <button className="btn quiet" onClick={() => setShowBulk(v => !v)} aria-expanded={showBulk}>
            {showBulk ? 'Hide list' : 'Paste a list…'}
          </button>
        </div>
        {showBulk && (
          <div style={{ marginTop: 12 }}>
            <textarea rows={5} value={bulk} onChange={e => setBulk(e.target.value)}
              placeholder={'Alice\nBob\nTeam X'} aria-label="Paste one name per line" />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={addBulk}>Add all names</button>
              <span className="muted">One name per line — empty lines are skipped.</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Participant list" sub="Click any name to rename it. Withdraw ejects a player from unplayed matches.">
        {domain.participants.length === 0 ? (
          <Empty
            title="No participants yet"
            hint="Add them one at a time above, or paste a whole list. You need at least two to generate a bracket."
            action={<button className="btn" onClick={() => setShowBulk(true)}>Paste a list</button>}
          />
        ) : (
          <>
            <Toolbar>
              <input className="search" type="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Filter by name or tag" aria-label="Filter participants" />
              <span className="sp" />
              <span className="count">{shown.length} of {domain.participants.length} shown</span>
            </Toolbar>
            {dupes > 0 && (
              <Alert tone="warn" title={`${dupes} duplicate name${dupes > 1 ? 's' : ''}`}>
                Duplicates are allowed and never blocked — check the seed order below before generating.
              </Alert>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th className="rank">#</th><th>Name</th><th className="num" style={{ width: 84 }}>Seed</th>
                  <th style={{ width: 150 }}>Tags</th><th style={{ width: 110 }}>Status</th><th />
                </tr></thead>
                <tbody>{shown.map(p => {
                  const i = domain.participants.indexOf(p);
                  return (
                    <tr key={p.id} className={p.active ? '' : 'dim'}>
                      <td className="rank">{i + 1}</td>
                      <td><input className="cell-input" value={p.name} aria-label={`Name of ${p.name}`}
                        onChange={e => edit(p.id, { name: e.target.value })} /></td>
                      <td className="num"><input className="cell-input" type="number" style={{ width: 66, textAlign: 'right' }}
                        value={p.seed ?? ''} aria-label={`Seed of ${p.name}`}
                        onChange={e => edit(p.id, { seed: e.target.value ? Number(e.target.value) : undefined })} /></td>
                      <td><input className="cell-input" value={p.tags.join(', ')} placeholder="—" aria-label={`Tags of ${p.name}`}
                        onChange={e => edit(p.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></td>
                      <td>{p.active
                        ? <span className="pill pill-ok">Active</span>
                        : <span className="pill pill-warn">Withdrawn</span>}</td>
                      <td className="actions">
                        <button className="btn sm" onClick={() => edit(p.id, { active: !p.active })}
                          title={p.active ? 'Eject from unplayed matches (opponent gets a walkover)' : 'Make active again'}>
                          {p.active ? 'Withdraw' : 'Re-activate'}
                        </button>{' '}
                        <button className="btn sm quiet" onClick={() => remove(p.id, p.name)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {shown.length === 0 && <p className="table-note">Nothing matches “{q}”.</p>}
          </>
        )}
      </Panel>

      <div className="footbar">
        <span className="muted">
          {domain.participants.length < 2
            ? 'Add at least 2 participants to continue.'
            : 'Next: check the format and scoring, then generate the bracket.'}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('overview')}>Overview</button>
        <button className="btn primary" disabled={domain.participants.length < 2} onClick={() => go('rules')}>Continue → rules</button>
      </div>
    </Page>
  );
}
