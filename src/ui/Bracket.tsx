// The generated structure: the knockout bracket drawn side by side,
// with connector lines between rounds, for every format that ends in a bracket.
import { useApp } from '../state/store';
import { Match } from '../engine/types';
import { describeFormat, hasBracket } from '../engine/generate';
import { buildBracketTree, knockoutPlaces } from '../engine/bracket-view';
import { Branding, normalizeBranding } from '../engine/branding';
import { Empty, Page } from './kit';
import { BracketCanvas } from './BracketCanvas';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function tintColor(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(31, 94, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

/** Polish plural for match count: 1 mecz, 2-4 mecze, 5+ meczów. */
function matchCountLabel(count: number, t: ReturnType<typeof useT>): string {
  const key = count === 1 ? 'double.matchOne' : count <= 4 ? 'double.matchFew' : 'double.matchMany';
  return `${count} ${t(key)}`;
}

function useNames() {
  const t = useT();
  const { domain } = useApp();
  const names = new Map(domain.participants.map(p => [p.id, p.name]));
  return (id: string | null | undefined) => (id ? names.get(id) ?? t('common.unknown') : t('common.tbd'));
}

type Pn = (id: string | null | undefined) => string;

export default function Bracket() {
  const t = useT();
  const { domain, go } = useApp();
  const pn = useNames();
  const fmt = domain.tournament.format;
  const branding = normalizeBranding(domain.tournament.branding);

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

  if (fmt === 'single-elimination') return <SingleView pn={pn} sub={sub} branding={branding} />;
  if (fmt === 'double-elimination') return <DoubleEliminationView pn={pn} sub={sub} branding={branding} />;
  if (fmt === 'groups-knockout' && domain.groups.length > 0)
    return <GroupsKoView pn={pn} sub={sub} branding={branding} />;

  return null;
}

// Single elimination: one tree, all rounds side by side with connector lines.
function SingleView({ pn, sub, branding }: { pn: Pn; sub: string; branding: Branding }) {
  const t = useT();
  const { domain, go } = useApp();
  const koMs = domain.matches.filter(m => !m.groupId);
  const tree = buildBracketTree(koMs, pn, {
    emptyLabel: t('common.tbd'), byeLabel: t('status.bye'), roundName: n => t('round.n', { n }),
  });
  const places = knockoutPlaces(koMs, pn);
  return (
    <Page title={t('bracket.title')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      {places.length > 0 && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {places.map(p => (
            <span key={p.place} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: tintColor(branding.accent1, 0.1), color: branding.accent1, fontWeight: 600, fontSize: 13 }}>
              {p.place}. {p.name}
            </span>
          ))}
        </div>
      )}
      <BracketCanvas
        nodes={tree.nodes}
        links={tree.links}
        rounds={tree.rounds}
        width={tree.width}
        height={tree.height}
        championMatchId={tree.champion?.matchId ?? null}
        championLabel={t('st.champion')}
        pn={pn}
        branding={branding}
        title={t('bracket.title')}
        sub={t('bracket.subPlayed', { format: describeFormat('single-elimination'), played: koMs.filter(m => FINISHED.has(m.result.status)).length, total: koMs.length })}
      />
      <div className="bracket-foot">
        <span className="muted">{t('bracket.updateNote')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}
// Double elimination: separate layout for winners bracket, losers bracket and
// grand final. Each section has its own column layout, spacing and connectors,
// so nothing overlaps or shifts chaotically.
function DoubleEliminationView({ pn, sub, branding }: { pn: Pn; sub: string; branding: Branding }) {
  const t = useT();
  const { domain, go } = useApp();
  const r = domain.tournament.rules;
  const ending = r.doubleElimEnding ?? 'single';

  const wb = domain.matches.filter(m => m.bracket?.kind === 'winners').sort((a, b) => a.round - b.round);
  const lb = domain.matches.filter(m => m.bracket?.kind === 'losers').sort((a, b) => a.round - b.round);
  const finals = domain.matches.filter(m => m.bracket?.kind === 'final').sort((a, b) => a.round - b.round);
  const gf = finals.find(m => m.roundName === 'Grand Final');
  const gfReset = finals.find(m => m.roundName === 'Grand Final Reset');
  const thirdPlace = finals.find(m => m.roundName === 'Third Place');

  const treeFrom = (ms: Match[]) => buildBracketTree(ms, pn, {
    emptyLabel: t('common.tbd'), byeLabel: t('status.bye'), roundName: n => t('round.n', { n }),
  });

  const showReset = ending === 'double' && !!gfReset;
  const showThird = ending === 'thirdPlace' && !!thirdPlace;

  return (
    <Page title={t('bracket.doubleTitle')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      <div className="de-ending-hint" style={{ marginBottom: 12, padding: 8, background: tintColor(branding.accent1, 0.06), borderRadius: 8, border: `1px solid ${tintColor(branding.accent1, 0.2)}`, fontSize: 13, color: branding.muted }}>
        {ending === 'single' ? t('double.end.single') : ending === 'double' ? t('double.end.double') : t('double.end.thirdPlace')}
      </div>
      <div className="de-sections" style={{ display: 'flex', gap: 24, flexDirection: 'column' }}>
        <section className="de-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wb.length > 0 ? (
            <BracketCanvas
              nodes={treeFrom(wb).nodes}
              links={treeFrom(wb).links}
              rounds={treeFrom(wb).rounds}
              width={treeFrom(wb).width}
              height={treeFrom(wb).height}
              championMatchId={null}
              championLabel={t('bracket.winners')}
              pn={pn}
              branding={branding}
              title={t('bracket.winners')}
              sub={matchCountLabel(wb.length, t)}
            />
          ) : <Empty title={t('common.nothingHere')} hint={t('bracket.emptyHint')} />}
        </section>
        <section className="de-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: '#697386', margin: 0, marginBottom: 8 }}>{t('bracket.losersHint')}</p>
          {lb.length > 0 ? (
            <BracketCanvas
              nodes={treeFrom(lb).nodes}
              links={treeFrom(lb).links}
              rounds={treeFrom(lb).rounds}
              width={treeFrom(lb).width}
              height={treeFrom(lb).height}
              championMatchId={null}
              championLabel={t('bracket.losers')}
              pn={pn}
              branding={branding}
              title={t('bracket.losers')}
              sub={matchCountLabel(lb.length, t)}
            />
          ) : <Empty title={t('common.nothingHere')} hint={t('bracket.emptyHint')} />}
        </section>
        {gf && (
          <section className="de-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BracketCanvas
              nodes={treeFrom([gf]).nodes}
              links={treeFrom([gf]).links}
              rounds={treeFrom([gf]).rounds}
              width={treeFrom([gf]).width}
              height={treeFrom([gf]).height}
              championMatchId={gf.id}
              championLabel={t('st.champion')}
              pn={pn}
              branding={branding}
              title={t('bracket.grandFinal')}
              sub=""
            />
          </section>
        )}
        {showReset && gfReset && (
          <section className="de-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BracketCanvas
              nodes={treeFrom([gfReset]).nodes}
              links={treeFrom([gfReset]).links}
              rounds={treeFrom([gfReset]).rounds}
              width={treeFrom([gfReset]).width}
              height={treeFrom([gfReset]).height}
              championMatchId={gfReset.id}
              championLabel={t('st.champion')}
              pn={pn}
              branding={branding}
              title={t('round.grandFinalReset')}
              sub=""
            />
          </section>
        )}
        {showThird && thirdPlace && (
          <section className="de-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BracketCanvas
              nodes={treeFrom([thirdPlace]).nodes}
              links={treeFrom([thirdPlace]).links}
              rounds={treeFrom([thirdPlace]).rounds}
              width={treeFrom([thirdPlace]).width}
              height={treeFrom([thirdPlace]).height}
              championMatchId={null}
              championLabel={t('bracket.thirdPlace')}
              pn={pn}
              branding={branding}
              title={t('bracket.thirdPlace')}
              sub=""
            />
          </section>
        )}
      </div>
      <div className="bracket-foot">
        <span className="muted">{t('bracket.losersAuto')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
      </div>
    </Page>
  );
}

// Groups → knockout: group fixtures stay as a table; the knockout phase uses
// the same bracket visual as single elimination.
function GroupsKoView({ pn, sub, branding }: { pn: Pn; sub: string; branding: Branding }) {
  const t = useT();
  const { domain, go } = useApp();
  const koMs = domain.matches.filter(m => m.groupId === null);
  const tree = koMs.length > 0 ? buildBracketTree(koMs, pn, {
    emptyLabel: t('common.tbd'), byeLabel: t('status.bye'), roundName: n => t('round.n', { n }),
  }) : { nodes: [], links: [], rounds: [], width: 0, height: 0, champion: null };
  return (
    <Page title={t('bracket.title')} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t('bracket.groupStage')}</h2>
        <p style={{ fontSize: 13, color: '#697386', margin: 0 }}>{t('bracket.groupStageSub')}</p>
        <Empty title={t('common.nothingHere')} hint="Group fixtures are shown on the Standings screen." />
      </section>
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{t('bracket.title')}</h2>
        {koMs.length > 0 ? (
          <BracketCanvas
            nodes={tree.nodes}
            links={tree.links}
            rounds={tree.rounds}
            width={tree.width}
            height={tree.height}
            championMatchId={tree.champion?.matchId ?? null}
            championLabel={t('st.champion')}
            pn={pn}
            branding={branding}
            title={t('bracket.title')}
            sub={t('bracket.subPlayed', { format: describeFormat('groups-knockout'), played: koMs.filter(m => FINISHED.has(m.result.status)).length, total: koMs.length })}
          />
        ) : <Empty title={t('bracket.emptyTitle')} hint={t('bracket.emptyHint')} />}
      </section>
      <div className="bracket-foot">
        <span className="muted">{t('bracket.updateNote')}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}
