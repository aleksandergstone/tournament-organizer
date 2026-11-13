import { useApp } from '../../state/store';
import { useState } from 'react';
import { Boat, BoatClass, Crew, uid, nowIso } from '../../engine/types';
import { useT } from '../../i18n';
import { Page, Panel, Field, Alert } from '../kit';

export default function SailingBoats() {
  const { domain, update, go } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [boatDraft, setBoatDraft] = useState<Partial<Boat> & { crewId?: string } | null>(null);

  const boats = domain.boats || [];
  const boatClasses = domain.boatClasses || [];
  const crews = domain.crews || [];

  if (boatClasses.length === 0) {
    return (
      <Page title={t('sailing.boats')} sub={t('sailing.boatsHint')}>
        <Alert tone="warn">{t('sailing.addBoatClassFirst')}</Alert>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => go('sailing-classes')}>
            {t('common.add')} {t('sailing.boatClass')}
          </button>
        </div>
      </Page>
    );
  }

  const addBoat = () => {
    if (!boatDraft?.name?.trim()) return;
    const classId = boatDraft.classId;
    if (!classId) return;

    const newBoat: Boat = {
      id: uid('boat'),
      name: boatDraft.name.trim(),
      sailNumber: boatDraft.sailNumber?.trim() || '',
      classId,
      country: boatDraft.country ?? null,
      buildYear: boatDraft.buildYear ?? null,
      owner: boatDraft.owner ?? null,
      club: boatDraft.club ?? null,
      teamName: boatDraft.teamName ?? null,
      skipperId: boatDraft.skipperId ?? undefined,
      crewIds: boatDraft.crewIds ?? [],
      active: true,
      measurementCert: '',
      sailCertificate: boatDraft.sailCertificate ?? null,
      notes: boatDraft.notes ?? null,
    };

    update(d => {
      const nextBoats = [...(d.boats || []), newBoat];
      const nextCrews = (d.crews || []).map(c => {
        if (boatDraft.crewId && c.id === boatDraft.crewId) {
          return { ...c, boatId: newBoat.id };
        }
        return c;
      });
      return {
        ...d,
        boats: nextBoats,
        crews: nextCrews,
      };
    }, 'boat.added');
    setEditingId(null);
    setBoatDraft(null);
  };

  const updateBoat = (id: string, changes: Partial<Boat>) => {
    update(d => {
      const current = (d.boats || []).find(boat => boat.id === id);
      const nextBoat = current ? { ...current, ...changes } : null;
      const races = (d.races || []).map(race => {
        if (!current || !nextBoat) return race;
        let results = race.results;
        if (race.classId === current.classId) results = results.filter(result => result.boatId !== id);
        if (race.classId === nextBoat.classId && !results.some(result => result.boatId === id)) {
          results = [...results, {
            id: uid('rr'), raceId: race.id, boatId: id, position: null,
            finishTime: null, elapsedSeconds: null, correctedSeconds: null,
            points: 0, status: 'DNS' as const, penalty: null, adjustment: null, notes: '',
          }];
        }
        return { ...race, results };
      });
      return {
        ...d,
        boats: (d.boats || []).map(boat => boat.id === id ? { ...boat, ...changes } : boat),
        races,
      };
    }, 'boat.updated');
    setEditingId(null);
    setBoatDraft(null);
  };

  const toggleActive = (boat: Boat) => {
    update(d => ({
      ...d,
      boats: (d.boats || []).map(b => b.id === boat.id ? { ...b, active: !b.active } : b),
    }), 'boat.toggled');
  };

  const deleteBoat = (id: string) => {
    update(d => ({
      ...d,
      boats: (d.boats || []).filter(b => b.id !== id),
      crews: (d.crews || []).map(c => c.boatId === id ? { ...c, boatId: null } : c),
    }), 'boat.deleted');
  };

  const startEdit = (b: Boat) => {
    setEditingId(b.id);
    const assignedCrew = (domain.crews || []).find(c => c.boatId === b.id);
    setBoatDraft({ ...b, crewId: assignedCrew?.id });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setBoatDraft(null);
  };

  const getClassName = (classId: string) => {
    const c = boatClasses.find(cls => cls.id === classId);
    return c ? c.name : t('common.unknown');
  };

  const getCrewName = (crewId: string | undefined | null) => {
    if (!crewId) return t('common.unknown');
    const c = crews.find(cr => cr.id === crewId);
    return c ? c.name : t('common.unknown');
  };

  const setField = (key: keyof Boat, value: string | number | boolean | null | string[] | undefined) => {
    setBoatDraft(current => current ? { ...current, [key]: value } : { ...boatDraft!, [key]: value });
  };

  const setCrewId = (value: string | undefined) => {
    setBoatDraft(current => current ? { ...current, crewId: value } : { ...boatDraft!, crewId: value });
  };

  const d = boatDraft!;

  return (
    <Page title={t('sailing.boats')} sub={t('sailing.boatsHint')}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setEditingId('new')}>
          {t('common.add')} {t('sailing.boat')}
        </button>
      </div>

      {boats.length === 0 ? (
        <Panel title={t('sailing.noBoats')} actions={null}>
          <p className="muted">{t('sailing.noBoatsNote')}</p>
        </Panel>
      ) : (
        <Panel title={t('sailing.boatsList')} actions={null}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boats.map(boat => {
              const boatClass = boatClasses.find(c => c.id === boat.classId);
              const assignedCrew = crews.find(c => c.boatId === boat.id);
              return (
                <div key={boat.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{boat.name || t('sailing.unnamedBoat')}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {boat.sailNumber ? `Sail: ${boat.sailNumber} · ` : ''}
                      {boatClass ? `Klasa: ${boatClass.name}` : t('common.unknown')}
                      {boat.country ? ` · Kraj: ${boat.country}` : ''}
                      {boat.buildYear ? ` · Rocznik: ${boat.buildYear}` : ''}
                      {assignedCrew ? ` · Załoga: ${assignedCrew.name}` : ` · ${t('sailing.noCrewAssigned')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge ${boat.active ? '' : 'muted'}`}>
                      {boat.active ? t('sailing.active') : t('sailing.inactive')}
                    </span>
                    <button className="btn" onClick={() => startEdit(boat)}>{t('common.edit')}</button>
                    <button className="btn danger" onClick={() => deleteBoat(boat.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {editingId === 'new' || (editingId !== null && boatDraft) ? (
        <Panel title={editingId === 'new' ? t('sailing.addBoat') : t('sailing.editBoat')}>
          <Field label={t('sailing.boatName')} required>
            <input
              autoFocus
              value={d.name ?? ''}
              placeholder={t('sailing.boatNamePlaceholder')}
              onChange={e => setField('name', e.target.value)}
            />
          </Field>
          <Field label={t('sailing.sailNumber')}>
            <input
              value={d.sailNumber ?? ''}
              placeholder={t('sailing.sailNumberPlaceholder')}
              onChange={e => setField('sailNumber', e.target.value)}
            />
          </Field>
          <Field label={t('sailing.boatClass')} required>
            <select
              value={d.classId ?? ''}
              onChange={e => setField('classId', e.target.value)}
            >
              <option value="">{t('sailing.selectClass')}</option>
              {boatClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.classCode || '—'})</option>
              ))}
            </select>
          </Field>
          <Field label={t('sailing.assignCrew')}>
            <select
              value={d.crewId ?? ''}
              onChange={e => setCrewId(e.target.value || undefined)}
            >
              <option value="">{t('common.unknown')}</option>
              {crews.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('sailing.country')}>
            <input
              maxLength={3}
              value={d.country ?? ''}
              placeholder={t('sailing.nationalityHint')}
              onChange={e => setField('country', e.target.value.toUpperCase() || null)}
            />
          </Field>
          <Field label={t('sailing.buildYear')}>
            <input
              type="number"
              min={1900}
              max={2100}
              value={d.buildYear ?? ''}
              onChange={e => setField('buildYear', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label={t('sailing.owner')}>
            <input
              value={d.owner ?? ''}
              placeholder={t('sailing.ownerPlaceholder')}
              onChange={e => setField('owner', e.target.value || null)}
            />
          </Field>
          <Field label={t('sailing.club')}>
            <input
              value={d.club ?? ''}
              placeholder={t('sailing.clubPlaceholder')}
              onChange={e => setField('club', e.target.value || null)}
            />
          </Field>
          <Field label={t('sailing.sailCertificate')}>
            <input
              value={d.sailCertificate ?? ''}
              placeholder={t('sailing.sailCertificate')}
              onChange={e => setField('sailCertificate', e.target.value || null)}
            />
          </Field>
          <Field label={t('sailing.notes')}>
            <textarea
              rows={3}
              value={d.notes ?? ''}
              onChange={e => setField('notes', e.target.value || null)}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={cancelEdit}>{t('common.cancel')}</button>
            <button className="btn primary" onClick={editingId === 'new' ? addBoat : () => updateBoat(editingId, d as Boat)}>
              {editingId === 'new' ? t('common.add') : t('common.save')}
            </button>
          </div>
        </Panel>
      ) : null}

      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => go('sailing-classes')}>
          {t('common.manage')} {t('sailing.boatClasses')}
        </button>
        <button className="btn" onClick={() => go('sailing-crews')}>
          {t('common.manage')} {t('sailing.crews')}
        </button>
      </div>
    </Page>
  );
}

