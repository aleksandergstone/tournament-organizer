import { useApp } from '../../state/store';
import { useState } from 'react';
import { Crew, CrewMember, Participant, uid, nowIso } from '../../engine/types';
import { useT } from '../../i18n';
import { Page, Panel, Field, Alert, Switch } from '../kit';

type RoleKey = 'skipper' | 'crew' | 'tactician' | 'navigator' | 'bowman' | 'other';

const ROLE_LABELS: Record<RoleKey, string> = {
  skipper: 'Sternik / Skipper',
  crew: 'Crew / Załoga',
  tactician: 'Taktik',
  navigator: 'Nawigator',
  bowman: 'Dziób',
  other: 'Inny',
};

export default function SailingCrews() {
  const { domain, update } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [crewDraft, setCrewDraft] = useState<Partial<Crew> | null>(null);

  const crews = domain.crews || [];
  const participants = domain.participants || [];
  const boats = domain.boats || [];

  const participantOptions = participants.filter(p => p.active).map(p => ({ id: p.id, name: p.name }));

  const addCrew = () => {
    if (!crewDraft?.name?.trim()) return;
    const newCrew: Crew = {
      id: uid('crew'),
      name: crewDraft.name.trim(),
      nationality: crewDraft.nationality ?? null,
      boatId: crewDraft.boatId ?? null,
      members: crewDraft.members ?? [],
      active: crewDraft.active ?? true,
      notes: crewDraft.notes ?? null,
    };
    update(d => ({ ...d, crews: [...(d.crews || []), newCrew] }), 'crew.added');
    setEditingId(null);
    setCrewDraft(null);
  };

  const updateCrew = (id: string, changes: Partial<Crew>) => {
    update(d => ({
      ...d,
      crews: (d.crews || []).map(c => c.id === id ? { ...c, ...changes } : c),
    }), 'crew.updated');
    setEditingId(null);
    setCrewDraft(null);
  };

  const deleteCrew = (id: string) => {
    update(d => ({ ...d, crews: (d.crews || []).filter(c => c.id !== id) }), 'crew.deleted');
  };

  const startEdit = (c: Crew) => {
    setEditingId(c.id);
    setCrewDraft({ ...c, members: [...c.members] });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCrewDraft(null);
  };

  const addMember = () => {
    if (!crewDraft) return;
    const newMember: CrewMember = {
      id: uid('crew-member'),
      participantId: '',
      role: 'crew',
    };
    setCrewDraft({ ...crewDraft, members: [...(crewDraft.members ?? []), newMember] });
  };

  const removeMember = (memberId: string) => {
    if (!crewDraft) return;
    setCrewDraft({ ...crewDraft, members: (crewDraft.members ?? []).filter(m => m.id !== memberId) });
  };

  const setMemberField = (memberId: string, field: keyof CrewMember, value: string | number | null) => {
    if (!crewDraft) return;
    setCrewDraft({
      ...crewDraft,
      members: (crewDraft.members ?? []).map(m =>
        m.id === memberId ? { ...m, [field]: value } : m
      ),
    });
  };

  const setMemberRole = (memberId: string, role: RoleKey) => {
    if (!crewDraft) return;
    setCrewDraft({
      ...crewDraft,
      members: (crewDraft.members ?? []).map(m =>
        m.id === memberId ? { ...m, role } : m
      ),
    });
  };

  const setField = (key: keyof Crew, value: string | number | boolean | null) => {
    setCrewDraft(current => current ? { ...current, [key]: value } : { ...crewDraft!, [key]: value });
  };

  const cd = crewDraft!;
  const members = cd.members ?? [];

  const hasSkipper = members.some(m => m.role === 'skipper');

  const getParticipantName = (participantId: string) => {
    const p = participants.find(p => p.id === participantId);
    return p ? p.name : t('common.unknown');
  };

  return (
    <Page title={t('sailing.crews')} sub={t('sailing.crewsHint')}>
      {crews.length === 0 ? (
        <Panel title={t('sailing.noCrews')} actions={null}>
          <p className="muted">{t('sailing.addCrewsFirst')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={() => setEditingId('new')}>
              {t('common.add')} {t('sailing.crew')}
            </button>
          </div>
        </Panel>
      ) : (
        <Panel title={t('sailing.crewsList')} actions={null}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {crews.map(c => {
              const boat = boats.find(b => b.id === c.boatId);
              const skipper = c.members.find(m => m.role === 'skipper');
              return (
                <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {boat ? `Łódź: ${boat.name} (${boat.sailNumber})` : t('common.unknown')}
                      {c.nationality ? ` · Kraj: ${c.nationality}` : ''}
                      {skipper ? ` · Sternik: ${getParticipantName(skipper.participantId)}` : ''}
                      {` · ${c.members.length} ${c.members.length === 1 ? t('sailing.person') : t('sailing.people')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" onClick={() => startEdit(c)}>{t('common.edit')}</button>
                    <button className="btn danger" onClick={() => deleteCrew(c.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {editingId === 'new' || (editingId !== null && crewDraft) ? (
        <Panel title={editingId === 'new' ? t('sailing.addCrew') : t('sailing.editCrew')}>
          <Field label={t('sailing.crewName')} required>
            <input
              autoFocus
              value={cd.name ?? ''}
              placeholder={t('sailing.crewNamePlaceholder')}
              onChange={e => setField('name', e.target.value)}
            />
          </Field>
          <Field label={t('sailing.assignToBoat')}>
            <select
              value={cd.boatId ?? ''}
              onChange={e => setField('boatId', e.target.value || null)}
            >
              <option value="">{t('common.unknown')}</option>
              {boats.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.sailNumber})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('sailing.nationality')}>
            <input
              maxLength={3}
              value={cd.nationality ?? ''}
              placeholder={t('sailing.nationalityHint')}
              onChange={e => setField('nationality', e.target.value.toUpperCase() || null)}
            />
          </Field>
          <Field label={t('sailing.members')} hint={t('sailing.crewMembersHint')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: 'var(--surface-alt)', borderRadius: 6 }}>
                  <select
                    value={m.participantId}
                    onChange={e => setMemberField(m.id, 'participantId', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">{t('sailing.selectPerson')}</option>
                    {participantOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={m.role}
                    onChange={e => setMemberRole(m.id, e.target.value as RoleKey)}
                    style={{ width: 140 }}
                  >
                    {(['skipper', 'crew', 'tactician', 'navigator', 'bowman', 'other'] as RoleKey[]).map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  <button className="btn danger" style={{ padding: '4px 10px' }} onClick={() => removeMember(m.id)}>
                    {t('common.remove')}
                  </button>
                </div>
              ))}
              <button className="btn" type="button" onClick={addMember}>
                {t('common.add')} {t('sailing.crewMember')}
              </button>
              {!hasSkipper && (
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('sailing.skipperRecommended')}</p>
              )}
            </div>
          </Field>
          <Field label={t('sailing.crewNotes')}>
            <textarea
              rows={3}
              value={cd.notes ?? ''}
              onChange={e => setField('notes', e.target.value || null)}
            />
          </Field>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={cd.active ?? true}
                onChange={e => setField('active', e.target.checked)}
              />
              {t('sailing.active')}
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={cancelEdit}>{t('common.cancel')}</button>
            <button className="btn primary" onClick={editingId === 'new' ? addCrew : () => updateCrew(editingId, cd as Crew)}>
              {editingId === 'new' ? t('common.add') : t('common.save')}
            </button>
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
