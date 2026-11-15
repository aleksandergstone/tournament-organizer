// The generated structure: the knockout bracket drawn as a "spider", group
// fixtures, or a plain match list for formats that end in a league.
import { useMemo } from 'react';
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { describeFormat, hasBracket } from '../engine/generate';
import { bracketSvg, buildBracketTree, knockoutPlaces } from '../engine/bracket-view';
import { Branding, normalizeBranding } from '../engine/branding';
import { Empty, Meta, Page, Panel, StatusPill } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function tintColor(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(31, 94, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function useNames() {
  const t = useT();
  const { domain } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  return (id: string | null | undefined) => (id ? names.get(id) ?? t('common.unknown') : t('common.tbd'));
}

export default function Bracket() {
  const t = useT();
  const { domain, go } = useApp();
  const pn = useNames();
  const fmt = domain.tournament.format;
  const branding = normalizeBranding(domain.tournament.branding);

  // A league (or any format without a knockout stage) has no bracket to draw.
  if (!hasBracket(fmt)) {
    return (
      <Page title={t('bracket.notHere')}>
        <Empty
          title={t('bracket.notHere')}
          hint={t('bracket.notHereHint')}
          action={<button className="btn primary" onClick={() => go('matches')}>{t('res.title')}</button>}
        />
      </Page>
    );
  }

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

  if (fmt === 'double-elimination') return <DoubleView pn={pn} sub={sub} branding={branding} />;
  if (fmt === 'groups-knockout' && domain.groups.length > 0) return <GroupsKoView pn={pn} sub={sub} branding={branding} />;

  // Single elimination: the bracket as a drawn spider, the same drawing the
  // document prints — one picture, no second rendering to keep in sync.
  const koMs = domain.matches.filter(m => !m.groupId);
  const tree = useMemo(() => buildBracketTree(koMs, pn, {
    emptyLabel: t('common.tbd'), byeLabel: t('status.bye'), roundName: n => t('round.n', { n }),
  }), [koMs, pn, t]);
  const spider = useMemo(() => bracketSvg({
    tree, title: t('bracket.title'), championLabel: t('st.champion'),
    accent1: branding.accent1, accent2: branding.accent2, background: branding.background,
  }), [tree, t, branding]);
  const places = useMemo(() => knockoutPlaces(koMs, pn), [koMs, pn]);

  return (
    <Page title={t('bracket.title')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      {places.length > 0 && (
        <Panel title={t('st.finalTitle')}>
          <div className="champion-row" style={{
            display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            marginBottom: 12,
          }}>
            {places.map(p => (
              <span key={p.place} className={`champion-place place-${p.place}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20,
                background: p.place === 1 ? branding.accent1 : branding.background,
                color: p.place === 1 ? '#ffffff' : branding.accent1,
                border: `1px solid ${p.place === 1 ? branding.accent1 : branding.accent2}`,
                fontWeight: p.place === 1 ? 700 : 600,
              }}>
                <b>{p.place}</b> {p.name}
              </span>
            ))}
          </div>
        </Panel>
      )}
      <Panel>
        <div className="bracket-wrap" style={{
          background: branding.background,
          border: `1px solid ${branding.accent2}`,
          borderRadius: 8,
          padding: 16,
          overflowX: 'auto',
          marginBottom: 12,
        }}>
          <div className="bracket-svg" dangerouslySetInnerHTML={{ __html: spider }} />
        </div>
        <p className="table-note">{t('doc.spiderNote')}</p>
      </Panel>
      <div className="footbar">
        <span className="muted">{t('bracket.updateNote')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}


function GroupsKoView({ pn, sub, branding }: { pn: (id: string | null) => string; sub: string; branding: Branding }) {
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
            {koMs.filter(m => m.round === r).map(m => <MCard key={m.id} m={m} pn={pn} branding={branding} />)}
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

function MCard({ m, pn, branding }: { m: Match; pn: (id: string | null) => string; branding: Branding }) {
  const w = m.result.winnerId;
  const done = FINISHED.has(m.result.status);
  const wonHome = w === m.homeId;
  const wonAway = w === m.awayId;
  return (
    <div className={'bmatch' + (done ? ' settled' : '')} style={{
      border: `1px solid ${done ? (wonHome || wonAway ? branding.accent1 : branding.accent2) : branding.accent2}`,
      borderRadius: 8,
      background: done ? (wonHome || wonAway ? tintColor(branding.accent1, 0.1) : branding.background) : 'transparent',
      padding: 10,
      marginBottom: 8,
    }}>
      <div className="rh" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: branding.accent1 }}>{m.roundName}</span>
        <StatusPill status={m.result.status} />
      </div>
      <div className={'nm' + (wonHome ? ' w' : w ? ' l' : '')} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: wonHome ? branding.accent1 : '#1a1d21' }}>{pn(m.homeId)}</span>
        <b style={{ color: wonHome ? branding.accent1 : '#1a1d21' }}>{m.result.homeScore ?? ''}</b>
      </div>
      <div className={'nm' + (wonAway ? ' w' : w ? ' l' : '')} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: wonAway ? branding.accent1 : '#1a1d21' }}>{pn(m.awayId)}</span>
        <b style={{ color: wonAway ? branding.accent1 : '#1a1d21' }}>{m.result.awayScore ?? ''}</b>
      </div>
    </div>
  );
}

function DoubleView({ pn, sub, branding }: { pn: (id: string | null) => string; sub: string; branding: Branding }) {
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
      {ms.map(m => <MCard key={m.id} m={m} pn={pn} branding={branding} />)}
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
