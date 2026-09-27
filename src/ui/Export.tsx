import { useState } from 'react';
import { useApp } from '../state/store';
import { serializeProject, fileNameFor, standingsCsv } from '../engine/storage';
import { desktop } from '../engine/desktop';
import { describeFormat } from '../engine/generate';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function Export() {
  const { domain, standings } = useApp();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const t = domain.tournament;
  const played = domain.matches.filter(m => ['played','draw','walkover','overtime'].includes(m.result.status)).length;
  const projectText = () => serializeProject({ tournament: domain.tournament, participants: domain.participants, groups: domain.groups, matches: domain.matches, audit: domain.audit, resources: domain.resources ?? [], settings: { autosave: true, confirmDestructive: true, theme: 'light' } });
  const saveFile = async () => {
    setErr('');
    try {
      const p = await desktop.saveText(fileNameFor(domain.tournament), projectText());
      setMsg(p ? `Saved project to ${p}` : 'Save cancelled — local autosave copy kept.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
  };
  const csvS = async () => {
    const csv = standingsCsv(['rank','name','P','W','D','L','scored','conceded','diff','points'],
      standings.map(s => [String(s.rank), names.get(s.participantId) ?? '?', String(s.played), String(s.wins), String(s.draws), String(s.losses), String(s.scored), String(s.conceded), String(s.diff), String(s.points)]));
    try {
      const p = await desktop.saveText(`${t.name || 'tournament'}.standings.csv`, csv);
      setMsg(p ? `Saved standings to ${p}` : 'Export cancelled.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Export failed'); }
  };
  const csvM = async () => {
    const csv = standingsCsv(['#','round','stage','home','away','home_score','away_score','status','winner','venue'],
      domain.matches.map((m, i) => [String(i + 1), m.roundName, m.bracket?.kind ?? '', names.get(m.homeId ?? '') ?? 'TBD', names.get(m.awayId ?? '') ?? 'TBD', String(m.result.homeScore ?? ''), String(m.result.awayScore ?? ''), m.result.status, names.get(m.result.winnerId ?? '') ?? '', m.venue ?? '']));
    try {
      const p = await desktop.saveText(`${t.name || 'tournament'}.matches.csv`, csv);
      setMsg(p ? `Saved matches to ${p}` : 'Export cancelled.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Export failed'); }
  };
  const print = () => window.print();
  return (
    <div className="wrap"><h1>Export / print</h1>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}
      {domain.matches.length === 0 && (
        <div className="empty">
          Nothing to export yet — add participants and generate the bracket first. Everything you do afterwards can be exported from this page.
        </div>
      )}
      <div className="card"><h3>Project file (backup / move to another PC)</h3>
        <button className="btn primary" onClick={saveFile}>Save .top.json{desktop.available ? ' (file dialog)' : ' (download)'}</button></div>
      <div className="card"><h3>CSV</h3><div className="row">
        <button className="btn" onClick={csvS}>Standings CSV</button>
        <button className="btn" onClick={csvM}>Matches CSV</button></div></div>
      <div className="card printable">
        <h3>Print summary</h3>
        <button className="btn" onClick={print}>Print</button>
        <div className="print-head" style={{ marginTop: 10 }}>
          <h2 style={{ marginBottom: 2 }}>{t.name || '(untitled)'}</h2>
          <div className="muted">{t.sport} · {describeFormat(t.format)} · {t.location || 'no venue'} · {t.dates.start ?? '—'} → {t.dates.end ?? '—'} · exported {fmtDate(new Date().toISOString())}</div>
          <div className="muted">{domain.participants.length} participants · {played}/{domain.matches.length} played · rules W{t.rules.winPoints}/D{t.rules.drawPoints}/L{t.rules.lossPoints}{t.rules.allowDraws ? '' : ' (no draws)'}</div>
        </div>
        <h4>Final ranking</h4>
        <table><thead><tr><th>#</th><th>Who</th><th>P</th><th>W-D-L</th><th>±</th><th>Pts</th></tr></thead>
        <tbody>{standings.map(s => <tr key={s.participantId}><td>{s.rank}</td><td>{names.get(s.participantId)}</td><td>{s.played}</td><td>{s.wins}-{s.draws}-{s.losses}</td><td>{s.diff}</td><td><b>{s.points}</b></td></tr>)}</tbody></table>
        <h4>Results</h4>
        <table><tbody>{domain.matches.map(m => <tr key={m.id}><td>{m.roundName}</td><td>{names.get(m.homeId ?? '') ?? 'TBD'} {m.result.homeScore ?? '–'}:{m.result.awayScore ?? '–'} {names.get(m.awayId ?? '') ?? 'TBD'}</td><td>{m.result.status}{m.result.status === 'walkover' ? ` (${names.get(m.result.walkoverWinnerId ?? '')})` : ''}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
