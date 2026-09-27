import { useApp } from '../state/store';

export default function Overview() {
  const { domain, standings, go } = useApp();
  const t = domain.tournament;
  const played = domain.matches.filter(m => ['played','draw','walkover','overtime'].includes(m.result.status)).length;
  return (
    <div className="wrap">
      <h1>{t.name || '(untitled)'}</h1>
      <p className="muted">{t.sport} · {t.format} · {domain.participants.length} participants · {domain.matches.length} matches ({played} played)</p>
      <div className="grid2">
        <div className="card"><h3>Top 5</h3><table><tbody>
          {standings.slice(0,5).map(s => <tr key={s.participantId}><td>#{s.rank}</td><td>{nm(domain, s.participantId)}</td><td>{s.points} pts</td></tr>)}
        </tbody></table>{standings.length === 0 && (
          <div className="empty">No standings yet — add participants, generate the bracket, then enter results.</div>
        )}</div>
        <div className="card"><h3>Next steps</h3><div className="row">
          <button className="btn" onClick={() => go('participants')}>Participants</button>
          <button className="btn" onClick={() => go('rules')}>Rules</button>
          <button className="btn" onClick={() => go('bracket')}>Bracket</button>
          <button className="btn primary" onClick={() => go('matches')}>Enter results</button>
          <button className="btn" onClick={() => go('export')}>Export</button>
        </div></div>
      </div>
      <div className="card"><h3>History ({domain.audit.length})</h3>
        <table><tbody>{[...domain.audit].reverse().slice(0,20).map(a => <tr key={a.id}><td className="muted">{new Date(a.at).toLocaleString()}</td><td>{a.action}</td><td className="muted">{a.detail ?? ''}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
function nm(d: { participants: { id: string; name: string }[] }, id: string) { return d.participants.find(p => p.id === id)?.name ?? '?'; }
