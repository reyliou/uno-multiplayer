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

    // Ensure flyer dimensions are card-sized, never blown up or collapsed
    const cardW = (fromRect.width > 30 && fromRect.width < 200) ? fromRect.width : 84;
    const cardH = (fromRect.height > 40 && fromRect.height < 300) ? fromRect.height : 126;
    const startLeft = fromRect.left + (fromRect.width - cardW) / 2;
    const startTop = fromRect.top + (fromRect.height - cardH) / 2;

    const flyer = document.createElement('div');
    flyer.className = 'fixed pointer-events-none z-[9999] select-none';
    flyer.style.width = `${cardW}px`;
    flyer.style.height = `${cardH}px`;
    flyer.style.left = `${startLeft}px`;
    flyer.style.top = `${startTop}px`;
    flyer.style.transformOrigin = 'center center';
    flyer.style.transform = `translate3d(0, 0, 0) rotate(${startRotation}deg) scale(${startScale})`;
    flyer.style.transition = `all ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]';
    flyer.appendChild(img);
    document.body.appendChild(flyer);

    // Translate to center of destination element
    const deltaX = toRect.left + (toRect.width - cardW) / 2 - startLeft;
    const deltaY = toRect.top + (toRect.height - cardH) / 2 - startTop;

    // Only apply width-based scale factor if toRect is a single card element (width between 40px and 130px).
    // If toRect is an entire player container/hand bar (> 130px), keep standard card scale to prevent huge bloated cards!
    let scaleFactor = endScale;
    if (toRect.width >= 40 && toRect.width <= 130 && cardW > 0) {
      const ratio = toRect.width / cardW;
      if (ratio >= 0.5 && ratio <= 1.35) {
        scaleFactor = ratio * endScale;
      }
    }

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
