// HomeView.jsx - Lobby Entry & Room Creator / Joiner with 2v2 Mode Selection
import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Users, Flame, ShieldCheck, Sparkles, Swords, UserCheck } from 'lucide-react';
import { P2PNetwork } from '../services/p2p';

export function HomeView({ onCreateRoom, onJoinRoom }) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('uno_player_name') || '玩家');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [allowStacking, setAllowStacking] = useState(true);
  const [gameMode, setGameMode] = useState('ffa'); // 'ffa' | '2v2'
  const [tab, setTab] = useState('create'); // 'create' | 'join'

  useEffect(() => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && hash.startsWith('UNO-')) {
      setRoomCodeInput(hash.toUpperCase());
      setTab('join');
    }
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setPlayerName(val);
    localStorage.setItem('uno_player_name', val);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const code = P2PNetwork.generateRoomCode();
    onCreateRoom(code, playerName, allowStacking, gameMode);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    onJoinRoom(roomCodeInput.trim().toUpperCase(), playerName);
  };

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0e2a1b]/95 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Host-Authoritative P2P
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span className="text-red-500 drop-shadow-[0_2px_10px_rgba(239,68,68,0.5)]">U</span>
            <span className="text-amber-400 drop-shadow-[0_2px_10px_rgba(244,196,48,0.5)]">N</span>
            <span className="text-blue-500 drop-shadow-[0_2px_10px_rgba(59,130,246,0.5)]">O</span>
            <span className="text-green-500 drop-shadow-[0_2px_10px_rgba(34,197,94,0.5)]">!</span>
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/70 mt-1">
            房主自架極速連線 • 支援 2V2 組隊與多人混戰 • 3D 官方精靈卡牌
          </p>
        </div>

        {/* Player Name Input */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-emerald-300 mb-1.5 uppercase tracking-wider">
            玩家暱稱
          </label>
          <input
            type="text"
            value={playerName}
            onChange={handleNameChange}
            maxLength={12}
            placeholder="請輸入你的暱稱..."
            className="w-full px-4 py-2.5 bg-[#081a10] border border-emerald-500/30 rounded-xl text-white placeholder-emerald-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
          />
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#07170e] rounded-xl border border-emerald-500/20 mb-5">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === 'create'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            建立房間
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === 'join'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            加入房間
          </button>
        </div>

        {/* Tab 1: Create Room */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Game Mode Selection */}
            <div>
              <label className="block text-xs font-medium text-emerald-300 mb-1.5 uppercase tracking-wider">
                遊戲模式 (Game Mode)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGameMode('ffa')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    gameMode === 'ffa'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                      : 'bg-[#081a10] border-emerald-500/20 text-emerald-300/70 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white mb-1">
                    <Swords className="w-4 h-4 text-amber-400" />
                    多人混戰 (FFA)
                  </div>
                  <div className="text-[11px] opacity-75">
                    各自為戰，支援 2~4 人，對手手牌蓋牌
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('2v2')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    gameMode === '2v2'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                      : 'bg-[#081a10] border-emerald-500/20 text-emerald-300/70 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white mb-1">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    2V2 雙人組隊
                  </div>
                  <div className="text-[11px] opacity-75">
                    對面是隊友，即時可見隊友手牌共謀勝利
                  </div>
                </button>
              </div>
            </div>

            {/* Stacking Rule options */}
            <div className="bg-[#081a10] border border-emerald-500/20 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white">疊牌規則 (Stacking)</div>
                    <div className="text-[11px] text-emerald-300/70">
                      允許 +2 疊 +2，+4 疊 +4 累積罰抽
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowStacking(!allowStacking)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    allowStacking ? 'bg-amber-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowStacking ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-xs text-emerald-300/80 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>自選對手模式：</strong>進入房間後可自由切換每一席為「電腦」或「真人」，即使單人也能與 AI 電腦組隊練習！
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-sm sm:text-base rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              建立房間並進入大廳
            </button>
          </form>
        )}

        {/* Tab 2: Join Room */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-emerald-300 mb-1.5 uppercase tracking-wider">
                房間號碼 (Room Code)
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="例如: UNO-7829"
                className="w-full px-4 py-3 bg-[#081a10] border border-emerald-500/30 rounded-xl text-white font-mono text-center tracking-widest text-lg placeholder-emerald-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-500/20 active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              加入房間
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
