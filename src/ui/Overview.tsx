// Overview — one screen that says where the tournament stands and what to do next.
import { useApp } from '../state/store';
import { describeFormat } from '../engine/generate';
import { Empty, Meta, Page, Panel } from './kit';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Overview() {
  const { domain, standings, go } = useApp();
  const t = domain.tournament;
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const played = domain.matches.filter(m => FINISHED.has(m.result.status)).length;
  const open = domain.matches.length - played;
  const hasBracket = domain.matches.length > 0;

  // One clear next step, in the order an organizer actually works in.
  const next = !domain.participants.length
    ? { label: 'Add participants', to: 'participants' as const, why: 'Every tournament starts with a list of players or teams.' }
    : !hasBracket
      ? { label: 'Generate the bracket', to: 'rules' as const, why: 'Pick the format and scoring, then create the matches.' }
      : open > 0
        ? { label: 'Enter results', to: 'matches' as const, why: `${open} ${open === 1 ? 'match is' : 'matches are'} still open.` }
        : { label: 'Show the final ranking', to: 'standings' as const, why: 'Everything is played — check the ranking and export it.' };

  return (
    <Page
      title={t.name || '(untitled)'}
      sub={`${t.sport} · ${describeFormat(t.format)}${t.location ? ' · ' + t.location : ''}`}
      actions={<button className="btn primary" onClick={() => go(next.to)}>{next.label}</button>}
    >
      <Panel>
        <Meta items={[
          { label: 'Players', value: domain.participants.length },
          { label: 'Matches', value: domain.matches.length },
          { label: 'Played', value: `${played}/${domain.matches.length}` },
          { label: 'Open', value: open },
        ]} />
        <p className="table-note">{next.why}</p>
      </Panel>

      <div className="grid2">
        <Panel title="Current ranking" sub="Top 5 — the full table is on the Standings screen.">
          {standings.length === 0 ? (
            <Empty
              title="No results yet"
              hint="The ranking appears as soon as the first result is entered."
              action={<button className="btn primary" onClick={() => go('matches')}>Enter results</button>}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th className="rank">#</th><th>Who</th><th className="num">Pts</th></tr></thead>
                <tbody>{standings.slice(0, 5).map(s => (
                  <tr key={s.participantId}>
                    <td className="rank">{s.rank}</td>
                    <td className="name">{names.get(s.participantId)}</td>
                    <td className="num"><b>{s.points}</b></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Go to" sub="Everything the organizer uses during an event.">
          <div className="stack">
            <div className="row"><button className="btn" onClick={() => go('participants')}>Participants</button>
              <span className="muted">Names, seeding, withdrawals</span></div>
            <div className="row"><button className="btn" onClick={() => go('rules')}>Format &amp; rules</button>
              <span className="muted">Scoring, groups, generate</span></div>
            <div className="row"><button className="btn" onClick={() => go('matches')}>Result entry</button>
              <span className="muted">{open} open</span></div>
            <div className="row"><button className="btn" onClick={() => go('schedule')}>Schedule</button>
              <span className="muted">Courts, tables, times</span></div>
            <div className="row"><button className="btn" onClick={() => go('display')}>Display</button>
              <span className="muted">Big screen for the hall</span></div>
            <div className="row"><button className="btn" onClick={() => go('export')}>Export &amp; print</button>
              <span className="muted">Backup, CSV, paper</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="History" sub={`Last ${Math.min(20, domain.audit.length)} of ${domain.audit.length} changes — newest first.`}>
        {domain.audit.length === 0 ? (
          <p className="f-hint">Nothing has changed yet in this tournament.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>{[...domain.audit].reverse().slice(0, 20).map(a => (
                <tr key={a.id}>
                  <td className="muted nowrap" style={{ width: 170 }}>{new Date(a.at).toLocaleString()}</td>
                  <td>{a.action}</td>
                  <td className="muted">{a.detail ?? ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
