// Publishing a tournament to the public site.
//
// The snapshot built here is the *only* thing that leaves the device. Two rules
// shape it:
//
// 1. It carries finished numbers, not the model. Standings are computed by the
//    engine that owns the rules; the site is a renderer. That is why this file
//    calls computeStandings instead of re-deriving a table.
// 2. It carries only what a spectator may see. No tags, no audit log, nothing the
//    organizer does not already print on the match sheet.

import { computeStandings } from './standings';
import { describeFormat } from './generate';
import { disciplineOf, matchLabel, participantLabel, venueLabel } from './discipline';
import { brandingOf, DEFAULT_BRANDING, isHexColor } from './branding';
import type { Group, Match, Participant, Tournament, VenueResource } from './types';
import { getLocale, t } from '../i18n';

export type PublishVisibility = 'private' | 'unlisted' | 'public';

export interface PublicStanding {
  participantId: string; rank: number; played: number; wins: number;
  draws: number; losses: number; points: number; diff: number | null; scored: number | null;
}

export interface Snapshot {
  v: 1;
  slug: string;
  visibility: PublishVisibility;
  publishedAt: string;
  revision: number;
  event: {
    name: string;
    discipline: string | null;
    disciplineLabel: string;
    format: string;
    formatLabel: string;
    sport: string;
    dateStart: string | null;
    dateEnd: string | null;
    venue: string | null;
    description: string;
    organizer: string | null;
    /** A small, publishable logo. Omitted rather than invented — see buildSnapshot. */
    logoUrl?: string | null;
    /** The organizer's own language, so the public page can speak it. */
    locale?: string;
    /** What the organizer put in Branding, published so the page looks like theirs. */
    branding?: {
      title?: string;
      subtitle?: string;
      edition?: string;
      note?: string;
      accent?: string;
    } | null;
  };
  terms: { match: string; participant: string; place: string; score: string };
  counts: { participants: number; matches: number; played: number; open: number };
  participants: { id: string; name: string; seed: number | null; active: boolean }[];
  standings: PublicStanding[] | null;
  groups: { id: string; name: string }[];
  matches: {
    id: string; round: number; roundName: string; groupId: string | null;
    homeId: string | null; awayId: string | null; homeName: string; awayName: string;
    homeScore: number | null; awayScore: number | null; status: string;
    scheduledAt: string | null; venue: string | null; durationMin: number | null;
  }[];
}

/** A match is finished when the engine says so, not when a score happens to exist. */
const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

/** Formats whose ranking comes from a table rather than from a bracket. */
const TABLE_FORMATS = new Set(['round-robin', 'league', 'swiss', 'groups-knockout']);

/**
 * The organizer's own wording, ready to travel.
 *
 * Only the fields a public page can show, and only when they are filled in: an
 * absent title is better than a page repeating the event's own name twice. The logo
 * is deliberately left out — it is a data URL, and it is handled (and shrunk) by
 * the caller instead.
 */
function publishableBranding(raw: Tournament['branding']): {
  title?: string; subtitle?: string; edition?: string; note?: string; accent?: string;
} | null {
  const b = brandingOf({ name: '', branding: raw });
  const out: { title?: string; subtitle?: string; edition?: string; note?: string; accent?: string } = {};
  const put = (key: 'title' | 'subtitle' | 'edition' | 'note', value: string) => {
    if (value.trim()) out[key] = value.trim();
  };
  put('title', b.eventTitle);
  put('subtitle', b.subtitle);
  put('edition', b.edition);
  put('note', b.headerNote || b.footerNote);
  // Only an accent the organizer actually chose. The default colour is the app's
  // own, and publishing it to everybody would put a mark on the page of an event
  // that never asked for one.
  if (isHexColor(b.accent) && b.accent !== DEFAULT_BRANDING.accent) out.accent = b.accent;
  return Object.keys(out).length > 0 ? out : null;
}

export interface BuildInput {
  tournament: Tournament;
  participants: Participant[];
  matches: Match[];
  groups?: Group[];
  resources?: VenueResource[];
  slug: string;
  visibility: PublishVisibility;
  revision: number;
  /** One line shown to the public. Empty is fine; nothing is invented. */
  description?: string;
  organizer?: string | null;
  /**
   * A logo small enough to travel with every publish.
   *
   * The Branding screen holds a full-size image; sending that on every update
   * would multiply the payload for a picture that is displayed at 64 pixels.
   * The caller shrinks it (see logoForPublish) and this only carries the result.
   */
  logoUrl?: string | null;
}

