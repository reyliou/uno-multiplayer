// 檔案位置：src/components/CardView.jsx
// 3D Modern UNO & Rabbids DLC Card Renderer with Auto-Reset & Retry on Slow Networks
import React, { useState, useEffect } from 'react';

export function CardView({
  card,
  isPlayable = false,
  isSmall = false,
  isBack = false,
  isTopCard = false,
  deckTheme = 'classic',
  onClick,
  style = {},
  className = ''
}) {
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  let assetKey = 'card_back';
  const isExplicitBack = isBack || card?.value === 'card_back' || card?.assetKey === 'card_back';

  if (!isExplicitBack && card) {
    if (card.color === 'wild') {
      if (isTopCard && card.chosenColor) {
        if (card.value === 'wild_draw4') {
          assetKey = `wild_draw4_${card.chosenColor}`;
        } else if (card.value === 'rabbids_wild_shield') {
          assetKey = `rabbids_wild_shield_${card.chosenColor}`;
        } else if (card.value.startsWith('rabbids_')) {
          assetKey = card.assetKey;
        } else {
          assetKey = `wild_${card.chosenColor}`;
        }
      } else {
        if (card.value === 'wild_draw4') {
          assetKey = 'wild_draw4';
        } else if (card.value.startsWith('rabbids_')) {
          assetKey = card.assetKey;
        } else {
          assetKey = 'wild';
        }
      }
    } else {
      assetKey = card.displayAssetKey || card.assetKey || 'card_back';
    }
  }

  const effectiveTheme = (deckTheme === 'rabbids' || card?.deckTheme === 'rabbids') ? 'cards_rabbids' : 'cards_modern';
  const baseImgSrc = `/${effectiveTheme}/${assetKey}.png`;
  const imgSrc = retryCount > 0 ? `${baseImgSrc}?retry=${retryCount}` : baseImgSrc;

  // Reset error state whenever the card image URL changes
  useEffect(() => {
    setImgError(false);
    setRetryCount(0);
  }, [baseImgSrc]);

  const handleImageError = () => {
    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, 300);
    } else {
      setImgError(true);
    }
  };

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
          onError={handleImageError}
          className="w-full h-full object-contain pointer-events-none drop-shadow-md"
          loading="eager"
          decoding="sync"
        />
      ) : (
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
