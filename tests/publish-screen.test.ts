// The online-preview screen, rendered for real.
//
// Sharing is the one screen an organizer touches while people are waiting, so the
// states it can be in are pinned here: what it offers before a link exists, what it
// shows once one does, and what it never asks for. These are rendered assertions
// on the markup, not on the component's internals.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import Publish from '../src/ui/Publish';
import { DEFAULT_SETTINGS, type AppSettings, type Domain } from '../src/engine/types';
import { setLocale } from '../src/i18n';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';

// The screen reads the app through context; the context is replaced so the states
// can be rendered without a mounted store.
const ctx = vi.hoisted(() => ({ app: null as unknown as { domain: unknown; settings: unknown; setSettings: (s: unknown) => void } }));
vi.mock('../src/state/store', () => ({ useApp: () => ctx.app }));

const domain = {
  tournament: {
    id: 't1', name: 'Club Final 2026', sport: 'Football', individualOrTeam: 'team',
    format: 'round-robin', dates: { start: null, end: null }, location: '', visibility: 'private',
    rules: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', archived: false,
  },
  participants: [], matches: [], groups: [], resources: [], audit: [],
} as unknown as Domain;

function render(settings: Partial<AppSettings> = {}): string {
  ctx.app = { domain, settings: { ...DEFAULT_SETTINGS, ...settings }, setSettings: () => {} };
  return renderToStaticMarkup(React.createElement(Publish));
}

afterEach(() => setLocale('en'));

describe('before the link exists', () => {
  it('offers one button, and asks for nothing to be typed', () => {
    const html = render();
    expect(html).toContain(en['pub.activate']);
    // No token field unless a token was set by hand: a password box an organizer
    // has never heard of is the first thing that stops them.
    expect(html).not.toContain('type="password"');
    // And nothing that only makes sense once a link exists.
    expect(html).not.toContain(en['pub.delete']);
    expect(html).not.toContain(en['pub.copy']);
  });

  it('shows the link it would create, so the choice is not blind', () => {
    expect(render()).toContain('tooboxplatform.online/club-final-2026');
  });

  it('lets the visibility be chosen before anything is sent', () => {
    const html = render();
    expect(html).toContain(en['pub.unlisted']);
    expect(html).toContain(en['pub.public']);
  });

  it('speaks the organizer\'s language', () => {
    setLocale('pl');
    const html = render();
    expect(html).toContain(pl['pub.activate']);
    expect(html).not.toContain(en['pub.activate']);
  });
});

describe('once the link is live', () => {
  const live = { publishEnabled: true, publishSlug: 'club-final-2026' };

  it('shows the link, and the ways to act on it', () => {
    const html = render(live);
    expect(html).toContain('tooboxplatform.online/club-final-2026');
    for (const key of ['pub.copy', 'pub.send', 'pub.delete'] as const) {
      expect(html, key).toContain(en[key]);
    }
    expect(html).not.toContain(en['pub.activate']);
  });

  it('keeps the link that was activated, even after a rename', () => {
    // The pinned slug decides: a link already handed out must not move because
    // somebody fixed a typo in the event name.
    const renamed = { ...domain, tournament: { ...domain.tournament, name: 'Club Final 2027' } };
    ctx.app = { domain: renamed, settings: { ...DEFAULT_SETTINGS, ...live }, setSettings: () => {} };
    expect(renderToStaticMarkup(React.createElement(Publish))).toContain('tooboxplatform.online/club-final-2026');
  });

  it('still asks for no token', () => {
    expect(render(live)).not.toContain('type="password"');
  });

  it('shows the token panel only to someone who set their own', () => {
    const html = render({ ...live, publishToken: 'my-own-site-token' });
    expect(html).toContain('type="password"');
    expect(html).toContain(en['pub.tokenSave']);
  });
});
