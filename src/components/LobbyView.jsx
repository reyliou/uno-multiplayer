// LobbyView.jsx - Casino Tabletop Seat Compass & House Rules Lobby
import React, { useState } from 'react';
import {
  Copy,
  Check,
  Bot,
  User,
  Play,
  LogOut,
  Flame,
  Crown,
  Link as LinkIcon,
  Swords,
  UserCheck,
  ArrowLeftRight,
  Trophy,
  Layers,
  Scale,
  Settings2,
  Sparkles
} from 'lucide-react';
import { soundManager } from '../services/sound';

const SEAT_LABELS = [
  { pos: '南席 (主位)', dir: 'SOUTH' },
  { pos: '西席 (左側下家)', dir: 'WEST' },
  { pos: '北席 (對面座位)', dir: 'NORTH' },
  { pos: '東席 (右側上家)', dir: 'EAST' }
];

export function LobbyView({
  roomCode,
  isHost,
  players = [],
  gameMode = 'ffa',
  allowStacking,
  allowChallengeWildDraw4 = true,
  targetScore = 500,
  drawRule = 'draw_one',
  deckTheme = 'classic',
  onSetDeckTheme,
  onToggleAi,
  onToggleStacking,
  onToggleChallengeRule,
  onSetTargetScore,
  onSetDrawRule,
  onSetGameMode,
  onSetFfaCount,
  onSwapSlots,
  onKickPlayer,
  onStartGame,
  onLeaveRoom
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [swapSource, setSwapSource] = useState(null);

  const inviteLink = `${window.location.origin}${window.location.pathname}#${roomCode}`;
  const is2v2 = gameMode === '2v2';

  const handleCopyCode = () => {
    soundManager.playTick();
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    soundManager.playTick();
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSlotClickForSwap = (idx) => {
    if (!isHost) return;
    soundManager.playCard();
    if (swapSource === null) {
      setSwapSource(idx);
    } else if (swapSource === idx) {
      setSwapSource(null);
    } else {
      onSwapSlots(swapSource, idx);
      setSwapSource(null);
    }
  };

  return (
    <div className="relative min-h-[100dvh] felt-table flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
      {/* Ambient Felt Spotlight */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(28, 98, 52, 0.42) 0%, rgba(10, 38, 20, 0.78) 58%, rgba(3, 12, 6, 0.98) 100%)'
        }}
      />

      <div className="relative z-10 w-full max-w-3xl rounded-3xl bg-gradient-to-b from-[#133822]/95 via-[#0b2315]/98 to-[#06140c] border-2 border-amber-500/40 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_0_6px_rgba(38,23,12,0.95)] p-5 sm:p-7 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-2.5 rounded-2xl border border-amber-400/15" />

        {/* ============================================================== */}
        {/* TOP HEADER: ROOM CODE TICKET & INVITE CONTROLS                 */}
        {/* ============================================================== */}
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-emerald-500/20">
          <div className="flex items-center gap-3.5">
            {/* Tilted UNO Mini Badge */}
            <div className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 border-2 border-amber-300 shadow-lg -rotate-3 shrink-0">
              <span className="font-black text-lg tracking-wider text-amber-300">
                UNO!
              </span>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-bold">
                房間號碼 (點擊可複製)
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="group flex items-center gap-2 px-3 py-1 rounded-xl bg-[#05120a] border border-amber-400/40 hover:border-amber-400 transition cursor-pointer shadow-inner"
                >
                  <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-wider">
                    {roomCode}
                  </span>
                  <span className="p-1 rounded-lg bg-emerald-950/90 text-emerald-300 group-hover:text-white transition">
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </span>
                </button>
                {copiedCode && (
                  <span className="text-xs font-bold text-green-400 animate-fade-in">
                    已複製房號
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Share Link & Leave Room Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/40 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              <span>{copiedLink ? '邀請連結已複製' : '複製邀請網址'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isHost) {
                  if (window.confirm('確定要解散房間嗎？解散後所有玩家將返回首頁。')) {
                    onLeaveRoom();
                  }
                } else {
                  onLeaveRoom();
                }
              }}
              className="py-2.5 px-3.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <LogOut className="w-4 h-4" />
              <span>{isHost ? '解散房間' : '離開房間'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 1: TABLE SEATS COMPASS (Visualizing Opposite Teammates)*/}
        {/* ============================================================== */}
        <div className="my-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                牌桌席位配置
              </span>
              {is2v2 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 font-bold">
                  2V2 規則：南席與北席同隊（對座共享明牌）、西席與東席同隊
                </span>
              )}
            </div>

            {isHost && (
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                  swapSource !== null
                    ? 'bg-amber-500 text-black border-amber-300 animate-pulse'
                    : 'bg-[#05120a] text-emerald-300/80 border-emerald-500/25'
                }`}
              >
                {swapSource !== null
                  ? `已選取席位 #${swapSource + 1}，請點擊另一席位互換位置`
                  : '房主提示：點擊任兩個座位可交換出牌順序與隊友'}
              </span>
            )}
          </div>

          {/* 4-Seat Grid with Clear Positional & Team Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p, idx) => {
              const isSelectedForSwap = swapSource === idx;
              const isTeamA = is2v2 && idx % 2 === 0;
              const isTeamB = is2v2 && idx % 2 === 1;
              const seatMeta = SEAT_LABELS[idx] || { pos: `席位 ${idx + 1}`, dir: `SEAT ${idx + 1}` };
              const isHuman = !p.isAi && (p.peerId || p.isHost);

              return (
                <div
                  key={idx}
                  onClick={isHost ? () => handleSlotClickForSwap(idx) : undefined}
                  className={`relative flex items-center justify-between p-3.5 rounded-2xl transition border-2 ${
                    isSelectedForSwap
                      ? 'bg-amber-500/25 border-amber-300 ring-2 ring-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                      : isTeamA
                      ? 'bg-gradient-to-r from-amber-950/35 to-[#06150c] border-amber-500/45'
                      : isTeamB
                      ? 'bg-gradient-to-r from-sky-950/35 to-[#06150c] border-sky-500/45'
                      : 'bg-[#06150c] border-emerald-500/25'
                  } ${isHost ? 'cursor-pointer hover:border-amber-400/70' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Seat Avatar */}
                    <div
                      className={`relative w-11 h-11 rounded-xl flex items-center justify-center font-bold border-2 shrink-0 shadow-md ${
                        p.isHost
                          ? 'bg-amber-500/25 border-amber-300 text-amber-300'
                          : isHuman
                          ? 'bg-emerald-500/25 border-emerald-300 text-emerald-200'
                          : p.isAi
                          ? 'bg-slate-800/90 border-slate-500 text-slate-300'
                          : 'bg-emerald-950/50 border-dashed border-emerald-500/50 text-emerald-400'
                      }`}
                    >
                      {p.isHost ? (
                        <Crown className="w-5 h-5 text-amber-300" />
                      ) : p.isAi ? (
                        <Bot className="w-5 h-5" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                      <span className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 rounded-md bg-black border border-white/30 text-[10px] font-mono font-black text-white flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Player Name & Seat Position */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-extrabold text-emerald-400/80">
                          {seatMeta.pos}
                        </span>
                        {is2v2 && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                              isTeamA
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-sky-400/20 text-sky-300 border-sky-400/40'
                            }`}
                          >
                            {isTeamA ? '金隊 A' : '藍隊 B'}
                          </span>
                        )}
                      </div>

                      <div className="font-extrabold text-white text-sm flex items-center gap-1.5 mt-0.5">
                        <span className="truncate max-w-[130px]">{p.name}</span>
                        {p.isHost && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400 text-black font-black shrink-0">
                            房主
                          </span>
                        )}
                        {p.score > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-400/30 shrink-0">
                            {p.score}分
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-emerald-300/65">
                        {p.isAi
                          ? 'AI 電腦託管'
                          : isHuman
                          ? '真人玩家已就緒'
                          : '等待真人玩家加入...'}
                      </div>
                    </div>
                  </div>

                  {/* Host Seat Controls */}
                  {isHost && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!p.isHost && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundManager.playTick();
                            onToggleAi(idx);
                          }}
                          className={`text-[11px] py-1.5 px-2.5 rounded-xl font-extrabold border transition cursor-pointer ${
                            p.isAi
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                              : 'bg-amber-950/90 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                          }`}
                        >
                          {p.isAi ? '設為開放' : p.peerId ? '換成電腦' : '換成電腦'}
                        </button>
                      )}
                      {!p.isHost && !p.isAi && p.peerId && onKickPlayer && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`確定要將玩家【${p.name}】移出房間嗎？`)) {
                              soundManager.playPenalty();
                              onKickPlayer(idx);
                            }
                          }}
                          title="將該玩家踢出房間"
                          className="text-[11px] py-1.5 px-2.5 rounded-xl font-extrabold bg-red-950/90 hover:bg-red-900 text-red-300 border border-red-500/40 transition cursor-pointer"
                        >
                          踢除
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSlotClickForSwap(idx);
                        }}
                        title="與其他座位交換順序"
                        className={`p-2 rounded-xl border transition cursor-pointer ${
                          isSelectedForSwap
                            ? 'bg-amber-400 text-black border-white'
                            : 'bg-white/5 hover:bg-white/15 text-emerald-200 border-white/10'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: HOUSE RULES CONFIGURATION PANEL                     */}
        {/* ============================================================== */}
        <div className="my-5 p-4 sm:p-5 bg-[#05120a] border border-emerald-500/25 rounded-2xl space-y-4 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300 tracking-wider uppercase">
            <Settings2 className="w-4 h-4" />
            <span>牌局規則與 DLC 模式設定 {isHost ? '(房主可即時切換)' : '(由房主設定)'}</span>
          </div>

          {/* Row 0: Deck Theme / DLC Mode Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-emerald-500/15">
            <div>
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                卡牌主題與 DLC 擴充模式
              </span>
              <div className="text-[10px] text-emerald-300/70 mt-0.5">
                {deckTheme === 'rabbids'
                  ? '🐰 瘋狂兔子 DLC：包含 4 種特殊功能牌 (3秒限時快抽、定時炸彈+4、全員抽牌、兔兔盾牌反彈)'
                  : '🃏 經典現代版：Ubisoft 原版乾淨卡面與官方標準牌庫'}
              </div>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    if (onSetDeckTheme) onSetDeckTheme('classic');
                  }}
                  className={`py-1 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    deckTheme === 'classic'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                  }`}
                >
                  <span>🃏 經典現代</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    if (onSetDeckTheme) onSetDeckTheme('rabbids');
                  }}
                  className={`py-1 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    deckTheme === 'rabbids'
                      ? 'bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-lg shadow-pink-500/25 ring-2 ring-pink-300/50'
                      : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                  }`}
                >
                  <span>🐰 瘋狂兔子 DLC</span>
                </button>
              </div>
            ) : (
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                deckTheme === 'rabbids'
                  ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {deckTheme === 'rabbids' ? '🐰 瘋狂兔子 DLC 模式' : '🃏 經典現代模式'}
              </span>
            )}
          </div>

          {/* Row 1: Mode & Player Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3.5 border-b border-emerald-500/15">
            {/* Game Mode */}
            <div className="flex items-center justify-between bg-[#081c10] p-2.5 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                對戰模式
              </span>
              {isHost ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetGameMode('ffa');
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      !is2v2
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-emerald-300 hover:bg-white/5'
                    }`}
                  >
                    個人混戰
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetGameMode('2v2');
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      is2v2
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-emerald-300 hover:bg-white/5'
                    }`}
                  >
                    2V2 組隊
                  </button>
                </div>
              ) : (
                <span className="text-xs font-extrabold text-amber-400">
                  {is2v2 ? '2V2 雙人組隊' : '個人混戰'}
                </span>
              )}
            </div>

            {/* Player Count or 2v2 Fixed Count */}
            <div className="flex items-center justify-between bg-[#081c10] p-2.5 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                牌桌人數
              </span>
              {!is2v2 && isHost ? (
                <div className="flex items-center gap-1">
                  {[2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        soundManager.playTick();
                        onSetFfaCount(cnt);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold transition cursor-pointer ${
                        players.length === cnt
                          ? 'bg-amber-500 text-black shadow'
                          : 'text-emerald-300 hover:bg-white/5'
                      }`}
                    >
                      {cnt}人
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-extrabold text-amber-400">
                  {players.length} 人局 {is2v2 ? '(固定 2V2)' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Target Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-emerald-500/15">
            <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              賽制目標積分
            </span>
            {isHost ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '單局暢玩 (無積分)', value: 0 },
                  { label: '250 分', value: 250 },
                  { label: '500 分 (標準)', value: 500 },
                  { label: '1000 分', value: 1000 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetTargetScore(opt.value);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      targetScore === opt.value
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-extrabold text-amber-400">
                {targetScore > 0 ? `${targetScore} 分奪冠制` : '單局暢玩 (無積分)'}
              </span>
            )}
          </div>

          {/* Row 3: 3 Custom House Rules Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* Draw Rule */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                無牌可出時
              </span>
              {isHost ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetDrawRule('draw_one');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                      drawRule === 'draw_one'
                        ? 'bg-sky-500 text-black'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    抽1張
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetDrawRule('draw_until_playable');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                      drawRule === 'draw_until_playable'
                        ? 'bg-sky-500 text-black'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    抽到能出
                  </button>
                </div>
              ) : (
                <span className="font-extrabold text-sky-300">
                  {drawRule === 'draw_until_playable' ? '抽到能出' : '僅抽 1 張'}
                </span>
              )}
            </div>

            {/* Stacking Rule */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                +2 / +4 疊牌
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    onToggleStacking();
                  }}
                  className={`px-3 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                    allowStacking
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {allowStacking ? '允許疊加' : '禁止疊加'}
                </button>
              ) : (
                <span className="font-extrabold text-amber-400">
                  {allowStacking ? '允許疊加' : '禁止疊加'}
                </span>
              )}
            </div>

            {/* Challenge Wild Draw 4 Rule */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-300" />
                質疑違規 +4
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    onToggleChallengeRule();
                  }}
                  className={`px-3 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                    allowChallengeWildDraw4
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {allowChallengeWildDraw4 ? '啟用質疑' : '關閉質疑'}
                </button>
              ) : (
                <span className="font-extrabold text-amber-400">
                  {allowChallengeWildDraw4 ? '啟用質疑' : '關閉質疑'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* START GAME CTA                                                 */}
        {/* ============================================================== */}
        {isHost ? (
          <button
            type="button"
            onClick={() => {
              soundManager.playShuffle();
              onStartGame();
            }}
            className="w-full py-4 px-6 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-base sm:text-lg rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.35)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer border border-amber-200/60"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{is2v2 ? '發牌開局 (2V2 組隊戰)' : '發牌開局 (多人混戰)'}</span>
          </button>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-[#05120a] border border-emerald-500/30 text-center text-sm font-bold text-emerald-300 flex items-center justify-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>已就緒，等待房主發牌開局...</span>
          </div>
        )}
      </div>
    </div>
  );
}