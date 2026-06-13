import React, { useState, useEffect, useRef } from 'react';
import { Team, Fixture, MatchSimulationResponse, InningsScorecard, OverSimulation, BallEvent } from '../types';
import { Play, SkipForward, RefreshCw, Award, Compass, Eye, Server, Zap, Clock, ShieldCheck, ChevronRight } from 'lucide-react';
import { oversToBalls, sanitizeResultText } from '../utils/cricketCalculations';

interface MatchSimPanelProps {
  fixture: Fixture;
  teamA: Team;
  teamB: Team;
  onMatchComplete: (fixtureId: string, scorecard: MatchSimulationResponse) => void;
}

export default function MatchSimPanel({
  fixture,
  teamA,
  teamB,
  onMatchComplete,
}: MatchSimPanelProps) {
  const [captainA, setCaptainA] = useState(fixture.captainA || teamA.players[0]?.name || '');
  const [viceCaptainA, setViceCaptainA] = useState(fixture.viceCaptainA || teamA.players[1]?.name || '');
  const [impactPlayerA, setImpactPlayerA] = useState(fixture.impactPlayerA || teamA.players[teamA.players.length - 1]?.name || '');

  const [captainB, setCaptainB] = useState(fixture.captainB || teamB.players[0]?.name || '');
  const [viceCaptainB, setViceCaptainB] = useState(fixture.viceCaptainB || teamB.players[1]?.name || '');
  const [impactPlayerB, setImpactPlayerB] = useState(fixture.impactPlayerB || teamB.players[teamB.players.length - 1]?.name || '');

  const [simState, setSimState] = useState<'idle' | 'loading' | 'playing' | 'postmatch'>('idle');
  const [scorecard, setScorecard] = useState<MatchSimulationResponse | null>(fixture.scorecard);
  const [errorMsg, setErrorMsg] = useState('');

  // Live Playback Engine state
  const [playbackSpeed, setPlaybackSpeed] = useState<'slow' | 'normal' | 'fast' | 'instant'>('normal');
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [overIndex, setOverIndex] = useState(0); // index in overs list
  const [ballIndex, setBallIndex] = useState(0); // index in timeline of that over

  // Progressive live board counters
  const [runningRuns, setRunningRuns] = useState(0);
  const [runningWickets, setRunningWickets] = useState(0);
  const [runningOversPlayed, setRunningOversPlayed] = useState('0.0');
  const [liveLog, setLiveLog] = useState<{ ballKey: string; bowler: string; desc: string; type: string }[]>([]);
  const [isWicketAnimation, setIsWicketAnimation] = useState(false);
  const [isBoundaryAnimation, setIsBoundaryAnimation] = useState<'four' | 'six' | null>(null);

  const [selectedScorecardTab, setSelectedScorecardTab] = useState<'summary' | 'innings1' | 'innings2'>('summary');
  const [isReplaying, setIsReplaying] = useState(false);

  const animationCleanupRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize internal state on fixture change
  useEffect(() => {
    setScorecard(fixture.scorecard);
    setIsReplaying(false);
    if (fixture.status === 'completed' && fixture.scorecard) {
      setSimState('postmatch');
    } else {
      setSimState('idle');
      // Reset simulator variables
      setCurrentInnings(1);
      setOverIndex(0);
      setBallIndex(0);
      setRunningRuns(0);
      setRunningWickets(0);
      setRunningOversPlayed('0.0');
      setLiveLog([]);
      setErrorMsg('');
    }
  }, [fixture]);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animationCleanupRef.current) clearTimeout(animationCleanupRef.current);
    };
  }, []);

  // Auto-scroll the live feed commentary to bottom inside the log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLog, overIndex]);

  // Speeds in milliseconds
  const getSpeedDelay = () => {
    switch (playbackSpeed) {
      case 'slow': return 1500;
      case 'fast': return 150;
      case 'instant': return 0;
      case 'normal':
      default: return 600;
    }
  };

  const startSimulationCall = async () => {
    setSimState('loading');
    setErrorMsg('');
    try {
      const response = await fetch('/api/match/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAName: teamA.name,
          teamBName: teamB.name,
          teamAPlayers: teamA.players,
          teamBPlayers: teamB.players,
          captainA,
          viceCaptainA,
          impactPlayerA,
          captainB,
          viceCaptainB,
          impactPlayerB,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server HTTP Error ${response.status}`);
      }

      const matchData: MatchSimulationResponse = await response.json();
      setScorecard(matchData);
      
      // Init live log
      setLiveLog([{
        ballKey: 'toss',
        bowler: 'Match Official',
        desc: `TOSS UPDATE: ${matchData.toss.commentary}`,
        type: 'toss'
      }]);

      setSimState('playing');
      setCurrentInnings(1);
      setOverIndex(0);
      setBallIndex(0);
      setRunningRuns(0);
      setRunningWickets(0);
      setRunningOversPlayed('0.0');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred connecting to the server Match Engine');
      setSimState('idle');
    }
  };

  // Playback Loop
  useEffect(() => {
    if (simState !== 'playing' || !scorecard) return;

    const innings = currentInnings === 1 ? scorecard.innings1 : scorecard.innings2;
    const overObj = innings.overs[overIndex];

    if (!overObj) {
      // Finished current innings
      if (currentInnings === 1) {
        // Transition to Innings 2 after a small break
        const delay = playbackSpeed === 'instant' ? 0 : 2500;
        setLiveLog(prev => [...prev, {
          ballKey: `mid_break`,
          bowler: 'Innings Break',
          desc: `--- END OF INNINGS 1 --- ${scorecard.innings1.battingTeam} finished at ${scorecard.innings1.totalRuns}/${scorecard.innings1.totalWickets} in ${scorecard.innings1.totalOvers} overs. target value for ${scorecard.innings2.battingTeam} is ${scorecard.innings1.totalRuns + 1} runs.`,
          type: 'extra'
        }]);

        timerRef.current = setTimeout(() => {
          setCurrentInnings(2);
          setOverIndex(0);
          setBallIndex(0);
          setRunningRuns(0);
          setRunningWickets(0);
          setRunningOversPlayed('0.0');
        }, delay);
      } else {
        // Match Simulation completely done!
        setSimState('postmatch');
        if (!isReplaying) {
          onMatchComplete(fixture.id, scorecard);
        }
      }
      return;
    }

    const timeline = overObj.timeline;
    const ballObj = timeline[ballIndex];

    if (!ballObj) {
      // Finished current over - append Over Summary commentary
      setLiveLog(prev => [...prev, {
        ballKey: `over_${currentInnings}_${overObj.overNumber}_summary`,
        bowler: 'Over Summary',
        desc: `--- End of Over ${overObj.overNumber}: ${overObj.commentary} (${overObj.runs} Runs, ${overObj.wicketsList.length} Wickets) ---`,
        type: 'extra'
      }]);

      // Move to next over
      const delay = playbackSpeed === 'instant' ? 0 : 1200;
      timerRef.current = setTimeout(() => {
        setOverIndex(prev => prev + 1);
        setBallIndex(0);
      }, delay);
      return;
    }

    // Play next ball
    const delay = getSpeedDelay();

    timerRef.current = setTimeout(() => {
      // Calculate running ratings
      let runsAfterBall = runningRuns + ballObj.runsScored;
      let wicketsAfterBall = runningWickets;

      // Handle extra run formatting
      if (ballObj.type === 'wicket') {
        wicketsAfterBall += 1;
        setIsWicketAnimation(true);
        animationCleanupRef.current = setTimeout(() => setIsWicketAnimation(false), 800);
      } else if (ballObj.type === 'boundary') {
        if (ballObj.runsScored === 4) {
          setIsBoundaryAnimation('four');
          animationCleanupRef.current = setTimeout(() => setIsBoundaryAnimation(null), 800);
        } else if (ballObj.runsScored === 6) {
          setIsBoundaryAnimation('six');
          animationCleanupRef.current = setTimeout(() => setIsBoundaryAnimation(null), 800);
        }
      }

      const formattedOvers = `${overObj.overNumber - 1}.${ballObj.ball}`;

      setRunningRuns(runsAfterBall);
      setRunningWickets(wicketsAfterBall);
      setRunningOversPlayed(formattedOvers);

      // Append ball logs
      const bowlerForThisOver = innings.bowlers[overIndex % innings.bowlers.length]?.name || 'Bowler';
      setLiveLog(prev => [...prev, {
        ballKey: `${currentInnings}_${overIndex}_${ballIndex}`,
        bowler: bowlerForThisOver,
        desc: `Over ${overObj.overNumber - 1}.${ballObj.ball} - ${ballObj.description}`,
        type: ballObj.type
      }]);

      // Advance ball
      setBallIndex(prev => prev + 1);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [simState, currentInnings, overIndex, ballIndex, scorecard, playbackSpeed]);

  const forceCompleteSimulation = () => {
    if (!scorecard) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Complete all states to end
    setSimState('postmatch');
    onMatchComplete(fixture.id, scorecard);
  };

  const getInningsLabel = (innNum: 1 | 2) => {
    if (!scorecard) return '';
    const inn = innNum === 1 ? scorecard.innings1 : scorecard.innings2;
    return `${inn.battingTeam} Roster`;
  };

  const renderGullyCommentary = () => {
    const rawText = scorecard?.result?.gullyCommentary;
    if (!rawText) {
      return (
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <div className="text-xs font-mono text-amber-500 uppercase tracking-widest font-bold mb-2">
              🎙 Post-Match Presentation dialogue
            </div>
            <p className="text-slate-300 italic whitespace-pre-wrap leading-relaxed">
              {scorecard?.result?.presentationCommentary}
            </p>
          </div>
        </div>
      );
    }

    const parts = rawText.split(/(?=🪙 Toss|⚡ Powerplay Summary|🔄 Middle Overs Summary|💥 Death Overs Summary|🎯 Match Turning Points|🏆 Player Of The Match|🎤 Presentation Ceremony)/gi);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl">
          <Zap className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
          <div>
            <h4 className="font-heading font-extrabold text-sm text-slate-100">
              Karnataka Gully Commentary Desk Live! 🏁🔥
            </h4>
            <p className="text-[11px] text-slate-400">
              Read the match story with full excitement, high josh, and pure local flavor!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {parts.map((part, idx) => {
            const cleanPart = part.trim();
            if (!cleanPart) return null;

            const lines = cleanPart.split('\n');
            const header = lines[0].trim();
            const body = lines.slice(1).join('\n').trim();

            let themeClass = 'border-slate-800 bg-slate-950/60';
            let titleColor = 'text-amber-500';
            let iconText = '🏏';

            if (header.includes('Toss') || header.includes('🪙')) {
              themeClass = 'border-amber-500/20 bg-gradient-to-br from-amber-950/10 to-slate-950';
              titleColor = 'text-amber-400';
              iconText = '🪙';
            } else if (header.includes('Powerplay') || header.includes('⚡')) {
              themeClass = 'border-yellow-500/20 bg-gradient-to-br from-yellow-950/10 to-slate-950';
              titleColor = 'text-yellow-400';
              iconText = '⚡';
            } else if (header.includes('Middle') || header.includes('🔄')) {
              themeClass = 'border-cyan-505/20 bg-gradient-to-br from-[#083344] to-slate-950';
              titleColor = 'text-cyan-400';
              iconText = '🔄';
            } else if (header.includes('Death') || header.includes('💥')) {
              themeClass = 'border-rose-500/20 bg-gradient-to-br from-[#450a0a] to-slate-950';
              titleColor = 'text-rose-400';
              iconText = '💥';
            } else if (header.includes('Turning') || header.includes('🎯')) {
              themeClass = 'border-emerald-500/20 bg-gradient-to-br from-[#064e3b] to-slate-950';
              titleColor = 'text-emerald-400';
              iconText = '🎯';
            } else if (header.includes('Player') || header.includes('🏆')) {
              themeClass = 'border-amber-500/25 bg-gradient-to-br from-amber-950/20 to-slate-950';
              titleColor = 'text-amber-400';
              iconText = '🏆';
            } else if (header.includes('Presentation') || header.includes('🎤')) {
              themeClass = 'border-purple-500/20 bg-gradient-to-br from-[#3b0764] to-slate-950';
              titleColor = 'text-purple-400';
              iconText = '🎤';
            }

            return (
              <div
                key={idx}
                className={`border rounded-xl p-4 transition-all hover:scale-[1.005] ${themeClass}`}
              >
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-900 font-heading">
                  <span className="text-sm">{iconText}</span>
                  <span className={`text-xs font-extrabold uppercase tracking-wide ${titleColor}`}>
                    {header.replace(/^[🪙⚡🔄💥🎯🏆🎤\s]+/, '')}
                  </span>
                </div>
                <p className="text-slate-350 text-xs md:text-sm whitespace-pre-line leading-relaxed not-italic">
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getLivePlayerStatus = () => {
    if (!scorecard) return null;
    const innings = currentInnings === 1 ? scorecard.innings1 : scorecard.innings2;
    if (!innings || !innings.overs || !innings.batsmen) return null;
    
    const batsmen = innings.batsmen.map((b) => ({
      name: b.name,
      runs: 0,
      balls: 0,
    }));
    
    if (batsmen.length === 0) return null;

    let bat1Idx = 0;
    let bat2Idx = 1;
    let strikeIdx = 0; 
    let nextBatIdx = 2;
    
    for (let o = 0; o <= overIndex; o++) {
      const overObj = innings.overs[o];
      if (!overObj) break;
      
      const timeline = overObj.timeline || [];
      const ballsToProcess = o === overIndex ? ballIndex : timeline.length;
      
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
      
      if (o < overIndex) {
        strikeIdx = strikeIdx === 0 ? 1 : 0;
      }
    }
    
    const striker = (strikeIdx === 0 ? batsmen[bat1Idx] : batsmen[bat2Idx]) || null;
    const nonStriker = (strikeIdx === 0 ? batsmen[bat2Idx] : batsmen[bat1Idx]) || null;
    
    const bowlerForThisOver = innings.bowlers[overIndex % innings.bowlers.length]?.name || 'Bowler';
    
    return {
      striker: striker ? { name: striker.name, runs: striker.runs, balls: striker.balls } : null,
      nonStriker: nonStriker ? { name: nonStriker.name, runs: nonStriker.runs, balls: nonStriker.balls } : null,
      bowlerName: bowlerForThisOver
    };
  };

  const livePlayers = getLivePlayerStatus();

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden" id="match-sim-root-panel">

      {/* Simulation Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#22c55e]">AI commentary fixture</span>
            <h2 className="font-heading font-black text-lg text-white">
              {teamA.name} <span className="text-sm text-slate-500">vs</span> {teamB.name}
            </h2>
          </div>
        </div>

        {simState === 'playing' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Playback speed:
            </span>
            <div className="flex bg-slate-950 px-1 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
              {(['slow', 'normal', 'fast', 'instant'] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                    playbackSpeed === spd ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STAGE 1: Idle Setup config rosters */}
      {simState === 'idle' && (
        <div className="p-6 space-y-6">
          <div className="text-center max-w-lg mx-auto py-3">
            <Compass className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-bounce" />
            <h3 className="font-heading font-bold text-slate-100 text-base">Roster Lineups & Custom Tactics</h3>
            <p className="text-xs text-slate-400 mt-1">
              Finalize team nominations before simulating the AI Match engine. Specify Captain (C), Vice Captain (VC) and Impact Players.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team A setup */}
            <div className="bg-[#0b0f19] p-5 rounded-xl border border-slate-850/50 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <span className="text-xl">{teamA.emoji}</span>
                <span className="font-heading font-bold text-slate-200">{teamA.name}</span>
              </div>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Squad Captain (C)</label>
                  <select
                    value={captainA}
                    onChange={(e) => setCaptainA(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    {teamA.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Vice Captain (VC)</label>
                  <select
                    value={viceCaptainA}
                    onChange={(e) => setViceCaptainA(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    {teamA.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Impact Player</label>
                  <select
                    value={impactPlayerA}
                    onChange={(e) => setImpactPlayerA(e.target.value)}
                    className="w-full bg-[#0d1323] border border-slate-800 rounded p-2 text-amber-500 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">No Custom Option Selected</option>
                    {teamA.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Team B setup */}
            <div className="bg-[#0b0f19] p-5 rounded-xl border border-slate-850/50 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <span className="text-xl">{teamB.emoji}</span>
                <span className="font-heading font-bold text-slate-200">{teamB.name}</span>
              </div>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Squad Captain (C)</label>
                  <select
                    value={captainB}
                    onChange={(e) => setCaptainB(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    {teamB.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Vice Captain (VC)</label>
                  <select
                    value={viceCaptainB}
                    onChange={(e) => setViceCaptainB(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    {teamB.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-405 font-semibold mb-1">Impact Player</label>
                  <select
                    value={impactPlayerB}
                    onChange={(e) => setImpactPlayerB(e.target.value)}
                    className="w-full bg-[#0d1323] border border-slate-800 rounded p-2 text-amber-500 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">No Custom Option Selected</option>
                    {teamB.players.map(p => <option key={p.id} value={p.name}>{p.name} ({p.role})</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2 font-mono">
              <span>⚠ ERROR:</span> <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={startSimulationCall}
              className="bg-amber-500 hover:bg-amber-600 transition text-slate-950 px-8 py-3.5 rounded-xl font-heading font-black text-xs flex items-center gap-2 text-center cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950 text-slate-950" /> INITIATE MATCH SIMULATION
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: Spinner Loading State */}
      {simState === 'loading' && (
        <div className="p-12 text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <Server className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-heading text-lg font-bold text-slate-100 uppercase tracking-wider">Consulting Gemini Match Analyzer...</h3>
            <p className="text-xs text-amber-500 font-semibold italic">"Simulating ball-by-ball physics logs inside T20 parameters"</p>
            <p className="text-[11px] text-slate-500">
              The AI Engine is composing pitch graphs, calculating bowler matchups, coin toss responses, over milestones, boundaries, wickets, and presentation scripts in a single complete request block! Please hold on.
            </p>
          </div>
        </div>
      )}

      {/* STAGE 3: Active Simulation Progress */}
      {simState === 'playing' && scorecard && (
        <div className="grid grid-cols-1 lg:grid-cols-12 border-t border-slate-800">
          {/* Left panel: Live Scoreboard Widget */}
          <div className="lg:col-span-4 bg-slate-950 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 gap-4 min-h-[440px]">
            {/* Live graphics summary */}
            <div className="space-y-4">
              <div>
                <span className="bg-red-600 text-white font-mono text-[9px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase animate-pulse">
                  live commentary
                </span>
                <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase">Innings {currentInnings}</span>
              </div>

              {/* Score Display */}
              <div className="space-y-1 border-l-2 border-amber-500 pl-3 border-b-0">
                <p className="text-xs font-mono font-bold text-slate-400">
                  {currentInnings === 1 ? scorecard.innings1.battingTeam : scorecard.innings2.battingTeam} is Batting
                </p>
                <h1 className="font-heading text-4xl font-extrabold text-[#f3f4f6] font-mono tracking-tighter">
                  {runningRuns}/{runningWickets}
                </h1>
                <p className="text-sm font-mono text-slate-400">
                  Overs: <span className="text-white font-bold">{runningOversPlayed}</span> / {scorecard.innings1.totalOvers || 20.0}
                </p>
              </div>

              {/* Live Batter & Bowler Info Block */}
              {livePlayers && (
                <div className="bg-[#12192c] border border-slate-800/80 p-3 rounded-lg space-y-3 font-mono text-xs text-slate-300 shadow-md" id="live-simulation-active-players-box">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider border-b border-slate-850 pb-1">Batting Partner duo</p>
                    {livePlayers.striker && (
                      <div className="flex justify-between items-center bg-[#18233c] px-2.5 py-1.5 rounded border border-amber-500/10">
                        <span className="font-bold text-slate-100 flex items-center gap-1.5">
                          🏏 {livePlayers.striker.name} <span className="bg-amber-400/10 text-amber-500 text-[9px] px-1 rounded font-normal uppercase scale-90">On Strike</span>
                        </span>
                        <span className="font-black text-amber-400 font-mono text-xs">
                          {livePlayers.striker.runs} <span className="text-[10px] font-normal text-slate-400">({livePlayers.striker.balls})</span>
                        </span>
                      </div>
                    )}
                    {livePlayers.nonStriker && (
                      <div className="flex justify-between items-center px-2.5 py-1 text-slate-400">
                        <span className="font-medium flex items-center gap-1.5">
                          👤 {livePlayers.nonStriker.name}
                        </span>
                        <span className="font-medium text-slate-300 font-mono">
                          {livePlayers.nonStriker.runs} <span className="text-[10px] font-normal text-slate-500">({livePlayers.nonStriker.balls})</span>
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 border-t border-slate-850 pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bowling Unit</p>
                    <div className="flex justify-between items-center bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-850">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        🔴 {livePlayers.bowlerName}
                      </span>
                      <span className="bg-rose-500/10 text-rose-400 text-[9px] px-1 py-0.5 rounded font-black uppercase tracking-wider">bowler</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Target / Required stat info */}
              {currentInnings === 2 && (
                <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-xs font-mono text-amber-500">
                  Target: <span className="text-white font-bold">{scorecard.innings1.totalRuns + 1} runs</span>
                  <br />
                  Need {Math.max(0, (scorecard.innings1.totalRuns + 1) - runningRuns)} runs from {Math.max(0, (Math.ceil(scorecard.innings1.totalOvers || 20.0) * 6) - oversToBalls(parseFloat(runningOversPlayed)))} balls.
                </div>
              )}

              {/* Highlights flash banners */}
              <div className="h-16 flex items-center justify-center relative overflow-hidden">
                {isWicketAnimation && (
                  <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white font-heading font-black text-xl px-6 py-2 rounded-xl animate-bounce border-2 border-red-400 shadow shadow-red-900">
                    🔴 OUT! WICKET!
                  </div>
                )}
                {isBoundaryAnimation === 'four' && (
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-heading font-black text-xl px-6 py-2 rounded-xl animate-pulse border-2 border-cyan-400 shadow shadow-blue-900">
                    ⚡ FOUR! BOUNDARY!
                  </div>
                )}
                {isBoundaryAnimation === 'six' && (
                  <div className="bg-gradient-to-r from-[#22c55e] to-emerald-600 text-white font-heading font-black text-xl px-6 py-2 rounded-xl animate-ping border-2 border-emerald-400 shadow shadow-emerald-950">
                    🏏 SIX! MAXIMUM!
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={forceCompleteSimulation}
              className="w-full bg-slate-900 hover:bg-slate-850 transition border border-slate-800 text-[11px] font-mono text-slate-400 py-2.5 rounded justify-center items-center flex gap-1.5"
            >
              <SkipForward className="w-3.5 h-3.5 text-slate-500" /> Complete Simulation instantly
            </button>
          </div>

          {/* Right panel: Scrolling ball commentary and events */}
          <div className="lg:col-span-8 flex flex-col h-[440px] bg-[#0c1223]">
            {/* Header sub */}
            <div className="bg-[#121a30] px-4 py-2 text-xs border-b border-slate-800 text-slate-400 flex justify-between font-mono font-medium">
              <span>LIVE BALL-BY-BALL COMMENTS</span>
              <span className="text-[10px] text-amber-500">Match active</span>
            </div>

            {/* Logs roll */}
            <div ref={logContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans max-h-[360px] scrollbar-thin">
              {liveLog.map((log) => {
                const isWkt = log.type === 'wicket';
                const isBdr = log.type === 'boundary';
                const isTossOrMid = log.type === 'toss' || log.type === 'extra';

                return (
                  <div
                    key={log.ballKey}
                    className={`p-3 rounded-lg text-xs leading-relaxed transition-all ${
                      isWkt
                        ? 'bg-rose-950/40 border border-rose-900/30 text-rose-300'
                        : isBdr
                        ? 'bg-blue-950/40 border border-blue-900/30 text-blue-300'
                        : isTossOrMid
                        ? 'bg-slate-900/80 border border-slate-800 text-amber-500 italic'
                        : 'bg-slate-900/10 hover:bg-slate-900/30 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold uppercase text-[9px] text-slate-500 tracking-wider">
                        {log.bowler}
                      </span>
                      <p className="flex-1">{log.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STAGE 4: Post Match details & Scorecards */}
      {simState === 'postmatch' && scorecard && (
        <div id="scorecard-postmatch-viewer">
          {/* Winner highlight block */}
          <div className="bg-gradient-to-r from-amber-950/20 to-slate-900/40 p-6 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest uppercase">
                  completed match report
                </span>
                <button
                  id="replay-commentary-btn"
                  onClick={() => {
                    setIsWicketAnimation(false);
                    setIsBoundaryAnimation(null);
                    setCurrentInnings(1);
                    setOverIndex(0);
                    setBallIndex(0);
                    setRunningRuns(0);
                    setRunningWickets(0);
                    setRunningOversPlayed('0.0');
                    setLiveLog([{
                      ballKey: `toss_replay_${Date.now()}`,
                      bowler: 'Match Official',
                      desc: `REPLAY TOSS UPDATE: ${scorecard.toss.commentary}`,
                      type: 'toss'
                    }]);
                    setIsReplaying(true);
                    setSimState('playing');
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer border border-transparent shadow shadow-amber-950/35"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Replay Commentary
                </button>
              </div>
              <h2 className="font-heading text-2xl font-extrabold text-white">
                {sanitizeResultText(scorecard.result.margin)}
              </h2>
              <p className="text-xs text-slate-400 max-w-xl pr-5 leading-normal">
                {scorecard.result.summary}
              </p>
            </div>

            {/* Player of Match custom card */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3 w-full md:w-auto md:min-w-64 max-w-xs shrink-0 self-start">
              <div className="bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <div className="text-xs">
                <span className="text-[9px] font-mono uppercase text-amber-400 tracking-wider font-bold">Player of the Match</span>
                <p className="font-heading font-black text-slate-200 text-sm mt-0.5">{scorecard.result.playerOfTheMatch.name}</p>
                <p className="text-[11px] text-slate-450 font-mono mt-0.5">{scorecard.result.playerOfTheMatch.stats}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 italic">"{scorecard.result.playerOfTheMatch.reason}"</p>
              </div>
            </div>
          </div>

          {/* Navigation Tab Menu */}
          <div className="flex border-b border-slate-800 bg-slate-900 text-xs font-mono font-medium">
            <button
              onClick={() => setSelectedScorecardTab('summary')}
              className={`py-3.5 px-6 border-b-2 transition cursor-pointer ${
                selectedScorecardTab === 'summary'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              🔥 Gully Commentary & Ceremony
            </button>
            <button
              onClick={() => setSelectedScorecardTab('innings1')}
              className={`py-3.5 px-6 border-b-2 transition cursor-pointer ${
                selectedScorecardTab === 'innings1'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {getInningsLabel(1)}
            </button>
            <button
              onClick={() => setSelectedScorecardTab('innings2')}
              className={`py-3.5 px-6 border-b-2 transition cursor-pointer ${
                selectedScorecardTab === 'innings2'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {getInningsLabel(2)}
            </button>
          </div>

          <div className="p-5 font-sans leading-relaxed text-slate-300">
            {/* SUBTAB 1: Summary Details */}
            {selectedScorecardTab === 'summary' && (
              <div className="space-y-5 text-sm">
                {renderGullyCommentary()}

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-[#121929] border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400">1st Innings: <span className="font-bold text-white">{scorecard.innings1.battingTeam}</span></p>
                    <p className="font-extrabold text-base text-slate-200 mt-1">{scorecard.innings1.totalRuns}/{scorecard.innings1.totalWickets} <span className="text-xs text-slate-450 font-normal">({scorecard.innings1.totalOvers} Overs)</span></p>
                  </div>
                  <div className="bg-[#121929] border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400">2nd Innings: <span className="font-bold text-white">{scorecard.innings2.battingTeam}</span></p>
                    <p className="font-extrabold text-base text-slate-200 mt-1">{scorecard.innings2.totalRuns}/{scorecard.innings2.totalWickets} <span className="text-xs text-slate-450 font-normal">({scorecard.innings2.totalOvers} Overs)</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: Innings 1 scorecard */}
            {selectedScorecardTab === 'innings1' && (
              <InningsScorecardTable innings={scorecard.innings1} />
            )}

            {/* SUBTAB 3: Innings 2 scorecard */}
            {selectedScorecardTab === 'innings2' && (
              <InningsScorecardTable innings={scorecard.innings2} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared score table subcomponent
 */
function InningsScorecardTable({ innings }: { innings: InningsScorecard }) {
  return (
    <div className="space-y-6">
      {/* Batting Roster */}
      <div className="space-y-2">
        <h4 className="font-heading font-extrabold text-slate-200 text-sm border-b border-slate-800 pb-1.5">
          {innings.battingTeam} Batting Scorecard
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono tracking-wider uppercase text-[10px]">
                <th className="py-2 px-3">Batsman Name</th>
                <th className="py-2 px-3">Dismissal Description</th>
                <th className="py-2 px-3 text-center w-14">Runs</th>
                <th className="py-2 px-3 text-center w-14">Balls</th>
                <th className="py-2 px-3 text-center w-12">4s</th>
                <th className="py-2 px-3 text-center w-12">6s</th>
                <th className="py-2 px-3 text-right w-16">Strike Rate</th>
              </tr>
            </thead>
            <tbody>
              {innings.batsmen.map((batsman, idx) => (
                <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/40 font-sans text-slate-300">
                  <td className="py-2.5 px-3 font-semibold text-slate-100">{batsman.name}</td>
                  <td className="py-2.5 px-3 text-slate-450 text-[11px] font-mono">{batsman.howOut}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-white font-mono">{batsman.runs}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{batsman.balls}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{batsman.fours}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{batsman.sixes}</td>
                  <td className="py-2.5 px-3 text-right text-amber-500 font-mono font-semibold">
                    {batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
              {/* Runs row aggregate */}
              <tr className="bg-slate-900 font-semibold text-white uppercase border-t border-slate-750">
                <td className="py-3 px-3 col-span-2 font-bold" colSpan={2}>
                  Total Score (Run-Wickets-Overs played)
                </td>
                <td className="py-3 px-3 text-center text-[#22c55e] font-mono font-black" colSpan={4}>
                  {innings.totalRuns} / {innings.totalWickets} ({innings.totalOvers} Overs)
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-450" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bowling Roster */}
      <div className="space-y-2">
        <h4 className="font-heading font-extrabold text-slate-200 text-sm border-b border-slate-800 pb-1.5">
          {innings.bowlingTeam} Bowling figures
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono tracking-wider uppercase text-[10px]">
                <th className="py-2 px-3">Bowler Name</th>
                <th className="py-2 px-3 text-center w-20">Overs</th>
                <th className="py-2 px-3 text-center w-20">Runs conceded</th>
                <th className="py-2 px-3 text-center w-20">Wickets</th>
                <th className="py-2 px-3 text-center w-20 font-bold text-amber-400">Extras</th>
                <th className="py-2 px-3 text-right w-20">Economy</th>
              </tr>
            </thead>
            <tbody>
              {innings.bowlers.map((bowler, idx) => (
                <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/40 font-mono text-slate-300">
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-100">{bowler.name}</td>
                  <td className="py-2.5 px-3 text-center text-slate-200 font-bold">{bowler.overs}</td>
                  <td className="py-2.5 px-3 text-center text-rose-400 font-semibold">{bowler.runs}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{bowler.wickets}</td>
                  <td className="py-2.5 px-3 text-center text-slate-500">{bowler.extras || 0}</td>
                  <td className="py-2.5 px-3 text-right text-amber-500 font-bold">
                    {bowler.overs > 0 ? (bowler.runs / bowler.overs).toFixed(2) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
