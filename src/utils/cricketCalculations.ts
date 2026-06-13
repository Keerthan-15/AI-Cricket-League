import { Team, Fixture, Standing, PlayerCareerStats } from '../types';

/**
 * Converts over representation (e.g. 18.3) to raw ball count
 */
export function oversToBalls(overs: number): number {
  const completedOvers = Math.floor(overs);
  const remaingBalls = Math.round((overs - completedOvers) * 10);
  return (completedOvers * 6) + remaingBalls;
}

/**
 * Converts raw ball count to over representation (e.g. 111 balls -> 18.3)
 */
export function ballsToOvers(balls: number): number {
  const oversText = `${Math.floor(balls / 6)}.${balls % 6}`;
  return parseFloat(oversText);
}

/**
 * Converts over representation to raw decimal number for division calculations
 */
export function oversToDecimal(overs: number): number {
  const completedOvers = Math.floor(overs);
  const remainingBalls = Math.round((overs - completedOvers) * 10);
  return completedOvers + (remainingBalls / 6);
}

/**
 * Generates a round-robin schedule for teams.
 * Each team plays every other team once.
 */
export function generateRoundRobinFixtures(teams: Team[]): Fixture[] {
  const fixtures: Fixture[] = [];
  const n = teams.length;
  if (n < 2) return [];

  // Copy teams list
  const list = [...teams];
  
  // Standard round robin (Circle tournament scheduling method)
  const rounds = n % 2 === 0 ? n - 1 : n;
  const matchesPerRound = Math.floor((n + 1) / 2);

  let matchIdCounter = 1;

  for (let round = 1; round <= rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const homeIdx = (round - 1 + match) % (n - 1);
      let awayIdx = (round - 1 + n - 1 - match) % (n - 1);

      if (match === 0) {
        awayIdx = n - 1;
      }

      // Check boundary bounds for dummy team (odd number of teams)
      if (homeIdx >= n || awayIdx >= n) {
        continue;
      }

      const teamA = list[homeIdx];
      const teamB = list[awayIdx];

      // Odd team bye logic
      if (n % 2 !== 0 && (homeIdx === n - 1 || awayIdx === n - 1)) {
        continue;
      }

      // Pre-select captain and vice captain as default recommendations
      const captainA = teamA.players.find(p => p.role === 'Batsman' || p.role === 'Wicket Keeper')?.name || teamA.players[0]?.name;
      const viceCaptainA = teamA.players.find(p => p.role === 'All Rounder' || p.role === 'Bowler')?.name || teamA.players[1]?.name;
      const impactPlayerA = teamA.players[teamA.players.length - 1]?.name;

      const captainB = teamB.players.find(p => p.role === 'Batsman' || p.role === 'Wicket Keeper')?.name || teamB.players[0]?.name;
      const viceCaptainB = teamB.players.find(p => p.role === 'All Rounder' || p.role === 'Bowler')?.name || teamB.players[1]?.name;
      const impactPlayerB = teamB.players[teamB.players.length - 1]?.name;

      fixtures.push({
        id: `m_${matchIdCounter++}`,
        round,
        teamAId: teamA.id,
        teamBId: teamB.id,
        status: 'scheduled',
        result: '',
        scorecard: null,
        isPlayoff: false,
        playoffType: null,
        captainA,
        viceCaptainA,
        impactPlayerA,
        captainB,
        viceCaptainB,
        impactPlayerB,
      });
    }
  }

  // Shuffle or sort fixtures by round
  return fixtures.sort((a, b) => a.round - b.round);
}

/**
 * Calculates Points Table Standings with full NRR compliance.
 */
