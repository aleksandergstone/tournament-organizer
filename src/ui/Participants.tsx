import { useState } from 'react';
import { useApp } from '../state/store';
import { applyWithdrawals } from '../engine/result';
import { Participant, uid } from '../engine/types';

export default function Participants() {
  const { domain, update, go } = useApp();
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const add = () => {
    const n = name.trim(); if (!n) return;
    update(d => ({ ...d, participants: [...d.participants, { id: uid('p'), name: n, kind: d.tournament.individualOrTeam === 'team' ? 'team' : 'player', tags: [], seed: d.participants.length + 1, active: true, withdrawnRound: null, avatar: null }] }), 'participant.add ' + n);
    setName('');
  };
  const addBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    update(d => ({ ...d, participants: [...d.participants, ...names.map((n, i) => ({ id: uid('p'), name: n, kind: (d.tournament.individualOrTeam === 'team' ? 'team' : 'player') as Participant['kind'], tags: [], seed: d.participants.length + i + 1, active: true as boolean, withdrawnRound: null, avatar: null }))] }), `participants.bulk ${names.length}`);
    setBulk('');
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
    update(d => ({ ...d, participants: d.participants.filter(p => p.id !== id) }), 'participant.remove ' + n);
  };
  return (
    <div className="wrap">
      <h1>Participants ({domain.participants.length})</h1>
      <div className="card"><div className="row">
        <input style={{ maxWidth: 300 }} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Name + Enter" />
        <button className="btn primary" onClick={add}>Add</button>
        <span className="muted">Duplicates allowed — flagged, never blocked.</span>
      </div></div>
      <div className="card"><h3>Paste list (one per line)</h3>
        <textarea rows={4} value={bulk} onChange={e => setBulk(e.target.value)} placeholder={'Alice\nBob\nTeam X'} />
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={addBulk}>Add all</button></div>
      </div>
      <div className="card"><table><thead><tr><th>#</th><th>Name</th><th>Seed</th><th>Tags</th><th>Status</th><th></th></tr></thead>
        <tbody>{domain.participants.map((p, i) => (
          <tr key={p.id}>
            <td>{i + 1}</td>
            <td><input value={p.name} onChange={e => edit(p.id, { name: e.target.value })} /></td>
            <td><input type="number" style={{ width: 70 }} value={p.seed ?? ''} onChange={e => edit(p.id, { seed: e.target.value ? Number(e.target.value) : undefined })} /></td>
            <td><input value={p.tags.join(', ')} onChange={e => edit(p.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="tag1, tag2" /></td>
            <td>{p.active ? <span className="pill">active</span> : <span className="pill wo">withdrawn</span>}</td>
            <td className="row">
              <button className="btn sm" onClick={() => edit(p.id, { active: !p.active })}>{p.active ? 'Withdraw' : 'Re-activate'}</button>
              <button className="btn sm danger" onClick={() => remove(p.id, p.name)}>Remove</button>
            </td>
          </tr>
        ))}</tbody></table>
        {domain.participants.length === 0 && (
          <div className="empty">
            No participants yet — add names one by one above, or paste a whole list under “Paste list”.
          </div>
        )}
      </div>
      <div className="row"><button className="btn primary" onClick={() => go('rules')}>Continue → rules</button><button className="btn" onClick={() => go('overview')}>Overview</button></div>
    </div>
  );
}
