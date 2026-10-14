// animation.js - Flying Card Motion System for UNO Tabletop (Supports Classic & Rabbids DLC Assets)
import { soundManager } from './sound';

// Immediate browser preloading for card back assets
if (typeof window !== 'undefined') {
  const classicBackImg = new Image();
  classicBackImg.src = '/cards_modern/card_back.png';
  const rabbidsBackImg = new Image();
  rabbidsBackImg.src = '/cards_rabbids/card_back.png';
}

class CardAnimationService {
  constructor() {
    this.isAnimating = false;
    this.deckTheme = 'classic'; // 'classic' | 'rabbids'
  }

  setDeckTheme(theme) {
    this.deckTheme = theme === 'rabbids' ? 'rabbids' : 'classic';
  }

  resolveCardImgSrc(cardAssetKey = 'card_back') {
    const folder = (this.deckTheme === 'rabbids' || String(cardAssetKey).startsWith('rabbids_'))
      ? 'cards_rabbids'
      : 'cards_modern';
    return `/${folder}/${cardAssetKey}.png`;
  }

  // Base flight animation between two screen rectangles
  animateFly({
    fromRect,
    toRect,
    imgSrc,
    startRotation = 0,
    endRotation = 0,
    startScale = 1,
    endScale = 1,
    duration = 450,
    onComplete
  }) {
    if (!fromRect || !toRect) {
      if (onComplete) onComplete();
      return;
    }

    const flyer = document.createElement('div');
    flyer.className = 'fixed pointer-events-none z-[9999] select-none';
    flyer.style.width = `${fromRect.width}px`;
    flyer.style.height = `${fromRect.height}px`;
    flyer.style.left = `${fromRect.left}px`;
    flyer.style.top = `${fromRect.top}px`;
    flyer.style.transformOrigin = 'center center';
    flyer.style.transform = `translate3d(0, 0, 0) rotate(${startRotation}deg) scale(${startScale})`;
    flyer.style.transition = `all ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]';
    flyer.appendChild(img);
    document.body.appendChild(flyer);

    const deltaX = toRect.left + (toRect.width - fromRect.width) / 2 - fromRect.left;
    const deltaY = toRect.top + (toRect.height - fromRect.height) / 2 - fromRect.top;
    const scaleFactor = toRect.width / fromRect.width * endScale;

    // Force reflow
    void flyer.offsetWidth;

    requestAnimationFrame(() => {
      flyer.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${endRotation}deg) scale(${scaleFactor})`;
    });

    setTimeout(() => {
      if (flyer.parentNode) {
        flyer.parentNode.removeChild(flyer);
      }
      if (onComplete) onComplete();
    }, duration + 50);
  }

  // Animate playing a card from a player's seat to the central discard pile
  animatePlayCard(fromEl, toEl, cardAssetKey = 'card_back', onComplete) {
    if (!fromEl || !toEl) {
      if (onComplete) onComplete();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const imgSrc = this.resolveCardImgSrc(cardAssetKey);
    const randomTilt = Math.floor(Math.random() * 16) - 8;

    soundManager.playCard();

    this.animateFly({
      fromRect,
      toRect,
      imgSrc,
      startRotation: 0,
      endRotation: randomTilt,
      startScale: 1,
      endScale: 1,
      duration: 380,
      onComplete
    });
  }

  // Animate drawing a card from the draw pile into a player's seat
  animateDrawCard(fromEl, toEl, cardAssetKey = 'card_back', onComplete) {
    if (!fromEl || !toEl) {
      if (onComplete) onComplete();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const imgSrc = this.resolveCardImgSrc(cardAssetKey);

    soundManager.playDraw();

    this.animateFly({
      fromRect,
      toRect,
      imgSrc,
      startRotation: 0,
      endRotation: 0,
      startScale: 0.95,
      endScale: 0.95,
      duration: 300,
      onComplete
    });
  }

  // Opening deal: deal a card to each active seat just like drawing a card
  animateDealToSeats(deckEl, seatEls = [], totalRounds = 7, onComplete) {
    if (!deckEl || !seatEls.length) {
      if (onComplete) onComplete();
      return;
    }

    let currentRound = 0;
    let currentSeatIdx = 0;
    const totalDeals = totalRounds * seatEls.length;
    let dealCount = 0;

    const dealInterval = setInterval(() => {
      const targetSeat = seatEls[currentSeatIdx];
      if (targetSeat && deckEl) {
        this.animateDrawCard(deckEl, targetSeat, 'card_back');
      }

      dealCount++;
      currentSeatIdx = (currentSeatIdx + 1) % seatEls.length;
      if (currentSeatIdx === 0) currentRound++;

      if (dealCount >= totalDeals) {
        clearInterval(dealInterval);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 350);
      }
    }, 70); // Rapid casino dealer rhythm (70ms per card)
  }

  // Opening deal: deal a card to each active seat sequentially and flip top card
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

  // Central Opening Card Flip: flip top card of draw pile over into the discard pile
  animateOpeningFlip(deckEl, discardEl, topCardAssetKey = 'card_back', onComplete) {
    if (!deckEl || !discardEl) {
      if (onComplete) onComplete();
      return;
    }

    const fromRect = deckEl.getBoundingClientRect();
    const toRect = discardEl.getBoundingClientRect();
    const imgSrc = this.resolveCardImgSrc(topCardAssetKey);
    const randomTilt = Math.floor(Math.random() * 12) - 6;

    soundManager.playCard();

    this.animateFly({
      fromRect,
      toRect,
      imgSrc,
      startRotation: 180,
      endRotation: randomTilt,
      startScale: 1,
      endScale: 1,
      duration: 480,
      onComplete
    });
  }
}

export const cardAnimationService = new CardAnimationService();