// Cuts the description to what a meta tag can hold, at a word boundary.
//
// The site would truncate it anyway; doing it here means what the organizer typed
// and what a visitor reads end up the same sentence, rather than the same text
// cut differently in two places.
function publicDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 400) return trimmed;
  // The ellipsis is part of the limit, not an addition to it: the site rejects a
  // longer description outright, so "400 plus a character" is a broken publish.
  const cut = trimmed.slice(0, 399);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildSnapshot(input: BuildInput): Snapshot {
  const { tournament, participants, matches, groups = [], resources = [] } = input;
  const names = new Map(participants.map(p => [p.id, p.name]));
  const resourceName = new Map(resources.map(r => [r.id, r.name]));
  const played = matches.filter(m => FINISHED.has(m.result.status)).length;
  const disc = disciplineOf(tournament);

  // A format with no table publishes `standings: null`, and the site then hides
  // the standings page entirely rather than showing an empty one.
  const table = TABLE_FORMATS.has(tournament.format)
    ? computeStandings(participants, matches, tournament.rules)
    : null;

  const venueOf = (m: Match) =>
    (m.resourceId ? resourceName.get(m.resourceId) : null) ?? m.venue ?? null;

  return {
    v: 1,
    slug: input.slug,
    visibility: input.visibility,
    publishedAt: new Date().toISOString(),
    revision: input.revision,
    event: {
      name: tournament.name || t('app.untitled'),
      discipline: tournament.discipline ?? null,
      // Empty for a neutral event: the site then omits the sport from titles
      // rather than inventing one.
      disciplineLabel: disc.id === 'generic' ? '' : t(disc.label),
      format: tournament.format,
      formatLabel: describeFormat(tournament.format),
      sport: tournament.sport,
      dateStart: tournament.dates.start ?? null,
      dateEnd: tournament.dates.end ?? null,
      venue: tournament.location ?? null,
      description: publicDescription(input.description ?? ''),
      organizer: (input.organizer ?? '').trim() || null,
      // A logo the organizer already chose, shrunk by the caller. Publishing it
      // gives the public page something to show and the share card an image;
      // without one the page simply has neither, and invents neither.
      logoUrl: input.logoUrl ?? null,
      // The language the organizer works in. The site writes its own sentences in
      // it, which is why a Polish organizer's page is not half-translated.
      locale: getLocale(),
      branding: publishableBranding(tournament.branding),
    },
    // The vocabulary is resolved here, in the organizer's language, and the site
    // renders it verbatim. That is what keeps a regatta page saying "Race".
    terms: {
      match: matchLabel(tournament),
      participant: participantLabel(tournament),
      place: venueLabel(tournament),
      score: t('common.score'),
    },
    counts: {
      participants: participants.length,
      matches: matches.length,
      played,
      open: matches.length - played,
    },
    participants: participants.map(p => ({
      id: p.id, name: p.name, seed: p.seed ?? null, active: p.active,
    })),
    standings: table
      ? table.map(r => ({
        participantId: r.participantId,
        rank: r.rank,
        played: r.played,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
        points: r.points,
        diff: typeof r.diff === 'number' ? r.diff : null,
        scored: typeof r.scored === 'number' ? r.scored : null,
      }))
      : null,
    groups: groups.map(g => ({ id: g.id, name: g.name })),
    matches: matches.map(m => ({
      id: m.id,
      round: m.round,
      roundName: m.roundName,
      groupId: m.groupId ?? null,
      homeId: m.homeId ?? null,
      awayId: m.awayId ?? null,
      // Names resolved here so the site never joins tables itself.
      homeName: m.homeId ? names.get(m.homeId) ?? '' : '',
      awayName: m.awayId ? names.get(m.awayId) ?? '' : '',
      homeScore: m.result.homeScore,
      awayScore: m.result.awayScore,
      status: m.result.status,
      scheduledAt: m.scheduledAt ?? null,
      venue: venueOf(m),
      durationMin: m.durationMin ?? null,
    })),
  };
}

/** The public URL of a tournament, or '' when it is not published. */
export function publicUrl(endpoint: string, slug: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  return slug ? `${base}/${slug}` : '';
}