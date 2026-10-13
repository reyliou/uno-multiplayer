// animation.js - Flying Card Motion System for UNO Tabletop
import { soundManager } from './sound';

// Immediate browser preloading for card back asset
if (typeof window !== 'undefined') {
  const cardBackImg = new Image();
  cardBackImg.src = '/cards_modern/card_back.png';
}

class CardAnimationService {
  constructor() {
    this.isAnimating = false;
  }

  // Base flight animation between two screen rectangles
  animateFlight({
    fromRect,
    toRect,
    imgSrc,
    startRot = 0,
    endRot = 0,
    duration = 340,
    onComplete
  }) {
    if (!fromRect || !toRect) {
      if (onComplete) onComplete();
      return;
    }

    const flying = document.createElement('div');
    flying.className = 'flying-card';

    const startW = fromRect.width || 70;
    const startH = fromRect.height || 105;
    const endW = toRect.width || 80;
    const endH = toRect.height || 120;

    Object.assign(flying.style, {
      position: 'fixed',
      zIndex: '9999',
      pointerEvents: 'none',
      width: `${startW}px`,
      height: `${startH}px`,
      left: `${fromRect.left}px`,
      top: `${fromRect.top}px`,
      transform: `rotate(${startRot}deg) scale(1)`,
      transformOrigin: 'center center',
      willChange: 'transform, left, top, width, height',
      filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.6))'
    });

    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    flying.appendChild(img);

    document.body.appendChild(flying);

    // Force browser reflow
    void flying.offsetWidth;

    // Trigger smooth flight transition
    requestAnimationFrame(() => {
      Object.assign(flying.style, {
        transition: `all ${duration}ms cubic-bezier(0.22, 0.85, 0.32, 1.05)`,
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${endW}px`,
        height: `${endH}px`,
        transform: `rotate(${endRot}deg) scale(1.04)`
      });
    });

    setTimeout(() => {
      flying.remove();
      if (onComplete) onComplete();
    }, duration);
  }

  // Animate playing a card from a hand element to the discard pile
  animatePlayCard(fromEl, toEl, cardAssetKey, onComplete) {
    if (!fromEl || !toEl) {
      soundManager.playCard();
      if (onComplete) onComplete();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const imgSrc = `/cards_modern/${cardAssetKey}.png`;
    const randomTilt = Math.floor(Math.random() * 16) - 8;

    soundManager.playCard();

    this.animateFlight({
      fromRect,
      toRect,
      imgSrc,
      startRot: 0,
      endRot: randomTilt,
      duration: 320,
      onComplete: () => {
        toEl.classList.remove('impact-bounce');
        void toEl.offsetWidth;
        toEl.classList.add('impact-bounce');
        if (onComplete) onComplete();
      }
    });
  }

  // Animate drawing a card from the draw pile into a player's hand
  animateDrawCard(fromEl, toEl, cardAssetKey = 'card_back', onComplete) {
    if (!fromEl || !toEl) {
      soundManager.playDraw();
      if (onComplete) onComplete();
      return;
    }

    fromEl.classList.add('scale-95');
    setTimeout(() => fromEl.classList.remove('scale-95'), 150);

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const imgSrc = `/cards_modern/${cardAssetKey}.png`;

    soundManager.playDraw();

    this.animateFlight({
      fromRect,
      toRect,
      imgSrc,
      startRot: 0,
      endRot: 0,
      duration: 300,
      onComplete
    });
  }

  // Animate multi-draw cascade (for +2, +4, +6 penalties)
  animateMultiDraw(fromEl, toEl, count, onComplete) {
    const actualCount = Math.min(count, 8);
    let drawn = 0;
    const interval = setInterval(() => {
      this.animateDrawCard(fromEl, toEl, 'card_back');
      drawn++;
      if (drawn >= actualCount) {
        clearInterval(interval);
        if (onComplete) setTimeout(onComplete, 320);
      }
    }, 180);
  }

  // Opening deal: deal a card to each active seat just like drawing a card
  animateOpeningDeal({
    drawPileEl,
    seatElements,
    discardPileEl,
    firstCardKey = 'card_back',
    onComplete
  }) {
    if (!drawPileEl || !seatElements || seatElements.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const seats = seatElements.filter(Boolean);
    if (seats.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    // Deal one card to each seat sequentially (staggered 140ms apart)
    seats.forEach((seatEl, i) => {
      setTimeout(() => {
        try {
          this.animateDrawCard(drawPileEl, seatEl, 'card_back');
        } catch {
          // ignore error
        }
      }, i * 140);
    });

    // After players receive cards, flip the top card to discard pile
    const finishDelay = seats.length * 140 + 80;
    setTimeout(() => {
      try {
        if (drawPileEl && discardPileEl) {
          this.animatePlayCard(drawPileEl, discardPileEl, firstCardKey, () => {
            if (onComplete) onComplete();
          });
        } else {
          if (onComplete) onComplete();
        }
      } catch {
        if (onComplete) onComplete();
      }
    }, finishDelay);
  }
}

export const cardAnimationService = new CardAnimationService();
