import React, { useState } from 'react';
import { Standing, PlayerCareerStats } from '../types';
import { Trophy, Award, Target, Flame, Lightbulb, Users, ArrowUpRight, TrendingUp } from 'lucide-react';

interface StatsTableProps {
  standings: Standing[];
  playerStats: PlayerCareerStats[];
}

export default function StatsTable({ standings, playerStats }: StatsTableProps) {
  const [activeTab, setActiveTab] = useState<'standings' | 'orange_cap' | 'purple_cap' | 'mvp' | 'special_awards'>('standings');

  // Filter leaders
  const orangeCapLeaders = [...playerStats]
    .filter((p) => p.batting.runs > 0)
    .sort((a, b) => b.batting.runs - a.batting.runs)
    .slice(0, 10);

  const purpleCapLeaders = [...playerStats]
    .filter((p) => p.bowling.wickets > 0)
    .sort((a, b) => b.bowling.wickets - a.bowling.wickets)
    .slice(0, 10);

  // MVP score calculation formula: Runs * 1 + Balls * -0.1 + Sixes * 2 + Fours * 1 + Wickets * 20
  const calculateMVPScore = (p: PlayerCareerStats) => {
    const batPoints = p.batting.runs * 1 + p.batting.sixes * 2 + p.batting.fours * 0.5;
    const bowlPoints = p.bowling.wickets * 20;
    return Math.round(batPoints + bowlPoints);
  };

  const mvpLeaders = [...playerStats]
    .map((p) => ({ ...p, mvpScore: calculateMVPScore(p) }))
    .filter((p) => p.mvpScore > 0)
    .sort((a, b) => b.mvpScore - a.mvpScore)
    .slice(0, 10);

  // Special Stats
  const mostSixesLeaders = [...playerStats]
    .filter((p) => p.batting.sixes > 0)
    .sort((a, b) => b.batting.sixes - a.batting.sixes)
    .slice(0, 5);

  const bestEconomyLeaders = [...playerStats]
    .filter((p) => p.bowling.overs >= 1.0 && p.bowling.runs > 0) // minimum 1 over bowled to qualify
    .map((p) => {
      const econ = p.bowling.runs / p.bowling.overs;
      return { ...p, economy: parseFloat(econ.toFixed(2)) };
    })
    .sort((a, b) => a.economy - b.economy)
    .slice(0, 5);

  const bestStrikeRateLeaders = [...playerStats]
    .filter((p) => p.batting.balls >= 10) // minimum 10 balls faced to qualify
    .map((p) => {
      const sr = (p.batting.runs / p.batting.balls) * 100;
      return { ...p, strikeRate: parseFloat(sr.toFixed(1)) };
    })
    .sort((a, b) => b.strikeRate - a.strikeRate)
    .slice(0, 5);

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden" id="analytics-desk-root">
      {/* Stats Navigation Menu */}
      <div className="flex flex-wrap border-b border-slate-800 bg-slate-900/40 text-xs font-mono font-semibold">
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex items-center gap-1.5 py-4 px-4 sm:px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'standings'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" /> Standings Table
        </button>
        <button
          onClick={() => setActiveTab('orange_cap')}
          className={`flex items-center gap-1.5 py-4 px-4 sm:px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'orange_cap'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-amber-500 text-sm">🧢</span> Orange Cap
        </button>
        <button
          onClick={() => setActiveTab('purple_cap')}
          className={`flex items-center gap-1.5 py-4 px-4 sm:px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'purple_cap'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-[#a855f7] text-sm">🧢</span> Purple Cap
        </button>
        <button
          onClick={() => setActiveTab('mvp')}
          className={`flex items-center gap-1.5 py-4 px-4 sm:px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'mvp'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-400" /> MVP Standings
        </button>
        <button
          onClick={() => setActiveTab('special_awards')}
          className={`flex items-center gap-1.5 py-4 px-4 sm:px-6 border-b-2 transition cursor-pointer ${
            activeTab === 'special_awards'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-orange-400 animate-pulse" /> Season Records
        </button>
      </div>

      <div className="p-5">
        {/* TAB 1: Points Table Grid */}
        {activeTab === 'standings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-slate-100 text-base">League Standings Table</h3>
                <p className="text-xs text-slate-400 mt-0.5">Top 4 teams automatically secure playoff berths</p>
              </div>
              <span className="text-[10px] bg-slate-800 text-amber-500 font-mono px-2 py-0.5 rounded uppercase">
                Active Standings
              </span>
            </div>

            {standings.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                <Users className="w-12 h-12 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-400 font-heading font-semibold text-sm">No Standings Data Recorded</p>
                <p className="text-xs text-slate-500 mt-0.5">Simulate scheduled fixtures to populate Points Table.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-850">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-mono text-[10px] tracking-wider uppercase font-semibold">
                      <th className="py-3 px-4 text-center w-12">Pos</th>
                      <th className="py-3 px-4">Franchise</th>
                      <th className="py-3 px-3 text-center w-14">P</th>
                      <th className="py-3 px-3 text-center w-14">W</th>
                      <th className="py-3 px-3 text-center w-14">L</th>
                      <th className="py-3 px-3 text-center w-16">Scored</th>
                      <th className="py-3 px-3 text-center w-16">Conceded</th>
                      <th className="py-3 px-3 text-center w-16 font-bold text-white">Pts</th>
                      <th className="py-3 px-4 text-right w-24">Net NRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((team, idx) => {
                      const isPlayoffSpot = idx < 4 && standings.length >= 4;
                      return (
                        <tr
                          key={team.teamId}
                          className={`border-b border-slate-850 hover:bg-slate-900/50 ${
                            isPlayoffSpot ? 'bg-amber-500/3' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center justify-center font-mono font-bold text-xs h-6 w-6 rounded-full ${
                              idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/20' :
                              idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/20' :
                              isPlayoffSpot ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-900 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-heading font-black text-slate-100 flex items-center gap-2">
                            <span>{team.teamName}</span>
                            {isPlayoffSpot && (
                              <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-500 border border-amber-500/10 px-1 py-0.2 rounded font-normal">
                                Q
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-300">{team.played}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-emerald-400">{team.won}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-rose-400">{team.lost}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-450">{team.runsScored} ({team.oversFaced})</td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-450">{team.runsConceded} ({team.oversBowled})</td>
                          <td className="py-3.5 px-3 text-center font-mono font-extrabold text-[#f3f4f6]">{team.points}</td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                            team.nrr >= 0 ? 'text-[#22c55e]' : 'text-rose-400'
                          }`}>
                            {team.nrr >= 0 ? `+${team.nrr.toFixed(3)}` : team.nrr.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Orange Cap */}
        {activeTab === 'orange_cap' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🧢</span>
              <div>
                <h3 className="font-heading font-black text-slate-100 text-base">Orange Cap Leaderboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Top batsmen of the league sorted by runs scored</p>
              </div>
            </div>

            {orangeCapLeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                <p className="text-slate-400 font-heading font-semibold text-xs">No Batting Roster Data Available</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-850">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-mono text-[10px] tracking-wider uppercase font-semibold">
                      <th className="py-3 px-4 w-12 text-center">Pos</th>
                      <th className="py-3 px-4">Batsman</th>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-3 text-center w-14">Matches</th>
                      <th className="py-3 px-3 text-center w-16">Balls</th>
                      <th className="py-3 px-3 text-center w-12">4s</th>
                      <th className="py-3 px-3 text-center w-12">6s</th>
                      <th className="py-3 px-3 text-center w-12">50/100</th>
                      <th className="py-3 px-3 text-center w-16">Highest</th>
                      <th className="py-3.5 px-4 text-right w-20 font-bold text-[#faf5ff] bg-amber-500/10">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orangeCapLeaders.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/50">
                        <td className="py-3 px-4 text-center">
                          {idx === 0 ? (
                            <span className="text-amber-500 font-bold">👑 1</span>
                          ) : (
                            <span className="font-mono text-slate-400">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-1">
                          {p.playerName}
                          {idx === 0 && <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.1 rounded text-[9px] uppercase font-mono font-bold">Orange Cap</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{p.teamName}</td>
                        <td className="py-3 px-3 text-center font-mono">{p.batting.matches}</td>
                        <td className="py-3 px-3 text-center font-mono">{p.batting.balls}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-405">{p.batting.fours}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-405">{p.batting.sixes}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-455">{p.batting.fifties} / {p.batting.hundreds}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-355">{p.batting.highest}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white bg-amber-500/5 border-l border-amber-500/10">{p.batting.runs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Purple Cap */}
        {activeTab === 'purple_cap' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🧢</span>
              <div>
                <h3 className="font-heading font-black text-slate-100 text-base">Purple Cap Leaderboard</h3>
                <p className="text-xs text-slate-400 mt-0.5">Top bowlers of the league sorted by wickets claimed</p>
              </div>
            </div>

            {purpleCapLeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                <p className="text-slate-400 font-heading font-semibold text-xs">No Bowling Roster Data Available</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-850">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-mono text-[10px] tracking-wider uppercase font-semibold">
                      <th className="py-3 px-4 w-12 text-center">Pos</th>
                      <th className="py-3 px-4">Bowler</th>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-3 text-center w-14">Matches</th>
                      <th className="py-3 px-3 text-center w-16">Overs bowled</th>
                      <th className="py-3 px-3 text-center w-16">Runs con.</th>
                      <th className="py-3 px-3 text-center w-16">Best figures</th>
                      <th className="py-3.5 px-4 text-right w-20 font-bold text-white bg-purple-500/10">Wickets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purpleCapLeaders.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/50 text-slate-300">
                        <td className="py-3 px-4 text-center">
                          {idx === 0 ? (
                            <span className="text-purple-500 font-bold">👑 1</span>
                          ) : (
                            <span className="font-mono text-slate-400">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-100 flex items-center gap-1">
                          {p.playerName}
                          {idx === 0 && <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1 py-0.1 rounded text-[9px] uppercase font-mono font-bold">Purple Cap</span>}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-400">{p.teamName}</td>
                        <td className="py-3 px-3 text-center font-mono">{p.bowling.matches}</td>
                        <td className="py-3 px-3 text-center font-mono">{p.bowling.overs}</td>
                        <td className="py-3 px-3 text-center font-mono text-rose-450">{p.bowling.runs}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-450">{p.bowling.bestWickets}/{p.bowling.bestRuns}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white bg-purple-500/5 border-l border-purple-500/10">{p.bowling.wickets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MVP */}
        {activeTab === 'mvp' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-heading font-black text-slate-100 text-base">MVP Leaderboard (Most Valuable Player)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Formula: Runs + Wickets * 20 + Boundaries * 2</p>
              </div>
            </div>

            {mvpLeaders.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                <p className="text-slate-400 font-heading font-semibold text-xs">No Stats Recorded Yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-850">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-mono text-[10px] tracking-wider uppercase font-semibold">
                      <th className="py-3 px-4 w-12 text-center">Pos</th>
                      <th className="py-3 px-4">Player</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Team Name</th>
                      <th className="py-3 px-3 text-center w-14">Runs</th>
                      <th className="py-3 px-3 text-center w-14">Wickets</th>
                      <th className="py-3.5 px-4 text-right w-24 font-bold text-white bg-emerald-500/10">MVP Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mvpLeaders.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/50">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-100">{p.playerName}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{p.role}</td>
                        <td className="py-3 px-4 text-slate-400">{p.teamName}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{p.batting.runs}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{p.bowling.wickets}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-[#2e7d32] text-sm bg-emerald-500/5 border-l border-emerald-500/10">{p.mvpScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Special Records */}
        {activeTab === 'special_awards' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-heading font-black text-slate-100 text-base">Accolades & Records Desk</h3>
                <p className="text-xs text-slate-400 mt-0.5">Special statistical filters across the tournament</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Box 1: Six hitters */}
              <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-850">
                <h4 className="font-heading font-extrabold text-sm text-slate-200 border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
                  <span>💥 Most Sixes Hit</span> <span className="text-[10px] text-orange-400 font-mono">Top 5</span>
                </h4>
                {mostSixesLeaders.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No data yet</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {mostSixesLeaders.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-300">
                        <div className="truncate pr-2">
                          <p className="font-semibold text-slate-200">{p.playerName}</p>
                          <p className="text-[9px] text-slate-500">{p.teamName}</p>
                        </div>
                        <span className="font-mono font-black text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded text-xs">{p.batting.sixes} 𝟞s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: Best Strike rate */}
              <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-850">
                <h4 className="font-heading font-extrabold text-sm text-slate-200 border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
                  <span>⚡ Highest Strike Rate </span> <span className="text-[10px] text-orange-400 font-mono">Min 10 balls</span>
                </h4>
                {bestStrikeRateLeaders.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No data yet</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {bestStrikeRateLeaders.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-300">
                        <div className="truncate pr-2">
                          <p className="font-semibold text-slate-200">{p.playerName}</p>
                          <p className="text-[9px] text-slate-500">{p.teamName}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">{p.strikeRate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 3: Best bow economy */}
              <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-850">
                <h4 className="font-heading font-extrabold text-sm text-slate-200 border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
                  <span>📉 Best Bowling Economy</span> <span className="text-[10px] text-orange-400 font-mono">Min 1 over</span>
                </h4>
                {bestEconomyLeaders.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No data yet</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {bestEconomyLeaders.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-300">
                        <div className="truncate pr-2">
                          <p className="font-semibold text-slate-200">{p.playerName}</p>
                          <p className="text-[9px] text-slate-500">{p.teamName}</p>
                        </div>
                        <span className="font-mono font-bold text-rose-400">{p.economy} r/o</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
