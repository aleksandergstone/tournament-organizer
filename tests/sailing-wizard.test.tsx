import { describe, expect, it, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { overviewScreenForFormat, Provider } from '../src/state/store';
import Wizard from '../src/ui/Wizard';
import SailingWizard from '../src/ui/sailing/SailingWizard';
import { setLocale, t } from '../src/i18n';

function render(component: ReactNode): string {
  return renderToStaticMarkup(createElement(Provider, null, component));
}

afterEach(() => setLocale('en'));

describe('event creation entry points', () => {
  it('opens persisted sailing events in the sailing overview and regular events normally', () => {
    expect(overviewScreenForFormat('fleet-racing')).toBe('sailing-overview');
    expect(overviewScreenForFormat('match-racing')).toBe('sailing-overview');
    expect(overviewScreenForFormat('team-racing')).toBe('sailing-overview');
    expect(overviewScreenForFormat('round-robin')).toBe('overview');
  });

  it('keeps the standard tournament wizard intact and sailing formats out of its picker', () => {
    const html = render(createElement(Wizard));
    expect(html).toContain(t('wizard.title'));
    expect(html).toContain(t('wizard.name'));
    expect(html).toContain(t('wizard.create'));
    expect(html).not.toContain(t('format.fleet-racing'));
    expect(html).not.toContain(t('format.match-racing'));
    expect(html).not.toContain(t('format.team-racing'));
  });

  it('renders a dedicated sailing wizard with event, racing-format and class steps', () => {
    const html = render(createElement(SailingWizard));
    expect(html).toContain(t('sailing.wizardTitle'));
    expect(html).toContain(t('sailing.wizardStepEvent'));
    expect(html).toContain(t('sailing.wizardStepSetup'));
    expect(html).toContain(t('sailing.wizardStepClass'));
    expect(html).toContain(t('format.fleet-racing'));
    expect(html).toContain(t('format.match-racing'));
    expect(html).toContain(t('format.team-racing'));
    expect(html.length).toBeGreaterThan(1000);
  });
});
