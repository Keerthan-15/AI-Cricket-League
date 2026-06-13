import React, { useState, useEffect } from 'react';
import { Team, Fixture, MatchSimulationResponse, Standing, PlayerCareerStats, HallOfFameRecord } from '../types';
import { Trophy, HelpCircle, ArrowRight, ShieldCheck, Award, Users, Star, Flame } from 'lucide-react';
import MatchSimPanel from './MatchSimPanel';
import { sanitizeResultText } from '../utils/cricketCalculations';

interface PlayoffsPanelProps {
  teams: Team[];
  standings: Standing[];
  playerStats: PlayerCareerStats[];
  playoffsFixtures: Fixture[];
  onPlayoffsUpdate: (fixtures: Fixture[]) => void;
  onCrownChampion: (champRecord: HallOfFameRecord) => void;
  onResetSeason: () => void;
  leagueStatus: 'setup' | 'team_building' | 'active_season' | 'playoffs' | 'completed';
}

export default function PlayoffsPanel({
  teams,
  standings,
  playerStats,
  playoffsFixtures,
  onPlayoffsUpdate,
  onCrownChampion,
  onResetSeason,
  leagueStatus,
}: PlayoffsPanelProps) {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);

  // Auto-generate Playoff structure when standings are final and playoffs list is empty
  useEffect(() => {
    if (leagueStatus !== 'playoffs') return;
    if (playoffsFixtures.length > 0) return;
    if (standings.length < 2) return;

    const topTeams = standings.map((s) => s.teamId);
    let newFixtures: Fixture[] = [];

    if (standings.length === 2 || standings.length === 3) {
      // 2 or 3-team direct playoff brackets
      if (standings.length === 2) {
        // Direct Final
        newFixtures.push({
          id: 'p_fi',
          round: 99, // playoffs round identifier
          teamAId: topTeams[0],
          teamBId: topTeams[1],
          status: 'scheduled',
          result: '',
          scorecard: null,
          isPlayoff: true,
          playoffType: 'FI',
          captainA: getTeamDefaultCap(topTeams[0]),
          viceCaptainA: getTeamDefaultVC(topTeams[0]),
          captainB: getTeamDefaultCap(topTeams[1]),
          viceCaptainB: getTeamDefaultVC(topTeams[1]),
        });
      } else {
        // 3-team bracket: Qualifier 2 (2nd vs 3rd), Final (1st vs Winner Q2)
        newFixtures.push({
          id: 'p_q2_3',
          round: 99,
          teamAId: topTeams[1], // 2nd
          teamBId: topTeams[2], // 3rd
          status: 'scheduled',
          result: '',
          scorecard: null,
          isPlayoff: true,
          playoffType: 'Q2',
          captainA: getTeamDefaultCap(topTeams[1]),
          viceCaptainA: getTeamDefaultVC(topTeams[1]),
          captainB: getTeamDefaultCap(topTeams[2]),
          viceCaptainB: getTeamDefaultVC(topTeams[2]),
        });
        // Final slot with placeholder
        newFixtures.push({
          id: 'p_fi_3',
          round: 99,
          teamAId: topTeams[0], // 1st
          teamBId: '', // Winner Q2 placeholder
          status: 'scheduled',
          result: '',
          scorecard: null,
          isPlayoff: true,
          playoffType: 'FI',
        });
      }
    } else {
      // Standard 4-team IPL Playoff structure: Q1, EL, Q2, FI
      newFixtures.push({
        id: 'p_q1',
        round: 99,
        teamAId: topTeams[0], // 1st
        teamBId: topTeams[1], // 2nd
        status: 'scheduled',
        result: '',
        scorecard: null,
        isPlayoff: true,
        playoffType: 'Q1',
        captainA: getTeamDefaultCap(topTeams[0]),
        viceCaptainA: getTeamDefaultVC(topTeams[0]),
        captainB: getTeamDefaultCap(topTeams[1]),
        viceCaptainB: getTeamDefaultVC(topTeams[1]),
      });
      newFixtures.push({
        id: 'p_el',
        round: 99,
        teamAId: topTeams[2], // 3rd
        teamBId: topTeams[3], // 4th
        status: 'scheduled',
        result: '',
        scorecard: null,
        isPlayoff: true,
        playoffType: 'EL',
        captainA: getTeamDefaultCap(topTeams[2]),
        viceCaptainA: getTeamDefaultVC(topTeams[2]),
        captainB: getTeamDefaultCap(topTeams[3]),
        viceCaptainB: getTeamDefaultVC(topTeams[3]),
      });
      newFixtures.push({
        id: 'p_q2',
        round: 99,
        teamAId: '', // Loser Q1 placeholder
        teamBId: '', // Winner EL placeholder
        status: 'scheduled',
        result: '',
        scorecard: null,
        isPlayoff: true,
        playoffType: 'Q2',
      });
      newFixtures.push({
        id: 'p_fi',
        round: 99,
        teamAId: '', // Winner Q1 placeholder
        teamBId: '', // Winner Q2 placeholder
        status: 'scheduled',
        result: '',
        scorecard: null,
        isPlayoff: true,
        playoffType: 'FI',
      });
    }

    onPlayoffsUpdate(newFixtures);
  }, [standings, playoffsFixtures, leagueStatus]);

  const getTeamDefaultCap = (tId: string) => {
    const t = teams.find((x) => x.id === tId);
    return t?.players[0]?.name || '';
  };

  const getTeamDefaultVC = (tId: string) => {
    const t = teams.find((x) => x.id === tId);
    return t?.players[1]?.name || '';
  };

  const activePlayoffFixture = playoffsFixtures.find((x) => x.id === selectedFixtureId);
  const teamA = activePlayoffFixture ? teams.find((x) => x.id === activePlayoffFixture.teamAId) : null;
  const teamB = activePlayoffFixture ? teams.find((x) => x.id === activePlayoffFixture.teamBId) : null;

  // Handle Playoff Match Completion / Advancing Brackets
  const handlePlayoffMatchComplete = (fixtureId: string, scorecard: MatchSimulationResponse) => {
    const updated = playoffsFixtures.map((f) => {
      if (f.id === fixtureId) {
        return {
          ...f,
          status: 'completed' as const,
          result: sanitizeResultText(scorecard.result.margin),
          scorecard,
        };
      }
      return f;
    });

    // Cascade / Promote teams depending on type (IPL Playoff Rules)
    const completedMap: Record<string, Fixture> = {};
    updated.forEach((f) => {
      completedMap[f.id] = f;
    });

    if (standings.length === 3) {
      // 3 Team Ladder Promotion: Q2 (p_q2_3) -> Winner goes to FI (p_fi_3)
      const q2 = completedMap['p_q2_3'];
      if (q2 && q2.status === 'completed' && q2.scorecard) {
        const winnerName = q2.scorecard.result.winner;
        const winnerId = winnerName === teams.find(t => t.id === q2.teamAId)?.name ? q2.teamAId : q2.teamBId;
        
        const finalIdx = updated.findIndex((f) => f.id === 'p_fi_3');
        if (finalIdx !== -1 && !updated[finalIdx].teamBId) {
          updated[finalIdx].teamBId = winnerId;
          updated[finalIdx].captainB = getTeamDefaultCap(winnerId);
          updated[finalIdx].viceCaptainB = getTeamDefaultVC(winnerId);
        }
      }
    } else if (standings.length >= 4) {
      // 4 Team Standard Promotion cascading
      const q1 = completedMap['p_q1'];
      const el = completedMap['p_el'];
      const q2 = completedMap['p_q2'];

      // 1. Resolve Q1 and EL to formulate Q2
      if (q1 && q1.status === 'completed' && q1.scorecard && el && el.status === 'completed' && el.scorecard) {
        const q1Winner = q1.scorecard.result.winner;
        const q1WinnerId = q1Winner === teams.find(t => t.id === q1.teamAId)?.name ? q1.teamAId : q1.teamBId;
        const q1LoserId = q1WinnerId === q1.teamAId ? q1.teamBId : q1.teamAId;

        const elWinner = el.scorecard.result.winner;
        const elWinnerId = elWinner === teams.find(t => t.id === el.teamAId)?.name ? el.teamAId : el.teamBId;

        // Push loser of Q1 and Winner of EL to Q2
        const q2Idx = updated.findIndex((f) => f.id === 'p_q2');
        if (q2Idx !== -1 && (!updated[q2Idx].teamAId || !updated[q2Idx].teamBId)) {
          updated[q2Idx].teamAId = q1LoserId;
          updated[q2Idx].captainA = getTeamDefaultCap(q1LoserId);
          updated[q2Idx].viceCaptainA = getTeamDefaultVC(q1LoserId);

          updated[q2Idx].teamBId = elWinnerId;
          updated[q2Idx].captainB = getTeamDefaultCap(elWinnerId);
          updated[q2Idx].viceCaptainB = getTeamDefaultVC(elWinnerId);
        }

        // Q1 winner goes to FI
        const fiIdx = updated.findIndex((f) => f.id === 'p_fi');
        if (fiIdx !== -1 && !updated[fiIdx].teamAId) {
          updated[fiIdx].teamAId = q1WinnerId;
          updated[fiIdx].captainA = getTeamDefaultCap(q1WinnerId);
          updated[fiIdx].viceCaptainA = getTeamDefaultVC(q1WinnerId);
        }
      }

      // 2. Resolve Q2 to formulate Final opponent
      if (q2 && q2.status === 'completed' && q2.scorecard) {
        const q2Winner = q2.scorecard.result.winner;
        const q2WinnerId = q2Winner === teams.find(t => t.id === q2.teamAId)?.name ? q2.teamAId : q2.teamBId;

        const fiIdx = updated.findIndex((f) => f.id === 'p_fi');
        if (fiIdx !== -1 && !updated[fiIdx].teamBId) {
          updated[fiIdx].teamBId = q2WinnerId;
          updated[fiIdx].captainB = getTeamDefaultCap(q2WinnerId);
          updated[fiIdx].viceCaptainB = getTeamDefaultVC(q2WinnerId);
        }
      }
    }

    onPlayoffsUpdate(updated);
    setSelectedFixtureId(null);

    // 3. Resolve Final match to crown Champion!
    const finalId = standings.length === 3 ? 'p_fi_3' : 'p_fi';
    const finalMatches = updated.filter(f => f.id === finalId && f.status === 'completed' && f.scorecard);
    if (finalMatches.length > 0) {
      const finalMatch = finalMatches[0];

      // --- DEEP REMIDAL VERIFICATION ACCORDING TO AUDIT REQUIREMENTS ---
      // 1. Verify playoffMatches contains ALL FOUR matches if we are in the standard 4-team playoff system
      if (standings.length >= 4) {
        const requiredIds = ['p_q1', 'p_el', 'p_q2', 'p_fi'];
        const hasAllFour = requiredIds.every(id => updated.some(m => m.id === id));
        if (updated.length < 4 || !hasAllFour) {
          console.error("Archival aborted: playoffMatches does not contain all four required playoff bracket matches.", {
            length: updated.length,
            matches: updated.map(m => m.id)
          });
          return; // Strictly abort archival if incomplete!
        }
      }

      // 2. Verify response components of the Final match object
      const hasResult = typeof finalMatch.result === 'string' && finalMatch.result.trim().length > 0;
      const scorecard = finalMatch.scorecard;
      const hasScorecard = scorecard !== null && typeof scorecard === 'object';
      
      const hasInnings = !!(
        hasScorecard &&
        scorecard.innings1 &&
        scorecard.innings1.battingTeam &&
        Array.isArray(scorecard.innings1.overs) &&
        scorecard.innings2 &&
        scorecard.innings2.battingTeam &&
        Array.isArray(scorecard.innings2.overs)
      );

      const hasCommentary = !!(
        hasScorecard &&
        scorecard.result &&
        (typeof scorecard.result.gullyCommentary === 'string' || typeof scorecard.result.presentationCommentary === 'string')
      );

      const hasPlayerOfMatch = !!(
        hasScorecard &&
        scorecard.result &&
        scorecard.result.playerOfTheMatch &&
        typeof scorecard.result.playerOfTheMatch.name === 'string' &&
        scorecard.result.playerOfTheMatch.name.trim().length > 0
      );

      const isDataComplete = hasResult && hasScorecard && hasInnings && hasCommentary && hasPlayerOfMatch;

      if (!isDataComplete) {
        console.error("Archival aborted: Grand Final match object contains incomplete result, scorecard, innings, commentary or player of match details.", {
          hasResult,
          hasScorecard,
          hasInnings,
          hasCommentary,
          hasPlayerOfMatch
        });
        return; // Strictly abort archival if incomplete!
      }

      const champName = finalMatch.scorecard!.result.winner;
      const runnerName = champName === teams.find(t => t.id === finalMatch.teamAId)?.name
        ? teams.find(t => t.id === finalMatch.teamBId)!.name
        : teams.find(t => t.id === finalMatch.teamAId)!.name;

      // Find awards from playerCareerStats
      const orangeCapName = [...playerStats].sort((a,b) => b.batting.runs - a.batting.runs)[0]?.playerName || 'TBD Player';
      const orangeCapRuns = [...playerStats].sort((a,b) => b.batting.runs - a.batting.runs)[0]?.batting.runs || 0;
      const purpleCapName = [...playerStats].sort((a,b) => b.bowling.wickets - a.bowling.wickets)[0]?.playerName || 'TBD Bowler';
      const purpleCapWkts = [...playerStats].sort((a,b) => b.bowling.wickets - a.bowling.wickets)[0]?.bowling.wickets || 0;

      const mvp = [...playerStats]
        .map(p => ({ ...p, mScore: p.batting.runs + p.bowling.wickets * 20 }))
        .sort((a,b) => b.mScore - a.mScore)[0]?.playerName || 'Star Contender';

      const hallRecord: HallOfFameRecord = {
        seasonId: `season_${Date.now()}`,
        seasonName: `Season ${new Date().getFullYear()} Championship`,
        championTeamName: champName,
        runnerUpTeamName: runnerName,
        mvpName: mvp,
        orangeCapName,
        orangeCapRuns,
        purpleCapName,
        purpleCapWickets: purpleCapWkts,
        summary: finalMatch.scorecard!.result.summary,
        playoffMatches: updated, // Pass fresh updated matches containing the Grand Final details
      };

      onCrownChampion(hallRecord);
    }
  };

  const getTeamLabelName = (tId: string, placeholder: string) => {
    if (!tId) return placeholder;
    return teams.find((t) => t.id === tId)?.name || placeholder;
  };

  const getPlayoffTitle = (type: string | null) => {
    switch (type) {
      case 'Q1': return 'Qualifier 1';
      case 'EL': return 'Eliminator';
      case 'Q2': return 'Qualifier 2';
      case 'FI': return 'Mega Final';
      default: return 'Playoffs Stage';
    }
  };

  // Determine if tournament has a final champions crowned already
  const finalNodeId = standings.length === 3 ? 'p_fi_3' : 'p_fi';
  const completedFinalNode = playoffsFixtures.find(f => f.id === finalNodeId && f.status === 'completed');

  return (
    <div className="space-y-6" id="playoff-central-panel">
      {/* Visual Banners */}
      <div className="bg-gradient-to-r from-amber-950/20 to-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase">
            knockout tournament brackets
          </span>
          <h2 className="font-heading text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500 animate-pulse" /> Playoffs Central Arena
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Simulate the final matches to crown the official champion of the Season! Review playoff branches and resolve matchups sequentially.
          </p>
        </div>
        {completedFinalNode && (
          <button
            onClick={onResetSeason}
            className="bg-emerald-600 hover:bg-emerald-500 transition text-white text-xs font-heading font-black py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow shadow-emerald-800 cursor-pointer"
          >
            🏆 Start New Season
          </button>
        )}
      </div>

      {activePlayoffFixture && teamA && teamB ? (
        <div className="space-y-3">
          <button
            onClick={() => setSelectedFixtureId(null)}
            className="text-xs text-amber-500 hover:text-amber-450 font-mono flex items-center gap-1 cursor-pointer"
          >
            ← Back to Playoffs Nodes
          </button>
          <MatchSimPanel
            fixture={activePlayoffFixture}
            teamA={teamA}
            teamB={teamB}
            onMatchComplete={handlePlayoffMatchComplete}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Playoff Nodes Layout Grid */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="font-heading font-black text-[#f3f4f6] text-base border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-500" /> Playoff nodes
            </h3>

            <div className="grid grid-cols-1 gap-3.5">
              {playoffsFixtures.map((f) => {
                const isCompleted = f.status === 'completed';
                const hasRostersReady = f.teamAId && f.teamBId;

                const nameA = getTeamLabelName(f.teamAId, 'TBD Node');
                const nameB = getTeamLabelName(f.teamBId, 'TBD Node');

                return (
                  <div
                    key={f.id}
                    className={`border rounded-xl p-4 transition ${
                      isCompleted ? 'bg-slate-900/60 border-emerald-500/20' :
                      hasRostersReady ? 'bg-[#0f172a] border-slate-800 hover:border-amber-500/40' :
                      'bg-slate-900/10 border-slate-850/30 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="bg-amber-500/10 text-amber-550 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded border border-amber-500/10 uppercase tracking-wider">
                          {getPlayoffTitle(f.playoffType)}
                        </span>
                        <div className="font-heading font-black text-slate-100 text-sm mt-1.5 flex items-center gap-2">
                          <span className={isCompleted && f.scorecard?.result.winner === nameA ? 'text-amber-400' : ''}>{nameA}</span>
                          <span className="text-slate-500 font-normal">vs</span>
                          <span className={isCompleted && f.scorecard?.result.winner === nameB ? 'text-amber-400' : ''}>{nameB}</span>
                        </div>
                        {isCompleted && (
                          <p className="text-[11px] text-emerald-400 font-mono mt-1 font-semibold">{sanitizeResultText(f.result)}</p>
                        )}
                      </div>

                      {!isCompleted && hasRostersReady && (
                        <button
                          onClick={() => setSelectedFixtureId(f.id)}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 self-start sm:self-center cursor-pointer"
                        >
                          Simulate Roster <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isCompleted && !hasRostersReady && (
                        <span className="text-[11px] text-slate-500 font-mono italic">
                          Awaiting preceding node brackets
                        </span>
                      )}

                      {isCompleted && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider flex items-center gap-1 font-bold">
                          ✓ Node complete
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar: Championship details presentation */}
          <div className="md:col-span-4 bg-slate-900/50 rounded-xl border border-slate-800 p-5 self-start space-y-4">
            <h4 className="font-heading font-extrabold text-sm text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-500" /> Crown Award Ceremonies
            </h4>

            {completedFinalNode ? (
              <div className="space-y-4 text-center">
                <div className="relative inline-block my-2">
                  <Trophy className="w-16 h-16 text-amber-400 mx-auto fill-amber-400/20 drop-shadow-xl animate-pulse" />
                  <div className="absolute -top-1 -right-1 bg-red-600 rounded-full h-5 w-5 flex items-center justify-center text-white text-[9px] font-bold font-mono">FI</div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold">official champions</span>
                  <h3 className="font-heading font-black text-[#faf5ff] text-lg leading-tight">
                    {completedFinalNode.scorecard?.result.winner}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Crowned champion after clean playoff sweeps!
                  </p>
                </div>

                {/* Champion highlight cards */}
                <div className="bg-[#0b0f19] border border-slate-850 p-3 rounded-lg text-left text-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-1">
                    <span className="text-slate-450 flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> Match MVP:</span>
                    <span className="font-semibold text-white truncate font-heading">{playerStats.flatMap(x => x.playerName)[0] || 'Star Player'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-1">
                    <span className="text-slate-450">🍊 Orange Cap:</span>
                    <span className="font-semibold text-amber-500">{[...playerStats].sort((a,b)=>b.batting.runs - a.batting.runs)[0]?.playerName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-450">🍇 Purple Cap:</span>
                    <span className="font-semibold text-purple-400">{[...playerStats].sort((a,b)=>b.bowling.wickets - a.bowling.wickets)[0]?.playerName || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs py-8 text-center space-y-2">
                <Flame className="w-8 h-8 text-slate-700 mx-auto animate-pulse" />
                <p className="font-heading font-bold text-slate-400">Playoffs Active</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Simulate the qualifying brackets and final nodes to coronate the champion and unlock award records.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
