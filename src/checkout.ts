// Where a purchase happens. Three values, one file, so that turning the store on
// is a single edit and nothing else in the app has to know about it.
//
// Nothing here is a secret and nothing here reaches the network by itself — the
// app only ever opens a URL in the system browser. The webhook secret, the store
// API key and the signing key live in the server's environment, never in here
// and never in the bundle.

/**
 * The hosted checkout. Paste the store's checkout URL here to switch purchase on.
 * Empty means "not configured": the License screen then says so plainly instead
 * of showing a button that pretends to sell something.
 */
export const CHECKOUT_URL = '';

/** Suggested amounts, shown on the License screen. The store enforces them. */
export const SUGGESTED_AMOUNTS = ['10', '20', '50'] as const;

/** The minimum the store enforces. The app repeats it; it does not decide it. */
export const MINIMUM_AMOUNT = '10';

/** Where a customer who lost their key writes. Shown on the License screen. */
export const SUPPORT_EMAIL = '';

/**
 * The checkout URL with a return path, so the success page can offer "activate
 * in the app" instead of making the customer find the key themselves.
 * Returns the bare URL when the store does not take query parameters.
 */
export function checkoutUrl(base: string = CHECKOUT_URL, appScheme = 'tournament-organizer'): string {
  if (!base) return '';
  try {
    const url = new URL(base);
    // Only http(s). A checkout link is configured once, by us — but a value
    // that somehow came from a project file must never become file:// or
    // javascript:.
    if (!/^https?:$/.test(url.protocol)) return '';
    url.searchParams.set('checkout[custom][activate]', `${appScheme}://license?from=checkout`);
    return url.toString();
  } catch {
    return '';   // an unparseable URL is "not configured", not a crash
  }
}

export const isPurchaseConfigured = (): boolean => checkoutUrl() !== '';

// PART2