import { useApp } from '../../state/store';
import { useState } from 'react';
import { BoatClass, uid } from '../../engine/types';
import { useT } from '../../i18n';
import { Page, Panel, Field, Alert } from '../kit';

export default function SailingClasses() {
  const { domain, update } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [classDraft, setClassDraft] = useState<Partial<BoatClass> | null>(null);

  const classes = domain.boatClasses || [];

  const addClass = () => {
    if (!classDraft?.name?.trim()) return;
    const newClass: BoatClass = {
      id: uid('class'),
      name: classDraft.name.trim(),
      classCode: classDraft.classCode?.trim() || null,
      description: classDraft.description ?? null,
      country: classDraft.country ?? null,
      crewSize: classDraft.crewSize ?? null,
      oneDesign: classDraft.oneDesign ?? true,
      classRules: classDraft.classRules ?? null,
      notes: classDraft.notes ?? null,
    };
    update(d => ({ ...d, boatClasses: [...(d.boatClasses || []), newClass] }), 'boat-class.added');
    setEditingId(null);
    setClassDraft(null);
  };

  const updateClass = (id: string, changes: Partial<BoatClass>) => {
    update(d => ({
      ...d,
      boatClasses: (d.boatClasses || []).map(c => c.id === id ? { ...c, ...changes } : c),
    }), 'boat-class.updated');
    setEditingId(null);
    setClassDraft(null);
  };

  const deleteClass = (id: string) => {
    const boats = domain.boats || [];
    const hasBoats = boats.some(b => b.classId === id);
    if (hasBoats) return;
    update(d => ({
      ...d,
      boatClasses: (d.boatClasses || []).filter(c => c.id !== id),
    }), 'boat-class.deleted');
  };

  const startEdit = (c: BoatClass) => {
    setEditingId(c.id);
    setClassDraft({ ...c });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setClassDraft(null);
  };

  const setField = (key: keyof BoatClass, value: string | number | boolean | null) => {
    setClassDraft(current => current ? { ...current, [key]: value } : { ...classDraft!, [key]: value });
  };

  const c = classDraft!;

  return (
    <Page title={t('sailing.boatClasses')} sub={t('sailing.boatClassesHint')}>
      {classes.length === 0 ? (
        <Panel title={t('sailing.noBoatClasses')} actions={null}>
          <p className="muted">{t('sailing.addBoatClassFirst')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={() => setEditingId('new')}>
              {t('common.add')} {t('sailing.boatClass')}
            </button>
          </div>
        </Panel>
      ) : (
        <>
          <Panel title={t('sailing.classesList')} actions={null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {classes.map(cls => (
                <div key={cls.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{cls.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {cls.classCode ? `Kod: ${cls.classCode} · ` : ''}
                      {cls.country ? `Kraj: ${cls.country} · ` : ''}
                      {cls.crewSize ? `Załoga: ${cls.crewSize} · ` : ''}
                      {cls.oneDesign ? t('sailing.oneDesign') : t('sailing.notOneDesign')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" onClick={() => startEdit(cls)}>{t('common.edit')}</button>
                    <button className="btn danger" onClick={() => deleteClass(cls.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {editingId === 'new' || (editingId !== null && classDraft) ? (
            <Panel title={editingId === 'new' ? t('sailing.addBoatClass') : t('sailing.editBoatClass')}>
              <Field label={t('sailing.boatClass')} required>
                <input
                  autoFocus
                  value={c.name ?? ''}
                  placeholder={t('sailing.boatClassPlaceholder')}
                  onChange={e => setField('name', e.target.value)}
                />
              </Field>
              <Field label={t('sailing.classCode')}>
                <input
                  value={c.classCode ?? ''}
                  placeholder={t('sailing.classCodePlaceholder')}
                  onChange={e => setField('classCode', e.target.value || null)}
                />
              </Field>
              <Field label={t('sailing.classDescription')}>
                <input
                  value={c.description ?? ''}
                  placeholder={t('sailing.classDescription')}
                  onChange={e => setField('description', e.target.value || null)}
                />
              </Field>
              <Field label={t('sailing.classCountry')}>
                <input
                  maxLength={3}
                  value={c.country ?? ''}
                  placeholder={t('sailing.nationalityHint')}
                  onChange={e => setField('country', e.target.value.toUpperCase() || null)}
                />
              </Field>
              <Field label={t('sailing.crewSize')}>
                <input
                  type="number"
                  min={1}
                  value={c.crewSize ?? ''}
                  onChange={e => setField('crewSize', e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                />
              </Field>
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={c.oneDesign ?? true}
                    onChange={e => setField('oneDesign', e.target.checked)}
                  />
                  {t('sailing.oneDesignClass')}
                </label>
              </div>
              <Field label={t('sailing.classRules')}>
                <textarea
                  rows={3}
                  value={c.classRules ?? ''}
                  onChange={e => setField('classRules', e.target.value || null)}
                />
              </Field>
              <Field label={t('sailing.notes')}>
                <textarea
                  rows={3}
                  value={c.notes ?? ''}
                  onChange={e => setField('notes', e.target.value || null)}
                />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn" onClick={cancelEdit}>{t('common.cancel')}</button>
                <button className="btn primary" onClick={editingId === 'new' ? addClass : () => updateClass(editingId, c as BoatClass)}>
                  {editingId === 'new' ? t('common.add') : t('common.save')}
                </button>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </Page>
  );
}
