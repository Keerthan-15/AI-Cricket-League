import React, { useState, useEffect } from 'react';
import { Player, Team, Fixture, NewsArticle, Standing, PlayerCareerStats, HallOfFameRecord, MatchSimulationResponse } from './types';
import {
  generateRoundRobinFixtures,
  calculateStandings,
  calculatePlayerCareerStats,
  sanitizeResultText,
} from './utils/cricketCalculations';
import SquadBuilder from './components/SquadBuilder';
import MatchSimPanel from './components/MatchSimPanel';
import StatsTable from './components/StatsTable';
import Newsroom from './components/Newsroom';
import PlayoffsPanel from './components/PlayoffsPanel';
import HallOfFamePanel from './components/HallOfFamePanel';
import {
  Trophy,
  Users,
  Calendar,
  Grid,
  Newspaper,
  Library,
  Settings,
  PlusCircle,
  TrendingUp,
  Award,
  Plus,
  RefreshCw,
  Lock,
  ChevronRight,
  Flame,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  // ----------------------------------------------------
  // STATES & STATE DESERIALIZATION
  // ----------------------------------------------------
  const [leagueName, setLeagueName] = useState(() => localStorage.getItem('cp_lbl_league_name') || '');
  const [leagueTeamsCount, setLeagueTeamsCount] = useState(() => Number(localStorage.getItem('cp_lbl_teams_count')) || 4);
  const [leagueStatus, setLeagueStatus] = useState<'setup' | 'team_building' | 'active_season' | 'playoffs' | 'completed'>(() => {
    return (localStorage.getItem('cp_lbl_status') as any) || 'setup';
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const saved = localStorage.getItem('cp_lbl_teams');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [fixtures, setFixtures] = useState<Fixture[]>(() => {
    try {
      const saved = localStorage.getItem('cp_lbl_fixtures');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [playoffsFixtures, setPlayoffsFixtures] = useState<Fixture[]>(() => {
    try {
      const saved = localStorage.getItem('cp_lbl_playoffs_fixtures');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(() => {
    try {
      const saved = localStorage.getItem('cp_lbl_news');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hallOfFame, setHallOfFame] = useState<HallOfFameRecord[]>(() => {
    try {
      const saved = localStorage.getItem('cp_lbl_hall_of_fame');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'squads' | 'fixtures' | 'stats' | 'newsroom' | 'playoffs' | 'hall_of_fame'>('dashboard');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);

  // Custom Confirm Dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  // Forms mapping
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3b82f6');
  const [newTeamEmoji, setNewTeamEmoji] = useState('🏏');

  // ----------------------------------------------------
  // PERSISTENCE EFFECT
  // ----------------------------------------------------
  useEffect(() => {
    localStorage.setItem('cp_lbl_league_name', leagueName);
    localStorage.setItem('cp_lbl_teams_count', String(leagueTeamsCount));
    localStorage.setItem('cp_lbl_status', leagueStatus);
    localStorage.setItem('cp_lbl_teams', JSON.stringify(teams));
    localStorage.setItem('cp_lbl_fixtures', JSON.stringify(fixtures));
    localStorage.setItem('cp_lbl_playoffs_fixtures', JSON.stringify(playoffsFixtures));
    localStorage.setItem('cp_lbl_news', JSON.stringify(newsArticles));
    localStorage.setItem('cp_lbl_hall_of_fame', JSON.stringify(hallOfFame));
  }, [leagueName, leagueTeamsCount, leagueStatus, teams, fixtures, playoffsFixtures, newsArticles, hallOfFame]);

  // Set default team id if squad builders are active
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // ----------------------------------------------------
  // CALCULATIONS / DERIVED VALUES
  // ----------------------------------------------------
  const standings: Standing[] = calculateStandings(teams, fixtures);
  const playerStats: PlayerCareerStats[] = calculatePlayerCareerStats(teams, [...fixtures, ...playoffsFixtures]);

  // Check if league round-robin fixtures are fully simulated and completed
  const isLeagueStageCompleted = fixtures.length > 0 && fixtures.every((f) => f.status === 'completed');

  // Activate playoffs block automatically when ready
  useEffect(() => {
    if (isLeagueStageCompleted && leagueStatus === 'active_season') {
      setLeagueStatus('playoffs');
    }
  }, [isLeagueStageCompleted, leagueStatus]);

  // ----------------------------------------------------
  // OPERATIONS / ACTIONS
  // ----------------------------------------------------

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim()) return;
    setLeagueStatus('team_building');
    setTeams([]);
    setFixtures([]);
    setPlayoffsFixtures([]);
    setActiveTab('dashboard');
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTeamName.trim();
    if (!trimmed) return;

    if (teams.length >= leagueTeamsCount) {
      alert(`The league is currently configured for a limit of ${leagueTeamsCount} teams. Change number of teams in setup to add more.`);
      return;
    }

    if (teams.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Team named "${trimmed}" already exists.`);
      return;
    }

    const newTeam: Team = {
      id: `team_${Date.now()}`,
      name: trimmed,
      color: newTeamColor,
      emoji: newTeamEmoji,
      locked: false,
      players: [],
    };

    setTeams([...teams, newTeam]);
    setNewTeamName('');
    setNewTeamEmoji('🏏');
  };

  const handlePresetQuickAdd = () => {
    const presets = [
      { name: 'Bengaluru Blasters', color: '#dc2626', emoji: '🔥' },
      { name: 'Mysore Titans', color: '#d97706', emoji: '⚔️' },
      { name: 'Coastal Kings', color: '#2563eb', emoji: '👑' },
      { name: 'Thunder Warriors', color: '#7c3aed', emoji: '⚡' },
    ];

    const currentNames = teams.map(t => t.name.toLowerCase());
    const added: Team[] = [];

    presets.forEach((pre) => {
      if (teams.length + added.length < leagueTeamsCount && !currentNames.includes(pre.name.toLowerCase())) {
        added.push({
          id: `team_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
          name: pre.name,
          color: pre.color,
          emoji: pre.emoji,
          locked: false,
          players: [],
        });
      }
    });

    if (added.length > 0) {
      setTeams([...teams, ...added]);
    }
  };

  const handleUpdateTeamPlayers = (teamId: string, players: Player[]) => {
    setTeams(
      teams.map((t) => {
        if (t.id === teamId) {
          return { ...t, players };
        }
        return t;
      })
    );
  };

  const handleLockTeam = (teamId: string) => {
    setTeams(
      teams.map((t) => {
        if (t.id === teamId) {
          return { ...t, locked: true };
        }
        return t;
      })
    );
  };

  const handleStartSeasonAndFixtures = () => {
    // Generate Round Robin fixtures automatically
    const rrFixtures = generateRoundRobinFixtures(teams);
    setFixtures(rrFixtures);
    setLeagueStatus('active_season');
    setActiveTab('fixtures');

    // Automatically generate introductory breaking news article!
    const initArticle: NewsArticle = {
      id: `news_start_${Date.now()}`,
      title: 'Mega Season Begins! Calendars Formulated for AI Cricket League Cup',
      category: 'Breaking',
      content: `The stage is set! The tournament will officially run a round-robin schedule comprising ${rrFixtures.length} matches, followed by Qualifier brackets and the grand finale. Analysts predict stars will face high-velocity challenges as pitches are dry and ready for action. Let the matches commence!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
    };
    setNewsArticles([initArticle, ...newsArticles]);
  };

  const handleAddNewsArticle = (art: NewsArticle) => {
    setNewsArticles([art, ...newsArticles]);
    setActiveTab('newsroom');
  };

  const handlePlayoffsUpdate = (playoffs: Fixture[]) => {
    setPlayoffsFixtures(playoffs);
  };

  const handleCrownChampion = (champ: HallOfFameRecord) => {
    const seasonNumber = hallOfFame.length + 1;
    
    // Explicitly compute complete final season stats of the players using champ.playoffMatches (which contains the complete final match)!
    const finalPlayoffs = champ.playoffMatches || playoffsFixtures;
    const finalPlayerStats = calculatePlayerCareerStats(teams, [...fixtures, ...finalPlayoffs]);

    // Recalculate caps/MVP based on the actual COMPLETE player stats (including the Grand Final!)
    const sortedBat = [...finalPlayerStats].sort((a, b) => b.batting.runs - a.batting.runs);
    const topBatsman = sortedBat[0];
    const sortedBowl = [...finalPlayerStats].sort((a, b) => b.bowling.wickets - a.bowling.wickets);
    const topBowler = sortedBowl[0];
    const sortedMvp = [...finalPlayerStats]
      .map(p => ({ ...p, mScore: p.batting.runs + p.bowling.wickets * 20 }))
      .sort((a, b) => b.mScore - a.mScore);
    const mvpPlayer = sortedMvp[0];

    const enrichedChamp: HallOfFameRecord = {
      ...champ,
      seasonName: `${leagueName || 'AI Cricket League'} (Season ${seasonNumber})`,
      pointsTable: [...standings],
      leagueResults: [...fixtures],
      playoffMatches: finalPlayoffs,
      seasonStatistics: finalPlayerStats,
      orangeCapName: topBatsman?.playerName || champ.orangeCapName,
      orangeCapRuns: topBatsman?.batting.runs || champ.orangeCapRuns,
      purpleCapName: topBowler?.playerName || champ.purpleCapName,
      purpleCapWickets: topBowler?.bowling.wickets || champ.purpleCapWickets,
      mvpName: mvpPlayer?.playerName || champ.mvpName,
    };
    setHallOfFame([enrichedChamp, ...hallOfFame]);
    setLeagueStatus('completed');
    setActiveTab('hall_of_fame');

    // Generate finale news summary article!
    const finaleArticle: NewsArticle = {
      id: `news_end_${Date.now()}`,
      title: `${enrichedChamp.championTeamName} Crowned Champions in Breathtaking Tournament Finish!`,
      category: 'Summary',
      content: `What a finish! ${enrichedChamp.championTeamName} clinched the championship trophy after a thrilling playoff final against ${enrichedChamp.runnerUpTeamName}. Best MVP: ${enrichedChamp.mvpName}. Orange Cap goes to ${enrichedChamp.orangeCapName} (${enrichedChamp.orangeCapRuns} runs) and Purple Cap is awarded to ${enrichedChamp.purpleCapName} (${enrichedChamp.purpleCapWickets} wickets). An historic season comes to an end.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
    };
    setNewsArticles([finaleArticle, ...newsArticles]);
  };

  const handleRecordLeagueMatchComplete = (fixtureId: string, scorecard: MatchSimulationResponse) => {
    setFixtures(
      fixtures.map((f) => {
        if (f.id === fixtureId) {
          return {
            ...f,
            status: 'completed' as const,
            result: sanitizeResultText(scorecard.result.margin),
            scorecard,
          };
        }
        return f;
      })
    );
    setSelectedFixtureId(null);
  };

  const handleResetSeason = () => {
    // Retain Hall Of Fame registries, reset rosters and fixtures to fresh setup
    setLeagueStatus('setup');
    setLeagueName('');
    setTeams([]);
    setFixtures([]);
    setPlayoffsFixtures([]);
    setNewsArticles([]);
    setSelectedTeamId('');
    setSelectedFixtureId(null);
    setActiveTab('dashboard');
  };

  const handleResetCompleteLeague = () => {
    triggerConfirm(
      'Wipe Entire League?',
      'Are you absolutely sure you want to reset the entire league? This will wipe teams, rosters, results, schedules, commentaries, and Hall of Fame registries permanently.',
      () => {
        setLeagueStatus('setup');
        setLeagueName('');
        setTeams([]);
        setFixtures([]);
        setPlayoffsFixtures([]);
        setNewsArticles([]);
        setHallOfFame([]);
        setActiveTab('dashboard');
        localStorage.clear();
      }
    );
  };

  // Helper selectors
  const allTeamsLocked = teams.length === leagueTeamsCount && teams.every((t) => t.locked);
  const activeFixture = fixtures.find((f) => f.id === selectedFixtureId);
  const fixtureTeamA = activeFixture ? teams.find((t) => t.id === activeFixture.teamAId) : null;
  const fixtureTeamB = activeFixture ? teams.find((t) => t.id === activeFixture.teamBId) : null;

  return (
    <div id="ai-cricket-league-app" className="min-h-screen bg-[#0A0F1E] text-[#f3f4f6] font-sans flex flex-col">
      {/* Upper Navigation Header bar */}
      <header className="bg-slate-900/40 border-b border-slate-800/80 px-5 py-4 sticky top-0 z-30 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-yellow-500 p-2.5 rounded-xl shadow-lg border border-amber-400/20">
            <Trophy className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="font-heading font-black text-lg text-white leading-none tracking-tight">AI Cricket League</h1>
            <p className="text-[10px] uppercase font-mono font-bold text-amber-500 mt-1 tracking-wider">IPL-style automated manager</p>
          </div>
        </div>

        {leagueStatus !== 'setup' && (
          <div className="flex items-center gap-3.5">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-100">{leagueName}</p>
              <p className="text-[10px] font-mono text-slate-400 uppercase">
                Status: <span className="text-amber-500 font-bold">{leagueStatus.replace('_', ' ')}</span>
              </p>
            </div>
            <button
              onClick={handleResetCompleteLeague}
              title="Reset entire database"
              className="bg-slate-950/80 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 text-slate-400 hover:text-rose-450 p-2 rounded-lg transition"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Full body layout wrapper */}
      {leagueStatus === 'setup' ? (
        /* SCREEN 1: Creation configuration Desk */
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center gap-6 animate-fade-in" id="league-setup-screen">
          <div className="text-center space-y-2">
            <Trophy className="w-14 h-14 text-amber-500 mx-auto fill-amber-500/10" />
            <h2 className="font-heading font-extrabold text-2xl text-white tracking-tight">Setup Custom Franchise League</h2>
            <p className="text-xs text-slate-400 leading-normal max-w-sm mx-auto">
              Automated manager for cricket leagues. Set parameters, formulate manual drafts, and play AI-commentated fixtures.
            </p>
          </div>

          <form onSubmit={handleCreateLeague} className="bg-[#0f172a] rounded-xl border border-slate-800/85 p-6 space-y-5 shadow-2xl">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Tournament Name</label>
              <input
                type="text"
                required
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g. Bengaluru Blasters Challenge Cup"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Number of franchises</label>
                <select
                  value={leagueTeamsCount}
                  onChange={(e) => setLeagueTeamsCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-sm text-slate-250 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value={2}>2 Teams (Duel Match)</option>
                  <option value={4}>4 Teams (IPL Standard)</option>
                  <option value={6}>6 Teams (Regional Cup)</option>
                  <option value={8}>8 Teams (Mega League)</option>
                  <option value={10}>10 Teams (Grand Slam)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Match play system</label>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-xs text-amber-550 italic font-mono flex items-center justify-center">
                  Round Robin + Playoffs
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 transition text-slate-950 font-heading font-black text-xs py-3.5 rounded-xl shadow-lg shadow-amber-950/20 uppercase tracking-wider cursor-pointer"
            >
              CREATE LEAGUE Season 1
            </button>
          </form>

          {hallOfFame.length > 0 && (
            <div className="text-center">
              <button
                onClick={() => setLeagueStatus('completed')}
                className="text-amber-500 text-xs font-semibold hover:underline font-mono cursor-pointer"
              >
                ← View Hall of Fame records ({hallOfFame.length})
              </button>
            </div>
          )}
        </main>
      ) : (
        /* SCREEN 2: Dashboard central */
        <div className="flex-1 flex flex-col md:flex-row" id="dashboard-central-screen">
          {/* Side command bar navigation */}
          <nav className="w-full md:w-64 bg-slate-900/60 border-b md:border-b-0 md:border-r border-slate-850 p-4 shrink-0 space-y-5">
            {/* Quick status card */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850 text-xs">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">League season active</p>
              <h4 className="font-heading font-black text-[#f3f4f6] truncate text-sm mt-0.5">{leagueName}</h4>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Franchises roster: <span className="text-amber-500 font-bold">{teams.length}</span> / {leagueTeamsCount}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                  activeTab === 'dashboard' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2"><Grid className="w-4 h-4" /> League Overview</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => setActiveTab('squads')}
                className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                  activeTab === 'squads' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Squad Builder</span>
                {teams.some(t => !t.locked) && <span className="bg-amber-500/10 text-amber-500 px-1 py-0.2 rounded font-mono text-[9px]">unlocked</span>}
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              {leagueStatus !== 'team_building' && (
                <>
                  <button
                    onClick={() => setActiveTab('fixtures')}
                    className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                      activeTab === 'fixtures' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Fixtures Arena</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                      activeTab === 'stats' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Stats & Awards</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    onClick={() => {
                      if (leagueStatus !== 'playoffs' && leagueStatus !== 'completed') {
                        alert('Playoffs unlock automatically once all round-robin league stage fixtures are played and completed!');
                        return;
                      }
                      setActiveTab('playoffs');
                    }}
                    className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold border transition ${
                      leagueStatus !== 'playoffs' && leagueStatus !== 'completed' ? 'opacity-40 border-transparent text-slate-500 cursor-not-allowed' :
                      activeTab === 'playoffs' ? 'bg-amber-500/10 text-amber-500 border-amber-500/15 font-bold' : 'text-slate-400 hover:bg-slate-850 border-transparent hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500 animate-pulse" /> Playoffs Arena</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    onClick={() => setActiveTab('newsroom')}
                    className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                      activeTab === 'newsroom' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2"><Newspaper className="w-4 h-4" /> AI Newsroom</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </>
              )}

              <button
                onClick={() => setActiveTab('hall_of_fame')}
                className={`w-full py-2.5 px-3.5 rounded-lg flex items-center justify-between text-xs font-semibold transition ${
                  activeTab === 'hall_of_fame' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2"><Library className="w-4 h-4 text-amber-500" /> Hall of Fame</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </nav>

          {/* Major Workspace Body */}
          <main className="flex-1 p-6 overflow-x-hidden min-h-[480px]">
            {/* Season Complete Floating Action Bar */}
            {leagueStatus === 'completed' && (
              <div className="mb-6 bg-gradient-to-r from-emerald-950/40 via-emerald-900/10 to-slate-900 border border-emerald-500/20 p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl animate-fade-in" id="season-complete-new-season-banner">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/10 text-emerald-405 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold uppercase shrink-0">
                      Season finalized
                    </span>
                    <h3 className="text-white font-heading font-black text-sm">Championship Cycle Concluded permanently!</h3>
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl">
                    This season has been archived permanently to the **Franchise Hall of Fame**. You can start a brand-new auction/draft cycle now.
                  </p>
                </div>
                <button
                  onClick={() => {
                    triggerConfirm(
                      "Start New Season?",
                      "Reset the entire league and start your brand-new season? Your current teams, rosters, fixtures, and standings will be reset, while previous seasons remain safely archived in the Hall of Fame.",
                      handleResetSeason
                    );
                  }}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 transition text-slate-950 px-5 py-2.5 rounded-lg font-heading font-black text-xs uppercase tracking-wider shadow-md shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  🏆 Start New Season
                </button>
              </div>
            )}

            {/* VIEW 1: Dashboard overview stats, team cards */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-heading font-black text-slate-100 text-xl leading-none">League Franchise Center</h2>
                  <p className="text-xs text-slate-400 mt-1">Status: {leagueStatus === 'team_building' ? 'Roster formation in progress' : 'Fixture series active'}</p>
                </div>

                {/* Team Grid Cards */}
                {leagueStatus === 'team_building' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add franchise card */}
                    {teams.length < leagueTeamsCount && (
                      <div className="bg-[#0f172a] rounded-xl border border-slate-850 p-5 space-y-4">
                        <h3 className="font-heading font-bold text-sm text-slate-200 flex items-center gap-2">
                          <PlusCircle className="w-4 h-4 text-amber-500" /> Create Team Slot
                        </h3>
                        <form onSubmit={handleAddTeam} className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1">Franchise Name</label>
                            <input
                              type="text"
                              required
                              value={newTeamName}
                              onChange={(e) => setNewTeamName(e.target.value)}
                              placeholder="e.g. Coastal Kings"
                              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1">Brand Theme Color</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={newTeamColor}
                                  onChange={(e) => setNewTeamColor(e.target.value)}
                                  className="h-8 w-8 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
                                />
                                <span className="font-mono text-[10px] text-slate-400">{newTeamColor}</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1">Badge Emoji</label>
                              <select
                                value={newTeamEmoji}
                                onChange={(e) => setNewTeamEmoji(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                              >
                                <option value="🏏">🏏 Cricket Bat</option>
                                <option value="👑">👑 Crown</option>
                                <option value="⚡">⚡ Thunder</option>
                                <option value="⚔️">⚔️ Swords</option>
                                <option value="🔥">🔥 Fire</option>
                                <option value="🐅">🐅 Tiger</option>
                                <option value="🦅">🦅 Eagle</option>
                                <option value="🦁">🦁 Lion</option>
                                <option value="🏆">🏆 Trophy</option>
                              </select>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-amber-500 hover:bg-amber-600 transition text-slate-950 text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Register Franchise Slot
                          </button>
                        </form>

                        {/* Quick preset option */}
                        <div className="flex justify-between items-center border-t border-slate-900 pt-3 text-[11px]">
                          <span className="text-slate-450 text-[10px] font-mono">Need suggestion presets?</span>
                          <button
                            onClick={handlePresetQuickAdd}
                            className="text-amber-500 hover:text-amber-400 font-bold cursor-pointer"
                          >
                            Quick Preset Add all
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show created teams */}
                    <div className="bg-[#0f172a] rounded-xl border border-slate-850 p-5 space-y-4 md:col-span-2">
                      <h3 className="font-heading font-bold text-sm text-slate-100 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-500" /> Slot roster list ({teams.length} / {leagueTeamsCount})
                      </h3>

                      {teams.length === 0 ? (
                        <p className="text-slate-500 text-xs italic text-center py-10">Select a preset or enter names above to add teams.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {teams.map((t) => (
                            <div
                              key={t.id}
                              style={{ borderLeftColor: t.color }}
                              className="bg-slate-950 p-4 rounded-lg border-l-4 border-y border-r border-slate-850 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{t.emoji}</span>
                                <div>
                                  <h4 className="font-heading font-black text-slate-200 text-sm">{t.name}</h4>
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    Players: <span className="text-slate-300 font-bold">{t.players.length}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedTeamId(t.id);
                                    setActiveTab('squads');
                                  }}
                                  className="bg-slate-900 hover:bg-slate-850 text-amber-500 hover:text-amber-400 transition text-[11px] px-2.5 py-1 rounded cursor-pointer"
                                >
                                  Squad
                                </button>
                                {t.locked ? (
                                  <span className="text-emerald-400" title="Locked and validated">
                                    <ShieldCheck className="w-4.5 h-4.5 fill-emerald-500/10" />
                                  </span>
                                ) : (
                                  <span className="text-amber-500" title="Unlocked/Incomplete">
                                    <Lock className="w-4 h-4" />
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lock Team trigger buttons */}
                {leagueStatus === 'team_building' && (
                  <div className="bg-[#121829] border border-slate-800 p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs space-y-1">
                      <p className="font-heading font-bold text-slate-200 text-sm">Lock All Rosters to Generate Match schedules</p>
                      <p className="text-slate-450 leading-normal max-w-xl">
                        A squad cannot be locked unless it contains minimum 11 players, at least 1 Wicket Keeper, 3 Bowlers, and 1 All Rounder. Once all rosters are complete and locked, the round-robin schedule can be initiated!
                      </p>
                    </div>

                    <button
                      disabled={!allTeamsLocked}
                      onClick={handleStartSeasonAndFixtures}
                      className={`font-heading font-black text-xs py-3 px-6 rounded-xl border transition ${
                        allTeamsLocked
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow shadow-emerald-900 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      GENERATE SCHEDULE & START SEASON
                    </button>
                  </div>
                )}

                {/* Active season view summary */}
                {leagueStatus !== 'team_building' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Standings block */}
                    <div className="md:col-span-2 space-y-3">
                      <h3 className="font-heading font-extrabold text-[#f3f4f6] text-sm flex items-center justify-between border-b border-slate-805 pb-1">
                        <span>📊 Current Standings</span>
                        <button onClick={() => setActiveTab('stats')} className="text-amber-500 hover:underline text-xs cursor-pointer">View detail stats</button>
                      </h3>
                      <div className="bg-[#0f172a] rounded-xl border border-slate-850 p-4">
                        <table className="w-full text-left font-mono text-xs">
                          <thead>
                            <tr className="border-b border-slate-800/60 pb-1.5 text-slate-500 text-[10px] uppercase font-bold">
                              <th className="py-1">Franchise</th>
                              <th className="py-1 text-center">Played</th>
                              <th className="py-1 text-center">Pts</th>
                              <th className="py-1 text-right">NRR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((t, i) => (
                              <tr key={t.teamId} className="border-b border-slate-850/50 hover:bg-slate-900/40 text-slate-300">
                                <td className="py-2.5 font-sans font-bold text-slate-100">{t.teamName}</td>
                                <td className="py-2.5 text-center">{t.played}</td>
                                <td className="py-2.5 text-center font-bold text-white">{t.points}</td>
                                <td className="py-2.5 text-right font-bold text-[#faf5ff]">{t.nrr >= 0 ? `+${t.nrr.toFixed(3)}` : t.nrr.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Fast info awards box */}
                    <div className="bg-[#0f172a]/85 rounded-xl border border-slate-800 p-5 self-start space-y-4">
                      <h4 className="font-heading font-extrabold text-xs text-slate-205 border-b border-slate-800 pb-1.5 uppercase flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500" /> Leading Contenders
                      </h4>
                      {playerStats.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-6 text-center">Simulate features to populate accolades</p>
                      ) : (
                        <div className="space-y-3.5 text-xs font-sans">
                          {/* Orange Cap */}
                          <div className="border-b border-slate-850 pb-2">
                            <p className="text-[10px] text-slate-500 uppercase font-mono">🍊 Orange Cap (Overall Runs)</p>
                            <p className="font-bold text-slate-200 mt-0.5 font-heading">
                              {[...playerStats].sort((a,b)=>b.batting.runs - a.batting.runs)[0]?.playerName || 'Star Batsman'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Runs scored: <span className="text-amber-500 font-bold">{[...playerStats].sort((a,b)=>b.batting.runs - a.batting.runs)[0]?.batting.runs || 0}</span>
                            </p>
                          </div>
                          {/* Purple Cap */}
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-mono">🍇 Purple Cap (Overall Wickets)</p>
                            <p className="font-bold text-slate-200 mt-0.5 font-heading">
                              {[...playerStats].sort((a,b)=>b.bowling.wickets - a.bowling.wickets)[0]?.playerName || 'Star Bowler'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Wickets hit: <span className="text-amber-500 font-bold">{[...playerStats].sort((a,b)=>b.bowling.wickets - a.bowling.wickets)[0]?.bowling.wickets || 0}</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: Team squads builder and player inputs */}
            {activeTab === 'squads' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                  <div>
                    <h2 className="font-heading font-black text-slate-100 text-xl">Squad Builder Arena</h2>
                    <p className="text-xs text-slate-400 mt-1">Populate player listings manually or via CSV draft uploads</p>
                  </div>
                  {/* Select team dropdown toggles */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-450 font-mono">Franchise:</span>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="bg-slate-900 border border-slate-805 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-500"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.emoji} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <SquadBuilder
                  teams={teams}
                  selectedTeamId={selectedTeamId}
                  onUpdateTeamPlayers={handleUpdateTeamPlayers}
                  onLockTeam={handleLockTeam}
                />
              </div>
            )}

            {/* VIEW 3: Fixtures lists / playing matches */}
            {activeTab === 'fixtures' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="font-heading font-black text-slate-100 text-xl">Fixtures Stadium</h2>
                    <p className="text-xs text-slate-400 mt-1">Concur scheduled lineups and run simulations</p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-full uppercase">
                    Round Robin
                  </span>
                </div>

                {selectedFixtureId && activeFixture && fixtureTeamA && fixtureTeamB ? (
                  <div className="space-y-3 animate-fade-in">
                    <button
                      onClick={() => setSelectedFixtureId(null)}
                      className="text-xs text-amber-500 hover:text-amber-400 font-mono flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to Schedule card list
                    </button>
                    <MatchSimPanel
                      fixture={activeFixture}
                      teamA={fixtureTeamA}
                      teamB={fixtureTeamB}
                      onMatchComplete={handleRecordLeagueMatchComplete}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fixtures.length === 0 ? (
                      <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 bg-[#0f172a]/20 rounded-xl">
                        <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-2" />
                        <p className="font-medium font-heading">Schedule registry is empty</p>
                        <p className="text-xs text-slate-600 mt-1">Verify that every single team roster is locked and configured.</p>
                      </div>
                    ) : (
                      // Group fixtures by rounds
                      <div className="space-y-6">
                        {Array.from(new Set(fixtures.map((f) => f.round))).map((r) => {
                          const roundFixtures = fixtures.filter((f) => f.round === r);
                          return (
                            <div key={r} className="space-y-3.5">
                              <h4 className="font-heading font-black text-slate-200 text-sm tracking-wide border-b border-slate-850 pb-2">
                                League Round {r} series matches
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {roundFixtures.map((f) => {
                                  const tA = teams.find((t) => t.id === f.teamAId);
                                  const tB = teams.find((t) => t.id === f.teamBId);
                                  const isComp = f.status === 'completed';

                                  if (!tA || !tB) return null;

                                  return (
                                    <div
                                      key={f.id}
                                      className={`border rounded-xl p-4 transition ${
                                        isComp
                                          ? 'bg-slate-900/60 border-emerald-500/10'
                                          : 'bg-[#0f172a] border-slate-850 hover:border-amber-500/30'
                                      }`}
                                    >
                                      <div className="flex justify-between items-start gap-2 relative">
                                        <div className="space-y-1">
                                          <div className="font-heading font-black text-slate-200 text-sm flex items-center gap-1.5">
                                            <span>{tA.emoji} {tA.name}</span>
                                            <span className="text-xs text-slate-500 font-normal">vs</span>
                                            <span>{tB.emoji} {tB.name}</span>
                                          </div>
                                          {isComp ? (
                                            <p className="text-[11px] text-emerald-400 font-mono font-medium">{sanitizeResultText(f.result)}</p>
                                          ) : (
                                            <p className="text-[10px] text-amber-500 font-mono uppercase tracking-wide">scheduled</p>
                                          )}
                                        </div>

                                        <button
                                          onClick={() => setSelectedFixtureId(f.id)}
                                          className={`text-xs py-1.5 px-3 rounded text-center transition cursor-pointer ${
                                            isComp
                                              ? 'bg-slate-900 text-slate-400 border border-slate-800'
                                              : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
                                          }`}
                                        >
                                          {isComp ? 'View Score' : 'Play / Sim'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: Standings & Accolades Leaders */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-heading font-black text-slate-100 text-xl leading-none">Standings & analytics Desk</h2>
                  <p className="text-xs text-slate-400 mt-1">Real-time parameters automatically recalculated after fixture events</p>
                </div>
                <StatsTable standings={standings} playerStats={playerStats} />
              </div>
            )}

            {/* VIEW 5: Post-season Playoffs Bracket arena */}
            {activeTab === 'playoffs' && (
              <PlayoffsPanel
                teams={teams}
                standings={standings}
                playerStats={playerStats}
                playoffsFixtures={playoffsFixtures}
                onPlayoffsUpdate={handlePlayoffsUpdate}
                onCrownChampion={handleCrownChampion}
                onResetSeason={() => {
                  triggerConfirm(
                    "Start New Season?",
                    "Reset the entire league and start your brand-new season? Your current teams, rosters, fixtures, and standings will be reset, while previous seasons remain safely archived in the Hall of Fame.",
                    handleResetSeason
                  );
                }}
                leagueStatus={leagueStatus}
              />
            )}

            {/* VIEW 6: AI sports news articles workspace */}
            {activeTab === 'newsroom' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-heading font-black text-slate-100 text-xl leading-none">AI Editorial Newsroom</h2>
                  <p className="text-xs text-slate-400 mt-1">Request Gemini-powered reviews using current league fixtures or standings draft context</p>
                </div>

                <Newsroom
                  newsArticles={newsArticles}
                  teams={teams}
                  standings={standings}
                  playerStats={playerStats}
                  fixtures={fixtures}
                  onAddArticle={handleAddNewsArticle}
                />
              </div>
            )}

            {/* VIEW 7: Past historical registry champions */}
            {activeTab === 'hall_of_fame' && (
              <HallOfFamePanel
                records={hallOfFame}
                onStartNewSeason={() => {
                  triggerConfirm(
                    "Start New Season?",
                    "Reset the entire league and start your brand-new season? Your current teams, rosters, fixtures, and standings will be reset, while previous seasons remain safely archived in the Hall of Fame.",
                    handleResetSeason
                  );
                }}
                activeStatus={leagueStatus}
              />
            )}
          </main>
        </div>
      )}

      {/* Ticker footer bar */}
      <footer className="bg-slate-950 border-t border-slate-850 px-4 py-2.5 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-mono uppercase tracking-wider relative shrink-0">
        <span>© {new Date().getFullYear()} AI Cricket League manager system. All rights reserved.</span>
        <span>Made with Gemini-3.5-flash AI Engine proxy</span>
      </footer>

      {/* Visual Custom non-blocking Confirm Dialog Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" id="custom-confirmation-modal-backdrop">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-2xl relative animate-scale-up border-amber-500/20" id="custom-confirmation-modal-container">
            <div className="space-y-2">
              <span className="bg-amber-500/15 text-amber-500 text-[10px] tracking-widest font-mono uppercase px-2 py-0.5 rounded border border-amber-500/10">league confirmation required</span>
              <h3 className="font-heading font-black text-white text-base tracking-tight leading-tight pt-1">{confirmState.title}</h3>
              <p className="text-xs text-slate-450 font-sans leading-relaxed pt-1">{confirmState.message}</p>
            </div>
            
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-mono font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-750/50 rounded-xl transition cursor-pointer"
                id="modal-cancel-control"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 text-xs font-heading font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-450 hover:to-yellow-450 text-slate-950 rounded-xl shadow-lg border border-amber-500/15 transition cursor-pointer"
                id="modal-confirm-control"
              >
                Run Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
