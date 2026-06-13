import React, { useState } from 'react';
import { NewsArticle, Team, Standing, PlayerCareerStats, Fixture } from '../types';
import { Newspaper, BellRing, Sparkles, Send, Loader2, ArrowRightCircle, Award } from 'lucide-react';

interface NewsroomProps {
  newsArticles: NewsArticle[];
  teams: Team[];
  standings: Standing[];
  playerStats: PlayerCareerStats[];
  fixtures: Fixture[];
  onAddArticle: (article: NewsArticle) => void;
}

export default function Newsroom({
  newsArticles,
  teams,
  standings,
  playerStats,
  fixtures,
  onAddArticle,
}: NewsroomProps) {
  const [loading, setLoading] = useState(false);
  const [newsCategory, setNewsCategory] = useState<'Preview' | 'Review' | 'Spotlight' | 'Summary' | 'Breaking'>('Breaking');
  const [selectedMatchFixtureId, setSelectedMatchFixtureId] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [breakingContext, setBreakingContext] = useState('');

  const completedFixtures = fixtures.filter((f) => f.status === 'completed');
  const activePlayers = playerStats.length > 0 ? playerStats : [];

  const handleGenerateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let contextData: any = {};

      if (newsCategory === 'Preview') {
        // Find selected schedule fixture or fallback
        const fixtureObj = fixtures.find(f => f.id === selectedMatchFixtureId) || fixtures[0];
        if (!fixtureObj) {
          alert('Generate fixtures or make a team first to formulate previews.');
          setLoading(false);
          return;
        }
        const teamA = teams.find(t => t.id === fixtureObj.teamAId)?.name || 'Team A';
        const teamB = teams.find(t => t.id === fixtureObj.teamBId)?.name || 'Team B';
        contextData = { teamA, teamB, round: fixtureObj.round };
      } else if (newsCategory === 'Review') {
        const fixtureObj = fixtures.find(f => f.id === selectedMatchFixtureId) || completedFixtures[0];
        if (!fixtureObj || !fixtureObj.scorecard) {
          alert('You must play a match first to write a Match Review!');
          setLoading(false);
          return;
        }
        const teamA = teams.find(t => t.id === fixtureObj.teamAId)?.name || 'Team A';
        const teamB = teams.find(t => t.id === fixtureObj.teamBId)?.name || 'Team B';
        contextData = {
          teamA,
          teamB,
          winner: fixtureObj.scorecard.result.winner,
          margin: fixtureObj.scorecard.result.margin,
          summary: fixtureObj.scorecard.result.summary,
        };
      } else if (newsCategory === 'Spotlight') {
        const pStat = activePlayers.find(p => p.playerName === selectedPlayerName) || activePlayers[0];
        if (!pStat) {
          alert('Introduce players manually or load squads before running spotlights!');
          setLoading(false);
          return;
        }
        const rawPlayer = teams.flatMap(t => t.players).find(p => p.name === pStat.playerName);
        contextData = {
          player: pStat.playerName,
          team: pStat.teamName,
          rating: rawPlayer?.rating || 85,
        };
      } else if (newsCategory === 'Summary') {
        contextData = {
          standings: standings.slice(0, 5).map(s => ({ team: s.teamName, points: s.points, nrr: s.nrr })),
        };
      } else if (newsCategory === 'Breaking') {
        contextData = {
          story: breakingContext.trim() || 'A massive training ground dispute shakes up the franchises heading into the final stages of the championship.',
        };
      }

      const response = await fetch('/api/news/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newsCategory,
          contextData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Newsroom API HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      
      const article: NewsArticle = {
        id: `news_${Date.now()}`,
        title: data.title,
        category: newsCategory,
        content: data.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
      };

      onAddArticle(article);
      setBreakingContext('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate article: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full" id="newsroom-tab-desk">
      {/* Editorial Controls Section */}
      <div className="lg:col-span-5 bg-[#0f172a] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
        <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-100">AI Sports News Editor Desk</h3>
            <p className="text-xs text-slate-400 mt-0.5">Prompt the AI newsroom to write realistic cricket reviews</p>
          </div>
        </div>

        <form onSubmit={handleGenerateArticle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">News Article Category</label>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {(['Breaking', 'Preview', 'Review', 'Spotlight', 'Summary'] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setNewsCategory(cat)}
                  className={`py-2 px-3 rounded-lg border text-left font-medium transition cursor-pointer ${
                    newsCategory === cat
                      ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-extrabold'
                      : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="mr-1">{
                    cat === 'Breaking' ? '🚨' :
                    cat === 'Preview' ? '🔍' :
                    cat === 'Review' ? '📊' :
                    cat === 'Spotlight' ? '⭐' : '📈'
                  }</span>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic contextual fields */}
          {newsCategory === 'Preview' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Select Scheduled Match Pair</label>
              <select
                required
                value={selectedMatchFixtureId}
                onChange={(e) => setSelectedMatchFixtureId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300"
              >
                <option value="">-- Choose scheduled fixture --</option>
                {fixtures.filter(f => f.status === 'scheduled').map(f => {
                  const tA = teams.find(t => t.id === f.teamAId)?.name || 'T1';
                  const tB = teams.find(t => t.id === f.teamBId)?.name || 'T2';
                  return <option key={f.id} value={f.id}>Round {f.round}: {tA} vs {tB}</option>;
                })}
              </select>
            </div>
          )}

          {newsCategory === 'Review' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Select Played Match Scorecard</label>
              <select
                required
                value={selectedMatchFixtureId}
                onChange={(e) => setSelectedMatchFixtureId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300"
              >
                <option value="">-- Choose completed fixture --</option>
                {completedFixtures.map(f => {
                  const tA = teams.find(t => t.id === f.teamAId)?.name || 'T1';
                  const tB = teams.find(t => t.id === f.teamBId)?.name || 'T2';
                  return <option key={f.id} value={f.id}>{tA} vs {tB} ({f.result})</option>;
                })}
              </select>
            </div>
          )}

          {newsCategory === 'Spotlight' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Choose Career Spotlight Player</label>
              <select
                required
                value={selectedPlayerName}
                onChange={(e) => setSelectedPlayerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300"
              >
                <option value="">-- Choose player name --</option>
                {activePlayers.map(p => (
                  <option key={p.playerName} value={p.playerName}>{p.playerName} ({p.role} - {p.teamName})</option>
                ))}
              </select>
            </div>
          )}

          {newsCategory === 'Breaking' && (
            <div>
              <label className="block text-xs font-semibold text-slate-405 mb-1">Sensational Headline Context (Optional)</label>
              <textarea
                rows={3}
                value={breakingContext}
                onChange={(e) => setBreakingContext(e.target.value)}
                placeholder="e.g. MS Dhoni announces shock return, or Bengaluru Blasters change captain and buy a new bowling trainer."
                className="w-full bg-slate-900 border border-slate-850 rounded-lg p-2.5 text-xs text-slate-300 font-sans focus:outline-none focus:border-amber-505"
              />
            </div>
          )}

          {newsCategory === 'Summary' && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[11px] text-amber-500 font-mono">
              ★ The mid-season review uses the current points table (top 5 teams) to generate analytical stats.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-505 transition text-slate-950 font-heading font-black text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-transparent shadow shadow-amber-950/20 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> Generating Article content...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" /> PUBLISH WITH GEMINI EDITORIAL
              </>
            )}
          </button>
        </form>
      </div>

      {/* Published News Feed Ticker Panel */}
      <div className="lg:col-span-7 bg-[#0f172a] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-100 flex items-center gap-2">
              Sports Journal Feed <span className="bg-amber-500/10 text-amber-500 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">sports feed</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronicles of preceding fixtures and spotlights published</p>
          </div>
          <span className="text-xs text-slate-500 font-mono font-bold bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            {newsArticles.length} News articles
          </span>
        </div>

        {newsArticles.length === 0 ? (
          <div className="text-center py-20 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-850">
            <BellRing className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="font-medium font-heading">Journal Feed is Empty</p>
            <p className="text-xs text-slate-650 max-w-xs mx-auto mt-1">
              Request the editor desk above to generate match stories, headline reviews and bulletins.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[440px] overflow-y-auto pr-2 scrollbar-thin">
            {newsArticles.map((art) => (
              <div
                key={art.id}
                className="bg-[#0b0f19] border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition duration-150 space-y-3"
              >
                <div className="flex items-center justify-between">
                  {/* Category badge */}
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono font-extrabold tracking-wider border ${
                    art.category === 'Breaking' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    art.category === 'Preview' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    art.category === 'Review' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' :
                    art.category === 'Spotlight' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {art.category} BULLETIN
                  </span>

                  <span className="text-[10px] text-slate-500 font-mono">{art.timestamp}</span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-heading font-black text-slate-100 text-base leading-snug tracking-tight">
                    {art.title}
                  </h3>
                </div>

                {/* Styled article text paragraphs */}
                <div className="text-xs text-slate-300 font-sans space-y-2 leading-relaxed whitespace-pre-wrap border-l-2 border-slate-800 pl-3.5 italic">
                  {art.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
