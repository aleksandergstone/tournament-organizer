import { Match, MatchResult, Participant, RuleSet, Id, SlotSource } from './types';
import { mkMatch, nextPow2, orderParticipants, decidedWinner } from './pairings';

export function wName(r: number, total: number): string {
  const rem = total - r + 1;
  if (rem === 1) return 'WB Final';
  if (rem === 2) return 'WB Semifinal';
  return 'WB Round ' + r;
}

// Real double elimination, Winners-bracket-first design:
//  - Winners bracket: standard single-elim from seeding (byes to top seeds).
//  - Losers bracket alternates minor/major rounds (see feed rule below).
//  - Grand final: W-champion vs L-champion, W-side unbeaten. Reset match activates
//    only when the L-side wins the first final (second final decides).
// All feeds are explicit srcHome/srcAway links; recompute() resolves them from
// decided results, so corrections propagate deterministically.
export interface DoubleElimPlan { matches: Match[]; wbRounds: number; }

export function genDoubleElim(ps: Participant[], rules: RuleSet): DoubleElimPlan {
  const ordered = orderParticipants(ps.filter(p => p.active), rules);
  const n = ordered.length;
  if (n < 2) return { matches: [], wbRounds: 0 };
  const size = nextPow2(n);
  const W = Math.log2(size);
  const matches: Match[] = [];
  // --- winners bracket ---
  const byes = size - n;
  const byePlayers = ordered.slice(0, byes);
  const playing = ordered.slice(byes);
  const wByRound: Match[][] = [];
  const w1: Match[] = [];
  for (let i = 0; i < playing.length / 2; i++) {
    const a = playing[i], b = playing[playing.length - 1 - i];
    if (a && b) w1.push(tagW(mkMatch(1, wName(1, W), a.id, b.id), a.id, b.id));
  }
  for (const p of byePlayers) w1.push(tagW(mkMatch(1, wName(1, W), p.id, null), p.id, null));
  wByRound[1] = w1;
  matches.push(...w1);
  for (let r = 2; r <= W; r++) {
    const arr: Match[] = [];
    const slots = size / Math.pow(2, r);
    for (let i = 0; i < slots; i++) {
      const m = mkMatch(r, wName(r, W), null, null);
      arr.push(tagWDerived(m, wByRound[r - 1][i * 2], wByRound[r - 1][i * 2 + 1]));
    }
    wByRound[r] = arr;
    matches.push(...arr);
  }
  // --- losers bracket ---
  // FEED RULE (standard WB-first, deterministic, documented):
  //  Every WB match loser enters the LB exactly once. Each LB round assembles
  //  a participant pool of slot sources in this fixed order, then cross-half
  //  pairs it (srcs[i] vs srcs[n-1-i]):
  //   - L1 (minor): fresh losers of W1 (bye matches excluded — a bye has no
  //     loser; feeding one creates a permanently-TBD slot for
  //     non-power-of-two fields).
  //   - L(2k) (major): winners of L(2k-1) + carry-in, then fresh losers of
  //     W(k+1); for the last round (lr = maxL) that fresh source is the WB
  //     final, so L(maxL) is exactly "L survivor vs WB-final loser".
  //   - L(2k-1), k >= 2 (minor): winners of L(2k-2) + carry-in, NO fresh
  //     feed — W(k) dropouts were already consumed by L(2k-2) one round
  //     earlier (re-feeding them would strand the L survivors and give
  //     dropouts a second life).
  //  - carry-in: an odd-sized pool leaves its middle player unpaired; that
  //    player joins the next round's pool instead of being dropped.
  // PAIRING RULE inside each round:
  //  - cross-half pairing, never adjacent index pairing. For major rounds the
  //    pool is [survivors..., carry-in, fresh dropouts...] so cross-half pairs
  //    survivor i with the (n-1-i)-th fresh loser (top survivor vs lowest
  //    fresh seed) — never strongest-vs-strongest by default; for minor
  //    rounds it keeps adjacent WB-match losers/survivors apart.
  //  - rematch avoidance: both rules are structural (fixed at generation), so
  //    recompute stays a pure function of decided results. Additionally,
  //    recordResult() performs a best-effort deterministic rematch swap at
  //    entry time ONLY when both occupants are known, neither match is
  //    decided, and the swap strictly reduces WB-rematches (see recompute.ts).
  // Single source of truth: srcHome/srcAway links; recompute resolves them.
  const lByRound: Match[][] = [];
  const maxL = W > 1 ? 2 * (W - 1) : 0;
  const lRoundOf = (lr: number) => 100 + lr;
  const lName = (lr: number) => 'LB Round ' + lr;
  // WB matches that can still produce a loser. Derived rounds always qualify
  // (their slots resolve from winners once played); round-1 manual byes do
  // not — a bye advances a player without a loss.
  const wLosers = (wr: number): Match[] =>
    (wByRound[wr] ?? []).filter(m => !(m.bracket?.manual === true && (m.homeId === null || m.awayId === null)));
  // Odd-pool leftovers: a player with no pair in round lr waits and joins
  // round lr+1's pool (source link preserved, so recompute stays pure).
  const pendingCarry: { lr: number; src: { w: string } | { l: string } }[] = [];
  const mkL = (lr: number, srcHome: { w: string } | { l: string } | null, srcAway: { w: string } | { l: string } | null): Match => {
    const m = mkMatch(lRoundOf(lr), lName(lr), null, null);
    m.bracket = { kind: 'losers', srcHome, srcAway };
    return m;
  };
  for (let lr = 1; lr <= maxL; lr++) {
    // Assemble this round's pool (see FEED RULE above), then cross-half pair.
    const pool: ({ w: string } | { l: string })[] = [];
    if (lr === 1) {
      for (const m of wLosers(1)) pool.push({ l: m.id });
    } else {
      for (const m of lByRound[lr - 1]) pool.push({ w: m.id });
      for (let i = pendingCarry.length - 1; i >= 0; i--) {
        if (pendingCarry[i].lr === lr) {
          pool.push(pendingCarry[i].src);
          pendingCarry.splice(i, 1);
        }
      }
      if (lr % 2 === 0) {
        // major round: fresh dropouts of W(lr/2 + 1) — at lr = maxL that is
        // the WB final, i.e. the last-round "survivor vs WB-final loser" feed.
        for (const m of wLosers(lr / 2 + 1)) pool.push({ l: m.id });
      }
    }
    const n = pool.length;
    const arr: Match[] = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      arr.push(mkL(lr, pool[i], pool[n - 1 - i]));
    }
    if (n % 2 === 1 && lr < maxL) {
      // Odd pool: the middle player waits and joins the next round's pool.
      pendingCarry.push({ lr: lr + 1, src: pool[Math.floor(n / 2)] });
    }
    lByRound[lr] = arr;
    matches.push(...arr);
  }
  // --- grand final (+ conditional reset) ---
  const wChamp = wByRound[W]?.[0];
  const lChamp = lByRound[maxL]?.[0];
  const gf = mkMatch(900, 'Grand Final', null, null);
  // W=1 (two players) has no LB — fall back to the WB-final loser so the GF
  // resolves as a rematch instead of a permanently-TBD slot.
  gf.bracket = { kind: 'final', srcHome: wChamp ? { w: wChamp.id } : null, srcAway: lChamp ? { w: lChamp.id } : (wChamp ? { l: wChamp.id } : null) };
  matches.push(gf);
  const reset = mkMatch(901, 'Grand Final Reset', null, null);
  reset.bracket = { kind: 'final', srcHome: null, srcAway: null }; // resolved only if L-side wins GF1
  matches.push(reset);
  void decidedWinner;
  return { matches, wbRounds: W };
}

function tagW(m: Match, a: Id | null, b: Id | null): Match {
  m.bracket = { kind: 'winners', manual: true, srcHome: { seed: a }, srcAway: { seed: b }, eliminatedOnLoss: false };
  return m;
}
function tagWDerived(m: Match, a?: Match, b?: Match): Match {
  m.bracket = { kind: 'winners', srcHome: a ? { w: a.id } : null, srcAway: b ? { w: b.id } : null, eliminatedOnLoss: false };
  return m;
}
export type { SlotSource };
export type { RuleSet };
