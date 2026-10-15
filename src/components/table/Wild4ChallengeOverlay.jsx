// 檔案位置：src/components/table/Wild4ChallengeOverlay.jsx
// Steam UNO-Style +4 Challenge Hand Inspection & Verdict Overlay
import React from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';
import { CardView } from '../CardView';

export function Wild4ChallengeOverlay({
  wild4ChallengeAnim,
  myIndex,
  seatDirection = 'top', // 'top' | 'left' | 'right' | 'me'
  deckTheme = 'classic'
}) {
  if (!wild4ChallengeAnim) return null;

  const {
    challengerName,
    challengedId,
    challengedName,
    targetColorName,
    isSuccess,
    handCards = [],
    matchingCardIds = []
  } = wild4ChallengeAnim;

  const isMeChallenged = challengedId === myIndex || seatDirection === 'me';

  // 決定對手手牌輸送動畫 class (從該座位的方向飛到牌桌中央，結算後飛回)
  const transportClass =
    seatDirection === 'left'
      ? 'challenge-transport-left'
      : seatDirection === 'right'
      ? 'challenge-transport-right'
      : 'challenge-transport-top';

  if (isMeChallenged) {
    // 當本人被質疑時，畫面焦點留在底部本人的手牌區，中央跳出宣告旗標與大判決徽章
    return (
      <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between items-center py-16 px-4">
        {/* 上方宣告 Banner */}
        <div className="mt-8 px-5 py-2.5 rounded-2xl bg-black/85 border border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.5)] backdrop-blur-md flex items-center gap-2.5 animate-bounce">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <div className="text-center">
            <div className="text-amber-300 font-black text-sm tracking-wide">
              ⚖️ 你被【{challengerName}】發動質疑！
            </div>
            <div className="text-gray-300 text-xs">
              正在檢驗你打出 +4 當下手牌中是否有底色【{targetColorName}】...
            </div>
          </div>
        </div>

        {/* 手牌上方的大判決彈出徽章 */}
        <div className="mb-24 flex flex-col items-center gap-2 challenge-verdict-pop">
          {isSuccess ? (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-600 border-2 border-green-300 shadow-[0_0_40px_rgba(34,197,94,0.95)] flex items-center justify-center">
                <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[3.5]" />
              </div>
              <div className="px-5 py-2 rounded-xl bg-green-950/95 border border-green-400/80 shadow-2xl text-center">
                <div className="text-green-300 font-black text-sm sm:text-base tracking-wide">
                  ✓ 質疑成立！違規被抓到了！
                </div>
                <div className="text-green-200 text-xs mt-0.5">
                  你手牌藏有【{targetColorName}】牌，即將承受 4 張罰抽！
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 border-2 border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.95)] flex items-center justify-center">
                <X className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[3.5]" />
              </div>
              <div className="px-5 py-2 rounded-xl bg-red-950/95 border border-red-400/80 shadow-2xl text-center">
                <div className="text-red-300 font-black text-sm sm:text-base tracking-wide">
                  ✕ 質疑不成立！你是清白的！
                </div>
                <div className="text-red-200 text-xs mt-0.5">
                  手牌確實無【{targetColorName}】，【{challengerName}】將被加罰 2 張！
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 當對手被質疑時：手牌從對手座位滑入中央牌桌亮牌展示，並在結算後滑回原位
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
      {/* 頂部質疑標題 */}
      <div className="absolute top-16 px-6 py-2.5 rounded-2xl bg-black/85 border border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.5)] backdrop-blur-md flex items-center gap-3 animate-fade-in">
        <ShieldAlert className="w-6 h-6 text-amber-400 animate-pulse" />
        <div className="text-center">
          <div className="text-amber-300 font-black text-sm sm:text-base tracking-wide">
            ⚖️ 【{challengerName}】質疑【{challengedName}】的 +4 合法性！
          </div>
          <div className="text-gray-300 text-xs mt-0.5">
            驗牌檢視【{challengedName}】出牌時是否藏有底色【{targetColorName}】...
          </div>
        </div>
      </div>

      {/* 中央被質疑者的手牌亮牌展示容器 */}
      <div className={`relative flex flex-col items-center justify-center ${transportClass}`}>
        <div className="px-4 py-1.5 rounded-full bg-slate-900/90 border border-white/20 text-yellow-300 font-bold text-xs tracking-wider mb-4 shadow-xl">
          【{challengedName}】出牌當下的手牌 ({handCards.length} 張)
        </div>

        {/* 手牌排列列：如果質疑失敗(無罪)，整副手牌左右劇烈搖晃；如果成功，同色牌抬高發綠光 */}
        <div
          className={`flex items-center justify-center -space-x-5 sm:-space-x-7 md:-space-x-8 overflow-visible px-8 py-6 ${
            !isSuccess ? 'challenge-hand-shake' : ''
          }`}
        >
          {handCards.map((card, idx) => {
            const isCulprit = matchingCardIds.includes(card.id);

            return (
              <div
                key={card.id || idx}
                className={`relative transition-all duration-300 ${
                  isCulprit ? 'challenge-card-lift z-30' : 'filter brightness-90 hover:brightness-100'
                }`}
              >
                {isCulprit && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-green-500 text-black text-[10px] font-black shadow-[0_0_12px_rgba(34,197,94,0.9)] animate-bounce z-40">
                    違規同色
                  </div>
                )}
                <CardView
                  card={card}
                  deckTheme={deckTheme}
                  className={
                    isCulprit
                      ? 'shadow-[0_0_30px_rgba(34,197,94,0.95)] ring-2 ring-green-400 scale-105'
                      : 'shadow-2xl'
                  }
                />
              </div>
            );
          })}
        </div>

        {/* 中央判決跳出大徽章 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 challenge-verdict-pop flex flex-col items-center">
          {isSuccess ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-600 border-4 border-green-300 shadow-[0_0_50px_rgba(34,197,94,1)] flex items-center justify-center">
                <Check className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[4]" />
              </div>
              <div className="px-6 py-2.5 rounded-2xl bg-black/90 border-2 border-green-400 shadow-[0_0_35px_rgba(34,197,94,0.7)] text-center">
                <div className="text-green-300 font-black text-base sm:text-lg tracking-wider">
                  ✓ 質疑成功！抓到了！
                </div>
                <div className="text-white text-xs sm:text-sm mt-0.5 font-bold">
                  【{challengedName}】違規出牌！將被罰抽 4 張！
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-600 border-4 border-red-300 shadow-[0_0_50px_rgba(239,68,68,1)] flex items-center justify-center">
                <X className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[4]" />
              </div>
              <div className="px-6 py-2.5 rounded-2xl bg-black/90 border-2 border-red-400 shadow-[0_0_35px_rgba(239,68,68,0.7)] text-center">
                <div className="text-red-300 font-black text-base sm:text-lg tracking-wider">
                  ✕ 質疑失敗！對方無罪！
                </div>
                <div className="text-white text-xs sm:text-sm mt-0.5 font-bold">
                  【{challengerName}】承受罰抽並加罰 2 張！
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Wild4ChallengeOverlay;
