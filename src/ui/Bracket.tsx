// The generated structure: bracket columns, group fixtures or a plain list.
// Read-only by design — results are entered on the Results screen.
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { describeFormat } from '../engine/generate';
import { Empty, Meta, Page, Panel, StatusPill } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function useNames() {
  const t = useT();
  const { domain } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  return (id: string | null) => (id ? names.get(id) ?? t('common.unknown') : 'TBD');
}

export default function Bracket() {
  const t = useT();
  const { domain, go } = useApp();
  const pn = useNames();
  const fmt = domain.tournament.format;

  if (domain.matches.length === 0) {
    return (
      <Page title={t('bracket.title')} sub={t('bracket.sub')}>
        <Empty
          title={t('bracket.emptyTitle')}
          hint={t('bracket.emptyHint')}
          action={<button className="btn primary" onClick={() => go('rules')}>{t('bracket.goRules')}</button>}
        />
      </Page>
    );
  }

  const played = domain.matches.filter(m => FINISHED.has(m.result.status)).length;
  const sub = t('bracket.subPlayed', { format: describeFormat(fmt), played, total: domain.matches.length });

  if (fmt === 'double-elimination') return <DoubleView pn={pn} sub={sub} />;
  if (fmt === 'groups-knockout' && domain.groups.length > 0) return <GroupsKoView pn={pn} sub={sub} />;

  const rounds = [...new Set(domain.matches.map(m => m.round))].sort((a, b) => a - b);
  const elim = fmt === 'single-elimination';
  return (
    <Page title={elim ? t('bracket.title') : t('bracket.scheduleTitle')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      {elim ? (
        <div className="bracket">{rounds.map(r => (
          <div className="bround" key={r}>
            <h3>{domain.matches.find(m => m.round === r)?.roundName ?? 'Round ' + r}</h3>
            {domain.matches.filter(m => m.round === r).map(m => <MCard key={m.id} m={m} pn={pn} />)}
          </div>
        ))}</div>
      ) : (
        <Panel>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('common.round')}</th><th>{t('nav.home')}</th><th>{t('common.away')}</th><th className="num">{t('common.score')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>{domain.matches.map(m => (
                <tr key={m.id} className={FINISHED.has(m.result.status) ? '' : 'dim'}>
                  <td className="muted nowrap">{m.roundName}</td>
                  <td className="name">{pn(m.homeId)}</td>
                  <td className="name">{pn(m.awayId)}</td>
                  <td className="num">{m.result.homeScore ?? '–'} : {m.result.awayScore ?? '–'}</td>
                  <td><StatusPill status={m.result.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
      <div className="footbar">
        <span className="muted">{t('bracket.updateNote')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}


function GroupsKoView({ pn, sub }: { pn: (id: string | null) => string; sub: string }) {
  const t = useT();
  const { domain, go } = useApp();
  const groupMs = domain.matches.filter(m => m.groupId != null);
  const koMs = domain.matches.filter(m => m.groupId == null);
  const rounds = [...new Set(koMs.map(m => m.round))].sort((a, b) => a - b);
  const total = groupMs.filter(m => m.result.status !== 'bye').length;
  const done = groupMs.filter(m => FINISHED.has(m.result.status)).length;
  return (
    <Page title={t('bracket.groupsKo')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      <Meta items={[
        { label: 'Group matches', value: `${done}/${total}` },
        { label: 'Knockout matches', value: koMs.length },
        { label: t('common.groups'), value: domain.groups.length },
      ]} />
      {koMs.length === 0 ? (
        <Empty
          title={t('bracket.koNotSeeded')}
          hint={t('bracket.koNotSeededHint')}
          action={<button className="btn primary" onClick={() => go('standings')}>{t('bracket.goStandings')}</button>}
        />
      ) : (
        <div className="bracket">{rounds.map(r => (
          <div className="bround" key={r}>
            <h3>{koMs.find(m => m.round === r)?.roundName ?? 'Round ' + r}</h3>
            {koMs.filter(m => m.round === r).map(m => <MCard key={m.id} m={m} pn={pn} />)}
          </div>
        ))}</div>
      )}

      <Panel title={t('bracket.groupStage')} sub={t('bracket.groupStageSub')}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('common.round')}</th><th>{t('common.group')}</th><th>{t('nav.home')}</th><th>{t('common.away')}</th><th className="num">{t('common.score')}</th><th>{t('common.status')}</th></tr></thead>
            <tbody>{groupMs.map(m => (
              <tr key={m.id} className={FINISHED.has(m.result.status) ? '' : 'dim'}>
                <td className="muted nowrap">{m.roundName}</td>
                <td className="muted nowrap">{domain.groups.find(g => g.id === m.groupId)?.name ?? ''}</td>
                <td className="name">{pn(m.homeId)}</td>
                <td className="name">{pn(m.awayId)}</td>
                <td className="num">{m.result.homeScore ?? '–'} : {m.result.awayScore ?? '–'}</td>
                <td><StatusPill status={m.result.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <div className="footbar">
        <span className="muted">{t('bracket.qualifierNote')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}

function MCard({ m, pn }: { m: Match; pn: (id: string | null) => string }) {
  const w = m.result.winnerId;
  const done = FINISHED.has(m.result.status);
  return (
    <div className={'bmatch' + (done ? ' settled' : '')}>
      <div className="rh"><span>{m.roundName}</span><StatusPill status={m.result.status} /></div>
      <div className={'nm' + (w === m.homeId ? ' w' : w ? ' l' : '')}>
        <span>{pn(m.homeId)}</span><b>{m.result.homeScore ?? ''}</b>
      </div>
      <div className={'nm' + (w === m.awayId ? ' w' : w ? ' l' : '')}>
        <span>{pn(m.awayId)}</span><b>{m.result.awayScore ?? ''}</b>
      </div>
    </div>
  );
}

function DoubleView({ pn, sub }: { pn: (id: string | null) => string; sub: string }) {
  const t = useT();
  const { domain, go } = useApp();
  const wb = domain.matches.filter(m => m.bracket?.kind === 'winners').sort((a, b) => a.round - b.round);
  const lb = domain.matches.filter(m => m.bracket?.kind === 'losers').sort((a, b) => a.round - b.round);
  const finals = domain.matches.filter(m => m.bracket?.kind === 'final');
  const gf = finals.filter(m => m.homeId !== null).sort((a, b) => a.round - b.round);
  const col = (title: string, ms: Match[], hint?: string) => (
    <div className="bround">
      <h3>{title} ({ms.length})</h3>
      {hint ? <p className="f-hint" style={{ margin: '-4px 0 8px' }}>{hint}</p> : null}
      {ms.map(m => <MCard key={m.id} m={m} pn={pn} />)}
    </div>
  );
  return (
    <Page title={t('bracket.doubleTitle')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      <div className="bracket">
        {col(t('bracket.winners'), wb)}
        {col(t('bracket.losers'), lb, t('bracket.losersHint'))}
        {col(t('bracket.grandFinal'), gf.length ? gf : finals)}
      </div>
      <div className="footbar">
        <span className="muted">{t('bracket.losersAuto')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}
