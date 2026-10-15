// 檔案位置：src/components/table/PlayerInfoPill.jsx
import React from 'react';
import { RotateCw, UserMinus } from 'lucide-react';
import { TurnTimerCircle } from './TurnTimerCircle';

export function PlayerInfoPill({
  player,
  cardCount = 0,
  avatar = '👤',
  isTeammate = false,
  isLocal = false,
  isHost = false,
  isActiveTurn = false,
  isSkipped = false,
  isChoosingColor = false,
  isContinuousDrawing = false,
  drawingStepCount = 1,
  showTimer = false,
  turnStartTime = null,
  turnDuration = 15,
  timerPosition = 'right', // 'left' | 'right'
  onKickPlayer
}) {
  if (!player) return null;

  return (
    <div className="flex items-center gap-2">
      {showTimer && timerPosition === 'left' && (
        <TurnTimerCircle
          turnStartTime={turnStartTime}
          duration={turnDuration}
          isLocal={isLocal}
        />
      )}

      <div
        className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-xl backdrop-blur-md transition-all duration-200 ${
          isSkipped
            ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
            : isActiveTurn || isChoosingColor
            ? 'active-turn-ring scale-105'
            : 'bg-[#0a1c12]/95 border-white/20'
        }`}
      >
        <div className="w-7 h-7 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm shrink-0">
          {avatar}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1 max-w-[95px] truncate">
            {player.name}
            {isTeammate && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/40 shrink-0">
                隊友
              </span>
            )}
          </span>
          <span className="text-[10px] text-emerald-300 font-bold">
            {cardCount} 張牌
          </span>
        </div>

        {isSkipped && (
          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] shadow animate-bounce border border-yellow-300">
            {isLocal ? '你的回合被跳過！' : '跳過！'}
          </span>
        )}

        {player.calledUno && (
          <span className="px-2 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[10px] shadow animate-pulse">
            UNO!
          </span>
        )}

        {isChoosingColor ? (
          <span className="text-[10px] font-bold text-purple-300 animate-pulse">
            選色中
          </span>
        ) : isContinuousDrawing ? (
          <span className="text-[10px] font-bold text-sky-300 animate-pulse flex items-center gap-1">
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            抽牌中 ({drawingStepCount || 1})
          </span>
        ) : !isLocal && isActiveTurn && !isSkipped ? (
          <span className="text-[10px] font-bold text-yellow-300 animate-pulse">
            思考中
          </span>
        ) : null}

        {player.timeoutCount > 0 && !(isLocal && isHost) && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40"
            title="超時累積次數 (達 2 次將由 AI 接管)"
          >
            ⏰ {player.timeoutCount}/2
          </span>
        )}

        {isHost && !isLocal && !player.isHost && !player.isAi && onKickPlayer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`確定要將【${player.name}】移出牌局並轉由 AI 接管嗎？`)) {
                onKickPlayer(player.id);
              }
            }}
            title="踢除此玩家並轉由 AI 接管"
            className="p-1 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition shadow ml-1 cursor-pointer"
          >
            <UserMinus className="w-3 h-3" />
          </button>
        )}
      </div>

      {showTimer && timerPosition === 'right' && (
        <TurnTimerCircle
          turnStartTime={turnStartTime}
          duration={turnDuration}
          isLocal={isLocal}
        />
      )}
    </div>
  );
}
