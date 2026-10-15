// HomeView.jsx - Streamlined Casino Tabletop Entry (Nickname + Create / Join Room)
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LogIn,
  Users,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { P2PNetwork } from '../services/p2p';
import { soundManager } from '../services/sound';

export function HomeView({ onCreateRoom, onJoinRoom }) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('uno_player_name') || '玩家');
  const [roomCodeInput, setRoomCodeInput] = useState('');
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

  const handleCreate = (e) => {
    e.preventDefault();
    soundManager.playShuffle();
    const code = P2PNetwork.generateRoomCode();
    // Default to stacking = true, mode = 'ffa'; all rules are configured inside LobbyView
    onCreateRoom(code, playerName.trim() || '房主', true, 'ffa');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    soundManager.playShuffle();
    onJoinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim() || '玩家');
  };

  return (
    <div
      className="fixed inset-0 felt-table overflow-y-auto overflow-x-hidden select-none z-30 flex flex-col items-center p-4 py-8 pb-12 custom-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      {/* Ambient Casino Spotlight & Table Rim Vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 42%, rgba(28, 98, 52, 0.45) 0%, rgba(10, 38, 20, 0.75) 55%, rgba(3, 12, 6, 0.98) 100%)'
        }}
      />

      {/* Decorative Background Floating Cards */}
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
      <div className="relative z-10 w-full max-w-md my-auto rounded-3xl bg-gradient-to-b from-[#133822]/95 via-[#0b2315]/98 to-[#06140c] border-2 border-amber-500/40 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_0_6px_rgba(38,23,12,0.95)] p-6 sm:p-8 backdrop-blur-xl shrink-0">
        {/* Subtle Inner Gold Hairline */}
        <div className="pointer-events-none absolute inset-2.5 rounded-2xl border border-amber-400/15" />

        {/* Hero Brand Showcase with Fanned Actual Cards */}
        <div className="relative flex flex-col items-center mb-6 pt-2">
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
            支援單人 AI 練習、好友房號連線與 2V2 組隊共視手牌
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
          <input
            type="text"
            value={playerName}
            onChange={handleNameChange}
            maxLength={12}
            placeholder="輸入你的牌桌名稱..."
            className="w-full px-4 py-3 bg-[#05120a] border border-emerald-500/35 rounded-xl text-white font-bold text-sm placeholder-emerald-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 transition shadow-inner"
          />
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

        {/* TAB 1: CREATE ROOM (Clean One-Click Entry to Lobby) */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#06150c] border border-emerald-500/25 text-xs text-emerald-200/85 space-y-1.5 leading-relaxed">
              <div className="font-extrabold text-amber-300 text-sm">
                建立專屬牌桌房間
              </div>
              <p className="text-emerald-300/70">
                進入房間大廳後，可自由設定 <span className="text-white font-bold">個人混戰 / 2V2 組隊</span>、<span className="text-white font-bold">目標積分</span>、<span className="text-white font-bold">+2/+4 疊牌</span> 與 <span className="text-white font-bold">AI 電腦或真人座位</span>。
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-sm sm:text-base rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.35)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 cursor-pointer border border-amber-200/60"
            >
              <Users className="w-5 h-5" />
              <span>開設房間並前往大廳</span>
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