// 檔案位置：src/components/table/Wild4ChallengeOverlay.jsx
// Clean Steam UNO-Style +4 Challenge Hand Inspection (Badge strictly ABOVE cards, zero text clutter)
import React from 'react';
import { Check, X } from 'lucide-react';
import { CardView } from '../CardView';

export function Wild4ChallengeOverlay({
  wild4ChallengeAnim,
  myIndex,
  seatDirection = 'top', // 'top' | 'left' | 'right' | 'me'
  deckTheme = 'classic'
}) {
  if (!wild4ChallengeAnim) return null;

  const {
    challengedId,
    isSuccess,
    handCards = [],
    matchingCardIds = []
  } = wild4ChallengeAnim;

  const isMeChallenged = challengedId === myIndex || seatDirection === 'me';

  const transportClass =
    seatDirection === 'left'
      ? 'challenge-transport-left'
      : seatDirection === 'right'
      ? 'challenge-transport-right'
      : 'challenge-transport-top';

  // 當本人被質疑時：不播放輸送動畫，僅在自己手牌的正上方（不擋住抬高的牌）彈出綠色勾勾或紅色叉叉
  if (isMeChallenged) {
    return (
      <div className="fixed inset-x-0 bottom-52 z-50 pointer-events-none flex flex-col items-center justify-center">
        <div className="challenge-verdict-pop">
          {isSuccess ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-600 border-4 border-green-200 shadow-[0_0_40px_rgba(34,197,94,0.95)] flex items-center justify-center">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[4]" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 border-4 border-red-200 shadow-[0_0_40px_rgba(239,68,68,0.95)] flex items-center justify-center">
              <X className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[4]" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 當對手被質疑時：手牌輸送至中央，勾勾/叉叉顯示在卡牌「正上方」，完全不遮擋手牌
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className={`relative flex flex-col items-center justify-center ${transportClass}`}>
        {/* 卡牌正上方的勾勾 / 叉叉徽章（預留 mb-6 空間讓下方違規牌向上抬高時也不會撞到） */}
        <div className="mb-6 z-50 challenge-verdict-pop flex items-center justify-center">
          {isSuccess ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-600 border-4 border-green-200 shadow-[0_0_45px_rgba(34,197,94,1)] flex items-center justify-center">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[4]" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 border-4 border-red-200 shadow-[0_0_45px_rgba(239,68,68,1)] flex items-center justify-center">
              <X className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[4]" />
            </div>
          )}
        </div>

        {/* 手牌排列列：質疑失敗時左右搖晃；質疑成功時違規同色牌向上抬高 */}
        <div
          className={`flex items-center justify-center -space-x-5 sm:-space-x-7 md:-space-x-8 overflow-visible px-6 py-4 ${
            !isSuccess ? 'challenge-hand-shake' : ''
          }`}
        >
          {handCards.map((card, idx) => {
            const isCulprit = matchingCardIds.includes(card.id);

            return (
              <div
                key={card.id || idx}
                className={`relative transition-all duration-300 ${
                  isCulprit ? 'challenge-card-lift z-30' : 'filter brightness-90'
                }`}
              >
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
      </div>
    </div>
  );
}

export default Wild4ChallengeOverlay;