export function calculateStandings(teams: Team[], fixtures: Fixture[]): Standing[] {
  const standingsMap: Record<string, Standing> = {};

  // Initialize standings for each team
  teams.forEach(t => {
    standingsMap[t.id] = {
      teamId: t.id,
      teamName: t.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      nrr: 0,
    };
  });

  // Aggregate results from completed fixtures
  fixtures.forEach(f => {
    if (f.status !== 'completed' || !f.scorecard) return;

    const { teamAId, teamBId, scorecard } = f;
    const sA = standingsMap[teamAId];
    const sB = standingsMap[teamBId];

    if (!sA || !sB) return;

    sA.played += 1;
    sB.played += 1;

    const winnerId = scorecard.result.winner === sA.teamName ? teamAId : teamBId;
    if (winnerId === teamAId) {
      sA.won += 1;
      sA.points += 2;
      sB.lost += 1;
    } else {
      sB.won += 1;
      sB.points += 2;
      sA.lost += 1;
    }

    // NRR calculations
    // Innings 1 corresponds to Team A batting if Team A was bat, or Team B if Team B bat
    const decA = scorecard.innings1.battingTeam === sA.teamName;
    const cardA = decA ? scorecard.innings1 : scorecard.innings2;
    const cardB = decA ? scorecard.innings2 : scorecard.innings1;

    sA.runsScored += cardA.totalRuns;
    sB.runsScored += cardB.totalRuns;

    sA.runsConceded += cardB.totalRuns;
    sB.runsConceded += cardA.totalRuns;

    // NRR Rule: If a team is bowled out (loses 10 wickets) before their full 20 overs,
    // they are credited with facing the entire 20.0 overs for NRR purposes!
    const playedOversA = cardA.totalWickets === 10 ? 20.0 : cardA.totalOvers;
    const playedOversB = cardB.totalWickets === 10 ? 20.0 : cardB.totalOvers;

    // Add overs faced (batting)
    sA.oversFaced = parseFloat((oversToDecimal(sA.oversFaced) + oversToDecimal(playedOversA)).toFixed(3));
    sB.oversFaced = parseFloat((oversToDecimal(sB.oversFaced) + oversToDecimal(playedOversB)).toFixed(3));

    // Add overs bowled (bowling is opposite of batting)
    sA.oversBowled = parseFloat((oversToDecimal(sA.oversBowled) + oversToDecimal(playedOversB)).toFixed(3));
    sB.oversBowled = parseFloat((oversToDecimal(sB.oversBowled) + oversToDecimal(playedOversA)).toFixed(3));
  });

  // Calculate NRR for each team and convert back
  const standings = Object.values(standingsMap).map(s => {
    const scoredDecimal = s.oversFaced; // which is already in decimal format as summed above
    const concededDecimal = s.oversBowled; // as already converted to decimal format

    const battingRate = scoredDecimal > 0 ? (s.runsScored / scoredDecimal) : 0;
    const bowlingRate = concededDecimal > 0 ? (s.runsConceded / concededDecimal) : 0;

    const nrr = parseFloat((battingRate - bowlingRate).toFixed(3));

    return {
      ...s,
      // Convert decimal representation back to traditional cricket formatting for display
      oversFaced: parseFloat(ballsToOvers(Math.round(s.oversFaced * 6)).toFixed(1)),
      oversBowled: parseFloat(ballsToOvers(Math.round(s.oversBowled * 6)).toFixed(1)),
      nrr,
    };
  });

  // Sort by Points (descending), then NRR (descending), then Runs Scored
  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    return b.runsScored - a.runsScored;
  });
}

/**
 * Aggregates career statistics for all players in the league.
 */
