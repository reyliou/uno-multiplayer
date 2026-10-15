// 檔案位置：src/components/table/OpponentHand3D.jsx
import React from 'react';
import { CardView } from '../CardView';

export function OpponentHand3D({
  count = 1,
  side = 'top',
  deckTheme = 'classic',
  isTeammateTop = false,
  teammateHand = []
}) {
  if (side === 'top' && isTeammateTop) {
    return (
      <div className="flex items-center -space-x-3 sm:-space-x-4 card-reflection">
        {teammateHand.map((c, cIdx) => (
          <div
            key={c.id || cIdx}
            className="transition-transform duration-150 hover:-translate-y-2 hover:scale-110 hover:z-30 cursor-pointer"
            title={`隊友手牌: ${c.color} ${c.value}`}
          >
            <CardView
              deckTheme={deckTheme}
              card={c}
              isSmall
              className="!w-[64px] !h-[96px] sm:!w-[74px] sm:!h-[110px] !rounded-lg drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
            />
          </div>
        ))}
      </div>
    );
  }

  const cardCount = typeof count === 'number' ? count : 1;
  const visualCount = Math.min(Math.max(cardCount, 1), 7);

  if (side === 'left') {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: '180px', height: '210px' }}
      >
        {Array.from({ length: visualCount }).map((_, idx) => {
          const offset = idx - (visualCount - 1) / 2;
          const tx = -offset * 14;
          const ty = offset * 20;
          const depthScale = 0.96 + (offset / Math.max(visualCount, 1)) * 0.18;

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                transform: `translate(${tx}px, ${ty}px) perspective(520px) rotateY(42deg) rotateX(6deg) rotateZ(-8deg) scale(${depthScale})`,
                transformStyle: 'preserve-3d',
                zIndex: idx + 1
              }}
              className="transition-all duration-200 drop-shadow-[-8px_10px_14px_rgba(0,0,0,0.8)] card-reflection"
            >
              <CardView
                deckTheme={deckTheme}
                isBack
                isSmall
                className="!w-[72px] !h-[108px] sm:!w-[84px] sm:!h-[126px] !rounded-xl"
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (side === 'right') {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: '180px', height: '210px' }}
      >
        {Array.from({ length: visualCount }).map((_, idx) => {
          const offset = idx - (visualCount - 1) / 2;
          const tx = offset * 14;
          const ty = offset * 20;
          const depthScale = 0.96 + (offset / Math.max(visualCount, 1)) * 0.18;

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                transform: `translate(${tx}px, ${ty}px) perspective(520px) rotateY(-42deg) rotateX(6deg) rotateZ(8deg) scale(${depthScale})`,
                transformStyle: 'preserve-3d',
                zIndex: idx + 1
              }}
              className="transition-all duration-200 drop-shadow-[8px_10px_14px_rgba(0,0,0,0.8)] card-reflection"
            >
              <CardView
                deckTheme={deckTheme}
                isBack
                isSmall
                className="!w-[72px] !h-[108px] sm:!w-[84px] sm:!h-[126px] !rounded-xl"
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center -space-x-4 sm:-space-x-5 card-reflection">
      {Array.from({ length: visualCount }).map((_, idx) => (
        <div
          key={idx}
          className="transition-transform duration-150 drop-shadow-[0_8px_14px_rgba(0,0,0,0.7)]"
        >
          <CardView
            deckTheme={deckTheme}
            isBack
            isSmall
            className="!w-[64px] !h-[96px] sm:!w-[74px] sm:!h-[110px] !rounded-lg"
          />
        </div>
      ))}
    </div>
  );
}
