import React, { useState, useRef } from 'react';
import { Player, Team } from '../types';
import { ShieldAlert, Trash2, UserPlus, Upload, FileText, CheckCircle2, Lock, ListFilter, AlertCircle } from 'lucide-react';

interface SquadBuilderProps {
  teams: Team[];
  selectedTeamId: string;
  onUpdateTeamPlayers: (teamId: string, players: Player[]) => void;
  onLockTeam: (teamId: string) => void;
}

export default function SquadBuilder({
  teams,
  selectedTeamId,
  onUpdateTeamPlayers,
  onLockTeam,
}: SquadBuilderProps) {
  const currentTeam = teams.find((t) => t.id === selectedTeamId);

  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState<'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper'>('Batsman');
  const [playerRating, setPlayerRating] = useState<number>(85);

  const [bulkInput, setBulkInput] = useState('');
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk' | 'file'>('manual');
  const [importLogs, setImportLogs] = useState<{ success: string[]; error: string[] }>({ success: [], error: [] });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentTeam) {
    return (
      <div className="bg-[#0f172a] rounded-xl p-8 text-center text-gray-400 border border-slate-800">
        <ShieldAlert className="mx-auto w-12 h-12 text-slate-600 mb-2" />
        Select a team from the dashboard to begin building their squad.
      </div>
    );
  }

  // Check if player name globally exists in any other team
  const findExistingPlayerAssignment = (name: string): string | null => {
    const cleanName = name.trim().toLowerCase();
    for (const t of teams) {
      if (t.players.some((p) => p.name.trim().toLowerCase() === cleanName)) {
        return t.name;
      }
    }
    return null;
  };

  const handleAddManualPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTeam.locked) return;

    const trimmedName = playerName.trim();
    if (!trimmedName) return;

    // Check unique ownership
    const assignedTeamName = findExistingPlayerAssignment(trimmedName);
    if (assignedTeamName) {
      alert(`"${trimmedName}" is already assigned to ${assignedTeamName}`);
      return;
    }

    const newPlayer: Player = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      role: playerRole,
      rating: Math.min(Math.max(playerRating, 1), 99),
    };

    onUpdateTeamPlayers(currentTeam.id, [...currentTeam.players, newPlayer]);
    setPlayerName('');
    setPlayerRole('Batsman');
    setPlayerRating(85);
  };

  const handleDeletePlayer = (playerId: string) => {
    if (currentTeam.locked) return;
    onUpdateTeamPlayers(
      currentTeam.id,
      currentTeam.players.filter((p) => p.id !== playerId)
    );
  };

  /**
   * Helper to parse line-by-line of format "Virat Kohli - Batsman - 98"
   */
  const parsePlayerLine = (line: string): { name: string; role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper'; rating: number } | null => {
    // Splits on commas, hyphens or tabs
    const parts = line.split(/[-,;]/).map((s) => s.trim());
    if (parts.length < 2) return null;

    const name = parts[0];
    if (!name) return null;

    let rawRole = parts[1].toLowerCase().replace(/\s+/g, '');
    let role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper' = 'Batsman';

    if (rawRole.includes('bowl') || rawRole.includes('bowler')) {
      role = 'Bowler';
    } else if (rawRole.includes('allrounder') || rawRole.includes('all-rounder') || rawRole.includes('all') || rawRole === 'ar') {
      role = 'All Rounder';
    } else if (rawRole.includes('wicket') || rawRole.includes('keeper') || rawRole.includes('wk') || rawRole === 'wicketkeeper') {
      role = 'Wicket Keeper';
    } else {
      role = 'Batsman'; // Default
    }

    let rating = 80; // default
    if (parts[2]) {
      const parsedRating = parseInt(parts[2], 10);
      if (!isNaN(parsedRating)) {
        rating = Math.min(Math.max(parsedRating, 1), 99);
      }
    }

    return { name, role, rating };
  };

  const processBulkImport = (text: string) => {
    if (currentTeam.locked) return;
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const successfullyAdded: Player[] = [];
    const successes: string[] = [];
    const errors: string[] = [];

    lines.forEach((line) => {
      const parsed = parsePlayerLine(line);
      if (!parsed) {
        errors.push(`Could not parse line: "${line}". Format: Name - Role - Rating`);
        return;
      }

      // Check unique ownership
      const assignedTeamName = findExistingPlayerAssignment(parsed.name);
      if (assignedTeamName) {
        errors.push(`"${parsed.name}" is already assigned to ${assignedTeamName}`);
        return;
      }

      // Check double names inside this exact batch import
      if (successfullyAdded.some(p => p.name.toLowerCase() === parsed.name.toLowerCase()) || 
          currentTeam.players.some(p => p.name.toLowerCase() === parsed.name.toLowerCase())) {
        errors.push(`"${parsed.name}" has duplicate entries in the same import list.`);
        return;
      }

      const player: Player = {
        id: `p_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: parsed.name,
        role: parsed.role,
        rating: parsed.rating,
      };

      successfullyAdded.push(player);
      successes.push(`Added ${parsed.name} (${parsed.role} - rating: ${parsed.rating})`);
    });

    if (successfullyAdded.length > 0) {
      onUpdateTeamPlayers(currentTeam.id, [...currentTeam.players, ...successfullyAdded]);
    }

    setImportLogs({ success: successes, error: errors });
    setBulkInput('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBulkImport(bulkInput);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processBulkImport(text);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Validation Checks for Locking
  const wkCount = currentTeam.players.filter((p) => p.role === 'Wicket Keeper').length;
  const bowlerCount = currentTeam.players.filter((p) => p.role === 'Bowler').length;
  const allRounderCount = currentTeam.players.filter((p) => p.role === 'All Rounder').length;
  const totalCount = currentTeam.players.length;

  const validationCriteria = [
    { text: 'At least 11 Players in Roster', met: totalCount >= 11, count: totalCount, req: 11 },
    { text: 'Minimum 1 Wicket Keeper', met: wkCount >= 1, count: wkCount, req: 1 },
    { text: 'Minimum 3 Bowlers', met: bowlerCount >= 3, count: bowlerCount, req: 3 },
    { text: 'Minimum 1 All Rounder', met: allRounderCount >= 1, count: allRounderCount, req: 1 },
  ];

  const canLock = validationCriteria.every((c) => c.met);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full" id="squad-builder-container">
      {/* Input Operations Panel */}
      <div className="lg:col-span-5 bg-[#0f172a] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="text-xl">{currentTeam.emoji}</span> Add Players to {currentTeam.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Define your customized roster for manual auction</p>
          </div>
          {currentTeam.locked && (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs flex items-center gap-1 font-mono font-medium">
              <Lock className="w-3.5 h-3.5" /> LOCKED
            </span>
          )}
        </div>

        {currentTeam.locked ? (
          <div className="text-center py-10 bg-slate-900/50 rounded-lg border border-dashed border-slate-800 px-4">
            <Lock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="font-heading font-medium text-slate-300">Roster is Locked & Ready</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              This squad is locked for the league schedule. To edit squad players, you will need to reset the league season.
            </p>
          </div>
        ) : (
          <>
            {/* Input Method Navigation */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'manual' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'bulk' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bulk Paste
              </button>
              <button
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'file' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                File Upload
              </button>
            </div>

            {/* TAB 1: Manual Entry */}
            {activeTab === 'manual' && (
              <form onSubmit={handleAddManualPlayer} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Player Name</label>
                  <input
                    type="text"
                    required
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Virat Kohli"
                    className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Role Type</label>
                    <select
                      value={playerRole}
                      onChange={(e) => setPlayerRole(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All Rounder">All Rounder</option>
                      <option value="Wicket Keeper">Wicket Keeper</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Skill Rating (1-99)</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={playerRating}
                      onChange={(e) => setPlayerRating(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 transition text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Add to Squad
                </button>
              </form>
            )}

            {/* TAB 2: Bulk Paste */}
            {activeTab === 'bulk' && (
              <form onSubmit={handleBulkSubmit} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-400">Paste Roster Lines</label>
                    <span className="text-[10px] text-slate-550">Format: Name - Role - Rating</span>
                  </div>
                  <textarea
                    rows={5}
                    required
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="Virat Kohli - Batsman - 98&#13;Jasprit Bumrah - Bowler - 99&#13;Hardik Pandya - All Rounder - 95"
                    className="w-full bg-slate-900 border border-slate-850 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 transition text-slate-950 text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" /> Parse & Import List
                </button>
              </form>
            )}

            {/* TAB 3: File Upload */}
            {activeTab === 'file' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-450 leading-normal">
                  Select a <strong>.txt</strong> or <strong>.csv</strong> containing one player on each line in the format:<br />
                  <code className="bg-slate-950 p-1 text-[11px] rounded inline-block mt-1 text-amber-500 font-mono">
                    Player Name - Role - Rating (e.g. MS Dhoni - Wicket Keeper - 93)
                  </code>
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 transition cursor-pointer bg-slate-900/40 py-8 px-4 rounded-xl text-center"
                >
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <span className="text-xs text-amber-500 font-semibold block">Click to Browse File</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Supports UTF-8 Plain text & CSV files</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.csv"
                  className="hidden"
                />
              </div>
            )}

            {/* Live Logs from imports */}
            {(importLogs.success.length > 0 || importLogs.error.length > 0) && (
              <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 text-xs max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold border-b border-slate-800 pb-1 uppercase tracking-wide">
                  <span>Import Report</span>
                  <button
                    onClick={() => setImportLogs({ success: [], error: [] })}
                    className="text-slate-400 hover:text-slate-200 hover:underline"
                  >
                    Clear Logs
                  </button>
                </div>
                {importLogs.success.map((msg, i) => (
                  <div key={`s_${i}`} className="text-emerald-400 font-mono flex items-start gap-1">
                    <span>✓</span> <span>{msg}</span>
                  </div>
                ))}
                {importLogs.error.map((msg, i) => (
                  <div key={`e_${i}`} className="text-rose-400 font-mono flex items-start gap-1">
                    <span>⚠</span> <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Squad Builder Lock Conditions Checker */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-850 p-4 space-y-3">
              <h4 className="font-heading font-semibold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-amber-500" /> Team Lock Requirements
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {validationCriteria.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                    <span className={c.met ? 'text-slate-300' : 'text-slate-400'}>{c.text}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      c.met ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {c.count} / {c.req}
                    </span>
                  </div>
                ))}
              </div>

              <button
                disabled={!canLock}
                onClick={() => onLockTeam(currentTeam.id)}
                className={`w-full mt-2 font-heading font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition duration-200 border cursor-pointer ${
                  canLock
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow shadow-emerald-750'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> LOCK TEAM ROSTER
              </button>
            </div>
          </>
        )}
      </div>

      {/* Roster Viewer list */}
      <div className="lg:col-span-7 bg-[#0f172a] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-100 flex items-center gap-2">
              Playing Squad <span className="text-xs bg-slate-800 text-amber-500 font-mono font-normal px-2 py-0.5 rounded-full">{totalCount} players</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Average Team Rating: {
              totalCount > 0 ? Math.round(currentTeam.players.reduce((sum, p) => sum + p.rating, 0) / totalCount) : 0
            }</p>
          </div>
          <span className="text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            Role counts
          </span>
        </div>

        {/* Categories breakdown bubbles */}
        <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
          <div className="bg-blue-950/30 border border-blue-900/15 p-2 rounded-lg">
            <div className="text-blue-400 font-bold text-base">{currentTeam.players.filter(p => p.role === 'Batsman').length}</div>
            <div className="text-slate-400 text-[9px] uppercase">Batsmen</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-900/15 p-2 rounded-lg">
            <div className="text-amber-400 font-bold text-base">{currentTeam.players.filter(p => p.role === 'Wicket Keeper').length}</div>
            <div className="text-slate-400 text-[9px] uppercase">Keepers</div>
          </div>
          <div className="bg-purple-950/30 border border-purple-900/15 p-2 rounded-lg">
            <div className="text-purple-400 font-bold text-base">{currentTeam.players.filter(p => p.role === 'All Rounder').length}</div>
            <div className="text-slate-400 text-[9px] uppercase">All-R</div>
          </div>
          <div className="bg-rose-950/30 border border-rose-900/15 p-2 rounded-lg">
            <div className="text-rose-400 font-bold text-base">{currentTeam.players.filter(p => p.role === 'Bowler').length}</div>
            <div className="text-slate-400 text-[9px] uppercase">Bowlers</div>
          </div>
        </div>

        {currentTeam.players.length === 0 ? (
          <div className="text-center py-20 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-850">
            <AlertCircle className="w-12 h-12 text-slate-700 mx-auto mb-2" />
            <p className="font-medium">No Players Assigned Yet</p>
            <p className="text-xs text-slate-600 mt-1">Manual entry or file upload coordinates to start</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[440px] overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="py-2.5 px-3">Player Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Rating</th>
                  {!currentTeam.locked && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {currentTeam.players.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-850 hover:bg-slate-900/40 font-sans group transition-colors duration-150"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[10px] w-4">{i + 1}</span>
                      {p.name}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        p.role === 'Batsman' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        p.role === 'Wicket Keeper' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        p.role === 'All Rounder' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold bg-slate-900 border border-slate-850 text-slate-300 px-2 py-0.5 rounded">
                        {p.rating}
                      </span>
                    </td>
                    {!currentTeam.locked && (
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition group-hover:opacity-100 duration-150"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
