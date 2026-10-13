// LobbyView.jsx - Multiplayer Lobby with 2v2 Team Alignment & Human/Bot Configuration
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
  Scale
} from 'lucide-react';

export function LobbyView({
  roomCode,
  isHost,
  players = [],
  gameMode = 'ffa',
  allowStacking,
  allowChallengeWildDraw4 = true,
  targetScore = 500,
  drawRule = 'draw_one',
  onToggleAi,
  onToggleStacking,
  onToggleChallengeRule,
  onSetTargetScore,
  onSetDrawRule,
  onSetGameMode,
  onSetFfaCount,
  onSwapSlots,
  onStartGame,
  onLeaveRoom
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [swapSource, setSwapSource] = useState(null);

  const inviteLink = `${window.location.origin}${window.location.pathname}#${roomCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSlotClickForSwap = (idx) => {
    if (!isHost) return;
    if (swapSource === null) {
      setSwapSource(idx);
    } else {
      onSwapSlots(swapSource, idx);
      setSwapSource(null);
    }
  };

  const is2v2 = gameMode === '2v2';

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0e2a1b]/95 border border-amber-500/30 rounded-2xl shadow-2xl p-5 sm:p-7 backdrop-blur-md">
        {/* Room Header & Share Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-emerald-500/20">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-1">
              房間代碼 (ROOM CODE)
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-3xl font-black text-amber-400 tracking-wider">
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="複製房號"
                className="p-1.5 px-2.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1 text-xs"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? '已複製' : '複製'}
              </button>
            </div>
          </div>

          {/* Invite Link Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition flex items-center justify-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <LinkIcon className="w-3.5 h-3.5" />}
              {copiedLink ? '已複製邀請連結！' : '複製好友邀請連結'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isHost) {
                  if (window.confirm('確定要解散房間嗎？解散後所有玩家將自動返回首頁。')) {
                    onLeaveRoom();
                  }
                } else {
                  onLeaveRoom();
                }
              }}
              title={isHost ? '解散房間' : '離開房間'}
              className="py-2 px-3 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-500/40 font-bold text-xs transition flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>{isHost ? '解散房間' : '離開房間'}</span>
            </button>
          </div>
        </div>

        {/* Mode & Rule Settings Panel */}
        <div className="my-5 p-4 bg-[#081a10] border border-emerald-500/25 rounded-2xl space-y-3.5">
          {/* Row 1: Game Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/15">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>對戰模式：</span>
              <span className="text-amber-400 font-extrabold">
                {is2v2 ? '2V2 雙人組隊戰' : `多人混戰 (${players.length}人局)`}
              </span>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetGameMode('ffa')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    !is2v2
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-emerald-950/80 text-emerald-300 hover:text-white border border-emerald-500/20'
                  }`}
                >
                  <Swords className="w-3 h-3" />
                  多人混戰
                </button>
                <button
                  type="button"
                  onClick={() => onSetGameMode('2v2')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    is2v2
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-emerald-950/80 text-emerald-300 hover:text-white border border-emerald-500/20'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  2V2 組隊
                </button>
              </div>
            ) : (
              <span className="text-xs text-emerald-400/80 font-mono">
                {is2v2 ? '隊伍對局模式' : '個人各自為戰'}
              </span>
            )}
          </div>

          {/* Row 2: Sub-settings (FFA Count or 2v2 banner) */}
          {!is2v2 && isHost && (
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/10 text-xs">
              <span className="text-emerald-300/80 font-medium">混戰人數設定：</span>
              <div className="flex items-center gap-1.5">
                {[2, 3, 4].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onSetFfaCount(cnt)}
                    className={`px-2.5 py-0.5 rounded font-mono font-bold transition ${
                      players.length === cnt
                        ? 'bg-amber-500 text-black'
                        : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/20'
                    }`}
                  >
                    {cnt} 人
                  </button>
                ))}
              </div>
            </div>
          )}

          {is2v2 && (
            <div className="text-[11px] text-amber-300/90 font-medium pb-2 border-b border-emerald-500/10">
              💡 <strong>2V2 規則：</strong>席位 0 & 2 為金隊（對面互為隊友），可即時看見隊友手牌；任一隊友出清即贏！
            </div>
          )}

          {/* Row 3: Target Score Setting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/10 text-xs">
            <div className="flex items-center gap-1 text-emerald-300/80">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>積分賽制目標：</span>
              <span className="text-amber-300 font-bold">
                {targetScore > 0 ? `${targetScore} 分完賽` : '無積分制 (暢玩)'}
              </span>
            </div>

            {isHost ? (
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: '無積分暢玩', value: 0 },
                  { label: '250分', value: 250 },
                  { label: '500分(標準)', value: 500 },
                  { label: '1000分', value: 1000 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetTargetScore(opt.value)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                      targetScore === opt.value
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="font-bold text-amber-400 font-mono">
                {targetScore > 0 ? `${targetScore} 分完賽` : '無積分暢玩'}
              </span>
            )}
          </div>

          {/* Row 4: Custom House Rules (抽牌規則 & 疊牌規則 & 質疑規則) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
            {/* Draw Rule */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
              <span className="text-emerald-300/80 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                抽牌規則：
              </span>
              {isHost ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSetDrawRule('draw_one')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      drawRule === 'draw_one'
                        ? 'bg-sky-500 text-white'
                        : 'bg-black/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    抽1張
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetDrawRule('draw_until_playable')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      drawRule === 'draw_until_playable'
                        ? 'bg-sky-500 text-white'
                        : 'bg-black/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    抽到能出
                  </button>
                </div>
              ) : (
                <span className="font-bold text-sky-300">
                  {drawRule === 'draw_until_playable' ? '抽到能出' : '抽 1 張'}
                </span>
              )}
            </div>

            {/* Stacking Rule */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
              <span className="text-emerald-300/80 flex items-center gap-1" title="+2疊+2、+4疊+4，不可混疊">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                +牌同類疊加：
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={onToggleStacking}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                    allowStacking
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {allowStacking ? '啟用' : '關閉'}
                </button>
              ) : (
                <span className="font-bold text-amber-400">
                  {allowStacking ? '啟用' : '關閉'}
                </span>
              )}
            </div>

            {/* Challenge Wild Draw 4 Rule */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
              <span className="text-emerald-300/80 flex items-center gap-1" title="出+4時若手中已有該色或該數字，可被下家質疑">
                <Scale className="w-3.5 h-3.5 text-amber-300" />
                質疑 +4 規則：
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={onToggleChallengeRule}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                    allowChallengeWildDraw4
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {allowChallengeWildDraw4 ? '啟用' : '關閉'}
                </button>
              ) : (
                <span className="font-bold text-amber-400">
                  {allowChallengeWildDraw4 ? '啟用' : '關閉'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Player Slots Grid */}
        <div className="my-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              席位名單 {isHost && <span className="text-emerald-400/60 font-normal">(點擊兩位可交換位置)</span>}
            </span>
            {swapSource !== null && (
              <span className="text-xs text-amber-300 animate-pulse font-bold">
                請點擊目標席位完成交換...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p, idx) => {
              const isSelectedForSwap = swapSource === idx;
              const isTeamA = is2v2 && idx % 2 === 0;
              const isTeamB = is2v2 && idx % 2 === 1;

              return (
                <div
                  key={idx}
                  onClick={isHost ? () => handleSlotClickForSwap(idx) : undefined}
                  className={`relative flex items-center justify-between p-3 rounded-xl transition border ${
                    isSelectedForSwap
                      ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400'
                      : isTeamA
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : isTeamB
                      ? 'bg-blue-950/20 border-blue-500/40'
                      : 'bg-[#081a10] border-emerald-500/20'
                  } ${isHost ? 'cursor-pointer hover:border-amber-400/60' : ''}`}
                >
                  {/* Slot Avatar & Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border ${
                        p.isHost
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : isTeamA
                          ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                          : isTeamB
                          ? 'bg-blue-500/15 border-blue-400 text-blue-300'
                          : p.isAi
                          ? 'bg-gray-800 border-gray-600 text-gray-400'
                          : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      }`}
                    >
                      {p.isHost ? (
                        <Crown className="w-4 h-4 text-amber-400" />
                      ) : p.isAi ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{p.name}</span>
                        {p.isHost && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            房主
                          </span>
                        )}
                        {p.score !== undefined && p.score > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold border border-amber-400/30">
                            ⭐ {p.score}分
                          </span>
                        )}
                      </div>

                      {/* Status / Team Tag */}
                      <div className="text-[11px] flex items-center gap-1.5">
                        {is2v2 && (
                          <span
                            className={`font-semibold text-[10px] px-1.5 rounded ${
                              isTeamA
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                            }`}
                          >
                            {isTeamA ? '👑 金隊 (隊友)' : '⚔️ 藍隊 (對手)'}
                          </span>
                        )}
                        <span className="text-emerald-400/70">
                          {p.isAi ? '電腦 Bot' : p.peerId || p.isHost ? '真人玩家' : '開放加入'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Slot Controls (Host Only) */}
                  {isHost && (
                    <div className="flex items-center gap-1">
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAi(idx);
                          }}
                          className={`text-[10px] py-1 px-2 rounded-lg font-semibold border transition ${
                            p.isAi
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/30 hover:bg-amber-900'
                          }`}
                        >
                          {p.isAi ? '開放真人' : '換成電腦'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSlotClickForSwap(idx);
                        }}
                        title="換位"
                        className="p-1 text-gray-400 hover:text-white"
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

        {/* Start Game CTA / Status */}
        {isHost ? (
          <button
            type="button"
            onClick={onStartGame}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-base rounded-xl shadow-xl shadow-amber-500/25 active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            {is2v2 ? '開始 2V2 組隊對局' : '開始多人對局'}
          </button>
        ) : (
          <div className="w-full py-3.5 px-6 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-center text-sm font-semibold text-emerald-300 flex items-center justify-center gap-2 animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            等待房主開始對局中...
          </div>
        )}
      </div>
    </div>
  );
}
