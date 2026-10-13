// CardView.jsx - 3D Modern UNO Card Renderer
import React, { useState } from 'react';

export function CardView({
  card,
  isPlayable = false,
  isSmall = false,
  isBack = false,
  isTopCard = false,
  onClick,
  style = {},
  className = ''
}) {
  const [imgError, setImgError] = useState(false);

  let assetKey = 'card_back';
  if (!isBack && card) {
    if (card.color === 'wild') {
      // In hand, Wild cards MUST ALWAYS be pristine uncolored (wild or wild_draw4)!
      // ONLY the active topCard on the table's discard pile shows the chosen color variant.
      if (isTopCard && card.chosenColor) {
        assetKey = card.value === 'wild_draw4' ? `wild_draw4_${card.chosenColor}` : `wild_${card.chosenColor}`;
      } else {
        assetKey = card.value === 'wild_draw4' ? 'wild_draw4' : 'wild';
      }
    } else {
      assetKey = card.displayAssetKey || card.assetKey || 'card_back';
    }
  }

  const imgSrc = `/cards_modern/${assetKey}.png`;

  const sizeClasses = isSmall
    ? 'w-10 h-14 sm:w-12 sm:h-16 rounded-md'
    : 'w-20 h-30 sm:w-24 sm:h-36 md:w-28 md:h-42 rounded-xl';

  const playableClasses = isPlayable
    ? 'ring-2 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.6)] -translate-y-2.5'
    : '';

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative select-none transition-all duration-200 transform-gpu ${sizeClasses} ${playableClasses} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {!imgError ? (
        <img
          src={imgSrc}
          alt={assetKey}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain pointer-events-none drop-shadow-md"
          loading="eager"
        />
      ) : (
        // Fallback CSS card in case of unexpected image issue
        <div
          className={`w-full h-full flex flex-col items-center justify-center font-bold text-white border-2 border-white/20 ${sizeClasses}`}
          style={{
            backgroundColor:
              card?.color === 'red' ? '#ef4444' :
              card?.color === 'blue' ? '#3b82f6' :
              card?.color === 'green' ? '#22c55e' :
              card?.color === 'yellow' ? '#eab308' : '#1f2937'
          }}
        >
          <span className="text-sm sm:text-base">{card?.value || 'UNO'}</span>
        </div>
      )}
    </div>
  );
}
