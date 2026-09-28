// Group stage → knockout planning.
//
// The plan is computed first and shown to the organizer (qualifiers, seeding
// order, the bracket that *would* be created). Nothing in the project changes
// until the organizer confirms — cancelling leaves the project untouched.
import { pickQualifiers, QualifierPick, seedKnockout } from './generate';
import { genSingleElim } from './elim';
import { recomputeBracket } from './recompute';
import { Domain } from './model';
import { Group, Match, Participant, RuleSet, StandingRow } from './types';
import { t } from '../i18n';

export interface KnockoutQualifier {
  participantId: string;
  name: string;
  fromGroup: string;
  groupRank: number;
  points: number;
  seed: number; // position in the seeded knockout order (1 = best)
}

export interface KnockoutPlan {
  qualifiers: KnockoutQualifier[];
  seededOrder: string[];              // participant ids, best first
  matches: Match[];                   // KO bracket, rounds already offset
  roundOffset: number;
  groupMatchCount: number;
  droppedKoMatches: number;           // existing KO matches that would be replaced
  reason: string | null;              // why the plan cannot be built
}

export function planKnockout(input: {
  groups: Group[];
  standingsByGroup: Map<string, StandingRow[]>;
  participants: Participant[];
  rules: RuleSet;
  options: { perGroup: number; wildcards: number };
  existingMatches: Match[];
}): KnockoutPlan {
  const groupNames = new Map(input.groups.map(g => [g.id, g.name]));
  const names = new Map(input.participants.map(p => [p.id, p.name]));
  const groupMatchCount = input.existingMatches.filter(m => !!m.groupId).length;
  const existingKo = input.existingMatches.filter(m => !m.groupId).length;

  const fail = (reason: string): KnockoutPlan => ({
    qualifiers: [], seededOrder: [], matches: [], roundOffset: 0,
    groupMatchCount, droppedKoMatches: existingKo, reason,
  });

  if (input.groups.length === 0) return fail(t('st.planNoGroups'));
  if (groupMatchCount === 0) return fail(t('st.planNoGroupMatches'));

  const picks = pickQualifiers(input.groups, input.standingsByGroup, input.options);
  if (picks.length < 2) return fail(t('st.planNeedTwo'));
  if (picks.length % 2 !== 0) return fail(t('st.planOddCount', { n: picks.length }));

  const seeded = seedKnockout(picks, input.participants);
  const ko = genSingleElim(seeded, input.rules, { order: 'given' });
  const roundOffset = input.existingMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const koMatches = ko.matches.map(m => ({
    ...m,
    round: m.round + roundOffset,
    roundName: `KO ${m.roundName}`,
  }));

  const byPick = new Map(picks.map(p => [p.participantId, p]));
  const qualifiers: KnockoutQualifier[] = seeded.map((p, i) => {
    const pick: QualifierPick | undefined = byPick.get(p.id);
    return {
      participantId: p.id,
      name: names.get(p.id) ?? p.name,
      fromGroup: pick ? groupNames.get(pick.fromGroupId) ?? '' : '',
      groupRank: pick?.groupRank ?? 0,
      points: pick?.points ?? 0,
      seed: i + 1,
    };
  });

  return {
    qualifiers,
    seededOrder: seeded.map(p => p.id),
    matches: koMatches,
    roundOffset,
    groupMatchCount,
    droppedKoMatches: existingKo,
    reason: null,
  };
}

/** Applies a confirmed plan: group matches are kept, the KO stage is (re)built. */
export function applyPlan(domain: Domain, plan: KnockoutPlan, rules: RuleSet): Domain {
  const groupMatches = domain.matches.filter(m => !!m.groupId);
  const matches = recomputeBracket([...groupMatches, ...plan.matches]);
  return { ...domain, matches, resources: domain.resources ?? [] };
}
