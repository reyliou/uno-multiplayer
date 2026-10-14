// GameTableView.jsx - Classic Casino Felt Table Layout (Reverted & Polished to 1:1 match 螢幕擷取畫面 2026-10-13 150340.png)
import React, { useState, useRef, useEffect } from 'react';
import { CardView } from './CardView';
import {
  Volume2,
  VolumeX,
  History,
  RotateCw,
  RotateCcw,
  AlertTriangle,
  Flame,
  X,
  Check,
  UserCheck,
  Swords,
  Sparkles,
  LogOut
} from 'lucide-react';
import { soundManager } from '../services/sound';
import { cardAnimationService } from '../services/animation';

const colorOrder = { red: 1, yellow: 2, green: 3, blue: 4, wild: 5 };
const valueOrder = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'draw2': 10, 'skip': 11, 'reverse': 12,
  'wild': 13, 'wild_draw4': 14
};

function sortHandCards(cards) {
  return [...cards].sort((a, b) => {
    const colA = colorOrder[a.color] || 99;
    const colB = colorOrder[b.color] || 99;
    if (colA !== colB) return colA - colB;
    const valA = valueOrder[a.value] !== undefined ? valueOrder[a.value] : 99;
    const valB = valueOrder[b.value] !== undefined ? valueOrder[b.value] : 99;
    return valA - valB;
  });
}

