// VictoryModal.jsx - Victory Celebration Modal with Multi-round Match Scoring & Lobby Return
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Crown, ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';

export function VictoryModal({
  winner,
  isHost,
  players = [],
  targetScore = 500,
  isMatchOver = false,
  matchWinner = null,
  lastRoundPoints = 0,
  onNextRound,
  onReturnToLobby,
  onRestart,
  onLeave
}) {
  useEffect(() => {
    try {
      const duration = 2.8 * 1000;
      const animationEnd = Date.now() + duration;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        confetti({
          startVelocity: 35,
          spread: 360,
          ticks: 70,
          origin: { x: Math.random(), y: Math.random() - 0.2 }
        });
      }, 250);
      return () => clearInterval(interval);
    } catch {
      // Confetti fallback
    }
  }, [isMatchOver]);

  const is2v2Win = !!winner?.teamName;
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0e2a1b] border-2 border-amber-400 rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Trophy Avatar */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_30px_rgba(244,196,48,0.4)]">
          {isMatchOver ? (
            <Crown className="w-9 h-9 sm:w-11 sm:h-11 text-amber-300 animate-bounce" />
          ) : (
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-300 animate-bounce" />
          )}
        </div>

        {/* Title Header */}
        <div className="text-xs uppercase tracking-widest text-amber-300 font-extrabold mb-1">
          {isMatchOver
            ? '🏆 賽事總冠軍誕生 (MATCH CHAMPION)'
            : is2v2Win
            ? '2V2 雙人隊伍本局獲勝'
            : '本局對戰結束 (ROUND COMPLETE)'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {isMatchOver
            ? `🎉 【${matchWinner?.teamName || matchWinner?.name}】奪得總冠軍！`
            : is2v2Win
            ? `🎉 【${winner.teamName}】本局獲勝！`
            : winner
            ? `🎉 【${winner.name}】本局獲勝！`
            : '遊戲結束！'}
        </h2>

        <p className="text-xs sm:text-sm text-emerald-300/80 mb-5">
          {isMatchOver
            ? `累計積分達到 ${matchWinner?.score} 分（賽事目標 ${targetScore} 分），登頂總冠軍榮耀！`
            : `率先出清手牌，本局斬獲 +${lastRoundPoints || 0} 結算積分！`}
        </p>

        {/* Match Leaderboard & Score Progress */}
        <div className="bg-[#081a10] border border-emerald-500/20 rounded-2xl p-3.5 mb-6 text-left">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400/90 mb-2 px-1">
            <span>賽事累計積分榜 (LEADERBOARD)</span>
            {targetScore > 0 && <span>目標：{targetScore} 分</span>}
          </div>

          <div className="divide-y divide-emerald-500/10">
            {sortedPlayers.map((p, idx) => {
              const isRoundWinner = is2v2Win ? p.teamId === winner?.teamId : winner && p.id === winner.id;
              const isGrandChampion = isMatchOver && (p.id === matchWinner?.id || (matchWinner?.teamId && p.teamId === matchWinner.teamId));
              const progressPct = targetScore > 0 ? Math.min(100, Math.round(((p.score || 0) / targetScore) * 100)) : 0;

              return (
                <div key={p.id} className="py-2.5 px-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-emerald-400/60 font-bold">#{idx + 1}</span>
                      <span className={`font-bold flex items-center gap-1.5 ${isGrandChampion ? 'text-amber-300' : isRoundWinner ? 'text-emerald-200' : 'text-gray-300'}`}>
                        <span>{p.name}</span>
                        {p.teamName && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-gray-300">
                            {p.teamName.slice(0, 2)}
                          </span>
                        )}
                        {isGrandChampion ? '👑' : isRoundWinner ? '✨' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400">
                        剩 {p.cardCount} 張牌
                      </span>
                      <span className="font-mono text-amber-400 font-extrabold text-sm">
                        {p.score || 0} 分
                      </span>
                    </div>
                  </div>

                  {/* Score Progress Bar (Only when targetScore > 0) */}
                  {targetScore > 0 && (
                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-emerald-500/20">
                      <div
                        className={`h-full transition-all duration-700 rounded-full ${
                          isGrandChampion
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isHost ? (
            <>
              {isMatchOver ? (
                <>
                  <button
                    type="button"
                    onClick={onReturnToLobby}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    結算回傳大廳
                  </button>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="py-3 px-4 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-300" />
                    新賽事重開
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onNextRound}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    進行下一局 (Next Round)
                  </button>
                  <button
                    type="button"
                    onClick={onReturnToLobby}
                    className="py-3 px-4 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    回大廳結算
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 py-3 px-4 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
              等待房主開啟下一局或返回大廳...
            </div>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="py-3 px-4 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}
