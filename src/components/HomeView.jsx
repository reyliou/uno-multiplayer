// HomeView.jsx - Commercial Casino Tabletop Entry & Room Creator / Joiner
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LogIn,
  Users,
  Flame,
  ShieldCheck,
  Swords,
  UserCheck,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { P2PNetwork } from '../services/p2p';
import { soundManager } from '../services/sound';

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

  const handleTabSwitch = (newTab) => {
    soundManager.playTick();
    setTab(newTab);
  };

  const handleModeSelect = (mode) => {
    soundManager.playTick();
    setGameMode(mode);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    soundManager.playShuffle();
    const code = P2PNetwork.generateRoomCode();
    onCreateRoom(code, playerName.trim() || '房主', allowStacking, gameMode);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    soundManager.playShuffle();
    onJoinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim() || '玩家');
  };

  return (
    <div className="relative min-h-[100dvh] felt-table flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Ambient Casino Spotlight & Table Rim Vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 42%, rgba(28, 98, 52, 0.45) 0%, rgba(10, 38, 20, 0.75) 55%, rgba(3, 12, 6, 0.98) 100%)'
        }}
      />

      {/* Decorative Background Floating Cards (Uses existing /cards_modern assets) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-20 sm:opacity-30">
        <img
          src="/cards_modern/red_skip.png"
          alt=""
          className="absolute -top-8 -left-8 w-36 sm:w-48 rotate-[22deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/blue_reverse.png"
          alt=""
          className="absolute top-12 -right-10 w-36 sm:w-48 -rotate-[18deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/yellow_draw2.png"
          alt=""
          className="absolute -bottom-10 left-8 w-36 sm:w-48 -rotate-[15deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/wild_draw4.png"
          alt=""
          className="absolute -bottom-8 right-10 w-36 sm:w-48 rotate-[16deg] blur-[1px] drop-shadow-2xl"
        />
      </div>

      {/* Main Casino Wood & Gold Framed Panel */}
      <div className="relative z-10 w-full max-w-xl rounded-3xl bg-gradient-to-b from-[#133822]/95 via-[#0b2315]/98 to-[#06140c] border-2 border-amber-500/40 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_0_6px_rgba(38,23,12,0.95)] p-6 sm:p-8 backdrop-blur-xl">
        {/* Subtle Inner Gold Hairline */}
        <div className="pointer-events-none absolute inset-2.5 rounded-2xl border border-amber-400/15" />

        {/* Hero Brand Showcase with Fanned Actual Cards */}
        <div className="relative flex flex-col items-center mb-6 pt-2">
          {/* Fanned 3-Card Showcase Behind Emblem */}
          <div className="relative h-24 sm:h-28 w-48 flex items-center justify-center mb-1">
            <img
              src="/cards_modern/red_draw2.png"
              alt="Red +2"
              className="w-16 sm:w-20 rounded-lg shadow-xl -rotate-[22deg] -translate-x-9 translate-y-1.5 transition-transform duration-500 hover:-translate-y-1"
            />
            <img
              src="/cards_modern/wild.png"
              alt="Wild"
              className="w-18 sm:w-22 rounded-lg shadow-2xl z-10 -translate-y-1 transition-transform duration-500 hover:-translate-y-3"
            />
            <img
              src="/cards_modern/blue_skip.png"
              alt="Blue Skip"
              className="w-16 sm:w-20 rounded-lg shadow-xl rotate-[22deg] translate-x-9 translate-y-1.5 transition-transform duration-500 hover:-translate-y-1"
            />

            {/* Classic Tilted UNO Emblem Overlay */}
            <div className="absolute -bottom-2 z-20 px-5 py-1 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 border-[3px] border-amber-300 shadow-[0_10px_25px_rgba(0,0,0,0.85)] -rotate-6">
              <span className="font-black text-2xl sm:text-3xl tracking-wider text-amber-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                UNO!
              </span>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-black tracking-wide text-white mt-3">
            線上多人派對牌桌
          </h1>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            支援單人 AI 練習、好友房號連線與 2V2 雙人組隊共視手牌
          </p>
        </div>

        {/* Player Nickname Input Box */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-amber-300/90 tracking-wider">
              玩家名稱
            </label>
            <span className="text-[11px] text-emerald-400/60">
              最多 12 字元
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={playerName}
              onChange={handleNameChange}
              maxLength={12}
              placeholder="輸入你的牌桌名稱..."
              className="w-full px-4 py-3 bg-[#05120a] border border-emerald-500/35 rounded-xl text-white font-bold text-sm placeholder-emerald-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 transition shadow-inner"
            />
          </div>
        </div>

        {/* Create / Join Segmented Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#05120a] rounded-2xl border border-emerald-500/25 mb-5 shadow-inner">
          <button
            type="button"
            onClick={() => handleTabSwitch('create')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'create'
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'text-emerald-300/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            開設新牌局
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('join')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'join'
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'text-emerald-300/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <LogIn className="w-4 h-4" />
            輸入房號加入
          </button>
        </div>

        {/* TAB 1: CREATE ROOM */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Game Mode Cards */}
            <div>
              <label className="block text-xs font-bold text-amber-300/90 mb-2 tracking-wider">
                選擇對戰模式
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleModeSelect('ffa')}
                  className={`relative p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer overflow-hidden ${
                    gameMode === 'ffa'
                      ? 'bg-gradient-to-br from-amber-500/20 to-emerald-950/90 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'bg-[#06150c] border-emerald-500/20 text-emerald-300/70 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-white">
                      <Swords className="w-4 h-4 text-amber-400" />
                      個人混戰
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-bold">
                      2-4P
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-200/75">
                    各自為政，手牌全蓋牌，最先出清手牌者獨得積分。
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeSelect('2v2')}
                  className={`relative p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer overflow-hidden ${
                    gameMode === '2v2'
                      ? 'bg-gradient-to-br from-amber-500/20 to-emerald-950/90 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'bg-[#06150c] border-emerald-500/20 text-emerald-300/70 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-white">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      2V2 雙人組隊
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                      TEAM
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-200/75">
                    對座互為隊友，牌桌上直接明牌共享隊友手牌、助攻獲勝。
                  </p>
                </button>
              </div>
            </div>

            {/* Stacking Rule Toggle Row */}
            <div
              onClick={() => {
                soundManager.playTick();
                setAllowStacking(!allowStacking);
              }}
              className="bg-[#06150c] hover:bg-[#081c10] border border-emerald-500/25 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-white">
                    允許累加上牌 (+2 / +4 疊牌)
                  </div>
                  <div className="text-[11px] text-emerald-300/65">
                    遭上家出 +2 或 +4 時，可打出同類牌將罰抽張數轉嫁給下家
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="切換疊牌規則"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  allowStacking ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    allowStacking ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Info Notice */}
            <div className="px-3.5 py-2.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-200/80 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                進入大廳後仍可隨時調整積分制、連續抽牌、質疑 +4 以及更換電腦或真人座位。
              </span>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              className="w-full py-3.5 px-5 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-sm sm:text-base rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.35)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 cursor-pointer border border-amber-200/60"
            >
              <Users className="w-5 h-5" />
              <span>開設房間並前往牌桌大廳</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* TAB 2: JOIN ROOM */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="bg-[#06150c] border border-emerald-500/25 rounded-2xl p-5 text-center">
              <label className="block text-xs font-bold text-amber-300/90 mb-2 tracking-wider">
                輸入好友房間代碼
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="UNO-0000"
                className="w-full px-4 py-3.5 bg-[#040d07] border-2 border-emerald-500/35 rounded-xl text-amber-400 font-mono font-black text-center tracking-[0.2em] text-2xl placeholder-emerald-800/70 focus:outline-none focus:border-amber-400 transition shadow-inner"
                autoFocus
              />
              <p className="text-[11px] text-emerald-300/60 mt-2.5">
                請向房主索取 8 碼房號（例如 UNO-7829），或直接開啟房主分享的邀請網址
              </p>
            </div>

            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="w-full py-3.5 px-5 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-sm sm:text-base rounded-2xl shadow-[0_8px_25px_rgba(16,185,129,0.3)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 cursor-pointer border border-emerald-200/50"
            >
              <Sparkles className="w-5 h-5" />
              <span>立即連線加入房間</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}