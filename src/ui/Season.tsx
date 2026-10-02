// Season screen — the tag on this tournament, plus the classification across
// every saved tournament that shares it.
//
// The season is not a separate store: it is read from the projects the app
// already has, so nothing has to be kept in step by hand.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { ProjectFile, uid } from '../engine/types';
import { disk } from '../engine/storage';
import { buildSeason, seasonsIn, seasonOf, SEASON_POINTS } from '../engine/season';
import { Alert, Empty, Field, Page, Panel } from './kit';
import { useT } from '../i18n';

export default function Season() {
  const t = useT();
  const { domain, update } = useApp();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const current = seasonOf({ tournament: domain.tournament } as ProjectFile);
  const [name, setName] = useState(current?.name ?? '');
  const [picked, setPicked] = useState<string | null>(current?.id ?? null);

  useEffect(() => {
    let alive = true;
    Promise.resolve(disk.loadAll())
      .then(all => { if (alive) setFiles(Object.values(all)); })
      .catch(() => { if (alive) setErr(t('err.actionFailed')); });
    return () => { alive = false; };
  }, [tick, t]);

  const seasons = useMemo(() => seasonsIn(files), [files]);
  const table = useMemo(
    () => (picked ? buildSeason(files, picked, seasons.find(s => s.id === picked)?.name ?? '') : null),
    [files, picked, seasons]);

  const assign = () => {
    const trimmed = name.trim();
    if (!trimmed) { setErr(t('season.empty')); return; }
    const id = current?.id ?? uid('season');
    update(d => ({ ...d, tournament: { ...d.tournament, season: { id, name: trimmed } } }), 'season.assign');
    setPicked(id); setErr(''); setTick(n => n + 1);
  };
  const untag = () => {
    update(d => ({ ...d, tournament: { ...d.tournament, season: null } }), 'season.assign');
    setPicked(null); setTick(n => n + 1);
  };

  return (
    <Page title={t('season.title')} sub={t('season.sub')}>
      {err && <Alert tone="err">{err}</Alert>}

      <Panel title={t('season.name')}>
        <div className="grid2">
          <Field label={t('season.name')} hint={t('season.countsHint')}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('season.namePlaceholder')} />
          </Field>
          <Field label={t('season.current')} hint={current ? current.id : t('season.none')}>
            <div className="row">
              <button className="btn primary" onClick={assign}>{t('season.assign')}</button>
              {current && <button className="btn ghost" onClick={untag}>{t('common.remove')}</button>}
            </div>
          </Field>
        </div>
      </Panel>

      {seasons.length > 0 && (
        <Panel title={t('season.tagged')}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {seasons.map(s => (
              <button key={s.id} className={'btn' + (picked === s.id ? ' primary' : '')} onClick={() => setPicked(s.id)}>
                {s.name} · {s.count}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {!table || table.counted === 0 ? (
        <Empty title={t('season.empty')} hint={t('season.emptyHint')} />
      ) : (
        <Panel title={table.name} sub={t('season.tableSub')}
          actions={<span className="muted">{t('season.events')}: {table.counted}</span>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>{t('st.colWho')}</th>
                  <th className="num">{t('season.events')}</th>
                  <th className="num">{t('season.pointsTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map(r => (
                  <tr key={r.key} className={r.rank === 1 ? 'champion' : ''}>
                    <td className="rank num">{r.rank}</td>
                    <td className="name">{r.name}</td>
                    <td className="num">{r.events}</td>
                    <td className="num"><b>{r.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">{`${t('season.pointsTotal')}: ${SEASON_POINTS.join(' · ')}`}</p>
        </Panel>
      )}

      {table && table.events.length > 0 && (
        <Panel title={t('season.clubRank')} sub={t('season.clubRankSub')}>
          <ul>
            {table.events.map(e => (
              <li key={e.tournament.id}>{e.tournament.name} — {e.tournament.dates?.start ?? e.tournament.createdAt.slice(0, 10)}</li>
            ))}
          </ul>
        </Panel>
      )}
    </Page>
  );
}
