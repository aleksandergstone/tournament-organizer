// Overview — one screen that says where the tournament stands and what to do next.
import { useApp } from '../state/store';
import { describeFormat, hasPointTable } from '../engine/generate';
import { knockoutPlaces } from '../engine/bracket-view';
import { describeAudit } from '../engine/audit';
import { Collapse, Empty, Meta, Page, Panel } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Overview() {
  const { domain, standings, go } = useApp();
  // "tr" not "t": the tournament object already owns the letter t in this file.
  const tr = useT();
  const t = domain.tournament;
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  const played = domain.matches.filter(m => FINISHED.has(m.result.status)).length;
  const open = domain.matches.length - played;
  const hasBracket = domain.matches.length > 0;
  // Points only rank a league, a Swiss run or a group stage.
  const points = hasPointTable(domain.tournament.format);
  const places = knockoutPlaces(
    domain.matches.filter(m => !m.groupId),
    id => (id ? names.get(id) ?? tr('common.unknown') : ''));

  // One clear next step, in the order an organizer actually works in.
  const next = !domain.participants.length
    ? { label: tr('overview.nextParticipants'), to: 'participants' as const, why: tr('overview.nextParticipantsWhy') }
    : !hasBracket
      ? { label: tr('overview.nextBracket'), to: 'rules' as const, why: tr('overview.nextBracketWhy') }
      : open > 0
        ? { label: tr('overview.nextResults'), to: 'matches' as const, why: open === 1 ? tr('overview.nextResultsWhyOne') : tr('overview.nextResultsWhy', { n: open }) }
        : { label: tr('overview.nextStandings'), to: 'standings' as const, why: tr('overview.nextStandingsWhy') };

  return (
    <Page
      title={t.name || tr('app.untitled')}
      sub={`${t.sport} · ${describeFormat(t.format)}${t.location ? ' · ' + t.location : ''}`}
      actions={<button className="btn primary" onClick={() => go(next.to)}>{next.label}</button>}
    >
      <Panel>
        <Meta items={[
          { label: tr('common.players'), value: domain.participants.length },
          { label: tr('common.matches'), value: domain.matches.length },
          { label: tr('common.played'), value: `${played}/${domain.matches.length}` },
          { label: tr('common.open'), value: open },
        ]} />
        <p className="table-note">{next.why}</p>
      </Panel>

      <div className="grid2">
        <Panel title={tr(points ? 'overview.ranking' : 'st.finalTitle')}
          sub={tr(points ? 'overview.rankingSub' : 'st.finalSub')}>
          {!points ? (
            places.length === 0 ? (
              <Empty
                title={tr('st.noChampionYet')}
                hint={tr('st.enterResultsFirst')}
                action={<button className="btn primary" onClick={() => go('matches')}>{tr('overview.enterResults')}</button>}
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th className="num">{tr('doc.place')}</th><th>{tr('st.colWho')}</th></tr></thead>
                  <tbody>{places.map(p => (
                    <tr key={p.place} className={p.place === 1 ? 'champion' : ''}>
                      <td className="rank num">{p.place}</td>
                      <td className="name">{p.name}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )
          ) : standings.length === 0 ? (
            <Empty
              title={tr('overview.noResults')}
              hint={tr('overview.noResultsHint')}
              action={<button className="btn primary" onClick={() => go('matches')}>{tr('overview.enterResults')}</button>}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th className="rank">#</th><th>{tr('st.colWho')}</th><th className="num">{tr('common.points')}</th></tr></thead>
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

        {/* Six shortcuts that already exist in the navigation bar. Kept, because a jump
            from here saves a trip, but folded: while working, the standings and
            the next step are what this screen is for. */}
        <Collapse title={tr('overview.goTo')} sub={tr('overview.goToSub')}>
          <div className="stack">
            <div className="row"><button className="btn" onClick={() => go('participants')}>{tr('nav.participants')}</button>
              <span className="muted">{tr('overview.shortParticipants')}</span></div>
            <div className="row"><button className="btn" onClick={() => go('rules')}>{tr('nav.rules')}</button>
              <span className="muted">{tr('overview.shortRules')}</span></div>
            <div className="row"><button className="btn" onClick={() => go('matches')}>{tr('nav.results')}</button>
              <span className="muted">{open} {tr('common.open').toLowerCase()}</span></div>
            <div className="row"><button className="btn" onClick={() => go('schedule')}>{tr('nav.schedule')}</button>
              <span className="muted">{tr('overview.shortSchedule')}</span></div>
            <div className="row"><button className="btn" onClick={() => go('display')}>{tr('nav.display')}</button>
              <span className="muted">{tr('overview.shortDisplay')}</span></div>
            <div className="row"><button className="btn" onClick={() => go('export')}>{tr('out.title')}</button>
              <span className="muted">{tr('overview.shortOutput')}</span></div>
          </div>
        </Collapse>
      </div>

      {/* The log is a record to check afterwards, not the thing to act on. It was the
          longest block on the screen and sat below the one thing that mattered,
          so it folds away and the next step stays the last thing read. */}
      <Collapse title={tr('overview.history')} sub={tr('overview.historySub', { shown: Math.min(20, domain.audit.length), total: domain.audit.length })}>
        {domain.audit.length === 0 ? (
          <p className="f-hint">{tr('overview.historyEmpty')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>{[...domain.audit].reverse().slice(0, 20).map(a => {
                const line = describeAudit(a.action, a.detail);
                return (
                  <tr key={a.id}>
                    <td className="muted nowrap" style={{ width: 170 }}>{new Date(a.at).toLocaleString()}</td>
                    <td>{line.label}</td>
                    <td className="muted">{line.detail}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Collapse>
    </Page>
  );
}
