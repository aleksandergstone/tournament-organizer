// Export and print — one place for backups, data files and paper copies.
import { useState } from 'react';
import { useApp } from '../state/store';
import { serializeProject, fileNameFor, standingsCsv } from '../engine/storage';
import { desktop } from '../engine/desktop';
import { describeFormat } from '../engine/generate';
import { Alert, Empty, Page, Panel, statusLabel } from './kit';

export default function Export() {
  const { domain, standings } = useApp();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const t = domain.tournament;
  const played = domain.matches.filter(m => ['played', 'draw', 'walkover', 'overtime'].includes(m.result.status)).length;
  const hasData = domain.matches.length > 0;
  const projectText = () => serializeProject({
    tournament: domain.tournament, participants: domain.participants, groups: domain.groups,
    matches: domain.matches, audit: domain.audit, resources: domain.resources ?? [],
    settings: { autosave: true, confirmDestructive: true, theme: 'light' },
  });
  const save = async (fileName: string, text: string, okMsg: string) => {
    setMsg(null);
    try {
      const p = await desktop.saveText(fileName, text);
      setMsg({ kind: 'ok', text: p ? `${okMsg}: ${p}` : 'Cancelled — nothing was written. Your work is still saved on this device.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'The file could not be written.' });
    }
  };
  const saveFile = () => save(fileNameFor(domain.tournament), projectText(), 'Project file saved');
  const csvStandings = () => save(
    `${t.name || 'tournament'}.standings.csv`,
    standingsCsv(['rank', 'name', 'P', 'W', 'D', 'L', 'scored', 'conceded', 'diff', 'points'],
      standings.map(s => [String(s.rank), names.get(s.participantId) ?? '?', String(s.played), String(s.wins),
        String(s.draws), String(s.losses), String(s.scored), String(s.conceded), String(s.diff), String(s.points)])),
    'Standings CSV saved');
  const csvMatches = () => save(
    `${t.name || 'tournament'}.matches.csv`,
    standingsCsv(['#', 'round', 'stage', 'home', 'away', 'home_score', 'away_score', 'status', 'winner', 'venue'],
      domain.matches.map((m, i) => [String(i + 1), m.roundName, m.bracket?.kind ?? '',
        names.get(m.homeId ?? '') ?? 'TBD', names.get(m.awayId ?? '') ?? 'TBD',
        String(m.result.homeScore ?? ''), String(m.result.awayScore ?? ''),
        statusLabel(m.result.status), names.get(m.result.winnerId ?? '') ?? '', m.venue ?? ''])),
    'Matches CSV saved');

  return (
    <Page title="Export & print" sub="Backups keep the whole project, data files are for spreadsheets, printing is for paper.">
      {msg && <Alert tone={msg.kind} title={msg.kind === 'ok' ? 'File written' : 'Could not write the file'}>{msg.text}</Alert>}

      {!hasData && (
        <Empty
          title="Nothing to export yet"
          hint="Add participants and generate the bracket first. Everything you enter afterwards can be exported from this page."
        />
      )}

      <Panel title="Backup — keeps everything" sub="One file with the full project. Use it to move to another computer or to recover after a crash.">
        <div className="row">
          <button className="btn primary" onClick={saveFile}>Save project file{desktop.available ? '…' : ' (download)'}</button>
          <span className="muted">Written as <span className="kbd">{fileNameFor(domain.tournament)}</span> — you choose the folder.</span>
        </div>
      </Panel>

      <Panel title="Data files — for spreadsheets" sub="Plain CSV, one row per line, for club records and further analysis.">
        <div className="stack">
          <div className="row">
            <button className="btn" onClick={csvStandings} disabled={standings.length === 0}>Save standings CSV</button>
            <span className="muted">Final table: rank, points, wins, draws, goals.</span>
          </div>
          <div className="row">
            <button className="btn" onClick={csvMatches} disabled={!hasData}>Save matches CSV</button>
            <span className="muted">Every match: round, teams, score, status, winner, venue.</span>
          </div>
        </div>
      </Panel>


      <Panel title="Print — for paper" sub="Prints the summary below: final ranking and every result.">
        <div className="row no-print" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={() => window.print()}>Print summary</button>
          <span className="muted">A preview is shown below — printing hides the app interface.</span>
        </div>
        <div className="print-head">
          <h2>{t.name || '(untitled)'}</h2>
          <div className="muted">
            {t.sport} · {describeFormat(t.format)} · {t.location || 'no venue'} · {t.dates.start ?? '—'} → {t.dates.end ?? '—'}
          </div>
          <div className="muted">
            {domain.participants.length} participants · {played}/{domain.matches.length} played ·
            scoring W{t.rules.winPoints} / D{t.rules.drawPoints} / L{t.rules.lossPoints}
            {t.rules.allowDraws ? '' : ' · no draws'}
          </div>
        </div>
        <h4 style={{ marginTop: 14 }}>Final ranking</h4>
        {standings.length === 0 ? <p className="f-hint">No results entered yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="rank">#</th><th>Who</th><th className="num">P</th>
                <th className="num">W-D-L</th><th className="num">±</th><th className="num">Pts</th></tr></thead>
              <tbody>{standings.map(s => (
                <tr key={s.participantId}>
                  <td className="rank">{s.rank}</td>
                  <td className="name">{names.get(s.participantId)}</td>
                  <td className="num">{s.played}</td>
                  <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
                  <td className="num">{s.diff}</td>
                  <td className="num"><b>{s.points}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <h4 style={{ marginTop: 14 }}>Results</h4>
        {domain.matches.length === 0 ? <p className="f-hint">No matches generated yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Round</th><th>Match</th><th>Status</th></tr></thead>
              <tbody>{domain.matches.map(m => (
                <tr key={m.id}>
                  <td className="muted nowrap">{m.roundName}</td>
                  <td>{names.get(m.homeId ?? '') ?? 'TBD'} {m.result.homeScore ?? '–'}:{m.result.awayScore ?? '–'} {names.get(m.awayId ?? '') ?? 'TBD'}</td>
                  <td>{statusLabel(m.result.status)}{m.result.status === 'walkover' ? ` (${names.get(m.result.walkoverWinnerId ?? '')})` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
