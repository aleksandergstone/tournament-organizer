// The public link, derived rather than typed.
//
// An organizer should never be asked to invent an address for their own event. The
// link is the event's name in a form a URL can carry, and if that is already taken,
// a few more characters are appended — automatically, because "pick a different name"
// is a question nobody should have to answer before they can share results.
//
// The rules here must match the site's exactly. A slug this produces and the site
// rejects is a broken link with no error anyone can act on.

/**
 * Where published results live.
 *
 * A constant rather than a field in settings: there is one public site for this
 * build of the app, and asking the organizer to type it would only let them get it
 * wrong.
 */
export const PUBLISH_ENDPOINT = 'https://tooboxplatform.online';

/**
 * The token this build publishes with, when the organizer has not set one.
 *
 * It is in the binary on purpose. The alternative is every organizer pasting a key
 * before their first publish, for a service they never chose and cannot configure —
 * and a step that is easy to skip, or to get wrong, is a step where sharing quietly
 * does not happen.
 *
 * What this costs: anyone holding a copy of the app can overwrite results on this
 * site. That is acceptable only because the site and the app are the same project and
 * the thing being overwritten is a tournament table that the organizer can re-send.
 * A token guarding anything worth stealing does not belong in a file like this.
 *
 * The current value is 32 digits, which is long but not random — a digits-only secret
 * is far easier to guess than it looks. Treat this as adequate for the results being
 * published, not as a secret worth keeping to itself.
 *
 * `publishToken` in settings still wins, so an organizer running their own site, or
 * one whose key has been rotated, is not stuck with this value.
 */
export const BUILT_IN_PUBLISH_TOKEN = '14123781481256324123423211253431';

/** The largest slug the site accepts. Longer names are cut, not rejected. */
const MAX_LEN = 80;

/**
 * Folds an event name into a URL-safe slug.
 *
 * Diacritics are folded rather than dropped ("Zażółć gęślą jaźń" becomes
 * "zazolc-gesla-jazn"), because a Polish event name should not turn into a string
 * of consonants.
 */
export function slugify(input: string): string {
  const folded = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ø/g, 'o').replace(/Ø/g, 'O')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'Oe')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LEN)
    .replace(/-+$/g, '');
  return folded;
}

/**
 * The slug for an event, avoiding the ones already in use.
 *
 * Random rather than a counter, for a reason beyond tidiness: a counter would let
 * anyone who can open the site ask for `finał-1`, `finał-2`, … and learn how many
 * events exist and what their neighbours are called. `taken` is whatever the
 * organizer already has locally; a collision on another machine is still handled,
 * because the same suffix logic runs when the publish is accepted.
 */
export function publishSlug(name: string, taken: readonly string[] = []): string {
  const base = slugify(name) || 'turniej';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  // Effectively unreachable; a timestamp keeps it total rather than returning a
  // name that is already taken.
  return `${base}-${Date.now().toString(36)}`;
}