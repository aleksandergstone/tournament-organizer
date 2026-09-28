import React from 'react';
import { t } from '../i18n';

// Last-resort UI safety net: if a render bug ever crashes the screen, the app
// shows a calm, actionable page instead of a white screen. Data is safe —
// autosave persisted every committed change before the crash.
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', padding: 24, textAlign: 'center', fontFamily: 'inherit' }}>
        <h1 style={{ fontSize: 20 }}>{t('error.crash.title')}</h1>
        <p style={{ color: '#6b7280' }}>
          {t('error.crash.body')}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>{String(this.state.error?.message ?? this.state.error)}</p>
        <button
          onClick={() => { this.setState({ error: null }); }}
          style={{ padding: '8px 18px', border: '1px solid #e2e5ea', background: '#fff', borderRadius: 6, cursor: 'pointer', marginRight: 8 }}
        >{t('common.retry')}</button>
        <button
          onClick={() => { window.location.reload(); }}
          style={{ padding: '8px 18px', border: '1px solid #e2e5ea', background: '#fff', borderRadius: 6, cursor: 'pointer' }}
        >{t('common.reload')}</button>
      </div>
    );
  }
}
