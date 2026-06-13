export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
  rating: number; // 1-99
}

export interface Team {
  id: string;
  name: string;
  color: string; // Tailwind hex color or class name
  emoji: string;
  locked: boolean;
  players: Player[];
}

export interface BallEvent {
  ball: number; // 1 to 6
  type: 'dot' | 'run' | 'boundary' | 'wicket' | 'extra';
  runsScored: number;
  description: string;
}

export interface OverSimulation {
  overNumber: number;
  runs: number;
  wicketsList: Array<{ player: string; howOut: string; bowler: string }>;
  commentary: string; // Comprehensive summary of the over
  timeline: BallEvent[];
}

export interface BatsmanStatsScorecard {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  howOut: string;
}

export interface BowlerStatsScorecard {
  name: string;
  overs: number; // e.g. 3.4
  runs: number;
  wickets: number;
  extras: number;
}

export interface InningsScorecard {
  battingTeam: string;
  bowlingTeam: string;
  totalRuns: number;
  totalWickets: number;
  totalOvers: number; // final overs bowled, e.g. 18.3 or 20
  overs: OverSimulation[];
  batsmen: BatsmanStatsScorecard[];
  bowlers: BowlerStatsScorecard[];
}

export interface MatchSimulationResponse {
  toss: {
    winner: string;
    decision: 'bat' | 'bowl';
    commentary: string;
  };
  innings1: InningsScorecard;
  innings2: InningsScorecard;
  result: {
    winner: string;
    margin: string;
    summary: string;
    playerOfTheMatch: {
      name: string;
      reason: string;
      stats: string;
    };
    presentationCommentary: string; // Final speech, captain quotes, etc.
    gullyCommentary: string; // Gully style match narrative
  };
}

export interface Fixture {
  id: string;
  round: number; // league stage round (e.g. 1, 2, 3)
  teamAId: string;
  teamBId: string;
  status: 'scheduled' | 'live' | 'completed';
  result: string; // formatted result explanation
  scorecard: MatchSimulationResponse | null;
  isPlayoff: boolean;
  playoffType: 'Q1' | 'EL' | 'Q2' | 'FI' | null; // Qualifier 1, Eliminator, Qualifier 2, Final
  captainA?: string;
  viceCaptainA?: string;
  impactPlayerA?: string;
  captainB?: string;
  viceCaptainB?: string;
  impactPlayerB?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: 'Preview' | 'Review' | 'Spotlight' | 'Breaking' | 'Summary' | 'Ceremony';
  content: string;
  timestamp: string;
  relatedTeamId?: string;
}

export interface HallOfFameRecord {
  seasonId: string;
  seasonName: string;
  championTeamName: string;
  runnerUpTeamName: string;
  mvpName: string;
  orangeCapName: string;
  orangeCapRuns: number;
  purpleCapName: string;
  purpleCapWickets: number;
  summary: string;
  pointsTable?: Standing[];
  leagueResults?: Fixture[];
  playoffMatches?: Fixture[];
  seasonStatistics?: PlayerCareerStats[];
}

export interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  nrr: number; // Net Run Rate
}

export interface PlayerCareerStats {
  playerName: string;
  teamName: string;
  role: string;
  batting: {
    matches: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
    highest: number;
  };
  bowling: {
    matches: number;
    wickets: number;
    overs: number;
    runs: number;
    bestWickets: number;
    bestRuns: number;
  };
}