export function calculatePlayerCareerStats(teams: Team[], fixtures: Fixture[]): PlayerCareerStats[] {
  const statsMap: Record<string, PlayerCareerStats> = {};

  // Pre-populate with all active players in locked teams
  teams.forEach(t => {
    t.players.forEach(p => {
      statsMap[p.name] = {
        playerName: p.name,
        teamName: t.name,
        role: p.role,
        batting: {
          matches: 0,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highest: 0,
        },
        bowling: {
          matches: 0,
          wickets: 0,
          overs: 0,
          runs: 0,
          bestWickets: 0,
          bestRuns: Number.MAX_SAFE_INTEGER,
        },
      };
    });
  });

  // Process completed scorecards
  fixtures.forEach(f => {
    if (f.status !== 'completed' || !f.scorecard) return;

    const { scorecard } = f;

    // Process Innings 1 & Innings 2 Batting
    [scorecard.innings1, scorecard.innings2].forEach(innings => {
      innings.batsmen.forEach(batsman => {
        // Find or create player stats (handles custom bulk names or renamed ones)
        if (!statsMap[batsman.name]) {
          statsMap[batsman.name] = {
            playerName: batsman.name,
            teamName: innings.battingTeam,
            role: 'Batsman',
            batting: { matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highest: 0 },
            bowling: { matches: 0, wickets: 0, overs: 0, runs: 0, bestWickets: 0, bestRuns: Number.MAX_SAFE_INTEGER },
          };
        }

        const stat = statsMap[batsman.name];
        stat.batting.matches += 1;
        stat.batting.runs += batsman.runs;
        stat.batting.balls += batsman.balls;
        stat.batting.fours += batsman.fours;
        stat.batting.sixes += batsman.sixes;

        if (batsman.runs >= 100) stat.batting.hundreds += 1;
        else if (batsman.runs >= 50) stat.batting.fifties += 1;

        if (batsman.runs > stat.batting.highest) {
          stat.batting.highest = batsman.runs;
        }
      });

      // Process Bowling
      innings.bowlers.forEach(bowler => {
        if (!statsMap[bowler.name]) {
          statsMap[bowler.name] = {
            playerName: bowler.name,
            teamName: innings.bowlingTeam,
            role: 'Bowler',
            batting: { matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highest: 0 },
            bowling: { matches: 0, wickets: 0, overs: 0, runs: 0, bestWickets: 0, bestRuns: Number.MAX_SAFE_INTEGER },
          };
        }

        const stat = statsMap[bowler.name];
        stat.bowling.matches += 1;
        stat.bowling.wickets += bowler.wickets;
        stat.bowling.runs += bowler.runs;

        // Add overs bowled
        const currentOversDecimal = oversToDecimal(stat.bowling.overs);
        const matchOversDecimal = oversToDecimal(bowler.overs);
        const newOversDecimal = currentOversDecimal + matchOversDecimal;
        stat.bowling.overs = parseFloat(ballsToOvers(Math.round(newOversDecimal * 6)).toFixed(1));

        // Track best bowling figures
        // Best is primarily based on higher wickets, secondarily fewer runs
        if (bowler.wickets > stat.bowling.bestWickets) {
          stat.bowling.bestWickets = bowler.wickets;
          stat.bowling.bestRuns = bowler.runs;
        } else if (bowler.wickets === stat.bowling.bestWickets && bowler.runs < stat.bowling.bestRuns) {
          stat.bowling.bestRuns = bowler.runs;
        }
      });
    });
  });

  return Object.values(statsMap).map(p => {
    // Correct bestRuns initial value if they never bowled
    return {
      ...p,
      bowling: {
        ...p.bowling,
        bestRuns: p.bowling.bestRuns === Number.MAX_SAFE_INTEGER ? 0 : p.bowling.bestRuns,
      }
    };
  });
}

/**
 * Sanitizes and removes any duplicate "won by" or repeated winner names
 * (e.g., "Royal Mech won by Royal Mech won by 8 wickets" -> "Royal Mech won by 8 wickets")
 */
export function sanitizeResultText(text: string | null | undefined): string {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Handle phrases like "Team_A won by Team_A won by X wickets" by splitting by "won by" and deduplicating
  const parts = cleaned.split(/\s+won\s+by\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const uniqueParts: string[] = [];
    for (const part of parts) {
      if (uniqueParts.length === 0 || part.toLowerCase() !== uniqueParts[uniqueParts.length - 1].toLowerCase()) {
        uniqueParts.push(part);
      }
    }
    cleaned = uniqueParts.join(' won by ');
  }

  // Also clean up any lingering adjacent repeat markers
  cleaned = cleaned.replace(/\s+won\s+by\s+won\s+by/gi, ' won by');
  cleaned = cleaned.replace(/won\s+by\s+won\s+by/gi, 'won by');
  return cleaned;
}
