import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../state/store';
import {
  Boat, Race, RaceResult, RaceResultStatus, BoatClass, uid, nowIso,
  type Id, type SeriesStanding, type RuleSet, type Penalty,
} from '../../engine/types';
import { scoreRaceResults } from '../../engine/sailing-scoring';
import { useT } from '../../i18n';
import {
  Page, Panel, Field, Alert, Table, Button, Input, Select,
  Badge, Tabs, Modal,
} from '../kit';

type EntryMode = 'quick' | 'detail' | 'import';

interface QuickEntryState {
  searchQuery: string;
  selectedBoatId: Id | null;
  position: number | null;
  status: RaceResultStatus;
  notes: string;
}

interface DetailEntryState {
  boatId: Id | null;
  position: number | null;
  finishTime: string | null;
  elapsedSeconds: number | null;
  correctedSeconds: number | null;
  status: RaceResultStatus;
  penalty: RaceResult['penalty'];
  adjustment: number | null;
  notes: string;
  committeeNote: string;
}

interface ImportPreviewRow {
  original: Record<string, string>;
  parsed: Partial<RaceResult> | null;
  errors: string[];
  boat: Boat | null;
}

export default function SailingResults() {
  const { domain, update, go } = useApp();
  const t = useT();

  const races = domain.races || [];
  const boats = domain.boats?.filter(b => b.active) || [];
  const boatClasses = domain.boatClasses || [];
  const rules = domain.tournament.rules;

  const [selectedRaceId, setSelectedRaceId] = useState<Id | null>(races[0]?.id ?? null);
  const [selectedClassId, setSelectedClassId] = useState<Id | null>(boatClasses[0]?.id ?? null);
  const [selectedFlightId, setSelectedFlightId] = useState<Id | null>(null);
  const [mode, setMode] = useState<EntryMode>('quick');

  const [quickState, setQuickState] = useState<QuickEntryState>({
    searchQuery: '',
    selectedBoatId: null,
    position: null,
    status: 'FINISHED',
    notes: '',
  });

  const [detailState, setDetailState] = useState<DetailEntryState>({
    boatId: null,
    position: null,
    finishTime: null,
    elapsedSeconds: null,
    correctedSeconds: null,
    status: 'FINISHED',
    penalty: null,
    adjustment: null,
    notes: '',
    committeeNote: '',
  });

  const [importCsv, setImportCsv] = useState<string>('');
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = uid('toast');
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const currentRace = races.find(r => r.id === selectedRaceId);
  const currentRaceResults = currentRace?.results || [];

  const contextBoats = useMemo(() => {
    if (!currentRace) return [];
    let list = boats.filter(b => b.classId === currentRace.classId);
    if (currentRace.flightId) {
      list = list.filter(b => domain.flights?.some(f => f.id === currentRace.flightId && f.boatIds.includes(b.id)));
    }
    return list;
  }, [boats, currentRace, domain.flights]);

  const resultsByBoat = useMemo(() => {
    const map = new Map<Id, RaceResult>();
    currentRaceResults.forEach(r => map.set(r.boatId, r));
    return map;
  }, [currentRaceResults]);

  const missingBoats = contextBoats.filter(b => !resultsByBoat.has(b.id));

  const statusLabel = (status: RaceResultStatus) => {
    const labels: Record<RaceResultStatus, string> = {
      FINISHED: t('sailing.resultStatus.finished'),
      DNS: t('sailing.resultStatus.dns') ?? 'DNS',
      DNF: t('sailing.resultStatus.dnf') ?? 'DNF',
      DSQ: t('sailing.resultStatus.dsq') ?? 'DSQ',
      OCS: t('sailing.resultStatus.ocs') ?? 'OCS',
      RET: t('sailing.resultStatus.ret') ?? 'RET',
      RDG: t('sailing.resultStatus.rdg') ?? 'RDG',
      DNE: t('sailing.resultStatus.dne') ?? 'DNE',
      DGM: t('sailing.resultStatus.dgm') ?? 'DGM',
      BFD: t('sailing.resultStatus.bfd') ?? 'BFD',
      UFD: t('sailing.resultStatus.ufd') ?? 'UFD',
      SCP: t('sailing.resultStatus.scp') ?? 'SCP',
      DNC: t('sailing.resultStatus.dnc') ?? 'DNC',
      NSC: 'NSC',
      DPI: 'DPI',
      ZFP: t('sailing.resultStatus.zfp') ?? 'ZFP',
    };
    return labels[status] ?? status;
  };

  const handleQuickSearch = (query: string) => {
    setQuickState(s => ({ ...s, searchQuery: query }));
    const found = contextBoats.find(b =>
      b.sailNumber?.toLowerCase().includes(query.toLowerCase()) ||
      b.name.toLowerCase().includes(query.toLowerCase())
    );
    setQuickState(s => ({ ...s, selectedBoatId: found?.id ?? null }));
  };

  const handleQuickSave = () => {
    if (!currentRace || !quickState.selectedBoatId) return;
    if (quickState.position === null && quickState.status === 'FINISHED') {
      showToast(t('sailing.enterPosition'), 'error');
      return;
    }

    const existing = resultsByBoat.get(quickState.selectedBoatId);
    const newResult: RaceResult = {
      id: existing?.id ?? uid('rr'),
      raceId: currentRace.id,
      boatId: quickState.selectedBoatId,
      position: quickState.status === 'FINISHED' ? quickState.position ?? null : null,
      finishTime: quickState.status === 'FINISHED' ? nowIso() : null,
      elapsedSeconds: null,
      correctedSeconds: null,
      points: 0,
      status: quickState.status,
      penalty: null,
      adjustment: null,
      notes: quickState.notes,
    };

    const updatedResults = currentRaceResults.map(r =>
      r.boatId === quickState.selectedBoatId ? newResult : r
    );
    const scoredResults = scoreRaceResults(updatedResults, rules.scoringSystem ?? 'low-point', {
      customPoints: rules.customPoints,
      nonFinisherPoints: rules.nonFinisherPoints,
    });

    update(d => ({
      ...d,
      races: (d.races || []).map(race =>
        race.id === currentRace.id ? { ...race, results: scoredResults } : race
      ),
    }), 'race.result.quickSaved');

    const nextMissing = missingBoats.find(b => b.id !== quickState.selectedBoatId);
    setQuickState({
      searchQuery: '',
      selectedBoatId: nextMissing?.id ?? null,
      position: null,
      status: 'FINISHED',
      notes: '',
    });
    showToast(t('sailing.resultSaved'), 'success');
  };

  const handleDetailSave = () => {
    if (!currentRace || !detailState.boatId) return;
    if (detailState.status === 'FINISHED' && detailState.position === null) {
      showToast(t('sailing.enterPosition'), 'error');
      return;
    }

    const existing = resultsByBoat.get(detailState.boatId);
    const newResult: RaceResult = {
      id: existing?.id ?? uid('rr'),
      raceId: currentRace.id,
      boatId: detailState.boatId,
      position: detailState.status === 'FINISHED' ? detailState.position ?? null : null,
      finishTime: detailState.finishTime,
      elapsedSeconds: detailState.elapsedSeconds,
      correctedSeconds: detailState.correctedSeconds,
      points: 0,
      status: detailState.status,
      penalty: detailState.penalty,
      adjustment: detailState.adjustment,
      notes: detailState.notes,
    };

    const updatedResults = currentRaceResults.map(r =>
      r.boatId === detailState.boatId ? newResult : r
    );
    const scoredResults = scoreRaceResults(updatedResults, rules.scoringSystem ?? 'low-point', {
      customPoints: rules.customPoints,
      nonFinisherPoints: rules.nonFinisherPoints,
    });

    update(d => ({
      ...d,
      races: (d.races || []).map(race =>
        race.id === currentRace.id ? { ...race, results: scoredResults } : race
      ),
    }), 'race.result.detailSaved');

    const nextMissing = missingBoats.find(b => b.id !== detailState.boatId);
    setDetailState({
      boatId: nextMissing?.id ?? null,
      position: null,
      finishTime: null,
      elapsedSeconds: null,
      correctedSeconds: null,
      status: 'FINISHED',
      penalty: null,
      adjustment: null,
      notes: '',
      committeeNote: '',
    });
    showToast(t('sailing.resultSaved'), 'success');
  };

  const parseTimeToSeconds = (timeStr: string | null): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  };

  const formatSeconds = (sec: number | null): string => {
    if (sec === null || sec === undefined) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const parseImportCsv = useCallback((csv: string) => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return { preview: [], errors: ['Empty CSV'] };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['sailnumber', 'position', 'status'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) return { preview: [], errors: [`Missing columns: ${missing.join(', ')}`] };

    const preview: ImportPreviewRow[] = [];
    const allErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => row[h] = values[idx] ?? '');

      const sailNumber = row.sailnumber;
      const boat = boats.find(b => b.sailNumber === sailNumber);
      const errors: string[] = [];

      if (!boat) errors.push(`Boat with sail number ${sailNumber} not found`);
      if (row.position && isNaN(Number(row.position))) errors.push('Invalid position');
      if (row.status && !['FINISHED', 'DNS', 'DNF', 'DSQ', 'OCS', 'RET', 'RDG', 'DNE', 'DGM', 'BFD', 'UFD', 'SCP', 'DNC', 'NSC', 'DPI', 'ZFP'].includes(row.status.toUpperCase())) {
        errors.push(`Invalid status: ${row.status}`);
      }

      const parsed: Partial<RaceResult> | null = errors.length === 0 ? {
        boatId: boat!.id,
        position: row.position ? Number(row.position) : null,
        status: (row.status?.toUpperCase() as RaceResultStatus) || 'FINISHED',
        finishTime: row.finishtime ? new Date(row.finishtime).toISOString() : null,
        elapsedSeconds: row.elapsed ? parseTimeToSeconds(row.elapsed) : null,
        correctedSeconds: row.corrected ? parseTimeToSeconds(row.corrected) : null,
        penalty: row.penalty ? { id: uid('pen'), type: 'points' as const, value: Number(row.penalty), reason: 'CSV import', boatId: boat!.id, isRedress: false } : null,
        adjustment: row.adjustment ? Number(row.adjustment) : null,
        notes: row.notes || '',
      } : null;

      preview.push({ original: row, parsed, errors, boat: boat ?? null });
      if (errors.length) allErrors.push(`Row ${i + 1}: ${errors.join('; ')}`);
    }

    return { preview, errors: allErrors };
  }, [boats]);

  const handleImportCsvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setImportCsv(e.target.value);
    const { preview, errors } = parseImportCsv(e.target.value);
    setImportPreview(preview);
    setImportErrors(errors);
  };

  const handleImportConfirm = () => {
    if (!currentRace) return;
    const validRows = importPreview.filter(r => r.parsed && r.errors.length === 0);
    if (validRows.length === 0) {
      showToast(t('sailing.noValidRows'), 'error');
      return;
    }

    const updatedResults = currentRaceResults.map(r => {
      const match = validRows.find(v => v.parsed?.boatId === r.boatId);
      if (!match || !match.parsed) return r;
      return { ...r, ...match.parsed, id: r.id, raceId: currentRace.id, boatId: r.boatId, points: 0 };
    });

    validRows.forEach(v => {
      if (v.parsed && !updatedResults.some(r => r.boatId === v.parsed!.boatId)) {
        updatedResults.push({ ...v.parsed!, id: uid('rr'), raceId: currentRace.id, points: 0, boatId: v.parsed!.boatId!, status: v.parsed!.status ?? 'FINISHED' });
      }
    });

    const scoredResults = scoreRaceResults(updatedResults, rules.scoringSystem ?? 'low-point', {
      customPoints: rules.customPoints,
      nonFinisherPoints: rules.nonFinisherPoints,
    });

    update(d => ({
      ...d,
      races: (d.races || []).map(race =>
        race.id === currentRace.id ? { ...race, results: scoredResults } : race
      ),
    }), 'race.result.imported');

    setImportCsv('');
    setImportPreview([]);
    setImportErrors([]);
    setShowImportConfirm(false);
    showToast(t('sailing.imported', { count: validRows.length }), 'success');
  };

  if (!currentRace) {
    return (
      <Page title={t('sailing.results')} sub={t('sailing.resultsHint')}>
        <Alert tone="warn">{t('sailing.noRaceSelected')}</Alert>
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => go('sailing-races')}>{t('sailing.manageRaces')}</Button>
        </div>
      </Page>
    );
  }

  const raceBoats = contextBoats;
  const scoredCount = currentRaceResults.filter(r => r.status === 'FINISHED').length;

  return (
    <Page title={t('sailing.results')} sub={t('sailing.resultsSub')}>
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>{toast.message}</div>
      ))}

      <Panel title={t('sailing.contextSelector')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Field label={t('sailing.race')}>
            <Select
              value={selectedRaceId ?? ''}
              onChange={setSelectedRaceId}
              options={races.map(r => ({ id: r.id, label: `${t('sailing.raceShort')} ${r.number}` + (r.flightId ? ` (Flight ${r.flightId.slice(0,6)})` : '') }))}
            />
          </Field>
          <Field label={t('sailing.boatClass')}>
            <Select
              value={selectedClassId ?? ''}
              onChange={setSelectedClassId}
              options={boatClasses.map(c => ({ id: c.id, label: c.name }))}
            />
          </Field>
          {domain.flights?.length && (
            <Field label={t('sailing.flight')}>
              <Select
                value={selectedFlightId ?? ''}
                onChange={setSelectedFlightId}
                options={[
                  { id: '', label: t('sailing.allFlights') },
                  ...(domain.flights || []).map(f => ({ id: f.id, label: f.name }))
                ]}
              />
            </Field>
          )}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          {t('sailing.raceStatus', { race: currentRace.number, scored: scoredCount, total: raceBoats.length })}
        </div>
      </Panel>

      <Tabs
        active={mode}
        onChange={(id: string) => setMode(id as EntryMode)}
        tabs={[
          { id: 'quick', label: t('sailing.quickEntry') },
          { id: 'detail', label: t('sailing.detailEntry') },
          { id: 'import', label: t('sailing.importCsv') },
        ]}
      />
      {mode === 'quick' && <div />}
      {mode === 'detail' && <div />}
      {mode === 'import' && <div />}
      <div />
    </Page>
  );
}