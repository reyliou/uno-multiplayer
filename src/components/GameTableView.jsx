// 檔案位置：src/components/GameTableView.jsx
// 2.5D Perspective Casino Felt Table Layout (Modularized with ./table/* Subcomponents)
import React, { useState, useRef, useEffect } from 'react';
import { CardView } from './CardView';
import { OpponentHand3D } from './table/OpponentHand3D';
import { PlayerInfoPill } from './table/PlayerInfoPill';
import { WildColorModal } from './table/WildColorModal';
import { Wild4ChallengeOverlay } from './table/Wild4ChallengeOverlay';
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
  'wild': 13, 'wild_draw4': 14,
  'rabbids_wild_shield': 15,
  'rabbids_hurry_up': 16,
  'rabbids_comin_through': 17,
  'rabbids_explosive': 18
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

export function GameTableView({
  gameState,
  onPlayCard,
  onChooseColor,
  onDrawCard,
  onPassTurn,
  onCallUno,
  onChallengeUno,
  onChallengeWildDraw4,
  onKickPlayer,
  isHost = false,
  onLeaveRoom,
  roomCode
}) {
  const [muted, setMuted] = useState(false);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [isHandCollapsed, setIsHandCollapsed] = useState(false);
  const [isSorted, setIsSorted] = useState(true);
  const [skippedPlayerInfo, setSkippedPlayerInfo] = useState(null);
  const [rabbidsEventBanner, setRabbidsEventBanner] = useState('');
  const prevActionTimeRef = useRef(0);

  // Refs for flight animations
  const drawPileRef = useRef(null);
  const discardPileRef = useRef(null);
  const myHandRef = useRef(null);
  const leftPlayerRef = useRef(null);
  const topPlayerRef = useRef(null);
  const rightPlayerRef = useRef(null);

  const prevTopCardRef = useRef(null);

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
    canChallengeWildDraw4 = false,
    lastWildDraw4PlayerName = null,
    deckTheme = 'classic',
    hurryUpTurns = 0,
    explosiveActive = false,
    vanishingCardId = null,
    wild4ChallengeAnim = null
  } = gameState || {};

  const is2v2 = gameMode === '2v2';
  const isForcedPenalty = stackedDrawCount > 0 && validCards.length === 0 && !canChallengeWildDraw4;
  const isMyTurn = currentTurn === myIndex && !isContinuousDrawing && !isDealing && !isForcedPenalty;

  const [displayedHand, setDisplayedHand] = useState(myHand);
  const [displayedCounts, setDisplayedCounts] = useState({});
  const initialSyncRef = useRef(false);
  const inflightCardIdsRef = useRef(new Set());
  const inflightOpponentCountsRef = useRef({});

  useEffect(() => {
    if ((!initialSyncRef.current || isDealing) && myHand && myHand.length > 0) {
      initialSyncRef.current = true;
      setDisplayedHand(myHand);
      const counts = {};
      players.forEach(p => { counts[p.id] = p.cardCount; });
      setDisplayedCounts(counts);
    }
  }, [myHand, players, isDealing]);

  useEffect(() => {
    if (gameState?.gameStatus === 'game_over') {
      setDisplayedHand(myHand);
      const counts = {};
      players.forEach(p => { counts[p.id] = p.cardCount; });
      setDisplayedCounts(counts);
    }
  }, [gameState?.gameStatus]);

  const myPlayer = players[myIndex] || { name: '你 (玩家)', cardCount: displayedHand.length };

  useEffect(() => {
    cardAnimationService.setDeckTheme(deckTheme);
  }, [deckTheme]);

  const [localHasDrawn, setLocalHasDrawn] = useState(false);
  const hasDrawnThisTurn = isMyTurn && (localHasDrawn || remoteHasDrawn);

  useEffect(() => {
    setLocalHasDrawn(false);
  }, [currentTurn]);

  const autoPenaltyTimerRef = useRef(null);

  useEffect(() => {
    if (currentTurn === myIndex && !isDealing && !isContinuousDrawing && isForcedPenalty) {
      showToast(`💥 無對應牌可疊！自動承受累積罰抽【+${stackedDrawCount} 張】...`);
      autoPenaltyTimerRef.current = setTimeout(() => {
        onDrawCard();
      }, 750);
      return () => {
        if (autoPenaltyTimerRef.current) {
          clearTimeout(autoPenaltyTimerRef.current);
          autoPenaltyTimerRef.current = null;
        }
      };
    }
  }, [currentTurn, myIndex, isDealing, isContinuousDrawing, isForcedPenalty, stackedDrawCount]);

  // Calculate Seats (Top, Left, Right)
  const totalP = players.length;
  const leftSeatIdx = totalP === 4 ? (myIndex + 1) % 4 : (totalP === 3 ? (myIndex + 1) % 3 : null);
  const topSeatIdx = totalP === 4 ? (myIndex + 2) % 4 : (totalP === 3 ? (myIndex + 2) % 3 : (totalP === 2 ? (myIndex + 1) % 2 : null));
  const rightSeatIdx = totalP === 4 ? (myIndex + 3) % 4 : null;

  const leftPlayer = leftSeatIdx !== null ? players[leftSeatIdx] : null;
  const topPlayer = topSeatIdx !== null ? players[topSeatIdx] : null;
  const rightPlayer = rightSeatIdx !== null ? players[rightSeatIdx] : null;

  const isTeammateTop = is2v2 && topSeatIdx === teammateIndex;

  let challengeSeatDirection = 'top';
  if (wild4ChallengeAnim) {
    if (wild4ChallengeAnim.challengedId === myIndex) {
      challengeSeatDirection = 'me';
    } else if (wild4ChallengeAnim.challengedId === leftSeatIdx) {
      challengeSeatDirection = 'left';
    } else if (wild4ChallengeAnim.challengedId === rightSeatIdx) {
      challengeSeatDirection = 'right';
    } else {
      challengeSeatDirection = 'top';
    }
  }

  const getPlayerRef = (seatIdx) => {
    if (seatIdx === myIndex) return myHandRef.current;
    if (seatIdx === leftSeatIdx) return leftPlayerRef.current;
    if (seatIdx === topSeatIdx) return topPlayerRef.current;
    if (seatIdx === rightSeatIdx) return rightPlayerRef.current;
    return null;
  };

  // Opening Deal Animation
  const hasAnimatedDealRef = useRef(false);
  const dealTimerRef = useRef(null);
  const wasDealingRef = useRef(false);

  useEffect(() => {
    if (isDealing) {
      wasDealingRef.current = true;
      if (hasAnimatedDealRef.current) return;

      if (myHand && myHand.length > 0) {
        setDisplayedHand(myHand);
        const counts = {};
        players.forEach(p => { counts[p.id] = p.cardCount; });
        setDisplayedCounts(counts);
      }
      inflightCardIdsRef.current.clear();
      inflightOpponentCountsRef.current = {};

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
        if (currentTurn === myIndex) {
          soundManager.playTurn();
        }
      }
    }
  }, [isDealing]);

  // Remote / AI animation detection & Action Events
  useEffect(() => {
    if (!gameState) return;

    const lastAction = gameState.lastAction;
    if (lastAction && lastAction.timestamp && lastAction.timestamp !== prevActionTimeRef.current) {
      prevActionTimeRef.current = lastAction.timestamp;

      if (lastAction.type === 'play') {
        if (lastAction.playerId !== myIndex) {
          const fromEl = getPlayerRef(lastAction.playerId);
          if (fromEl && discardPileRef.current) {
            const cardKey = lastAction.card.displayAssetKey || lastAction.card.assetKey;
            cardAnimationService.animatePlayCard(fromEl, discardPileRef.current, cardKey);
          }
        }

        if (lastAction.card.value === 'skip') {
          soundManager.playSkip();
          setSkippedPlayerInfo({
            playerId: lastAction.skippedPlayerId,
            playerName: lastAction.skippedPlayerName,
            sourceName: lastAction.playerName
          });
          setTimeout(() => setSkippedPlayerInfo(null), 2400);
        } else if (lastAction.card.value === 'rabbids_comin_through') {
          soundManager.playWild();
          setRabbidsEventBanner(`🌪️ 【${lastAction.playerName}】發動瘋狂借過！第一波衝撞對手 -> 第二波全場發牌！`);
          setTimeout(() => setRabbidsEventBanner(''), 2500);
        } else if (lastAction.card.value === 'rabbids_explosive') {
          soundManager.playAction();
          setRabbidsEventBanner(`💣 【${lastAction.playerName}】在抽牌堆安裝了瘋狂定時炸彈 (+4)！`);
          setTimeout(() => setRabbidsEventBanner(''), 1800);
        } else if (lastAction.card.value === 'rabbids_hurry_up') {
          soundManager.playWild();
          setRabbidsEventBanner(`⚡ 【${lastAction.playerName}】啟動瘋狂快抽！全場進入 3 秒極限思考！`);
          setTimeout(() => setRabbidsEventBanner(''), 1800);
        } else if (lastAction.card.value === 'rabbids_wild_shield' && lastAction.isVanishing) {
          soundManager.playWild();
          setRabbidsEventBanner(`🛡️ 【${lastAction.playerName}】展開兔兔盾牌！將累積罰抽直接轉嫁給下一位玩家！`);
          setTimeout(() => setRabbidsEventBanner(''), 1800);
        } else if (lastAction.card.value === 'reverse') {
          soundManager.playAction();
        } else if (['draw2', 'wild_draw4'].includes(lastAction.card.value)) {
          soundManager.playAction();
        } else if (lastAction.card.color === 'wild') {
          soundManager.playWild();
        }
      } else if (lastAction.type === 'draw_autopass') {
        if (lastAction.playerId === myIndex) {
          showToast('💨 抽牌完畢，回合結束！');
        }
      }
    } else if (topCard && prevTopCardRef.current && prevTopCardRef.current.id !== topCard.id) {
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

    if (myHand.length < displayedHand.length) {
      setDisplayedHand(myHand);
    } else if (myHand.length > displayedHand.length) {
      const newCards = myHand.filter(c => !displayedHand.some(dh => dh.id === c.id) && !inflightCardIdsRef.current.has(c.id));
      if (newCards.length > 0 && lastAction && (lastAction.type === 'draw_step' || lastAction.type === 'draw_finished' || lastAction.type === 'penalty_finish' || lastAction.card?.value === 'rabbids_comin_through' || lastAction.card?.value === 'rabbids_wild_shield' || lastAction.type === 'challenge_wild4_penalty')) {
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
          }, idx * 180);
        });
      } else if (inflightCardIdsRef.current.size === 0) {
        // 若並非抽牌事件（例如剛才前端搶先移除手牌但後端未接受），立即還原手牌，避免視覺吃牌！
        setDisplayedHand(myHand);
      }
    }

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
          }, k * 180);
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

  const handleSortHand = () => {
    soundManager.playShuffle();
    setIsHandCollapsed(true);
    setTimeout(() => {
      setIsSorted((prev) => !prev);
      setIsHandCollapsed(false);
    }, 180);
  };

  const handleCardClick = (card, cardEl) => {
    if (isDealing) {
      showToast('🎴 開局發牌中，請稍候...');
      return;
    }
    if (isContinuousDrawing) {
      showToast('⏳ 場上效果與動畫正在結算中，請稍候...');
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
    red: { name: '紅色', hex: '#ef4444' },
    blue: { name: '藍色', hex: '#3b82f6' },
    green: { name: '綠色', hex: '#22c55e' },
    yellow: { name: '黃色', hex: '#eab308' },
    wild: { name: '指定色', hex: '#ffffff' }
  };

  const activeColorInfo = colorLabels[currentColor] || colorLabels.red;
  const handToDisplay = isSorted ? sortHandCards(displayedHand) : displayedHand;

  return (
    <div className="relative w-screen h-[100dvh] felt-table flex flex-col justify-between overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs sm:text-sm shadow-2xl animate-bounce flex items-center gap-1.5">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="relative z-40 h-12 flex items-center justify-between px-3 sm:px-6 bg-black/50 border-b border-emerald-500/20 backdrop-blur-md">
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
              <span>暢玩模式</span>
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
      {/* UNIFIED 2.5D ARENA STAGE                                       */}
      {/* ============================================================== */}
      <main className="arena-stage">
        <div className="table-surface-3d" />

        {/* TOP SEAT */}
        {topPlayer && (
          <div
            ref={topPlayerRef}
            className="absolute top-3 sm:top-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto"
          >
            <PlayerInfoPill
              player={topPlayer}
              cardCount={displayedCounts[topPlayer.id] !== undefined ? displayedCounts[topPlayer.id] : topPlayer.cardCount}
              avatar={isTeammateTop ? '🤝' : '🤖'}
              isTeammate={isTeammateTop}
              isHost={isHost}
              isActiveTurn={currentTurn === topPlayer.id && !isDealing && !isContinuousDrawing}
              isSkipped={skippedPlayerInfo && topPlayer.id === skippedPlayerInfo.playerId}
              isChoosingColor={isChoosingColor && colorChoosingPlayerIndex === topPlayer.id}
              isContinuousDrawing={isContinuousDrawing && drawingPlayerIndex === topPlayer.id}
              drawingStepCount={drawingStepCount}
              showTimer={((currentTurn === topPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === topPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over'}
              turnStartTime={turnStartTime}
              turnDuration={turnDuration || (isChoosingColor ? 6 : 15)}
              timerPosition="right"
              onKickPlayer={onKickPlayer}
            />

            <div className="flex items-center justify-center mt-0.5">
              <OpponentHand3D
                side="top"
                count={displayedCounts[topPlayer.id] !== undefined ? displayedCounts[topPlayer.id] : topPlayer.cardCount}
                deckTheme={deckTheme}
                isTeammateTop={isTeammateTop}
                teammateHand={teammateHand}
              />
            </div>

            {topPlayer.unoVulnerable && (
              <button
                type="button"
                onClick={() => onChallengeUno(topPlayer.id)}
                className="mt-1 py-0.5 px-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                抓漏 UNO!
              </button>
            )}
          </div>
        )}

        {/* LEFT SEAT */}
        {leftPlayer && (
          <div
            ref={leftPlayerRef}
            className="absolute left-[5%] sm:left-[9%] md:left-[11.5%] top-[43%] -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto"
          >
            <PlayerInfoPill
              player={leftPlayer}
              cardCount={displayedCounts[leftPlayer.id] !== undefined ? displayedCounts[leftPlayer.id] : leftPlayer.cardCount}
              avatar="👾"
              isHost={isHost}
              isActiveTurn={currentTurn === leftPlayer.id && !isDealing && !isContinuousDrawing}
              isSkipped={skippedPlayerInfo && leftPlayer.id === skippedPlayerInfo.playerId}
              isChoosingColor={isChoosingColor && colorChoosingPlayerIndex === leftPlayer.id}
              isContinuousDrawing={isContinuousDrawing && drawingPlayerIndex === leftPlayer.id}
              drawingStepCount={drawingStepCount}
              showTimer={((currentTurn === leftPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === leftPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over'}
              turnStartTime={turnStartTime}
              turnDuration={turnDuration || (isChoosingColor ? 6 : 15)}
              timerPosition="right"
              onKickPlayer={onKickPlayer}
            />

            <OpponentHand3D
              side="left"
              count={displayedCounts[leftPlayer.id] !== undefined ? displayedCounts[leftPlayer.id] : leftPlayer.cardCount}
              deckTheme={deckTheme}
            />

            {leftPlayer.unoVulnerable && (
              <button
                type="button"
                onClick={() => onChallengeUno(leftPlayer.id)}
                className="py-0.5 px-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                抓漏 UNO!
              </button>
            )}
          </div>
        )}

        {/* RIGHT SEAT */}
        {rightPlayer && (
          <div
            ref={rightPlayerRef}
            className="absolute right-[5%] sm:right-[9%] md:right-[11.5%] top-[43%] -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-auto"
          >
            <PlayerInfoPill
              player={rightPlayer}
              cardCount={displayedCounts[rightPlayer.id] !== undefined ? displayedCounts[rightPlayer.id] : rightPlayer.cardCount}
              avatar="🎯"
              isHost={isHost}
              isActiveTurn={currentTurn === rightPlayer.id && !isDealing && !isContinuousDrawing}
              isSkipped={skippedPlayerInfo && rightPlayer.id === skippedPlayerInfo.playerId}
              isChoosingColor={isChoosingColor && colorChoosingPlayerIndex === rightPlayer.id}
              isContinuousDrawing={isContinuousDrawing && drawingPlayerIndex === rightPlayer.id}
              drawingStepCount={drawingStepCount}
              showTimer={((currentTurn === rightPlayer.id && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === rightPlayer.id)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over'}
              turnStartTime={turnStartTime}
              turnDuration={turnDuration || (isChoosingColor ? 6 : 15)}
              timerPosition="left"
              onKickPlayer={onKickPlayer}
            />

            <OpponentHand3D
              side="right"
              count={displayedCounts[rightPlayer.id] !== undefined ? displayedCounts[rightPlayer.id] : rightPlayer.cardCount}
              deckTheme={deckTheme}
            />

            {rightPlayer.unoVulnerable && (
              <button
                type="button"
                onClick={() => onChallengeUno(rightPlayer.id)}
                className="py-0.5 px-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow-lg animate-bounce flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                抓漏 UNO!
              </button>
            )}
          </div>
        )}

        {/* CENTER TABLE PILES */}
        <div className="relative z-10 -mt-12 flex flex-col items-center justify-center gap-3 pointer-events-auto">
          {rabbidsEventBanner && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-1.5 rounded-full bg-gradient-to-r from-pink-600 via-amber-500 to-purple-600 border-2 border-yellow-200 text-white font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(236,72,153,0.9)] animate-bounce flex items-center gap-1.5 whitespace-nowrap">
              <span>{rabbidsEventBanner}</span>
            </div>
          )}

          {skippedPlayerInfo && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-red-600 border-2 border-yellow-300 text-white font-black text-xs sm:text-sm shadow-2xl animate-bounce flex items-center gap-1.5 whitespace-nowrap">
              <span>🚫 【{skippedPlayerInfo.sourceName}】出禁止牌！跳過【{skippedPlayerInfo.playerName}】！</span>
            </div>
          )}

          {isDealing && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-5 py-2 rounded-full bg-black/90 border-2 border-amber-400 text-amber-300 font-extrabold text-xs sm:text-sm shadow-2xl animate-pulse flex items-center gap-2 whitespace-nowrap backdrop-blur-md">
              <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>開局發牌中，請稍候...</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-10 sm:gap-14">
            {/* Draw Pile */}
            <div className="flex flex-col items-center gap-2.5">
              <div
                style={{ transform: 'perspective(600px) rotateX(22deg) rotateZ(-4deg)' }}
                className="relative transition-transform duration-150 hover:scale-105"
              >
                {explosiveActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-black text-white border border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-bounce flex items-center gap-1 whitespace-nowrap">
                    <span>💣 +4 炸彈</span>
                  </div>
                )}
                <div
                  ref={drawPileRef}
                  onClick={isContinuousDrawing ? undefined : handleDrawWithAnimation}
                  title={
                    isContinuousDrawing
                      ? '正在結算動畫中...'
                      : (hasDrawnThisTurn && stackedDrawCount === 0)
                      ? '本回合已抽過牌，請打出手牌或點擊過牌'
                      : '點擊抽一張牌'
                  }
                  className={`relative deck-3d-stack ${
                    explosiveActive ? 'ring-4 ring-red-500 shadow-[0_0_25px_rgba(239,68,68,0.85)] rounded-xl' : ''
                  } ${
                    isContinuousDrawing
                      ? 'cursor-wait opacity-80'
                      : (hasDrawnThisTurn && stackedDrawCount === 0)
                      ? 'cursor-not-allowed opacity-75'
                      : 'cursor-pointer active:scale-95'
                  }`}
                >
                  <CardView deckTheme={deckTheme} isBack />
                </div>
              </div>

              <div className="bg-black/80 px-3.5 py-0.5 rounded-full text-xs font-bold text-gray-200 border border-white/20 shadow-md">
                {drawPileCount || 80} 張
              </div>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center gap-2.5">
              <div
                ref={discardPileRef}
                style={{ transform: 'perspective(600px) rotateX(22deg)' }}
                className="relative w-20 h-30 sm:w-24 sm:h-36 flex items-center justify-center"
              >
                {recentDiscardPile && recentDiscardPile.length > 1 && recentDiscardPile.slice(0, -1).map((discardedCard, idx) => (
                  <div
                    key={discardedCard.id || idx}
                    className="absolute inset-0 pointer-events-none transition-all duration-300 flex items-center justify-center"
                    style={{
                      transform: `translate(${discardedCard.offsetX || 0}px, ${discardedCard.offsetY || 0}px) rotate(${discardedCard.rot || (idx * 10 - 15)}deg)`,
                      zIndex: idx
                    }}
                  >
                    <CardView deckTheme={deckTheme} card={discardedCard} className="shadow-md filter brightness-90" />
                  </div>
                ))}

                <div
                  className={`relative z-10 transition-transform duration-200 ${
                    topCard && vanishingCardId === topCard.id ? 'rabbids-vanish-card' : ''
                  }`}
                  style={{
                    transform: recentDiscardPile?.length
                      ? `translate(${recentDiscardPile[recentDiscardPile.length - 1].offsetX || 0}px, ${recentDiscardPile[recentDiscardPile.length - 1].offsetY || 0}px) rotate(${recentDiscardPile[recentDiscardPile.length - 1].rot || -3}deg)`
                      : 'rotate(-3deg)'
                  }}
                >
                  <CardView deckTheme={deckTheme} card={topCard} isTopCard className="shadow-xl" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-[#0a1c12]/95 border border-white/20 shadow-md text-xs font-bold text-white">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{
                    backgroundColor: activeColorInfo.hex,
                    boxShadow: `0 0 8px ${activeColorInfo.hex}`
                  }}
                />
                <span>{activeColorInfo.name}</span>
              </div>
            </div>
          </div>

          {/* Status Indicators (Explosive Bomb & Hurry Up 3s Blitz) */}
          {(explosiveActive || hurryUpTurns > 0) && (
            <div className="flex flex-col items-center gap-1.5 z-20 mt-1 mb-0.5">
              {explosiveActive && (
                <div className="animate-bounce flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-red-600 to-amber-600 border border-red-300 text-white text-[11px] font-black shadow-[0_0_20px_rgba(239,68,68,0.9)]">
                  <span>💣 炸彈已安裝！下位抽牌者承受 +4 張炸彈重創！</span>
                </div>
              )}
              {hurryUpTurns > 0 && (
                <div className="animate-pulse flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 border border-yellow-200 text-black text-[11px] font-black shadow-[0_0_20px_rgba(245,158,11,0.9)]">
                  <span>⚡ 瘋狂快抽 3秒限時 (剩 {hurryUpTurns} 回合)</span>
                </div>
              )}
            </div>
          )}

          {/* Direction & Game Status Bar */}
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-black/75 border border-white/15 text-xs font-bold text-gray-200 shadow">
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

        {/* BOTTOM SEAT: HUMAN PLAYER CONTROLS & HAND */}
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 z-30 flex flex-col items-center pointer-events-auto">
          <div className="w-full max-w-4xl flex items-center justify-between px-6 mb-1.5">
            <PlayerInfoPill
              player={{ ...myPlayer, name: myPlayer.name || '你 (玩家)' }}
              cardCount={displayedHand.length}
              avatar="👤"
              isLocal
              isHost={isHost}
              isActiveTurn={currentTurn === myIndex && !isDealing && !isContinuousDrawing}
              isSkipped={skippedPlayerInfo && skippedPlayerInfo.playerId === myIndex}
              isChoosingColor={isChoosingColor && colorChoosingPlayerIndex === myIndex}
              isContinuousDrawing={isContinuousDrawing && drawingPlayerIndex === myIndex}
              drawingStepCount={drawingStepCount}
              showTimer={((currentTurn === myIndex && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === myIndex)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over'}
              turnStartTime={turnStartTime}
              turnDuration={turnDuration || (isChoosingColor ? 6 : 15)}
              timerPosition="right"
            />

            {/* Action Buttons Group */}
            <div className="flex items-center gap-2 sm:gap-2.5">
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
                  <span>開局發牌中...</span>
                </span>
              ) : isContinuousDrawing ? (
                <span className="text-xs text-sky-300 font-bold px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-400/40 flex items-center gap-1.5 animate-pulse">
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>{drawingPlayerIndex !== null ? `發牌結算中 (${drawingStepCount || 1})...` : '特殊效果發動中...'}</span>
                </span>
              ) : (
                <>
                  {!isMyTurn && !isChoosingColor && !isForcedPenalty && (
                    <span className="text-xs text-gray-300 font-medium px-3 py-1 rounded-full bg-black/50 border border-white/10 hidden sm:inline-block">
                      等待對手行動中...
                    </span>
                  )}

                  {players.some((p) => p.unoVulnerable && p.id !== myIndex) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = players.find((p) => p.unoVulnerable && p.id !== myIndex);
                        if (target) onChallengeUno(target.id);
                      }}
                      className="py-1.5 px-3.5 rounded-full bg-red-600/80 hover:bg-red-600 border border-red-400 text-white font-bold text-xs shadow-lg animate-pulse"
                    >
                      抓漏
                    </button>
                  )}

                  {isMyTurn && !isChoosingColor && hasDrawnThisTurn && stackedDrawCount === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalHasDrawn(false);
                        onPassTurn();
                      }}
                      className="py-1.5 px-4 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-xs shadow transition"
                    >
                      過牌 (Pass)
                    </button>
                  )}

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

                  {isMyTurn && !isChoosingColor && canChallengeWildDraw4 && (
                    <button
                      type="button"
                      onClick={onChallengeWildDraw4}
                      className="py-1.5 px-4 rounded-full font-black text-xs shadow-xl transition active:scale-95 bg-amber-500 hover:bg-amber-400 text-black border-2 border-yellow-200 animate-bounce flex items-center gap-1.5"
                    >
                      <span>質疑 +4！{lastWildDraw4PlayerName ? `(${lastWildDraw4PlayerName})` : ''}</span>
                    </button>
                  )}

                  {currentTurn === myIndex && !isDealing && !isContinuousDrawing && !isChoosingColor && (
                    isForcedPenalty ? (
                      <div className="py-1.5 px-3.5 sm:px-4 rounded-full font-bold text-xs bg-red-950/90 border border-red-500/60 text-red-300 flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span>自動承受罰抽 (+{stackedDrawCount})</span>
                      </div>
                    ) : (!hasDrawnThisTurn || stackedDrawCount > 0) && (
                      <button
                        type="button"
                        disabled={isContinuousDrawing}
                        onClick={handleDrawWithAnimation}
                        className="py-1.5 px-4 rounded-full font-extrabold text-xs shadow-lg transition duration-150 flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white active:scale-95 disabled:opacity-50"
                      >
                        <span>{stackedDrawCount > 0 ? '承受罰抽' : '抽牌'}</span>
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

          {/* Straight Level Hand Cards */}
          {(() => {
            const isMeChallenged = wild4ChallengeAnim && wild4ChallengeAnim.challengedId === myIndex;

            return (
              <div
                ref={myHandRef}
                className={`w-full max-w-4xl px-4 pt-1 pb-1 overflow-visible flex items-center justify-center min-h-[125px] ${
                  isMeChallenged && !wild4ChallengeAnim.isSuccess ? 'challenge-hand-shake' : ''
                }`}
              >
                <div className="flex items-center justify-center -space-x-5 sm:-space-x-6 md:-space-x-7 overflow-visible transition-all">
                  {handToDisplay.map((card, idx) => {
                    const isPlayable = isMyTurn && validCards.includes(card.id);
                    const isCulpritCard = isMeChallenged && wild4ChallengeAnim.matchingCardIds?.includes(card.id);

                    let translateY = isHandCollapsed ? 16 : (isMyTurn ? 0 : 8);
                    let scale = isMyTurn ? (isHandCollapsed ? 0.94 : 1) : 0.95;
                    let filter = (isDealing || isContinuousDrawing)
                      ? 'brightness(0.7) saturate(80%)'
                      : (isMyTurn ? 'brightness(1) saturate(100%)' : 'brightness(0.68) saturate(85%)');

                    if (isMeChallenged) {
                      if (isCulpritCard) {
                        translateY = -28;
                        scale = 1.15;
                        filter = 'brightness(1.25) drop-shadow(0 0 18px rgba(34, 197, 94, 0.95))';
                      } else if (wild4ChallengeAnim.isSuccess) {
                        filter = 'brightness(0.35) saturate(50%)';
                      }
                    }

                    return (
                      <div
                        key={card.id}
                        style={{
                          transform: `translateY(${translateY}px) scale(${scale})`,
                          transformOrigin: 'bottom center',
                          filter,
                          transitionProperty: 'transform, filter',
                          transitionDuration: '320ms',
                          transitionTimingFunction: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
                          transitionDelay: isHandCollapsed ? '0ms' : `${idx * 20}ms`,
                          pointerEvents: isMyTurn ? 'auto' : 'none',
                          zIndex: isCulpritCard ? 45 : undefined
                        }}
                        className={`relative overflow-visible transition-transform duration-200 ${
                          isMyTurn ? 'hover:z-40 hover:!-translate-y-5 cursor-pointer' : 'select-none'
                        }`}
                      >
                        {isCulpritCard && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-green-500 text-black text-[10px] font-black shadow-[0_0_12px_rgba(34,197,94,0.9)] animate-bounce z-50">
                            違規同色
                          </div>
                        )}
                        <CardView
                          deckTheme={deckTheme}
                          card={card}
                          isPlayable={isPlayable}
                          onClick={(e) => handleCardClick(card, e?.currentTarget)}
                          className={isCulpritCard ? 'shadow-[0_0_25px_rgba(34,197,94,0.95)] ring-2 ring-green-400' : 'shadow-2xl'}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Wild Color Picker Modal */}
        <WildColorModal
          isOpen={isChoosingColor && colorChoosingPlayerIndex === myIndex}
          turnStartTime={turnStartTime}
          turnDuration={turnDuration || 6}
          myColorCounts={myColorCounts}
          onSelectColor={handleConfirmWildColor}
        />

        {/* Wild 4 Challenge Inspection & Verdict Overlay */}
        <Wild4ChallengeOverlay
          wild4ChallengeAnim={wild4ChallengeAnim}
          myIndex={myIndex}
          seatDirection={challengeSeatDirection}
          deckTheme={deckTheme}
        />
      </main>

      {/* Game Log Drawer */}
      {showLogDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[#071626]/95 border-l border-emerald-500/20 shadow-2xl p-4 backdrop-blur-md flex flex-col">
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