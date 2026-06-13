import React, { useState } from 'react';
import { HallOfFameRecord, Fixture, MatchSimulationResponse, Standing, PlayerCareerStats } from '../types';
import { oversToBalls, sanitizeResultText } from '../utils/cricketCalculations';
import {
  Award,
  Library,
  Star,
  Milestone,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Trophy,
  Users,
  TrendingUp,
  Flame,
  MessageSquare,
  Sparkle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface HallOfFamePanelProps {
  records: HallOfFameRecord[];
  onStartNewSeason?: () => void;
  activeStatus?: 'setup' | 'team_building' | 'active_season' | 'playoffs' | 'completed';
}

export default function HallOfFamePanel({ records, onStartNewSeason, activeStatus }: HallOfFamePanelProps) {
  const [selectedRecord, setSelectedRecord] = useState<HallOfFameRecord | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'standings' | 'results' | 'playoffs' | 'stats'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);

  // Floating Action Button rendering helper
  const floatBtn = activeStatus === 'completed' && onStartNewSeason && (
    <button
      onClick={onStartNewSeason}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-heading font-black px-5 py-3 rounded-full flex items-center gap-2 shadow-2xl tracking-wider uppercase border border-emerald-400/20 cursor-pointer hover:scale-105 transition-all"
      id="global-floating-reset-season-btn"
    >
      <RefreshCw className="w-4 h-4 animate-spin-slow" /> Start New Season
    </button>
  );

  if (selectedRecord) {
    // Sub-render for a single detailed archived season
    const rec = selectedRecord;

    // Filters for career statistics
    const filteredStats = (rec.seasonStatistics || []).filter(p => {
      const matchesSearch = p.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.teamName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'All' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div className="relative space-y-6" id="hall-of-fame-detail-root">
        {floatBtn}
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setSelectedRecord(null);
              setActiveSubTab('overview');
            }}
            className="flex items-center gap-2 text-xs font-bold text-amber-500 hover:text-amber-400 font-mono transition bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-800 shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Hall Of Fame Registry
          </button>
          <div className="sm:text-right font-mono">
            <h3 className="text-sm font-black text-white">{rec.seasonName}</h3>
            <p className="text-[11px] text-amber-500">🏆 CHAMPION: {rec.championTeamName}</p>
          </div>
        </div>

        {/* Detailed Season Sub-Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4.5 py-3 text-xs font-bold font-mono border-b-2 uppercase tracking-wide transition shrink-0 ${
              activeSubTab === 'overview'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✨ Season Overview
          </button>
          <button
            onClick={() => setActiveSubTab('standings')}
            className={`px-4.5 py-3 text-xs font-bold font-mono border-b-2 uppercase tracking-wide transition shrink-0 ${
              activeSubTab === 'standings'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Points Table
          </button>
          <button
            onClick={() => setActiveSubTab('results')}
            className={`px-4.5 py-3 text-xs font-bold font-mono border-b-2 uppercase tracking-wide transition shrink-0 ${
              activeSubTab === 'results'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 League Results
          </button>
          <button
            onClick={() => setActiveSubTab('playoffs')}
            className={`px-4.5 py-3 text-xs font-bold font-mono border-b-2 uppercase tracking-wide transition shrink-0 ${
              activeSubTab === 'playoffs'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🔥 Playoff Finals
          </button>
          <button
            onClick={() => setActiveSubTab('stats')}
            className={`px-4.5 py-3 text-xs font-bold font-mono border-b-2 uppercase tracking-wide transition shrink-0 ${
              activeSubTab === 'stats'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📈 Player Statistics
          </button>
        </div>

        {/* TAB CONTENT */}

        {/* 1. OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6 animate-fade-in text-xs font-sans">
            {/* Champs Crown Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0f172a] border border-emerald-500/20 p-6 rounded-xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                    🥇 TOURNAMENT CHAMPION
                  </span>
                  <h4 className="text-3xl font-heading font-black text-emerald-400">{rec.championTeamName}</h4>
                  <p className="text-slate-400 italic leading-relaxed pt-2">
                    "{rec.summary}"
                  </p>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-slate-300">
                    Crowned as the premier franchise of the auction cycle!
                  </span>
                </div>
              </div>

              <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-xl flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                    🥈 RUNNER UP
                  </span>
                  <h4 className="text-2xl font-heading font-black text-slate-200">{rec.runnerUpTeamName}</h4>
                  <p className="text-slate-400 leading-normal pt-2">
                    Fought valiantly throughout the round-robin stages but fell short in the high-voltage championship final match.
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="text-[11px] text-slate-300">
                    Outstanding campaign finished with final silver accolades.
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Awards cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 opacity-5">
                  <Star className="w-24 h-24 text-amber-500" />
                </div>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono uppercase">
                  Most valuable player
                </span>
                <p className="font-heading font-black text-lg text-white mt-2">{rec.mvpName}</p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Exceptional baseline contribution across both batting lines and bowling overs throughout the season.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 opacity-5">
                  <Award className="w-24 h-24 text-amber-500" />
                </div>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono uppercase">
                  🍊 Orange Cap Holder
                </span>
                <p className="font-heading font-black text-lg text-white mt-2">{rec.orangeCapName}</p>
                <p className="text-[11px] font-mono text-amber-400 mt-1 font-bold">Runs compiled: {rec.orangeCapRuns} runs</p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Supreme batsmanship, targeting lines and sending boundaries deep into the crowds under maximum speed.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 relative overflow-hidden">
                <div className="absolute right-2 top-2 opacity-5">
                  <Award className="w-24 h-24 text-purple-500" />
                </div>
                <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-mono uppercase">
                  🍇 Purple Cap Holder
                </span>
                <p className="font-heading font-black text-lg text-white mt-2">{rec.purpleCapName}</p>
                <p className="text-[11px] font-mono text-purple-400 mt-1 font-bold">Wickets claimed: {rec.purpleCapWickets} wkts</p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Crucial lengths, destroying layouts and securing early wickets to build vital pressure during active overs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. STANDINGS / POINTS TABLE */}
        {activeSubTab === 'standings' && (
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 space-y-4 animate-fade-in text-xs font-sans">
            <div className="flex justify-between items-center pb-2">
              <span className="font-heading font-bold text-slate-200">Historical Standings Table</span>
              <span className="text-[10px] text-slate-500 font-mono">ROUND ROBIN CLASSIFICATION</span>
            </div>

            {rec.pointsTable && rec.pointsTable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-mono text-[10px] uppercase text-slate-500">
                      <th className="py-2.5 font-bold">Rank & Franchise</th>
                      <th className="py-2.5 text-center font-bold">Played</th>
                      <th className="py-2.5 text-center font-bold">Won</th>
                      <th className="py-2.5 text-center font-bold">Lost</th>
                      <th className="py-2.5 text-center font-bold text-slate-200">Points</th>
                      <th className="py-2.5 text-right font-mono text-[10px] font-bold">Net Run Rate (NRR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {rec.pointsTable.map((std, idx) => (
                      <tr key={std.teamId} className="hover:bg-slate-900/40">
                        <td className="py-3 font-semibold text-slate-100 flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500 w-4">#{idx + 1}</span>
                          {std.teamName}
                        </td>
                        <td className="py-3 text-center text-slate-300 font-mono">{std.played}</td>
                        <td className="py-3 text-center text-emerald-400 font-mono font-bold">{std.won}</td>
                        <td className="py-3 text-center text-rose-400 font-mono">{std.lost}</td>
                        <td className="py-3 text-center text-amber-500 font-mono font-black text-sm">{std.points}</td>
                        <td className={`py-3 text-right font-mono font-semibold ${std.nrr >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                          {std.nrr >= 0 ? '+' : ''}{std.nrr.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 py-6 text-center italic">
                Points Table log not found for this historical season.
              </p>
            )}
          </div>
        )}

        {/* 3. LEAGUE RESULTS */}
        {activeSubTab === 'results' && (
          <div className="space-y-4 animate-fade-in text-xs font-sans">
            <div>
              <h4 className="font-heading font-black text-slate-200 text-sm">Round Robin Match Record</h4>
              <p className="text-[11px] text-slate-400">Review full detailed match scorecards and results archived permanently from this league stage cycle.</p>
            </div>

            {rec.leagueResults && rec.leagueResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-3.5">
                {rec.leagueResults.map((fix) => (
                  <ArchivedFixtureCard
                    key={fix.id}
                    fixture={fix}
                    isExpanded={expandedFixtureId === fix.id}
                    onToggle={() => setExpandedFixtureId(expandedFixtureId === fix.id ? null : fix.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 py-6 text-center italic">
                League match results were not logged for this historical season.
              </p>
            )}
          </div>
        )}

        {/* 4. PLAYOFF FINALS */}
        {activeSubTab === 'playoffs' && (
          <div className="space-y-6 animate-fade-in text-xs font-sans">
            <div>
              <h4 className="font-heading font-black text-slate-200 text-sm">The Playoff brackets & Finals Arena</h4>
              <p className="text-[11px] text-slate-400">High pressure qualifier knockout fixtures to crown the final franchise champion.</p>
            </div>

            {rec.playoffMatches && rec.playoffMatches.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {rec.playoffMatches.map((fix) => (
                  <ArchivedFixtureCard
                    key={fix.id}
                    fixture={fix}
                    isExpanded={expandedFixtureId === fix.id}
                    onToggle={() => setExpandedFixtureId(expandedFixtureId === fix.id ? null : fix.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 py-6 text-center italic">
                Playoffs playoff history logs not found for this historical season.
              </p>
            )}
          </div>
        )}

        {/* 5. PLAYER STATISTICS */}
        {activeSubTab === 'stats' && (
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 space-y-5 animate-fade-in text-xs font-sans">
            {/* Filter controls */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search player name or franchise..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-9 py-2 text-xs focus:outline-none focus:border-amber-500 text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-mono text-[10px] uppercase">Filter Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-855 rounded px-2.5 py-1.5 text-xs text-slate-350 focus:outline-none"
                >
                  <option value="All">All Roles</option>
                  <option value="Batsman">Batsmen</option>
                  <option value="Bowler">Bowlers</option>
                  <option value="All Rounder">All Rounders</option>
                  <option value="Wicket Keeper">Wicket Keepers</option>
                </select>
              </div>
            </div>

            {filteredStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-500 uppercase h-9">
                      <th className="py-2 font-bold">Player Name</th>
                      <th className="py-2 font-bold">Franchise</th>
                      <th className="py-2 text-center font-bold">Role</th>
                      <th className="py-2 text-center font-bold text-amber-500/90 font-mono">Matches</th>
                      <th className="py-2 text-center font-bold text-slate-200 font-mono">Runs</th>
                      <th className="py-2 text-center font-bold font-mono">Fours</th>
                      <th className="py-2 text-center font-bold font-mono">Sixes</th>
                      <th className="py-2 text-center font-bold text-purple-400 font-mono">Wickets</th>
                      <th className="py-2 text-center font-bold font-mono">Overs</th>
                      <th className="py-2 text-right font-bold text-emerald-400 font-mono">Strike Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredStats.map((p) => {
                      const batSR = p.batting.balls > 0 ? ((p.batting.runs / p.batting.balls) * 100).toFixed(1) : '-';
                      return (
                        <tr key={p.playerName} className="hover:bg-slate-900/30 font-sans">
                          <td className="py-2.5 font-semibold text-slate-100">{p.playerName}</td>
                          <td className="py-2.5 text-slate-400 font-mono text-[11px]">{p.teamName}</td>
                          <td className="py-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800 uppercase font-mono">
                              {p.role}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-mono text-slate-300">{p.batting.matches || p.bowling.matches || 0}</td>
                          <td className="py-2.5 text-center font-mono font-bold text-slate-100">{p.batting.runs}</td>
                          <td className="py-2.5 text-center font-mono text-slate-400">{p.batting.fours}</td>
                          <td className="py-2.5 text-center font-mono text-slate-400">{p.batting.sixes}</td>
                          <td className="py-2.5 text-center font-mono font-bold text-purple-400">{p.bowling.wickets}</td>
                          <td className="py-2.5 text-center font-mono text-slate-400">{p.bowling.overs}</td>
                          <td className="py-2.5 text-right font-mono font-semibold text-emerald-400">{batSR}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 py-6 text-center italic">
                No archived player data corresponds to your query guidelines.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-6 animate-fade-in" id="hall-of-fame-registry-root">
      {floatBtn}
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-600/10 via-amber-950/20 to-slate-900 border border-slate-800 p-6 rounded-xl space-y-1 relative" id="hall-of-fame-banner">
        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase">
          league historical registry
        </span>
        <h2 className="font-heading text-2xl font-black text-white flex items-center gap-2">
          <Library className="w-5 h-5 text-amber-500" /> Franchise Hall of Fame
        </h2>
        <p className="text-xs text-slate-400 max-w-xl">
          View preceding champion franchises, cap owners, and complete technical records stored permanently across completed season cycles.
        </p>

        {/* Start New Season inside Hall of Fame when season is completed */}
        {activeStatus === 'completed' && onStartNewSeason && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center bg-emerald-950/10 p-3 rounded-lg border border-emerald-500/10">
            <span className="text-[11px] text-slate-300 font-mono">🎖️ Cycle Ready! Click to roll out the next draft & auction.</span>
            <button
              onClick={onStartNewSeason}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 transition font-mono px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin-slow" /> Start Next Season
            </button>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-[#070b14]/50 border border-slate-850 rounded-xl" id="hall-of-fame-empty">
          <Milestone className="w-12 h-12 text-slate-700 mx-auto mb-2" />
          <p className="font-medium font-heading text-sm text-slate-300">No Historical Season Archives Recorded Yet</p>
          <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-normal">
            Play standard round-robin matches and conclude playoff bracket finales to capture championship details in the Hall Of Fame permanently.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="hall-of-fame-grid">
          {records.map((rec) => (
            <div
              key={rec.seasonId}
              className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow hover:border-slate-700 transition"
            >
              {/* Card top banner */}
              <div className="bg-slate-900 px-5 py-3.5 border-b border-slate-800 flex justify-between items-center">
                <span className="font-heading font-black text-slate-100 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500/20" /> {rec.seasonName}
                </span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold font-mono px-2 py-0.5 rounded uppercase">
                  Champ crowned
                </span>
              </div>

              {/* Summary info and key figures */}
              <div className="p-5 space-y-4 text-xs font-sans">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">🏆 League Champion</span>
                    <p className="font-heading font-black text-base text-amber-400 mt-0.5">{rec.championTeamName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono uppercase">Runner-Up</span>
                    <p className="font-heading font-bold text-slate-350 mt-0.5">{rec.runnerUpTeamName}</p>
                  </div>
                </div>

                <p className="text-slate-400 italic leading-relaxed border-l border-amber-500/30 pl-3.5">
                  "{rec.summary}"
                </p>

                {/* Star players */}
                <div className="grid grid-cols-3 gap-2.5 pt-1.5 font-mono text-[10px] bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">⭐ MVP</span>
                    <span className="font-medium text-slate-350 truncate block mt-0.5" title={rec.mvpName}>
                      {rec.mvpName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-amber-500 uppercase block">🍊 ORANGE</span>
                    <span className="font-medium text-slate-350 block mt-0.5 truncate" title={rec.orangeCapName}>
                      {rec.orangeCapName} <span className="text-slate-500 text-[9px]">({rec.orangeCapRuns})</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-purple-400 uppercase block">🍇 PURPLE</span>
                    <span className="font-medium text-slate-350 block mt-0.5 truncate" title={rec.purpleCapName}>
                      {rec.purpleCapName} <span className="text-slate-500 text-[9px]">({rec.purpleCapWickets})</span>
                    </span>
                  </div>
                </div>

                {/* Sub-tab view triggers */}
                <button
                  onClick={() => {
                    setSelectedRecord(rec);
                    setActiveSubTab('overview');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-amber-400 hover:text-amber-300 transition text-[11px] font-mono font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                >
                  <Sparkle className="w-3.5 h-3.5" /> Open Detailed Season Log & Stats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------
// SUB-HELPERS: Archived Fixture Display Card & Nested Scorecard Drawers
// ------------------------------------------------------------------------------------------------------------------------------------------------------

interface ArchivedFixtureCardProps {
  key?: string;
  fixture: Fixture;
  isExpanded: boolean;
  onToggle: () => void;
}

function ArchivedFixtureCard({ fixture, isExpanded, onToggle }: ArchivedFixtureCardProps) {
  const isPlayoff = fixture.isPlayoff;

  // Replay State
  const [isReplaying, setIsReplaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWicketAnimation, setIsWicketAnimation] = useState(false);
  const [isBoundaryAnimation, setIsBoundaryAnimation] = useState<'four' | 'six' | null>(null);
  const replayAnimationCleanupRef = React.useRef<any>(null);
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [overIdx, setOverIdx] = useState(0);
  const [ballIdx, setBallIdx] = useState(0);
  const [runningRuns, setRunningRuns] = useState(0);
  const [runningWickets, setRunningWickets] = useState(0);
  const [runningOversPlayed, setRunningOversPlayed] = useState('0.0');
  const [playbackSpeed, setPlaybackSpeed] = useState<'slow' | 'normal' | 'fast' | 'instant'>('normal');
  const [liveLog, setLiveLog] = useState<Array<{ ballKey: string; bowler: string; desc: string; type: string }>>([]);
  const replayLogContainerRef = React.useRef<HTMLDivElement | null>(null);

  const getSpeedDelay = () => {
    switch (playbackSpeed) {
      case 'slow': return 1200;
      case 'fast': return 200;
      case 'instant': return 0;
      case 'normal':
      default: return 600;
    }
  };

  // Localized scroll within the replay box container to prevent page jumping
  React.useEffect(() => {
    if (replayLogContainerRef.current) {
      replayLogContainerRef.current.scrollTop = replayLogContainerRef.current.scrollHeight;
    }
  }, [liveLog]);

  const getLivePlayerStatus = () => {
    if (!fixture.scorecard) return null;
    const scorecard = fixture.scorecard;
    const innings = currentInnings === 1 ? scorecard.innings1 : scorecard.innings2;
    if (!innings || !innings.overs || !innings.batsmen) return null;
    
    const batsmen = innings.batsmen.map((b: any) => ({
      name: b.name,
      runs: 0,
      balls: 0,
    }));
    
    if (batsmen.length === 0) return null;

    let bat1Idx = 0;
    let bat2Idx = 1;
    let strikeIdx = 0; 
    let nextBatIdx = 2;
    
    for (let o = 0; o <= overIdx; o++) {
      const overObj = innings.overs[o];
      if (!overObj) break;
      
      const timeline = overObj.timeline || [];
      const ballsToProcess = o === overIdx ? ballIdx : timeline.length;
      
      for (let b = 0; b < ballsToProcess; b++) {
        const ballObj = timeline[b];
        if (!ballObj) break;
        
        const batsmanOnStrike = strikeIdx === 0 ? batsmen[bat1Idx] : batsmen[bat2Idx];
        if (batsmanOnStrike) {
          if (ballObj.type !== 'extra') {
            batsmanOnStrike.balls += 1;
            batsmanOnStrike.runs += ballObj.runsScored;
          }
        }
        
        if (ballObj.type === 'wicket') {
          if (nextBatIdx < batsmen.length) {
            if (strikeIdx === 0) {
              bat1Idx = nextBatIdx;
            } else {
              bat2Idx = nextBatIdx;
            }
            nextBatIdx++;
          }
        } else if (ballObj.type === 'run' || ballObj.type === 'boundary') {
          const runs = ballObj.runsScored;
          if (runs % 2 === 1) {
            strikeIdx = strikeIdx === 0 ? 1 : 0;
          }
        }
      }
      
      if (o < overIdx) {
        strikeIdx = strikeIdx === 0 ? 1 : 0;
      }
    }
    
    const striker = (strikeIdx === 0 ? batsmen[bat1Idx] : batsmen[bat2Idx]) || null;
    const nonStriker = (strikeIdx === 0 ? batsmen[bat2Idx] : batsmen[bat1Idx]) || null;
    
    const bowlerForThisOver = innings.bowlers[overIdx % innings.bowlers.length]?.name || 'Bowler';
    
    return {
      striker: striker ? { name: striker.name, runs: striker.runs, balls: striker.balls } : null,
      nonStriker: nonStriker ? { name: nonStriker.name, runs: nonStriker.runs, balls: nonStriker.balls } : null,
      bowlerName: bowlerForThisOver
    };
  };

  const livePlayers = getLivePlayerStatus();

  React.useEffect(() => {
    if (!isPlaying || !fixture.scorecard) return;

    const scorecard = fixture.scorecard;
    const innings = currentInnings === 1 ? scorecard.innings1 : scorecard.innings2;
    const overObj = innings?.overs[overIdx];

    if (!overObj) {
      if (currentInnings === 1) {
        // Transition to Inning 2
        const delay = playbackSpeed === 'instant' ? 0 : 2000;
        setLiveLog(prev => [...prev, {
          ballKey: `mid_break_${Date.now()}`,
          bowler: 'Innings Break',
          desc: `--- END OF INNINGS 1 --- ${scorecard.innings1.battingTeam} finished at ${scorecard.innings1.totalRuns}/${scorecard.innings1.totalWickets} in ${scorecard.innings1.totalOvers} overs. target value for ${scorecard.innings2.battingTeam} is ${scorecard.innings1.totalRuns + 1} runs.`,
          type: 'extra'
        }]);

        const timer = setTimeout(() => {
          setCurrentInnings(2);
          setOverIdx(0);
          setBallIdx(0);
          setRunningRuns(0);
          setRunningWickets(0);
          setRunningOversPlayed('0.0');
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setIsPlaying(false);
        setLiveLog(prev => [...prev, {
          ballKey: `end_match_${Date.now()}`,
          bowler: 'Match Result',
          desc: `🏆 MATCH COMPLETED! ${sanitizeResultText(fixture.result)}`,
          type: 'extra'
        }]);
      }
      return;
    }

    const timeline = overObj.timeline;
    const ballObj = timeline[ballIdx];

    if (!ballObj) {
      // Over finished
      setLiveLog(prev => [...prev, {
        ballKey: `over_${currentInnings}_${overObj.overNumber}_summary_${Date.now()}`,
        bowler: 'Over Summary',
        desc: `--- End of Over ${overObj.overNumber}: ${overObj.commentary} (${overObj.runs} Runs, ${overObj.wicketsList.length} Wickets) ---`,
        type: 'extra'
      }]);

      const delay = playbackSpeed === 'instant' ? 0 : 1000;
      const timer = setTimeout(() => {
        setOverIdx(prev => prev + 1);
        setBallIdx(0);
      }, delay);
      return () => clearTimeout(timer);
    }

    // Process ball
    const delay = getSpeedDelay();
    const timer = setTimeout(() => {
      const runsAfterBall = runningRuns + ballObj.runsScored;
      let wicketsAfterBall = runningWickets;
      if (ballObj.type === 'wicket') {
        wicketsAfterBall += 1;
        setIsWicketAnimation(true);
        if (replayAnimationCleanupRef.current) clearTimeout(replayAnimationCleanupRef.current);
        replayAnimationCleanupRef.current = setTimeout(() => setIsWicketAnimation(false), 800);
      } else if (ballObj.type === 'boundary') {
        if (ballObj.runsScored === 4) {
          setIsBoundaryAnimation('four');
          if (replayAnimationCleanupRef.current) clearTimeout(replayAnimationCleanupRef.current);
          replayAnimationCleanupRef.current = setTimeout(() => setIsBoundaryAnimation(null), 800);
        } else if (ballObj.runsScored === 6) {
          setIsBoundaryAnimation('six');
          if (replayAnimationCleanupRef.current) clearTimeout(replayAnimationCleanupRef.current);
          replayAnimationCleanupRef.current = setTimeout(() => setIsBoundaryAnimation(null), 800);
        }
      }
      const formattedOvers = `${overObj.overNumber - 1}.${ballObj.ball}`;

      setRunningRuns(runsAfterBall);
      setRunningWickets(wicketsAfterBall);
      setRunningOversPlayed(formattedOvers);

      const bowlerForThisOver = (innings?.bowlers && innings.bowlers.length > 0) ? innings.bowlers[overIdx % innings.bowlers.length]?.name : 'Bowler';
      setLiveLog(prev => [...prev, {
        ballKey: `replay_${currentInnings}_${overIdx}_${ballIdx}_${Date.now()}`,
        bowler: bowlerForThisOver,
        desc: `Over ${overObj.overNumber - 1}.${ballObj.ball} - ${ballObj.description}`,
        type: ballObj.type
      }]);

      setBallIdx(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [isPlaying, currentInnings, overIdx, ballIdx, fixture.scorecard, playbackSpeed]);

  // Render a clean match card with clickable scoreboard drawer details!
  return (
    <div className={`bg-[#0f172a] border rounded-xl overflow-hidden transition ${isExpanded ? 'border-amber-500/30' : 'border-slate-800 hover:border-slate-700'}`}>
      <div
        onClick={onToggle}
        className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer hover:bg-slate-900/30 select-none text-xs"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono uppercase font-bold ${isPlayoff ? 'text-amber-500 bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.2 rounded' : 'text-slate-500'}`}>
                {isPlayoff ? `${getPlayoffTitle(fixture.playoffType)}` : `Round Robin Stage`}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Matched Record</span>
            </div>
            <p className="font-heading font-bold text-slate-200 mt-1">
              Match Result: <span className="text-emerald-400 font-extrabold">{sanitizeResultText(fixture.result)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 border-slate-850 pt-2.5 md:pt-0">
          <span className="text-[10px] font-mono text-slate-500 uppercase">
            Click to {isExpanded ? 'Collapse' : 'Expand Scorecard'}
          </span>
          <button className="text-slate-400 bg-slate-950 p-1.5 rounded-lg border border-slate-850">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && fixture.scorecard && (
        <div className="border-t border-slate-850 bg-slate-950/50 p-5 space-y-6">
          {/* Summary Box */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg space-y-1.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <span className="text-[9px] text-amber-500 font-mono uppercase block">👑 Presentation Highlights</span>
              <p className="text-slate-100 font-bold text-xs">{fixture.scorecard.result.summary}</p>
              <div className="pt-1 flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded text-[9px] font-mono">POTM</span>
                <p className="text-[11px] text-slate-300 font-mono">
                  {fixture.scorecard.result.playerOfTheMatch.name} ({fixture.scorecard.result.playerOfTheMatch.stats}) - {fixture.scorecard.result.playerOfTheMatch.reason}
                </p>
              </div>
            </div>

            {/* Replay Commentary Button */}
            {!isReplaying ? (
              <button
                onClick={() => {
                  setIsReplaying(true);
                  setIsPlaying(true);
                  setCurrentInnings(1);
                  setOverIdx(0);
                  setBallIdx(0);
                  setRunningRuns(0);
                  setRunningWickets(0);
                  setRunningOversPlayed('0.0');
                  setLiveLog([{
                    ballKey: 'toss_replay',
                    bowler: 'Match Official',
                    desc: `REPLAY TOSS UPDATE: ${fixture.scorecard!.toss.commentary}`,
                    type: 'toss'
                  }]);
                }}
                className="bg-amber-500 hover:bg-amber-600 font-heading text-slate-950 text-xs font-black tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow shadow-amber-950/20 cursor-pointer self-start md:self-center shrink-0 border border-transparent hover:scale-[1.02]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Replay Commentary
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsReplaying(false);
                  setIsPlaying(false);
                }}
                className="bg-slate-800 hover:bg-slate-700 font-heading text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer self-start md:self-center shrink-0 border border-slate-750"
              >
                ← Back to Stat Tables
              </button>
            )}
          </div>

          {isReplaying ? (
            /* Immersive Commentary Replay Workspace */
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-in text-xs font-sans">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-850 pb-3 gap-3">
                <div>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase">
                    live match commentary playback
                  </span>
                  <p className="font-heading font-black text-slate-200 mt-0.5">
                    {currentInnings === 1 ? fixture.scorecard.innings1.battingTeam : fixture.scorecard.innings2.battingTeam} is batting
                  </p>
                </div>

                {/* Speed Controls & Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Play / Pause Toggle */}
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition ${
                      isPlaying
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-600'
                    }`}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  {/* Playback speed buttons */}
                  <div className="flex bg-slate-900 border border-slate-850 px-1 py-0.5 rounded font-mono text-[9px]">
                    {(['slow', 'normal', 'fast', 'instant'] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {spd}
                      </button>
                    ))}
                  </div>

                  {/* Restart button */}
                  <button
                    onClick={() => {
                      setCurrentInnings(1);
                      setOverIdx(0);
                      setBallIdx(0);
                      setRunningRuns(0);
                      setRunningWickets(0);
                      setRunningOversPlayed('0.0');
                      setLiveLog([{
                        ballKey: 'toss_replay',
                        bowler: 'Match Official',
                        desc: `REPLAY TOSS UPDATE: ${fixture.scorecard!.toss.commentary}`,
                        type: 'toss'
                      }]);
                      setIsPlaying(true);
                    }}
                    className="bg-slate-900 hover:bg-slate-850 border border-slate-800 p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                    title="Restart Playback"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Main Replay Visual Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border-b border-slate-850 pb-4">
                {/* Score Widget Card */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-850 p-4.5 rounded-xl flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Innings {currentInnings}</p>
                      <h3 className="font-heading font-black text-base text-slate-200 mt-1">
                        {currentInnings === 1 ? fixture.scorecard.innings1.battingTeam : fixture.scorecard.innings2.battingTeam}
                      </h3>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Score</p>
                      <h2 className="font-heading font-black text-3xl text-white">
                        {runningRuns}/{runningWickets}
                      </h2>
                      <p className="text-xs font-mono text-slate-400">
                        Overs: <span className="text-white font-bold">{runningOversPlayed}</span> / {fixture.scorecard.innings1.totalOvers || 20.0}
                      </p>
                    </div>

                    {currentInnings === 2 && (
                      <div className="bg-slate-950 p-2 text-[10px] font-mono border border-slate-850 rounded text-amber-500">
                        Target: <span className="text-white font-bold">{fixture.scorecard.innings1.totalRuns + 1} runs</span>
                        <br />
                        Need {Math.max(0, (fixture.scorecard.innings1.totalRuns + 1) - runningRuns)} runs from {' '}
                        {Math.max(0, (Math.ceil(fixture.scorecard.innings1.totalOvers || 20.0) * 6) - oversToBalls(parseFloat(runningOversPlayed)))} balls.
                      </div>
                    )}

                    {/* Live Replay Batter & Bowler Info Block */}
                    {livePlayers && (
                      <div className="bg-[#12192c] border border-slate-800/80 p-3 rounded-lg space-y-3 font-mono text-[10px] text-slate-300 shadow-md" id="replay-simulation-active-players-box">
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider border-b border-slate-800/40 pb-1">Batting Partner duo</p>
                          {livePlayers.striker && (
                            <div className="flex justify-between items-center bg-[#18233c] px-2 py-1 rounded border border-amber-500/10">
                              <span className="font-bold text-slate-100 flex items-center gap-1.5 text-[11px]">
                                🏏 {livePlayers.striker.name} <span className="bg-amber-400/15 text-amber-500 text-[8px] px-1 rounded font-normal uppercase scale-90">On Strike</span>
                              </span>
                              <span className="font-black text-amber-400 font-mono text-[11px]">
                                {livePlayers.striker.runs} <span className="text-[9px] font-normal text-slate-400">({livePlayers.striker.balls})</span>
                              </span>
                            </div>
                          )}
                          {livePlayers.nonStriker && (
                            <div className="flex justify-between items-center px-1.5 py-0.5 text-slate-400">
                              <span className="font-medium flex items-center gap-1.5 text-[11px]">
                                👤 {livePlayers.nonStriker.name}
                              </span>
                              <span className="font-medium text-slate-300 font-mono text-[11px]">
                                {livePlayers.nonStriker.runs} <span className="text-[9px] font-normal text-slate-500">({livePlayers.nonStriker.balls})</span>
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1.5 border-t border-slate-800/60 pt-2">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bowling Unit</p>
                          <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded border border-slate-800/40">
                            <span className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px]">
                              🔴 {livePlayers.bowlerName}
                            </span>
                            <span className="bg-rose-500/10 text-rose-400 text-[8px] px-1 py-0.5 rounded font-black uppercase tracking-wider">bowler</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Highlights flash banners */}
                    <div className="h-14 flex items-center justify-center relative overflow-hidden mt-2">
                      {isWicketAnimation && (
                        <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white font-heading font-black text-xs px-4 py-1.5 rounded-lg animate-bounce border border-red-400 shadow shadow-red-900">
                          🔴 OUT! WICKET!
                        </div>
                      )}
                      {isBoundaryAnimation === 'four' && (
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-heading font-black text-xs px-4 py-1.5 rounded-lg animate-pulse border border-cyan-400 shadow shadow-blue-900">
                          ⚡ FOUR! BOUNDARY!
                        </div>
                      )}
                      {isBoundaryAnimation === 'six' && (
                        <div className="bg-gradient-to-r from-[#22c55e] to-emerald-600 text-white font-heading font-black text-xs px-4 py-1.5 rounded-lg animate-ping border border-emerald-400 shadow shadow-emerald-950">
                          🏏 SIX! MAXIMUM!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrolling commentary text board */}
                <div className="lg:col-span-8 bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col h-[280px]">
                  <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest border-b border-slate-800 pb-2 mb-2">
                    Commentary Log
                  </p>
                  <div ref={replayLogContainerRef} className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed">
                    {liveLog.map((log) => {
                      let tagColor = 'bg-slate-900 text-slate-400 border border-slate-800';
                      if (log.type === 'wicket') tagColor = 'bg-rose-500 text-rose-950 font-black';
                      if (log.type === 'boundary') tagColor = 'bg-amber-500 text-slate-950 font-black';
                      if (log.type === 'toss') tagColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                      if (log.type === 'extra') tagColor = 'bg-purple-950/20 text-purple-300 border border-purple-500/10';

                      return (
                        <div key={log.ballKey} className="flex items-start gap-2 animate-fade-in border-b border-slate-900/40 pb-1.5 last:border-b-0">
                          <span className={`${tagColor} text-[9px] uppercase px-2 py-0.2 rounded font-black shrink-0 font-mono tracking-wider min-w-[70px] text-center`}>
                            {log.type === 'wicket' ? 'OUT' : log.type === 'boundary' ? 'BOUND' : log.bowler}
                          </span>
                          <span className="text-slate-300">{log.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Innings columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Innings 1 Card */}
                <ArchivedInningBox inning={fixture.scorecard.innings1} title="First Innings (Batting)" />
                {/* Innings 2 Card */}
                <ArchivedInningBox inning={fixture.scorecard.innings2} title="Second Innings (Chase)" />
              </div>

              {/* Gully commentary block */}
              <div className="bg-[#111827] border border-amber-500/10 rounded-xl p-5.5 relative">
                <div className="absolute right-4.5 top-4 text-amber-500 font-mono text-[9px] opacity-25 uppercase font-black">
                  🎙️ gully-style audio
                </div>
                <h4 className="font-mono text-[10px] uppercase text-amber-500 font-bold mb-2.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-500" /> Ground Narrative Commentary
                </h4>
                <div className="text-slate-300 whitespace-pre-line text-xs font-serif leading-relaxed italic bg-black/30 p-4 rounded-lg border border-slate-850 max-h-80 overflow-y-auto">
                  {fixture.scorecard.result.gullyCommentary || fixture.scorecard.result.presentationCommentary}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ArchivedInningBoxProps {
  inning: any;
  title: string;
}

function ArchivedInningBox({ inning, title }: ArchivedInningBoxProps) {
  if (!inning) return null;

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 space-y-4 text-xs font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
        <h5 className="font-heading font-black text-slate-200">{title}</h5>
        <div className="text-right">
          <p className="font-heading font-extrabold text-amber-500 text-sm">
            {inning.battingTeam}: {inning.totalRuns}/{inning.totalWickets}
          </p>
          <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
            Overs: {inning.totalOvers} overs
          </p>
        </div>
      </div>

      {/* Batsmen stats */}
      <div className="space-y-2">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">Batsmen Card</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 font-mono text-[9px] text-slate-500 uppercase h-6">
                <th>Batsman</th>
                <th className="text-center">Runs</th>
                <th className="text-center">Balls</th>
                <th className="text-center">4s</th>
                <th className="text-center">6s</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {inning.batsmen.map((b: any, idx: number) => {
                const batSR = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0';
                return (
                  <tr key={idx} className="h-7 text-[11px]">
                    <td className="font-semibold text-slate-250 py-0.5">{b.name}</td>
                    <td className="text-center font-mono font-bold text-slate-100">{b.runs}</td>
                    <td className="text-center font-mono text-slate-400">{b.balls}</td>
                    <td className="text-center font-mono text-slate-400">{b.fours}</td>
                    <td className="text-center font-mono text-slate-400">{b.sixes}</td>
                    <td className="text-right font-mono text-[9px] text-slate-500 truncate max-w-28">{b.howOut || 'dnb'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bowlers stats */}
      <div className="space-y-2 pt-1">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black">Bowling Card</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 font-mono text-[9px] text-slate-500 uppercase h-6">
                <th>Bowler</th>
                <th className="text-center">Overs</th>
                <th className="text-center">Runs</th>
                <th className="text-center">Wickets</th>
                <th className="text-right">Economy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {inning.bowlers.map((bw: any, idx: number) => {
                const economy = bw.overs > 0 ? (bw.runs / bw.overs).toFixed(2) : '0.00';
                return (
                  <tr key={idx} className="h-7 text-[11px]">
                    <td className="font-semibold text-slate-250 py-0.5">{bw.name}</td>
                    <td className="text-center font-mono text-slate-400">{bw.overs}</td>
                    <td className="text-center font-mono text-slate-400">{bw.runs}</td>
                    <td className="text-center font-mono font-bold text-purple-400">{bw.wickets}</td>
                    <td className="text-right font-mono text-emerald-400">{economy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getPlayoffTitle(type: string | null) {
  switch (type) {
    case 'Q1': return 'Qualifier 1';
    case 'EL': return 'Eliminator';
    case 'Q2': return 'Qualifier 2';
    case 'FI': return 'The Grand Final';
    default: return 'Playoff Match';
  }
}