// Circular Countdown Timer (15s decreasing radial ring next to character info card)
function TurnTimerCircle({ turnStartTime, duration = 15, isLocal = false }) {
  const [remaining, setRemaining] = useState(duration);
  const prevTickRef = useRef(null);

  useEffect(() => {
    const startTime = turnStartTime || Date.now();
    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);

      if (isLocal && rem > 0 && rem <= 3) {
        const sec = Math.ceil(rem);
        if (prevTickRef.current !== sec) {
          prevTickRef.current = sec;
          soundManager.playTick();
        }
      }
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [turnStartTime, duration, isLocal]);

  const progress = Math.min(1, Math.max(0, remaining / duration));
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  const isLow = remaining <= 5;
  const isCritical = remaining <= 2;
  const strokeColor = isCritical ? '#ef4444' : (isLow ? '#f59e0b' : '#10b981');

  return (
    <div
      className={`relative flex items-center justify-center transition-all select-none ${
        isCritical ? 'animate-pulse scale-105' : ''
      }`}
      title={`思考限時 ${duration} 秒（剩餘 ${Math.ceil(remaining)} 秒）`}
    >
      <svg className="w-8 h-8 sm:w-8.5 sm:h-8.5 -rotate-90 drop-shadow-md" viewBox="0 0 34 34">
        {/* Background track */}
        <circle
          cx="17"
          cy="17"
          r={r}
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="3.2"
          fill="rgba(10, 28, 18, 0.85)"
        />
        {/* Animated depleting ring */}
        <circle
          cx="17"
          cy="17"
          r={r}
          stroke={strokeColor}
          strokeWidth="3.2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 250ms ease' }}
        />
      </svg>
      {/* Centered remaining seconds */}
      <span
        className={`absolute text-[11px] font-black tracking-tighter ${
          isCritical ? 'text-red-400 font-extrabold' : (isLow ? 'text-amber-300' : 'text-emerald-300')
        }`}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}

export function GameTableView({
  gameState,
  onPlayCard,
  onChooseColor,
  onDrawCard,
  onPassTurn,
  onCallUno,
  onChallengeUno,
  onChallengeWildDraw4,
  isHost = false,
  onLeaveRoom,
  roomCode
}) {
  const [muted, setMuted] = useState(false);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Hand Fan & Sort Animation States
  const [isHandCollapsed, setIsHandCollapsed] = useState(false);
  const [isSorted, setIsSorted] = useState(true);
  const [skippedPlayerInfo, setSkippedPlayerInfo] = useState(null);
  const hasDealtRef = useRef(false);
  const prevActionTimeRef = useRef(0);

  // Refs for flight animations
  const drawPileRef = useRef(null);
  const discardPileRef = useRef(null);
  const myHandRef = useRef(null);
  const leftPlayerRef = useRef(null);
  const topPlayerRef = useRef(null);
  const rightPlayerRef = useRef(null);

  // Tracking refs to detect remote / bot actions for flight animations
  const prevTopCardRef = useRef(null);
  const prevHandCountsRef = useRef({});

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const {
    gameMode = 'ffa',
    myIndex = 0,
    teammateIndex,
    teammateHand = [],
    players = [],
    myHand = [],
    validCards = [],
    topCard,
    recentDiscardPile = [],
    currentColor = 'red',
    direction = 1,
    currentTurn = 0,
    stackedDrawCount = 0,
    hasDrawnThisTurn: remoteHasDrawn = false,
    targetScore = 500,
    drawRule = 'draw_one',
    isMatchOver = false,
    matchWinner = null,
    lastRoundPoints = 0,
    drawPileCount = 80,
    log = [],
    isContinuousDrawing = false,
    drawingPlayerIndex = null,
    drawingStepCount = 0,
    isDealing = false,
    turnStartTime = null,
    turnDuration = 15,
    isChoosingColor = false,
    colorChoosingPlayerIndex = null,
    pendingWildCard = null,
    canChallengeWildDraw4 = false,
    lastWildDraw4PlayerName = null
  } = gameState || {};

  const is2v2 = gameMode === '2v2';
  const isMyTurn = currentTurn === myIndex;

  // Visually synchronized hand cards & opponent counts (cards only enter hand upon landing!)
  const [displayedHand, setDisplayedHand] = useState(myHand);
  const [displayedCounts, setDisplayedCounts] = useState({});
  const initialSyncRef = useRef(false);
  const inflightCardIdsRef = useRef(new Set());
  const inflightOpponentCountsRef = useRef({});

  useEffect(() => {
    if (!initialSyncRef.current && myHand && myHand.length > 0) {
      initialSyncRef.current = true;
      setDisplayedHand(myHand);
      const counts = {};
      players.forEach(p => { counts[p.id] = p.cardCount; });
      setDisplayedCounts(counts);
    }
  }, [myHand, players]);

  useEffect(() => {
    if (gameState?.gameStatus === 'game_over') {
      setDisplayedHand(myHand);
      const counts = {};
      players.forEach(p => { counts[p.id] = p.cardCount; });
      setDisplayedCounts(counts);
    }
  }, [gameState?.gameStatus]);

  const myPlayer = players[myIndex] || { name: '你 (玩家)', cardCount: displayedHand.length };

  // Helper to render fanned opponent card backs based on card count
  const renderOpponentCards = (count, direction = 'horizontal') => {
    const cardCount = typeof count === 'number' ? count : 1;
    const visualCount = Math.min(Math.max(cardCount, 1), 6);
    if (direction === 'vertical') {
      return (
        <div className="flex flex-col items-center -space-y-6 sm:-space-y-7 card-reflection">
          {Array.from({ length: visualCount }).map((_, idx) => (
            <div
              key={idx}
              className="transition-transform duration-150 drop-shadow-md"
              style={{
                transform: `rotate(${(idx - (visualCount - 1) / 2) * 3}deg)`
              }}
            >
              <CardView isBack isSmall />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex items-center -space-x-4 sm:-space-x-5 card-reflection">
        {Array.from({ length: visualCount }).map((_, idx) => (
          <div
            key={idx}
            className="transition-transform duration-150 drop-shadow-md"
            style={{
              transform: `rotate(${(idx - (visualCount - 1) / 2) * 4}deg) translateY(${Math.abs(idx - (visualCount - 1) / 2) * 1.5}px)`
            }}
          >
            <CardView isBack isSmall />
          </div>
        ))}
      </div>
    );
  };

  // Turn-based state for contextual actions
  const [localHasDrawn, setLocalHasDrawn] = useState(false);
  const hasDrawnThisTurn = isMyTurn && (localHasDrawn || remoteHasDrawn);

  // Reset local hasDrawn state on turn change
  useEffect(() => {
    setLocalHasDrawn(false);
  }, [currentTurn]);

  // Auto penalty draw when facing +2/+4 penalty without matching stack cards (guarded against +4 challenge phase)
  const autoPenaltyTimerRef = useRef(null);

  useEffect(() => {
    if (isMyTurn && !isDealing && stackedDrawCount > 0 && validCards.length === 0 && !canChallengeWildDraw4) {
      showToast(`💥 無對應牌可疊！自動承受累積罰抽【+${stackedDrawCount} 張】...`);
      autoPenaltyTimerRef.current = setTimeout(() => {
        handleDrawWithAnimation();
      }, 750);
      return () => {
        if (autoPenaltyTimerRef.current) {
          clearTimeout(autoPenaltyTimerRef.current);
          autoPenaltyTimerRef.current = null;
        }
      };
    }
  }, [isMyTurn, isDealing, stackedDrawCount, validCards.length, canChallengeWildDraw4]);

  // Calculate Seats (Top, Left, Right)
  const totalP = players.length;
  // Clockwise (順時針): Turn advances to your LEFT (下家: +1), Teammate/Opposite (+2) is TOP, Previous (+3) is RIGHT (上家)
  const leftSeatIdx = totalP === 4 ? (myIndex + 1) % 4 : (totalP === 3 ? (myIndex + 1) % 3 : null);
  const topSeatIdx = totalP === 4 ? (myIndex + 2) % 4 : (totalP === 3 ? (myIndex + 2) % 3 : (totalP === 2 ? (myIndex + 1) % 2 : null));
  const rightSeatIdx = totalP === 4 ? (myIndex + 3) % 4 : null;

  const leftPlayer = leftSeatIdx !== null ? players[leftSeatIdx] : null;
  const topPlayer = topSeatIdx !== null ? players[topSeatIdx] : null;
  const rightPlayer = rightSeatIdx !== null ? players[rightSeatIdx] : null;

  const isTeammateTop = is2v2 && topSeatIdx === teammateIndex;

  const getPlayerRef = (seatIdx) => {
    if (seatIdx === myIndex) return myHandRef.current;
    if (seatIdx === leftSeatIdx) return leftPlayerRef.current;
    if (seatIdx === topSeatIdx) return topPlayerRef.current;
    if (seatIdx === rightSeatIdx) return rightPlayerRef.current;
    return null;
  };

  // Trigger Opening Deal Animation when isDealing is true
  const hasAnimatedDealRef = useRef(false);
  const dealTimerRef = useRef(null);
  const wasDealingRef = useRef(false);

  useEffect(() => {
    if (isDealing) {
      wasDealingRef.current = true;
      if (hasAnimatedDealRef.current) return;

      // Sync displayed hand & counts for the deal
      if (myHand && myHand.length > 0) {
        setDisplayedHand(myHand);
        const counts = {};
        players.forEach(p => { counts[p.id] = p.cardCount; });
        setDisplayedCounts(counts);
      }
      inflightCardIdsRef.current.clear();
      inflightOpponentCountsRef.current = {};

      // Smooth fan out of hand cards on game start/deal
      setIsHandCollapsed(true);
      const collapseTimer = setTimeout(() => {
        setIsHandCollapsed(false);
        soundManager.playShuffle();
      }, 260);

      let attempts = 0;
      const runDealAnimation = () => {
        const seats = [
          myHandRef.current,
          leftPlayerRef.current,
          topPlayerRef.current,
          rightPlayerRef.current
        ].filter(Boolean);

        const drawEl = drawPileRef.current;
        const discardEl = discardPileRef.current;

        if (drawEl && discardEl && seats.length > 0) {
          hasAnimatedDealRef.current = true;
          const firstCardKey = topCard?.displayAssetKey || topCard?.assetKey || 'card_back';
          cardAnimationService.animateOpeningDeal({
            drawPileEl: drawEl,
            seatElements: seats,
            discardPileEl: discardEl,
            firstCardKey
          });
        } else if (attempts < 15) {
          attempts++;
          dealTimerRef.current = setTimeout(runDealAnimation, 60);
        }
      };

      dealTimerRef.current = setTimeout(runDealAnimation, 120);

      return () => {
        clearTimeout(collapseTimer);
        if (dealTimerRef.current) {
          clearTimeout(dealTimerRef.current);
          dealTimerRef.current = null;
        }
        hasAnimatedDealRef.current = false;
      };
    } else {
      hasAnimatedDealRef.current = false;
      if (wasDealingRef.current) {
        wasDealingRef.current = false;
        if (isMyTurn) {
          soundManager.playTurn();
        }
      }
    }
  }, [isDealing]);

  // Remote / AI animation detection & Action Events
  useEffect(() => {
    if (!gameState) return;

    // 1. Precise action-driven animations from engine
    const lastAction = gameState.lastAction;
    if (lastAction && lastAction.timestamp && lastAction.timestamp !== prevActionTimeRef.current) {
      prevActionTimeRef.current = lastAction.timestamp;

      if (lastAction.type === 'play') {
        // If not human player, trigger flight animation from player seat to discard pile
        if (lastAction.playerId !== myIndex) {
          const fromEl = getPlayerRef(lastAction.playerId);
          if (fromEl && discardPileRef.current) {
            const cardKey = lastAction.card.displayAssetKey || lastAction.card.assetKey;
            cardAnimationService.animatePlayCard(fromEl, discardPileRef.current, cardKey);
          }
        }

        // Action card transitions & sound effects
        if (lastAction.card.value === 'skip') {
          soundManager.playSkip();
          setSkippedPlayerInfo({
            playerId: lastAction.skippedPlayerId,
            playerName: lastAction.skippedPlayerName,
            sourceName: lastAction.playerName
          });
          setTimeout(() => setSkippedPlayerInfo(null), 2400);
        } else if (lastAction.card.value === 'reverse') {
          soundManager.playAction();
        } else if (['draw2', 'wild_draw4'].includes(lastAction.card.value)) {
          soundManager.playAction();
        } else if (lastAction.card.color === 'wild') {
          soundManager.playWild();
        }
      } else if (lastAction.type === 'draw_autopass') {
        if (lastAction.playerId === myIndex) {
          showToast('💨 抽到的牌無法出，系統已自動跳過回合！');
        }
      }
    } else if (topCard && prevTopCardRef.current && prevTopCardRef.current.id !== topCard.id) {
      // Fallback topCard diffing
      const prevTurn = (currentTurn - direction + totalP) % totalP;
      if (prevTurn !== myIndex) {
        const fromEl = getPlayerRef(prevTurn);
        if (fromEl && discardPileRef.current) {
          const cardKey = topCard.displayAssetKey || topCard.assetKey;
          cardAnimationService.animatePlayCard(fromEl, discardPileRef.current, cardKey);
        }
      }
    }
    prevTopCardRef.current = topCard;

    // 2. Synchronize drawn card flights and exact landing additions
    // If opening deal is active, do not trigger single-card flight animations
    if (isDealing) {
      if (myHand && myHand.length > 0) {
        setDisplayedHand(myHand);
        const counts = {};
        players.forEach(p => { counts[p.id] = p.cardCount; });
        setDisplayedCounts(counts);
      }
      inflightCardIdsRef.current.clear();
      inflightOpponentCountsRef.current = {};
      return;
    }

    // For local player's hand:
    if (myHand.length < displayedHand.length) {
      setDisplayedHand(myHand);
    } else if (myHand.length > displayedHand.length) {
      const newCards = myHand.filter(c => !displayedHand.some(dh => dh.id === c.id) && !inflightCardIdsRef.current.has(c.id));
      newCards.forEach((c, idx) => {
        inflightCardIdsRef.current.add(c.id);
        setTimeout(() => {
          if (drawPileRef.current && myHandRef.current) {
            cardAnimationService.animateDrawCard(drawPileRef.current, myHandRef.current, 'card_back', () => {
              inflightCardIdsRef.current.delete(c.id);
              setDisplayedHand(prev => {
                if (prev.some(p => p.id === c.id)) return prev;
                return [...prev, c];
              });
            });
          } else {
            inflightCardIdsRef.current.delete(c.id);
            setDisplayedHand(prev => {
              if (prev.some(p => p.id === c.id)) return prev;
              return [...prev, c];
            });
          }
        }, idx * 280);
      });
    }

    // For opponents:
    players.forEach((p) => {
      if (p.id === myIndex) return;
      const scheduledCount = inflightOpponentCountsRef.current[p.id] !== undefined
        ? inflightOpponentCountsRef.current[p.id]
        : (displayedCounts[p.id] !== undefined ? displayedCounts[p.id] : p.cardCount);

      if (p.cardCount < scheduledCount) {
        inflightOpponentCountsRef.current[p.id] = p.cardCount;
        setDisplayedCounts(prev => ({ ...prev, [p.id]: p.cardCount }));
      } else if (p.cardCount > scheduledCount) {
        const diff = p.cardCount - scheduledCount;
        inflightOpponentCountsRef.current[p.id] = p.cardCount;
        const toEl = getPlayerRef(p.id);
        for (let k = 0; k < diff; k++) {
          setTimeout(() => {
            if (toEl && drawPileRef.current) {
              cardAnimationService.animateDrawCard(drawPileRef.current, toEl, 'card_back', () => {
                setDisplayedCounts(prev => ({
                  ...prev,
                  [p.id]: Math.min(p.cardCount, (prev[p.id] !== undefined ? prev[p.id] : scheduledCount) + 1)
                }));
              });
            } else {
              setDisplayedCounts(prev => ({ ...prev, [p.id]: p.cardCount }));
            }
          }, k * 280);
        }
      }
    });
  }, [gameState]);

  const handleMuteToggle = () => {
    const isMuted = soundManager.toggleMute();
    setMuted(isMuted);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Manual Hand Sort & Ripple Fan-out Trigger
  const handleSortHand = () => {
    soundManager.playShuffle();
    setIsHandCollapsed(true);
    setTimeout(() => {
      setIsSorted((prev) => !prev);
      setIsHandCollapsed(false);
      showToast('✨ 已為您整理手牌並展開！');
    }, 180);
  };

  // Play card with flight animation
  const handleCardClick = (card, cardEl) => {
    if (isDealing) {
      showToast('🎴 開局發牌中，請稍候...');
      return;
    }
    if (isContinuousDrawing) {
      showToast('正在連續抽牌中，請稍候...');
      return;
    }
    if (isChoosingColor) {
      showToast('🌈 正在選擇顏色階段，請選擇牌面顏色！');
      return;
    }
    if (!isMyTurn) {
      showToast(`尚未輪到你的回合！目前輪到【${players[currentTurn]?.name || '對手'}】出牌`);
      return;
    }
    if (!validCards.includes(card.id)) {
      showToast(`此牌不符合出牌規則！頂牌需出同顏色或同數字/功能，或萬用牌！`);
      return;
    }

    const hasPreCalledUno = !!myPlayer.calledUno;

    if (card.color === 'wild') {
      soundManager.playWild();
      setLocalHasDrawn(false);
      setDisplayedHand(prev => prev.filter(c => c.id !== card.id));

      if (cardEl && discardPileRef.current) {
        const cardKey = card.displayAssetKey || card.assetKey;
        cardAnimationService.animatePlayCard(cardEl, discardPileRef.current, cardKey, () => {
          onPlayCard(card.id, null, hasPreCalledUno);
        });
      } else {
        onPlayCard(card.id, null, hasPreCalledUno);
      }
    } else {
      // Skip card transition
      if (card.value === 'skip') {
        soundManager.playSkip();
        const skippedIdx = (currentTurn + direction + totalP) % totalP;
        setSkippedPlayerInfo({
          playerId: skippedIdx,
          playerName: players[skippedIdx]?.name || '下家',
          sourceName: '你'
        });
        setTimeout(() => setSkippedPlayerInfo(null), 2400);
      } else if (card.value === 'reverse' || card.value === 'draw2') {
        soundManager.playAction();
      }

      setLocalHasDrawn(false);
      setDisplayedHand(prev => prev.filter(c => c.id !== card.id));

      if (cardEl && discardPileRef.current) {
        const cardKey = card.displayAssetKey || card.assetKey;
        cardAnimationService.animatePlayCard(cardEl, discardPileRef.current, cardKey, () => {
          onPlayCard(card.id, null, hasPreCalledUno);
        });
      } else {
        onPlayCard(card.id, null, hasPreCalledUno);
      }
    }
  };

  const handleConfirmWildColor = (chosenColor) => {
    if (onChooseColor) {
      onChooseColor(chosenColor);
    }
  };

  // Draw card with flight animation
  const handleDrawWithAnimation = () => {
    if (isDealing) {
      showToast('🎴 開局發牌中，請稍候...');
      return;
    }
    if (isContinuousDrawing) return;
    if (isChoosingColor) return;
    if (!isMyTurn) {
      showToast(`尚未輪到你的回合！目前輪到【${players[currentTurn]?.name || '對手'}】出牌`);
      return;
    }
    if (hasDrawnThisTurn && stackedDrawCount === 0) {
      showToast('⚠️ 本回合你已經主動抽過牌了！請打出手牌或點擊「過牌 (Pass)」！');
      return;
    }

    setLocalHasDrawn(true);
    onDrawCard();
  };

  const myColorCounts = {
    red: displayedHand.filter((c) => c.color === 'red').length,
    blue: displayedHand.filter((c) => c.color === 'blue').length,
    green: displayedHand.filter((c) => c.color === 'green').length,
    yellow: displayedHand.filter((c) => c.color === 'yellow').length
  };

  const colorLabels = {
    red: { name: '紅色', hex: '#ef4444', emoji: '🔴' },
    blue: { name: '藍色', hex: '#3b82f6', emoji: '🔵' },
    green: { name: '綠色', hex: '#22c55e', emoji: '🟢' },
    yellow: { name: '黃色', hex: '#eab308', emoji: '🟡' },
    wild: { name: '指定色', hex: '#ffffff', emoji: '🌈' }
  };

  const activeColorInfo = colorLabels[currentColor] || colorLabels.red;
  const handToDisplay = isSorted ? sortHandCards(displayedHand) : displayedHand;

  return (
    <div className="relative w-screen min-h-screen felt-table flex flex-col justify-between overflow-x-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs sm:text-sm shadow-2xl animate-bounce flex items-center gap-1.5">
          <span>⚠️ {toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="relative z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-black/50 border-b border-emerald-500/20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-yellow-300 font-black text-xs tracking-wider shadow">
            UNO
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            title="點擊複製房號"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-amber-400 font-mono text-xs font-bold hover:bg-emerald-900 transition"
          >
            <span>{roomCode}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <span className="text-[10px] text-emerald-400">複製</span>}
          </button>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 font-semibold">
            {is2v2 ? <UserCheck className="w-3.5 h-3.5 text-amber-400" /> : <Swords className="w-3.5 h-3.5 text-amber-400" />}
            <span>{is2v2 ? '2V2 雙人組隊戰' : '多人混戰'}</span>
          </div>

          {targetScore > 0 ? (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-xs text-amber-300 font-bold">
              <span>🏆 目標 {targetScore} 分</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-xs text-emerald-300 font-medium">
              <span>🎮 暢玩模式</span>
            </div>
          )}

          {drawRule === 'draw_until_playable' && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[11px] text-sky-300 font-bold">
              <span>🔄 連續抽牌</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMuteToggle}
            className="p-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/20 text-emerald-300 transition"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            type="button"
            onClick={() => setShowLogDrawer(!showLogDrawer)}
            className="p-1.5 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/20 text-emerald-300 transition flex items-center gap-1 text-xs"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">對局紀錄</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isHost) {
                if (window.confirm('確定要解散房間嗎？對局將立即結束，所有玩家將返回首頁。')) {
                  if (onLeaveRoom) onLeaveRoom();
                }
              } else {
                if (window.confirm('確定要離開對局嗎？你將退出並轉由電腦託管。')) {
                  if (onLeaveRoom) onLeaveRoom();
                }
              }
            }}
            title={isHost ? '解散房間' : '離開對局'}
            className="p-1.5 px-2.5 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-500/30 text-red-300 transition flex items-center gap-1 text-xs font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isHost ? '解散' : '離開'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* GAME ARENA TABLE (1:1 from 螢幕擷取畫面 2026-10-13 150340.png) */}
      {/* ============================================================== */}
      <main className="relative flex-1 flex items-center justify-center p-2 sm:p-5">
        <div className="table-surface">

          {/* ---------------------------------------------------------- */}
          {/* TOP ROW: OPPONENT 2 (Or Teammate in 2V2)                   */}
          {/* ---------------------------------------------------------- */}
          <div className="w-full flex flex-col items-center justify-center min-h-[90px] z-10">
            {topPlayer && (
              <div
                ref={topPlayerRef}
                className="flex flex-col items-center gap-1.5 transition-all duration-300"
              >
                {/* Player Info Card (Pill Badge) & Turn Timer Circle */}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 ${
                      skippedPlayerInfo && topPlayer && topPlayer.id === skippedPlayerInfo.playerId
                        ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
                        : (((currentTurn === topPlayer.id && !isDealing) || (isChoosingColor && colorChoosingPlayerIndex === topPlayer.id)))
                        ? 'active-turn-ring scale-105'
                        : 'bg-[#0a1c12]/90 border-white/15'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm">
                      {isTeammateTop ? '🤝' : '🤖'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        {topPlayer.name}
                        {isTeammateTop && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/40">
                            隊友
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-300">{(displayedCounts[topPlayer.id] !== undefined ? displayedCounts[topPlayer.id] : topPlayer.cardCount)} 張牌</span>
                    </div>

                    {skippedPlayerInfo && topPlayer && topPlayer.id === skippedPlayerInfo.playerId && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] shadow-2xl animate-bounce border border-yellow-300 flex items-center gap-1">
                        🚫 跳過！
                      </span>
                    )}
                    {topPlayer.calledUno && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[10px] shadow animate-pulse">
                        UNO!
                      </span>
                    )}
                    {isChoosingColor && colorChoosingPlayerIndex === topPlayer.id ? (
                      <span className="text-[10px] font-bold text-purple-300 animate-pulse flex items-center gap-1">
                        🌈 選色中 (6s)
                      </span>
                    ) : isContinuousDrawing && drawingPlayerIndex === topPlayer.id ? (
                      <span className="text-[10px] font-bold text-sky-300 animate-pulse flex items-center gap-1">
                        <RotateCw className="w-2.5 h-2.5 animate-spin" />
                        抽牌中 ({drawingStepCount || 1})
                      </span>
                    ) : currentTurn === topPlayer.id && !skippedPlayerInfo && !isDealing && (
                      <span className="text-[10px] font-bold text-yellow-300 animate-pulse">
                        思考中 💭
                      </span>
                    )}
                  </div>
                  {((currentTurn === topPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === topPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over' && (
                    <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || (isChoosingColor ? 6 : 15)} />
                  )}
                </div>

                {/* Hand Display: If 2V2 Teammate, cards face-up! If opponent, fanned cards */}
                <div className="flex items-center justify-center mt-1">
                  {isTeammateTop ? (
                    <div className="flex items-center -space-x-4 sm:-space-x-5">
                      {teammateHand.map((c, cIdx) => (
                        <div
                          key={c.id || cIdx}
                          className="transition-transform duration-150 hover:-translate-y-2 hover:scale-120 cursor-pointer"
                          title={`隊友手牌: ${c.color} ${c.value}`}
                        >
                          <CardView card={c} isSmall className="drop-shadow-md" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderOpponentCards(displayedCounts[topPlayer.id] !== undefined ? displayedCounts[topPlayer.id] : topPlayer.cardCount, 'horizontal')
                  )}
                </div>

                {topPlayer.unoVulnerable && (
                  <button
                    type="button"
                    onClick={() => onChallengeUno(topPlayer.id)}
                    className="py-0.5 px-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    抓漏 UNO!
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------- */}
          {/* MIDDLE ROW: OPPONENT 1 | CENTER ARENA | OPPONENT 3        */}
          {/* ---------------------------------------------------------- */}
          <div className="flex-1 flex items-center justify-between gap-4 px-2 sm:px-6 z-10">

            {/* LEFT OPPONENT (Player 1) */}
            <div className="w-32 flex flex-col items-center">
              {leftPlayer && (
                <div
                  ref={leftPlayerRef}
                  className="flex flex-col items-center gap-2 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 ${
                        skippedPlayerInfo && leftPlayer && leftPlayer.id === skippedPlayerInfo.playerId
                          ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
                          : (((currentTurn === leftPlayer.id && !isDealing) || (isChoosingColor && colorChoosingPlayerIndex === leftPlayer.id)))
                          ? 'active-turn-ring scale-105'
                          : 'bg-[#0a1c12]/90 border-white/15'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm">
                        👾
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white max-w-[65px] truncate">
                          {leftPlayer.name}
                        </span>
                        <span className="text-[10px] text-gray-300">{(displayedCounts[leftPlayer.id] !== undefined ? displayedCounts[leftPlayer.id] : leftPlayer.cardCount)} 張牌</span>
                      </div>
                      {skippedPlayerInfo && leftPlayer && leftPlayer.id === skippedPlayerInfo.playerId && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-black text-[9px] shadow-2xl animate-bounce border border-yellow-300">
                          🚫 跳過！
                        </span>
                      )}
                      {leftPlayer.calledUno && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[9px] shadow animate-pulse">
                          UNO!
                        </span>
                      )}
                      {isChoosingColor && colorChoosingPlayerIndex === leftPlayer.id && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white font-bold text-[9px] animate-pulse">
                          🌈 選色中 (6s)
                        </span>
                      )}
                      {isContinuousDrawing && drawingPlayerIndex === leftPlayer.id && (
                        <span className="px-1.5 py-0.5 rounded-full bg-sky-600 text-white font-bold text-[9px] animate-pulse flex items-center gap-0.5">
                          <RotateCw className="w-2.5 h-2.5 animate-spin" />
                          抽牌({drawingStepCount || 1})
                        </span>
                      )}
                    </div>
                    {((currentTurn === leftPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === leftPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over' && (
                      <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || (isChoosingColor ? 6 : 15)} />
                    )}
                  </div>

                  <div className="mt-1">
                    {renderOpponentCards(displayedCounts[leftPlayer.id] !== undefined ? displayedCounts[leftPlayer.id] : leftPlayer.cardCount, 'vertical')}
                  </div>

                  {leftPlayer.unoVulnerable && (
                    <button
                      type="button"
                      onClick={() => onChallengeUno(leftPlayer.id)}
                      className="py-0.5 px-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      抓漏 UNO!
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* CENTER ARENA (Draw Pile, Discard Pile, Status Bar) */}
            <div className="relative flex flex-col items-center justify-center gap-4">
              {/* Skip Floating Banner */}
              {skippedPlayerInfo && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-red-600 border-2 border-yellow-300 text-white font-black text-xs sm:text-sm shadow-2xl animate-bounce flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-sm">🚫</span>
                  <span>【{skippedPlayerInfo.sourceName}】出禁止牌！跳過【{skippedPlayerInfo.playerName}】！</span>
                </div>
              )}

              {/* Dealing Opening Banner */}
              {isDealing && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-5 py-2 rounded-full bg-black/90 border-2 border-amber-400 text-amber-300 font-extrabold text-xs sm:text-sm shadow-2xl animate-pulse flex items-center gap-2 whitespace-nowrap backdrop-blur-md">
                  <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>🎴 開局發牌中，請稍候...</span>
                </div>
              )}

              {/* Piles Row */}
              <div className="flex items-center justify-center gap-8 sm:gap-12">

                {/* Draw Pile (Left) */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    ref={drawPileRef}
                    onClick={isContinuousDrawing ? undefined : handleDrawWithAnimation}
                    title={
                      isContinuousDrawing
                        ? '正在連續抽牌中...'
                        : (hasDrawnThisTurn && stackedDrawCount === 0)
                        ? '本回合已抽過牌，請打出手牌或點擊過牌'
                        : '點擊抽一張牌'
                    }
                    className={`relative deck-3d-stack transition-transform duration-150 ${
                      isContinuousDrawing
                        ? 'cursor-wait opacity-80'
                        : (hasDrawnThisTurn && stackedDrawCount === 0)
                        ? 'cursor-not-allowed opacity-75'
                        : 'cursor-pointer hover:-translate-y-1 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {/* Subtle deck stack depth layers */}
                    <div className="absolute top-1.5 left-1.5 w-full h-full rounded-xl bg-black/40 border border-white/10 pointer-events-none" />
                    <div className="absolute top-0.5 left-0.5 w-full h-full rounded-xl bg-[#0a1c12] border border-white/15 pointer-events-none" />
                    <CardView isBack />
                  </div>
                  {/* Pile Count Badge (80 張) */}
                  <div className="bg-black/75 px-3 py-0.5 rounded-full text-xs font-bold text-gray-200 border border-white/15 shadow">
                    {drawPileCount || 80} 張
                  </div>
                </div>

                {/* Discard Pile (Right) */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    ref={discardPileRef}
                    className="relative transition-transform duration-300 w-20 h-30 sm:w-24 sm:h-36 flex items-center justify-center"
                  >
                    {/* Layered Under-cards */}
                    {recentDiscardPile && recentDiscardPile.length > 1 && recentDiscardPile.slice(0, -1).map((discardedCard, idx) => (
                      <div
                        key={discardedCard.id || idx}
                        className="absolute inset-0 pointer-events-none transition-all duration-300 flex items-center justify-center"
                        style={{
                          transform: `translate(${discardedCard.offsetX || 0}px, ${discardedCard.offsetY || 0}px) rotate(${discardedCard.rot || (idx * 5 - 10)}deg)`,
                          zIndex: idx
                        }}
                      >
                        <CardView card={discardedCard} className="shadow-md filter brightness-90" />
                      </div>
                    ))}

                    {/* Top Active Card */}
                    <div
                      className="relative z-10 transition-transform duration-200"
                      style={{
                        transform: recentDiscardPile?.length
                          ? `translate(${recentDiscardPile[recentDiscardPile.length - 1].offsetX || 0}px, ${recentDiscardPile[recentDiscardPile.length - 1].offsetY || 0}px) rotate(${recentDiscardPile[recentDiscardPile.length - 1].rot || -3}deg)`
                          : 'rotate(-3deg)'
                      }}
                    >
                      <CardView card={topCard} isTopCard />
                    </div>
                  </div>
                  {/* Active Color Badge (🔴 紅色) */}
                  <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0a1c12]/95 border border-white/20 shadow-lg text-xs font-bold text-white">
                    <span
                      className="w-3 h-3 rounded-full inline-block shadow-sm"
                      style={{
                        backgroundColor: activeColorInfo.hex,
                        boxShadow: `0 0 8px ${activeColorInfo.hex}`
                      }}
                    />
                    <span>{activeColorInfo.name}</span>
                  </div>
                </div>

              </div>

              {/* Direction & Game Status Bar */}
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-black/60 border border-white/15 text-xs font-bold text-gray-200 shadow">
                  {direction === 1 ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>順時針出牌</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>逆時針出牌</span>
                    </>
                  )}
                </div>

                {stackedDrawCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-red-600 to-amber-600 border border-red-300 text-white font-extrabold text-xs shadow-lg animate-pulse">
                    <Flame className="w-3.5 h-3.5 text-yellow-300 fill-current" />
                    <span>累積罰抽：+{stackedDrawCount} 張</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT OPPONENT (Player 3) */}
            <div className="w-32 flex flex-col items-center">
              {rightPlayer && (
                <div
                  ref={rightPlayerRef}
                  className="flex flex-col items-center gap-2 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    {((currentTurn === rightPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === rightPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over' && (
                      <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || (isChoosingColor ? 6 : 15)} />
                    )}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 ${
                        skippedPlayerInfo && rightPlayer && rightPlayer.id === skippedPlayerInfo.playerId
                          ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
                          : (((currentTurn === rightPlayer.id && !isDealing) || (isChoosingColor && colorChoosingPlayerIndex === rightPlayer.id)))
                          ? 'active-turn-ring scale-105'
                          : 'bg-[#0a1c12]/90 border-white/15'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm">
                        🎯
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white max-w-[65px] truncate">
                          {rightPlayer.name}
                        </span>
                        <span className="text-[10px] text-gray-300">{(displayedCounts[rightPlayer.id] !== undefined ? displayedCounts[rightPlayer.id] : rightPlayer.cardCount)} 張牌</span>
                      </div>
                      {skippedPlayerInfo && rightPlayer && rightPlayer.id === skippedPlayerInfo.playerId && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-black text-[9px] shadow-2xl animate-bounce border border-yellow-300">
                          🚫 跳過！
                        </span>
                      )}
                      {rightPlayer.calledUno && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[9px] shadow animate-pulse">
                          UNO!
                        </span>
                      )}
                      {isChoosingColor && colorChoosingPlayerIndex === rightPlayer.id && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white font-bold text-[9px] animate-pulse">
                          🌈 選色中 (6s)
                        </span>
                      )}
                      {isContinuousDrawing && drawingPlayerIndex === rightPlayer.id && (
                        <span className="px-1.5 py-0.5 rounded-full bg-sky-600 text-white font-bold text-[9px] animate-pulse flex items-center gap-0.5">
                          <RotateCw className="w-2.5 h-2.5 animate-spin" />
                          抽牌({drawingStepCount || 1})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1">
                    {renderOpponentCards(displayedCounts[rightPlayer.id] !== undefined ? displayedCounts[rightPlayer.id] : rightPlayer.cardCount, 'vertical')}
                  </div>

                  {rightPlayer.unoVulnerable && (
                    <button
                      type="button"
                      onClick={() => onChallengeUno(rightPlayer.id)}
                      className="py-0.5 px-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      抓漏 UNO!
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ---------------------------------------------------------- */}
          {/* BOTTOM ROW: HUMAN PLAYER CONTROLS & FANNED HAND            */}
          {/* ---------------------------------------------------------- */}
          <div className="w-full flex flex-col items-center z-20 pb-2">

            {/* Controls Bar */}
            <div className="w-full max-w-4xl flex items-center justify-between px-4 mb-2">
              {/* Human Player Badge & Turn Timer Circle (Bottom-Left) */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 ${
                    skippedPlayerInfo && skippedPlayerInfo.playerId === myIndex
                      ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
                      : (((isMyTurn && !isDealing) || (isChoosingColor && colorChoosingPlayerIndex === myIndex))) ? 'active-turn-ring scale-105' : 'bg-[#0a1c12]/90 border-white/15'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm">
                    👤
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{myPlayer.name || '你 (玩家)'}</span>
                    <span className="text-[10px] text-gray-300">{displayedHand.length} 張牌</span>
                  </div>
                  {skippedPlayerInfo && skippedPlayerInfo.playerId === myIndex && (
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] shadow-2xl animate-bounce border border-yellow-300">
                      🚫 你的回合被跳過！
                    </span>
                  )}
                  {myPlayer.calledUno && (
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[10px] shadow animate-pulse">
                      UNO!
                    </span>
                  )}
                  {isChoosingColor && colorChoosingPlayerIndex === myIndex && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-black text-[10px] shadow-lg animate-pulse">
                      🌈 選色階段 (6s)
                    </span>
                  )}
                </div>
                {((isMyTurn && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === myIndex)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over' && (
                  <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || (isChoosingColor ? 6 : 15)} isLocal />
                )}
              </div>

              {/* Action Buttons Group (Bottom-Right) */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* 整理手牌 按鈕 */}
                <button
                  type="button"
                  onClick={handleSortHand}
                  title="依顏色與數字整理手牌並重新展開"
                  className="py-1.5 px-3 sm:px-3.5 rounded-full bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/40 text-emerald-300 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>整理手牌</span>
                </button>

                {isDealing ? (
                  <span className="text-xs text-amber-300 font-bold px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center gap-1.5 animate-pulse">
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>🎴 開局發牌中...</span>
                  </span>
                ) : (
                  <>
                    {!isMyTurn && !isChoosingColor && (
                      <span className="text-xs text-gray-300 font-medium px-3 py-1 rounded-full bg-black/40 border border-white/10 hidden sm:inline-block">
                        ⏳ 等待對手行動中...
                      </span>
                    )}

                    {/* Challenge UNO Button */}
                    {players.some((p) => p.unoVulnerable && p.id !== myIndex) && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = players.find((p) => p.unoVulnerable && p.id !== myIndex);
                          if (target) onChallengeUno(target.id);
                        }}
                        className="py-1.5 px-3.5 rounded-full bg-red-600/80 hover:bg-red-600 border border-red-400 text-white font-bold text-xs shadow-lg animate-pulse"
                      >
                        ⚖️ 抓漏
                      </button>
                    )}

                    {/* Pass Button: ONLY when isMyTurn && hasDrawnThisTurn && stackedDrawCount === 0 */}
                    {isMyTurn && !isChoosingColor && hasDrawnThisTurn && stackedDrawCount === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalHasDrawn(false);
                          onPassTurn();
                        }}
                        className="py-1.5 px-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs shadow transition animate-in fade-in"
                      >
                        過牌 (Pass)
                      </button>
                    )}

                    {/* Manual UNO Button:
                        1. During turn when player has 2 cards with playable card (can pre-call before playing)
                        2. Or anytime with 1 card when player hasn't called UNO yet (can rescue call before being challenged) */}
                    {!isDealing && (((isMyTurn && !isChoosingColor && displayedHand.length === 2 && (validCards.length > 0 || myPlayer.calledUno))) || (displayedHand.length === 1)) && (
                      <button
                        type="button"
                        onClick={onCallUno}
                        disabled={myPlayer.calledUno}
                        className={`py-1.5 px-4 rounded-full font-black text-xs shadow-xl transition active:scale-95 ${
                          myPlayer.calledUno
                            ? 'bg-emerald-700 text-white opacity-80 cursor-default'
                            : 'bg-red-600 hover:bg-red-500 text-yellow-300 border-2 border-yellow-300 uno-alert-btn animate-bounce'
                        }`}
                      >
                        {myPlayer.calledUno ? '✓ 已喊 UNO！' : 'UNO！'}
                      </button>
                    )}

                    {/* Challenge Wild Draw 4 Button (Appears when victim faces +4) */}
                    {isMyTurn && !isChoosingColor && canChallengeWildDraw4 && (
                      <button
                        type="button"
                        onClick={onChallengeWildDraw4}
                        className="py-1.5 px-4 rounded-full font-black text-xs shadow-xl transition active:scale-95 bg-amber-500 hover:bg-amber-400 text-black border-2 border-yellow-200 animate-bounce flex items-center gap-1.5"
                      >
                        <span>⚖️ 質疑 +4！{lastWildDraw4PlayerName ? `(${lastWildDraw4PlayerName})` : ''}</span>
                      </button>
                    )}

                    {/* Draw Button or Auto Penalty Badge or Continuous Drawing State */}
                    {isMyTurn && !isChoosingColor && (!hasDrawnThisTurn || stackedDrawCount > 0) && (
                      stackedDrawCount > 0 && validCards.length === 0 && !canChallengeWildDraw4 ? (
                        <div className="py-1.5 px-3.5 sm:px-4 rounded-full font-bold text-xs bg-red-950/90 border border-red-500/60 text-red-300 flex items-center gap-1.5 shadow-lg animate-pulse">
                          <span>💥 自動承受罰抽 (+{stackedDrawCount})</span>
                        </div>
                      ) : isContinuousDrawing && drawingPlayerIndex === myIndex ? (
                        <div className="py-1.5 px-4 rounded-full font-extrabold text-xs shadow-lg bg-sky-900/90 border border-sky-400/50 text-sky-200 flex items-center gap-1.5 animate-pulse">
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                          <span>連續抽牌中... (第 {drawingStepCount || 1} 張)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isContinuousDrawing}
                          onClick={handleDrawWithAnimation}
                          className="py-1.5 px-4 rounded-full font-extrabold text-xs shadow-lg transition duration-150 flex items-center gap-1 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white active:scale-95 disabled:opacity-50"
                        >
                          <span>{stackedDrawCount > 0 ? '💥 承受罰抽' : '🎴 抽牌'}</span>
                          {drawRule === 'draw_until_playable' && stackedDrawCount === 0 && (
                            <span className="text-yellow-300 text-[10px] font-bold">(抽到能出)</span>
                          )}
                          {stackedDrawCount > 0 && <span className="text-yellow-300 font-black">(+{stackedDrawCount})</span>}
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Fanned Hand Cards with Smooth Staggered Fan & Sorting Animation */}
            <div
              ref={myHandRef}
              className="w-full max-w-4xl px-4 pt-4 pb-1 overflow-visible flex items-center justify-center min-h-[140px]"
            >
              <div className="flex items-center justify-center -space-x-6 sm:-space-x-8 md:-space-x-10 overflow-visible transition-all">
                {handToDisplay.map((card, idx) => {
                  const isPlayable = !isDealing && isMyTurn && validCards.includes(card.id);
                  const count = handToDisplay.length;
                  const rotation = isHandCollapsed ? 0 : (idx - (count - 1) / 2) * 3;
                  const baseTranslateY = isHandCollapsed ? 22 : Math.abs(idx - (count - 1) / 2) * 2;
                  const sinkOffset = isMyTurn ? 0 : 38;
                  const translateY = baseTranslateY + sinkOffset;
                  const scale = isMyTurn ? (isHandCollapsed ? 0.94 : 1) : 0.93;

                  return (
                    <div
                      key={card.id}
                      style={{
                        transform: `rotate(${rotation}deg) translateY(${translateY}px) scale(${scale})`,
                        transformOrigin: 'bottom center',
                        filter: isDealing
                          ? 'brightness(0.7) saturate(80%)'
                          : (isMyTurn ? 'brightness(1) saturate(100%)' : 'brightness(0.62) saturate(75%)'),
                        transitionProperty: 'transform, filter',
                        transitionDuration: '380ms',
                        transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
                        transitionDelay: isHandCollapsed ? '0ms' : `${idx * 25}ms`,
                        pointerEvents: (isMyTurn && !isDealing) ? 'auto' : 'none'
                      }}
                      className={`overflow-visible transition-transform duration-200 ${
                        (isMyTurn && !isDealing) ? 'hover:z-40 hover:!rotate-0 hover:!-translate-y-6 cursor-pointer' : 'select-none'
                      }`}
                    >
                      <CardView
                        card={card}
                        isPlayable={isPlayable}
                        onClick={(e) => handleCardClick(card, e?.currentTarget)}
                        className="shadow-2xl"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Floating Wild Color Picker Modal (Dedicated 6s Color Selection Phase) */}
          {isChoosingColor && colorChoosingPlayerIndex === myIndex && (
            <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-5 rounded-3xl bg-[#0a1c12]/95 border-2 border-amber-400 shadow-2xl backdrop-blur-md flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
              <div className="text-sm font-black text-white flex items-center justify-between w-full">
                <span className="flex items-center gap-1.5">
                  <span className="text-base">🌈</span>
                  <span>請指定變色牌顏色 (限時 6 秒)</span>
                </span>
                <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || 6} isLocal />
              </div>

              <div className="text-[11px] text-amber-200/90 text-center px-2">
                超時未選將自動以你手中最多顏色的牌出發！
              </div>

              <div className="grid grid-cols-2 gap-2.5 w-64">
                <button
                  type="button"
                  onClick={() => handleConfirmWildColor('red')}
                  className="py-2.5 px-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-red-300/40"
                >
                  <span>🔴 紅色 RED</span>
                  <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.red} 張</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmWildColor('yellow')}
                  className="py-2.5 px-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-yellow-300/40"
                >
                  <span>🟡 黃色 YELLOW</span>
                  <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.yellow} 張</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmWildColor('green')}
                  className="py-2.5 px-3 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-green-300/40"
                >
                  <span>🟢 綠色 GREEN</span>
                  <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.green} 張</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmWildColor('blue')}
                  className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-blue-300/40"
                >
                  <span>🔵 藍色 BLUE</span>
                  <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.blue} 張</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Game Log Drawer */}
      {showLogDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[#071626]/95 border-l border-emerald-500/20 shadow-2xl p-4 backdrop-blur-md flex flex-col animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20 mb-3">
            <div className="font-bold text-white text-sm flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-400" />
              對局歷史紀錄
            </div>
            <button
              type="button"
              onClick={() => setShowLogDrawer(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {log.length === 0 ? (
              <div className="text-gray-400 text-center py-6">尚無紀錄</div>
            ) : (
              log.map((item, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-black/40 border border-white/10">
                  <span className="text-[10px] text-gray-400 block">{item.time}</span>
                  <span className="text-gray-200">{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
