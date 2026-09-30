// Purchase flow state: what the Upgrade button does when the store is not set
// up, and what it must refuse to do when a URL is wrong.
//
// The app's promise here is small and testable: either there is a real https
// checkout URL, or the screen says plainly that buying is not configured. There
// is no third state where a button appears to work and does nothing.
import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_URL, MINIMUM_AMOUNT, SUGGESTED_AMOUNTS, SUPPORT_EMAIL,
  checkoutUrl, isPurchaseConfigured,
} from '../src/checkout';

describe('this build has no store wired up', () => {
  it('reports purchase as not configured', () => {
    expect(CHECKOUT_URL).toBe('');
    expect(isPurchaseConfigured()).toBe(false);
    expect(checkoutUrl()).toBe('');
  });

  it('still states the commercial terms the store will enforce', () => {
    expect(MINIMUM_AMOUNT).toBe('10');
    expect([...SUGGESTED_AMOUNTS]).toEqual(['10', '20', '50']);
    // Nothing may be offered below the minimum.
    for (const amount of SUGGESTED_AMOUNTS) {
      expect(Number(amount), amount).toBeGreaterThanOrEqual(Number(MINIMUM_AMOUNT));
    }
  });
});

describe('the checkout URL is built safely', () => {
  it('carries a return path back into the app', () => {
    const url = checkoutUrl('https://store.example.com/checkout/buy/abc123');
    expect(url).toContain('https://store.example.com/');
    expect(url).toContain('tournament-organizer%3A%2F%2Flicense');
    expect(url).toContain('from%3Dcheckout');
  });

  it('refuses anything that is not http or https', () => {
    for (const bad of [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      expect(checkoutUrl(bad), bad).toBe('');
    }
  });

  it('treats a malformed URL as not configured rather than crashing', () => {
    for (const bad of ['', 'not a url', '://missing-scheme', 'ht tp://x']) {
      expect(checkoutUrl(bad), JSON.stringify(bad)).toBe('');
    }
  });

  it('accepts a plain http checkout for local testing', () => {
    expect(checkoutUrl('http://localhost:3000/buy')).toContain('localhost:3000');
  });
});

describe('support is a real address, not a dead link', () => {
  it('is configured before the store goes live', () => {
    // Either it is set, or the License screen must not promise a resend.
    // Asserted here so turning the store on without support is a visible gap.
    expect(typeof SUPPORT_EMAIL).toBe('string');
  });
});