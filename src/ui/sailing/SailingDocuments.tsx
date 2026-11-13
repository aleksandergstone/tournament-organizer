import { useApp } from '../../state/store';
import { useState } from 'react';
import { SailingInstruction, NoticeOfRace, PublicDocument, Attachment, uid, nowIso } from '../../engine/types';
import { useT } from '../../i18n';
import { Page, Panel, Field, Alert } from '../kit';

export default function SailingDocuments() {
  const { domain, update } = useApp();
  const t = useT();
  const [activeTab, setActiveTab] = useState<'si' | 'nor' | 'public'>('si');

  const si = domain.sailingInstructions || [];
  const nor = domain.noticeOfRace || [];
  const publicDocs = domain.publicDocuments || [];

  const addSI = () => {
    const newSI: SailingInstruction = {
      id: uid('si'),
      title: 'Sailing Instructions',
      content: '',
      attachments: [],
      version: 1,
      updatedAt: nowIso(),
      published: false,
    };
    update(d => ({ ...d, sailingInstructions: [...d.sailingInstructions || [], newSI] }), 'si.added');
  };

  const updateSI = (id: string, changes: Partial<SailingInstruction>) => {
    update(d => ({
      ...d,
      sailingInstructions: (d.sailingInstructions || []).map(s => s.id === id ? { ...s, ...changes, updatedAt: nowIso() } : s)
    }), 'si.updated');
  };

  const deleteSI = (id: string) => {
    update(d => ({
      ...d,
      sailingInstructions: (d.sailingInstructions || []).filter(s => s.id !== id)
    }), 'si.deleted');
  };

  const addNOR = () => {
    const newNOR: NoticeOfRace = {
      id: uid('nor'),
      title: 'Notice of Race',
      content: '',
      attachments: [],
      version: 1,
      updatedAt: nowIso(),
      published: false,
    };
    update(d => ({ ...d, noticeOfRace: [...d.noticeOfRace || [], newNOR] }), 'nor.added');
  };

  const updateNOR = (id: string, changes: Partial<NoticeOfRace>) => {
    update(d => ({
      ...d,
      noticeOfRace: (d.noticeOfRace || []).map(n => n.id === id ? { ...n, ...changes, updatedAt: nowIso() } : n)
    }), 'nor.updated');
  };

  const deleteNOR = (id: string) => {
    update(d => ({
      ...d,
      noticeOfRace: (d.noticeOfRace || []).filter(n => n.id !== id)
    }), 'nor.deleted');
  };

  const addPublicDoc = () => {
    const newDoc: PublicDocument = {
      id: uid('pub'),
      title: '',
      type: 'sailing-instruction',
      content: '',
      attachments: [],
      locale: undefined,
    };
    update(d => ({ ...d, publicDocuments: [...d.publicDocuments || [], newDoc] }), 'publicDoc.added');
  };

  const updatePublicDoc = (id: string, changes: Partial<PublicDocument>) => {
    update(d => ({
      ...d,
      publicDocuments: (d.publicDocuments || []).map(p => p.id === id ? { ...p, ...changes } : p)
    }), 'publicDoc.updated');
  };

  const deletePublicDoc = (id: string) => {
    update(d => ({
      ...d,
      publicDocuments: (d.publicDocuments || []).filter(p => p.id !== id)
    }), 'publicDoc.deleted');
  };

  const togglePublish = (type: 'si' | 'nor', id: string) => {
    if (type === 'si') {
      update(d => ({
        ...d,
        sailingInstructions: (d.sailingInstructions || []).map(s =>
          s.id === id ? { ...s, published: !s.published, updatedAt: nowIso() } : s
        )
      }), 'si.published');
    } else {
      update(d => ({
        ...d,
        noticeOfRace: (d.noticeOfRace || []).map(n =>
          n.id === id ? { ...n, published: !n.published, updatedAt: nowIso() } : n
        )
      }), 'nor.published');
    }
  };

  return (
    <Page title={t('sailing.documents')}>
      <div className="section-head">
        <h2>{t('sailing.documents')}</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>
        <button
          className={activeTab === 'si' ? 'btn primary' : 'btn'}
          onClick={() => setActiveTab('si')}
        >
          {t('sailing.sailingInstructions')}
        </button>
        <button
          className={activeTab === 'nor' ? 'btn primary' : 'btn'}
          onClick={() => setActiveTab('nor')}
        >
          {t('sailing.noticeOfRace')}
        </button>
        <button
          className={activeTab === 'public' ? 'btn primary' : 'btn'}
          onClick={() => setActiveTab('public')}
        >
          {t('sailing.publicDocuments')}
        </button>
      </div>

      {activeTab === 'si' && (
        <Panel title={t('sailing.sailingInstructions')} sub={t('sailing.sailingInstructionsSub')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>{t('sailing.sailingInstructionsList')}</h3>
            <button className="btn primary" onClick={addSI}>
              {t('common.add')} {t('sailing.sailingInstructions')}
            </button>
          </div>
          {si.length === 0 ? (
            <Panel title={t('sailing.noSailingInstructions')} actions={null}>
              <p className="muted">{t('sailing.noSailingInstructions')}</p>
            </Panel>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {si.map(doc => (
                <div key={doc.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      <strong>{doc.title}</strong>
                      <br />
                      <span className="muted">
                        v{doc.version} • {new Date(doc.updatedAt).toLocaleString()} •
                        <span className={doc.published ? 'badge' : 'badge muted'}>
                          {doc.published ? t('sailing.published') : t('sailing.draft')}
                        </span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => togglePublish('si', doc.id)}>
                        {doc.published ? t('sailing.unpublish') : t('sailing.publish')}
                      </button>
                      <button className="btn danger" onClick={() => deleteSI(doc.id)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                  <Field label={t('sailing.common.content')}>
                    <textarea
                      rows={6}
                      defaultValue={doc.content}
                      onBlur={e => updateSI(doc.id, { content: e.target.value })}
                      placeholder={t('sailing.sailingInstructionsPlaceholder')}
                    />
                  </Field>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" defaultChecked={doc.published} onChange={e => togglePublish('si', doc.id)} />
                      {t('sailing.publishToPublic')}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'nor' && (
        <Panel title={t('sailing.noticeOfRace')} sub={t('sailing.noticeOfRaceSub')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>{t('sailing.noticeOfRaceList')}</h3>
            <button className="btn primary" onClick={addNOR}>
              {t('common.add')} {t('sailing.noticeOfRace')}
            </button>
          </div>
          {nor.length === 0 ? (
            <Panel title={t('sailing.noNoticeOfRace')} actions={null}>
              <p className="muted">{t('sailing.noNoticeOfRace')}</p>
            </Panel>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {nor.map(doc => (
                <div key={doc.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      <strong>{doc.title}</strong>
                      <br />
                      <span className="muted">
                        v{doc.version} • {new Date(doc.updatedAt).toLocaleString()} •
                        <span className={doc.published ? 'badge' : 'badge muted'}>
                          {doc.published ? t('sailing.published') : t('sailing.draft')}
                        </span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => togglePublish('nor', doc.id)}>
                        {doc.published ? t('sailing.unpublish') : t('sailing.publish')}
                      </button>
                      <button className="btn danger" onClick={() => deleteNOR(doc.id)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                  <Field label={t('sailing.common.content')}>
                    <textarea
                      rows={6}
                      defaultValue={doc.content}
                      onBlur={e => updateNOR(doc.id, { content: e.target.value })}
                      placeholder={t('sailing.noticeOfRacePlaceholder')}
                    />
                  </Field>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" defaultChecked={doc.published} onChange={e => togglePublish('nor', doc.id)} />
                      {t('sailing.publishToPublic')}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {activeTab === 'public' && (
        <Panel title={t('sailing.publicDocuments')} sub={t('sailing.publicDocumentsSub')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>{t('sailing.publicDocumentsList')}</h3>
            <button className="btn primary" onClick={addPublicDoc}>
              {t('common.add')} {t('sailing.publicDocument')}
            </button>
          </div>
          {publicDocs.length === 0 ? (
            <Panel title={t('sailing.noPublicDocuments')} actions={null}>
              <p className="muted">{t('sailing.noPublicDocuments')}</p>
            </Panel>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {publicDocs.map(doc => (
                <div key={doc.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                    <Field label={t('common.name')}>
                      <input
                        defaultValue={doc.title}
                        onBlur={e => updatePublicDoc(doc.id, { title: e.target.value })}
                      />
                    </Field>
                    <Field label={t('sailing.documentType')}>
                      <select defaultValue={doc.type} onChange={e => updatePublicDoc(doc.id, { type: e.target.value as PublicDocument['type'] })}>
                        <option value="sailing-instruction">{t('sailing.documentType.sailingInstruction')}</option>
                        <option value="notice-of-race">{t('sailing.documentType.noticeOfRace')}</option>
                        <option value="amendment">{t('sailing.documentType.amendment')}</option>
                        <option value="bulletin">{t('sailing.documentType.bulletin')}</option>
                        <option value="other">{t('sailing.documentType.other')}</option>
                      </select>
                    </Field>
                    <Field label={t('sailing.externalUrl')}>
                      <input
                        defaultValue={doc.url || ''}
                        onBlur={e => updatePublicDoc(doc.id, { url: e.target.value || undefined })}
                        placeholder="https://..."
                      />
                    </Field>
                    <Field label={t('sailing.locale')}>
                      <input
                        defaultValue={doc.locale || ''}
                        onBlur={e => updatePublicDoc(doc.id, { locale: e.target.value || undefined })}
                        placeholder="en, pl, de, es"
                      />
                    </Field>
                  </div>
                  <Field label={t('sailing.common.content')}>
                    <textarea
                      rows={4}
                      defaultValue={doc.content}
                      onBlur={e => updatePublicDoc(doc.id, { content: e.target.value })}
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn danger" onClick={() => deletePublicDoc(doc.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </Page>
  );
}