import { describe, expect, it } from 'vitest';
import { computeSailingStandings, computeTeamStandings, scoreRaceResults } from '../src/engine/sailing-scoring';
import { DEFAULT_RULES, type Boat, type Race, type RaceResult, type RaceResultStatus } from '../src/engine/types';

const boats: Boat[] = ['a', 'b', 'c'].map(id => ({
  id, name: id.toUpperCase(), sailNumber: id, classId: 'class',
  crewIds: [], active: true,
}));

function result(boatId: string, position: number | null, status: RaceResultStatus = 'FINISHED'): RaceResult {
  return {
    id: `result-${boatId}`, raceId: 'race', boatId, position, points: 0,
    status, penalty: null, adjustment: null, finishTime: null, elapsedSeconds: null, correctedSeconds: null, notes: '',
  };
}

function race(id: string, status: Race['status'], results: RaceResult[]): Race {
  return {
    id, number: 1, classId: 'class', status,
    publicationStatus: 'draft',
    corrections: [],
    results: results.map(item => ({ ...item, id: `${id}-${item.id}`, raceId: id })),
  };
}

describe('sailing scoring', () => {
  it('scores low-point finishers by place and non-finishers after the fleet', () => {
    const scored = scoreRaceResults([
      result('a', 2), result('b', 1), result('c', null, 'DNS'),
    ]);
    expect(scored.map(item => item.points)).toEqual([2, 1, 4]);
  });

  it('uses the selected high-point scale', () => {
    const scored = scoreRaceResults([result('a', 1), result('b', 2), result('c', 3)], 'high-point');
    expect(scored.map(item => item.points)).toEqual([3, 2, 1]);
  });

  it('does not include results from races that are not finished', () => {
    const standings = computeSailingStandings(
      boats,
      [race('unfinished', 'started', [result('a', 1), result('b', 2), result('c', 3)])],
      { ...DEFAULT_RULES },
    );
    expect(standings.every(row => row.raceResults.length === 0 && row.totalPoints === 0)).toBe(true);
  });

  it('discards the worst low-point result and ranks the net totals', () => {
    const results1 = scoreRaceResults([result('a', 1), result('b', 2), result('c', 3)]);
    const results2 = scoreRaceResults([result('a', 3), result('b', 1), result('c', 2)]);
    const standings = computeSailingStandings(
      boats,
      [race('r1', 'finished', results1), race('r2', 'finished', results2)],
      { ...DEFAULT_RULES, discardProfile: { racesToQualify: 2, schedule: [[2, 1]] } },
    );
    expect(standings.map(row => [row.boatId, row.totalPoints, row.discardedPoints, row.netPoints]))
      .toEqual([['b', 3, 2, 1], ['a', 4, 3, 1], ['c', 5, 3, 2]]);
  });

  it('reverses both ranking and discard direction for high-point scoring', () => {
    const one = scoreRaceResults([result('a', 1), result('b', 2), result('c', 3)], 'high-point');
    const two = scoreRaceResults([result('a', 3), result('b', 1), result('c', 2)], 'high-point');
    const standings = computeSailingStandings(
      boats,
      [race('r1', 'finished', one), race('r2', 'finished', two)],
      { ...DEFAULT_RULES, scoringSystem: 'high-point', discardProfile: { racesToQualify: 2, schedule: [[2, 1]] } },
    );
    expect(standings[0].boatId).toBe('b');
    expect(standings[0].netPoints).toBe(3);
  });

  it('aggregates completed-race points by assigned team', () => {
    const teamBoats = [
      { ...boats[0], teamName: 'Blue' },
      { ...boats[1], teamName: 'Red' },
      { ...boats[2], teamName: 'Blue' },
    ];
    const results = scoreRaceResults([result('a', 1), result('b', 2), result('c', 3)]);
    const standings = computeTeamStandings(
      teamBoats,
      [race('r1', 'finished', results)],
      { ...DEFAULT_RULES },
    );
    expect(standings.map(team => [team.teamName, team.totalPoints, team.rank]))
      .toEqual([['Red', 2, 1], ['Blue', 4, 2]]);
  });
});
