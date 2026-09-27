import { useApp } from '../state/store';
import { Match } from '../engine/types';

export default function Bracket() {
  const { domain, go } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const pn = (id: string | null) => (id ? names.get(id) ?? 'Unknown (renamed?)' : 'TBD');
  if (domain.matches.length === 0) return <div className="wrap"><h1>Bracket / schedule</h1><div className="empty">Nothing generated yet. <button className="btn primary" onClick={() => go('rules')}>Go to rules → generate</button></div></div>;
  const fmt = domain.tournament.format;
  if (fmt === 'double-elimination') return <DoubleView names={names} pn={pn} />;
  if (fmt === 'groups-knockout' && domain.groups.length > 0) return <GroupsKoView pn={pn} />;
  const rounds = [...new Set(domain.matches.map(m => m.round))].sort((a,b) => a-b);
  const byR = (r: number) => domain.matches.filter(m => m.round === r);
  const elim = fmt === 'single-elimination';
  return (
    <div className="wrap">
      <h1>Bracket / schedule ({domain.matches.length})</h1>
      {elim ? (
        <div className="bracket">{rounds.map(r => (
          <div className="bround" key={r}><h3>{byR(r)[0]?.roundName ?? ('Round '+r)}</h3>
            {byR(r).map(m => <MCard key={m.id} m={m} pn={pn} />)}
          </div>))}
        </div>
      ) : (
        <div className="card"><table><thead><tr><th>Round</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>{domain.matches.map(m => (
          <tr key={m.id}><td>{m.roundName}</td><td>{pn(m.homeId)}</td><td>{pn(m.awayId)}</td>
          <td>{m.result.homeScore ?? '–'} : {m.result.awayScore ?? '–'}</td><td><St m={m} /></td></tr>))}
        </tbody></table></div>
      )}
      <div className="row"><button className="btn primary" onClick={() => go('matches')}>Enter results</button><button className="btn" onClick={() => go('standings')}>Standings</button></div>
    </div>
  );
}
function GroupsKoView({ pn }: { pn: (id: string | null) => string }) {
  const { domain, go } = useApp();
  const groupMs = domain.matches.filter(m => m.groupId != null);
  const koMs = domain.matches.filter(m => m.groupId == null);
  const rounds = [...new Set(koMs.map(m => m.round))].sort((a, b) => a - b);
  const done = groupMs.filter(m => ['played','draw','walkover','overtime'].includes(m.result.status)).length;
  return (
    <div className="wrap">
      <h1>Groups → knockout ({domain.matches.length})</h1>
      <div className="card">
        <h3>Group stage ({done}/{groupMs.filter(m => m.result.status !== 'bye').length} played)</h3>
        <table><thead><tr><th>Round</th><th>Group</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>{groupMs.map(m => (
          <tr key={m.id}><td>{m.roundName}</td><td>{domain.groups.find(g => g.id === m.groupId)?.name ?? ''}</td>
          <td>{pn(m.homeId)}</td><td>{pn(m.awayId)}</td>
          <td>{m.result.homeScore ?? '–'} : {m.result.awayScore ?? '–'}</td><td><St m={m} /></td></tr>))}
        </tbody></table>
      </div>
      {koMs.length === 0 ? (
        <div className="empty">Knockout stage not seeded yet — finish group matches, then use <b>Standings → Seed knockout from standings</b>.</div>
      ) : (
        <div className="bracket">{rounds.map(r => (
          <div className="bround" key={r}>
            <h3>{koMs.find(m => m.round === r)?.roundName ?? ('Round ' + r)}</h3>
            {koMs.filter(m => m.round === r).map(m => <MCard key={m.id} m={m} pn={pn} />)}
          </div>))}
        </div>
      )}
      <div className="row"><button className="btn primary" onClick={() => go('matches')}>Enter results</button><button className="btn" onClick={() => go('standings')}>Standings</button></div>
    </div>
  );
}

function MCard({ m, pn }: { m: Match; pn: (id: string|null) => string }) {
  const w = m.result.winnerId;
  return <div className="bmatch"><div className="rh">{m.roundName} · <St m={m} /></div>
    <div className={'nm'+(w===m.homeId?' w':'') }><span>{pn(m.homeId)}</span><b>{m.result.homeScore ?? ''}</b></div>
    <div className={'nm'+(w===m.awayId?' w':'') }><span>{pn(m.awayId)}</span><b>{m.result.awayScore ?? ''}</b></div>
  </div>;
}
export function St({ m }: { m: Match }) {
  const s = m.result.status;
  const cls = s === 'scheduled' ? '' : s === 'walkover' ? 'wo' : 'played';
  return <span className={'pill '+cls}>{s}</span>;
}

function DoubleView({ names: _n, pn }: { names: Map<string, string>; pn: (id: string | null) => string }) {
  const { domain, go } = useApp();
  const wb = domain.matches.filter(m => m.bracket?.kind === 'winners').sort((a, b) => a.round - b.round);
  const lb = domain.matches.filter(m => m.bracket?.kind === 'losers').sort((a, b) => a.round - b.round);
  const gf = domain.matches.filter(m => m.bracket?.kind === 'final' && m.homeId !== null).sort((a, b) => a.round - b.round);
  const col = (title: string, ms: Match[]) => (
    <div className="bround" style={{ minWidth: 250 }}><h3>{title} ({ms.length})</h3>
      {ms.map(m => <MCard key={m.id} m={m} pn={pn} />)}
    </div>
  );
  void _n;
  return (
    <div className="wrap">
      <h1>Double elimination ({domain.matches.length})</h1>
      <div className="bracket">
        {col('Winners', wb)}
        {col('Losers', lb)}
        {col('Grand final', gf.length ? gf : domain.matches.filter(m => m.bracket?.kind === 'final'))}
      </div>
      <div className="row"><button className="btn primary" onClick={() => go('matches')}>Enter results</button><button className="btn" onClick={() => go('standings')}>Standings</button></div>
    </div>
  );
}
