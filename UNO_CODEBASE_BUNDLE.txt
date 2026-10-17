# UNO Multiplayer - Full Source Code Package

> Generated for AI prompt / code review. Contains the entire architecture, game engine, P2P networking, and UI components.

## Table of Contents

1. [package.json](#package-json)
2. [vite.config.js](#vite-config-js)
3. [vercel.json](#vercel-json)
4. [index.html](#index-html)
5. [src/main.jsx](#src-main-jsx)
6. [src/App.jsx](#src-App-jsx)
7. [src/index.css](#src-index-css)
8. [src/game/unoEngine.js](#src-game-unoEngine-js)
9. [src/game/unoAi.js](#src-game-unoAi-js)
10. [src/game/hostGameController.js](#src-game-hostGameController-js)
11. [src/services/p2p.js](#src-services-p2p-js)
12. [src/services/sound.js](#src-services-sound-js)
13. [src/services/animation.js](#src-services-animation-js)
14. [src/components/HomeView.jsx](#src-components-HomeView-jsx)
15. [src/components/LobbyView.jsx](#src-components-LobbyView-jsx)
16. [src/components/GameTableView.jsx](#src-components-GameTableView-jsx)
17. [src/components/table/TurnTimerCircle.jsx](#src-components-table-TurnTimerCircle-jsx)
18. [src/components/table/OpponentHand3D.jsx](#src-components-table-OpponentHand3D-jsx)
19. [src/components/table/PlayerInfoPill.jsx](#src-components-table-PlayerInfoPill-jsx)
20. [src/components/table/WildColorModal.jsx](#src-components-table-WildColorModal-jsx)
21. [src/components/table/Wild4ChallengeOverlay.jsx](#src-components-table-Wild4ChallengeOverlay-jsx)
22. [src/components/CardView.jsx](#src-components-CardView-jsx)
23. [src/components/VictoryModal.jsx](#src-components-VictoryModal-jsx)

---

## package.json

```json
{
  "name": "uno-multiplayer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "canvas-confetti": "^1.9.4",
    "lucide-react": "^1.55.0",
    "peerjs": "^1.5.5",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1",
    "oxlint": "^1.81.0",
    "vite": "^8.3.0"
  }
}

```

## vite.config.js

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
})

```

## vercel.json

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

```

## index.html

```html
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/cards_modern/wild.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>UNO! 線上多人對戰 (P2P Host-Authoritative)</title>
  </head>
  <body class="bg-[#07170e] text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

```

## src/main.jsx

```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```

## src/App.jsx

```javascript
// 檔案位置：src/App.jsx
import React, { useState, useEffect } from 'react';
import { HomeView } from './components/HomeView';
import { LobbyView } from './components/LobbyView';
import { GameTableView } from './components/GameTableView';
import { VictoryModal } from './components/VictoryModal';
import { p2pNetwork } from './services/p2p';
import { preloadDeckAssets, isDeckThemeLoaded } from './services/assetPreloader';
import { AlertCircle, X, RotateCw } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); // 'home' | 'lobby' | 'game'
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [spectators, setSpectators] = useState([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const [allowStacking, setAllowStacking] = useState(true);
  const [allowChallengeWildDraw4, setAllowChallengeWildDraw4] = useState(true);
  const [gameMode, setGameMode] = useState('ffa'); // 'ffa' | '2v2'
  const [targetScore, setTargetScore] = useState(500);
  const [drawRule, setDrawRule] = useState('draw_one');
  const [deckTheme, setDeckTheme] = useState('classic');
  const [gameState, setGameState] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Asset Preloading State before entering match
  const [isPreloadingAssets, setIsPreloadingAssets] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  // Background warm-up preloading when app mounts or theme changes
  useEffect(() => {
    preloadDeckAssets(deckTheme);
  }, [deckTheme]);

  useEffect(() => {
    p2pNetwork.onLobbyUpdate = (data) => {
      setLobbyPlayers([...(data.players || [])]);
      setSpectators([...(data.spectators || [])]);
      if (data.isSpectator !== undefined) setIsSpectator(!!data.isSpectator);
      setAllowStacking(data.allowStacking);
      if (data.allowChallengeWildDraw4 !== undefined) setAllowChallengeWildDraw4(data.allowChallengeWildDraw4);
      setGameMode(data.gameMode || 'ffa');
      setRoomCode(data.roomCode);
      if (data.targetScore !== undefined) setTargetScore(data.targetScore);
      if (data.drawRule) setDrawRule(data.drawRule);
      if (data.deckTheme) setDeckTheme(data.deckTheme);
      setView((prev) => (prev === 'home' ? 'lobby' : prev));
    };

    p2pNetwork.onStateUpdate = (state) => {
      const theme = state.deckTheme || 'classic';
      if (!isDeckThemeLoaded(theme)) {
        setIsPreloadingAssets(true);
        preloadDeckAssets(theme, ({ percent }) => {
          setPreloadProgress(percent);
        }).then(() => {
          setIsPreloadingAssets(false);
          setGameState({ ...state });
          if (state.spectators) setSpectators([...state.spectators]);
          if (state.isSpectator !== undefined) setIsSpectator(!!state.isSpectator);
          setView((prev) => (prev !== 'game' ? 'game' : prev));
        });
      } else {
        setGameState({ ...state });
        if (state.spectators) setSpectators([...state.spectators]);
        if (state.isSpectator !== undefined) setIsSpectator(!!state.isSpectator);
        setView((prev) => (prev !== 'game' ? 'game' : prev));
      }
    };

    p2pNetwork.onReturnToLobby = (data) => {
      if (data && data.players) setLobbyPlayers([...data.players]);
      if (data && data.spectators) setSpectators([...data.spectators]);
      if (data && data.isSpectator !== undefined) setIsSpectator(!!data.isSpectator);
      if (data && data.allowChallengeWildDraw4 !== undefined) setAllowChallengeWildDraw4(data.allowChallengeWildDraw4);
      if (data && data.targetScore !== undefined) setTargetScore(data.targetScore);
      if (data && data.drawRule) setDrawRule(data.drawRule);
      if (data && data.deckTheme) setDeckTheme(data.deckTheme);
      setView('lobby');
    };

    p2pNetwork.onRoomDisbanded = (reason) => {
      setErrorMessage(reason || '房主已解散房間！');
      setGameState(null);
      setLobbyPlayers([]);
      setSpectators([]);
      setIsSpectator(false);
      setView('home');
      window.location.hash = '';
      setTimeout(() => setErrorMessage(''), 5000);
    };

    p2pNetwork.onError = (msg) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 5000);
    };

    return () => {
      p2pNetwork.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isHost && p2pNetwork.isHost) {
        p2pNetwork.disbandRoom('房主已關閉頁面，房間已自動解散！');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isHost]);

  const handleCreateRoom = (code, hostName, stacking, mode = 'ffa') => {
    setIsHost(true);
    setIsSpectator(false);
    setRoomCode(code);
    setAllowStacking(stacking);
    setGameMode(mode);
    p2pNetwork.createRoom(code, hostName, stacking, mode);
    setView('lobby');
  };

  const handleJoinRoom = (code, guestName) => {
    setIsHost(false);
    setRoomCode(code);
    p2pNetwork.joinRoom(code, guestName);
    setView('lobby');
  };

  // Host starts game: Ensure all card images for the chosen theme are 100% preloaded before dealing!
  const handleStartGame = async () => {
    if (!isDeckThemeLoaded(deckTheme)) {
      setIsPreloadingAssets(true);
      setPreloadProgress(0);
      await preloadDeckAssets(deckTheme, ({ percent }) => {
        setPreloadProgress(percent);
      });
      setIsPreloadingAssets(false);
    }
    p2pNetwork.startGame();
  };

  const handleToggleAi = (slotIndex) => {
    p2pNetwork.toggleSlotAi(slotIndex);
  };

  const handleToggleStacking = () => {
    p2pNetwork.toggleStackingRule();
  };

  const handleToggleChallengeRule = () => {
    p2pNetwork.toggleChallengeRule();
  };

  const handleSetTargetScore = (score) => {
    setTargetScore(score);
    p2pNetwork.setTargetScore(score);
  };

  const handleSetDrawRule = (rule) => {
    setDrawRule(rule);
    p2pNetwork.setDrawRule(rule);
  };

  const handleSetDeckTheme = (theme) => {
    setDeckTheme(theme);
    p2pNetwork.setDeckTheme(theme);
  };

  const handleNextRound = (resetMatch = false) => {
    p2pNetwork.startNextRound(resetMatch);
  };

  const handleReturnToLobby = () => {
    p2pNetwork.returnToLobby();
    setView('lobby');
  };

  const handleSetGameMode = (mode) => {
    setGameMode(mode);
    p2pNetwork.setGameMode(mode);
  };

  const handleSetFfaCount = (count) => {
    p2pNetwork.setFfaPlayerCount(count);
  };

  const handleSwapSlots = (idxA, idxB) => {
    p2pNetwork.swapSlots(idxA, idxB);
  };

  const handleKickPlayer = (slotIndex, reason = '房主已將你移出房間！') => {
    if (!isHost) return;
    p2pNetwork.kickPlayer(slotIndex, reason);
  };

  const handleMoveToSpectator = (slotIndex) => {
    if (isHost) {
      p2pNetwork.moveToSpectator(slotIndex);
    }
  };

  const handleMoveSpectatorToSlot = (peerId) => {
    if (isHost) {
      p2pNetwork.moveSpectatorToSlot(peerId);
    }
  };

  const handleKickSpectator = (peerId) => {
    if (isHost) {
      p2pNetwork.kickSpectator(peerId);
    }
  };

  const handleClientToggleSpectate = () => {
    if (!isHost) {
      p2pNetwork.clientToggleSpectate();
    }
  };

  const handleLeaveRoom = () => {
    if (isHost) {
      p2pNetwork.disbandRoom('房主已解散房間！');
    } else {
      p2pNetwork.disconnect();
    }
    setGameState(null);
    setLobbyPlayers([]);
    setSpectators([]);
    setIsSpectator(false);
    setView('home');
    window.location.hash = '';
  };

  const handlePlayCard = (cardId, chosenColor, calledUno) => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostPlayCard(cardId, chosenColor, calledUno);
    } else {
      p2pNetwork.clientPlayCard(cardId, chosenColor, calledUno);
    }
  };

  const handleDrawCard = () => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostDrawCard();
    } else {
      p2pNetwork.clientDrawCard();
    }
  };

  const handlePassTurn = () => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostPassTurn();
    } else {
      p2pNetwork.clientPassTurn();
    }
  };

  const handleCallUno = () => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostCallUno();
    } else {
      p2pNetwork.clientCallUno();
    }
  };

  const handleChallengeUno = (targetIndex) => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostChallengeUno(targetIndex);
    } else {
      p2pNetwork.clientChallengeUno(targetIndex);
    }
  };

  const handleChallengeWildDraw4 = () => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostChallengeWildDraw4();
    } else {
      p2pNetwork.clientChallengeWildDraw4();
    }
  };

  const handleChooseColor = (chosenColor) => {
    if (isSpectator) return;
    if (isHost) {
      p2pNetwork.hostChooseColor(chosenColor);
    } else {
      p2pNetwork.clientChooseColor(chosenColor);
    }
  };

  return (
    <div className="relative min-h-[100dvh]">
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-bold shadow-2xl animate-bounce">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Full-Deck Asset Preloader Modal before entering match */}
      {isPreloadingAssets && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none">
          <div className="w-full max-w-sm rounded-3xl bg-[#0b2315] border-2 border-amber-400/60 p-6 shadow-2xl flex flex-col items-center text-center gap-3">
            <RotateCw className="w-9 h-9 text-amber-400 animate-spin" />
            <div className="text-base font-black text-white">
              正在載入牌桌卡面素材 ({preloadProgress}%)...
            </div>
            <div className="text-xs text-emerald-300/80">
              正在將全套高清卡牌寫入快取，確保對局流暢不破圖
            </div>
            <div className="w-full h-3 rounded-full bg-black/60 border border-emerald-500/30 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-150"
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'home' && (
        <HomeView
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {view === 'lobby' && (
        <LobbyView
          roomCode={roomCode}
          isHost={isHost}
          players={lobbyPlayers}
          spectators={spectators}
          isSpectator={isSpectator}
          gameMode={gameMode}
          allowStacking={allowStacking}
          allowChallengeWildDraw4={allowChallengeWildDraw4}
          targetScore={targetScore}
          drawRule={drawRule}
          deckTheme={deckTheme}
          onSetDeckTheme={handleSetDeckTheme}
          onToggleAi={handleToggleAi}
          onToggleStacking={handleToggleStacking}
          onToggleChallengeRule={handleToggleChallengeRule}
          onSetTargetScore={handleSetTargetScore}
          onSetDrawRule={handleSetDrawRule}
          onSetGameMode={handleSetGameMode}
          onSetFfaCount={handleSetFfaCount}
          onSwapSlots={handleSwapSlots}
          onKickPlayer={handleKickPlayer}
          onMoveToSpectator={handleMoveToSpectator}
          onMoveSpectatorToSlot={handleMoveSpectatorToSlot}
          onKickSpectator={handleKickSpectator}
          onClientToggleSpectate={handleClientToggleSpectate}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {view === 'game' && gameState && (
        <GameTableView
          gameState={gameState}
          roomCode={roomCode}
          isHost={isHost}
          onPlayCard={handlePlayCard}
          onChooseColor={handleChooseColor}
          onDrawCard={handleDrawCard}
          onPassTurn={handlePassTurn}
          onCallUno={handleCallUno}
          onChallengeUno={handleChallengeUno}
          onChallengeWildDraw4={handleChallengeWildDraw4}
          onKickPlayer={handleKickPlayer}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {view === 'game' && gameState && gameState.gameStatus === 'game_over' && (
        <VictoryModal
          winner={gameState.winner}
          isHost={isHost}
          players={gameState.players}
          targetScore={gameState.targetScore}
          isMatchOver={gameState.isMatchOver}
          matchWinner={gameState.matchWinner}
          lastRoundPoints={gameState.lastRoundPoints}
          onNextRound={() => handleNextRound(false)}
          onReturnToLobby={handleReturnToLobby}
          onRestart={() => handleNextRound(true)}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}

```

## src/index.css

```css
@import "tailwindcss";

@layer base {
  :root {
    --felt-bg: #072012;
    --felt-surface: #0f3e22;
    --felt-border: rgba(255, 255, 255, 0.12);
    --gold: #f4c430;
    --gold-hover: #e0b020;
    --card-shadow: 0 16px 32px rgba(0,0,0,0.5), 0 10px 10px rgba(0,0,0,0.3);
  }

  body {
    margin: 0;
    padding: 0;
    background-color: #041209;
    color: #e6f4ea;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    user-select: none;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
}

/* Casino Felt Outer Background */
.felt-table {
  background-color: #041209;
}

/* Custom Scrollbar for Smooth Lobby, Modals & Mobile Menus */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(244, 196, 48, 0.45) rgba(0, 0, 0, 0.35);
  -webkit-overflow-scrolling: touch;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(244, 196, 48, 0.45);
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(244, 196, 48, 0.75);
}

/* =========================================================
   2.5D / 3D TABLE ARENA CONTAINER
   ========================================================= */
.arena-stage {
  position: relative;
  width: 100%;
  max-width: 1440px;
  height: calc(100dvh - 48px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1100px;
  perspective-origin: 50% 42%;
  overflow: hidden;
}

/* Tilted 3D Green Felt Table Surface (Spans from top player to bottom player) */
.table-surface-3d {
  position: absolute;
  width: min(1300px, 95vw);
  height: min(850px, 90dvh);
  top: 48%;
  left: 50%;
  border-radius: 72px;
  background: radial-gradient(
    ellipse at 50% 48%,
    rgba(34, 112, 60, 0.98) 0%,
    rgba(15, 58, 31, 0.99) 62%,
    rgba(6, 24, 12, 1) 100%
  );
  border: 10px solid #2b1b0e;
  box-shadow:
    inset 0 0 90px rgba(0, 0, 0, 0.82),
    0 18px 0 #170e07,
    0 38px 75px rgba(0, 0, 0, 0.95),
    0 0 0 2.5px rgba(244, 196, 48, 0.38);
  transform-origin: 50% 50%;
  transform: translate(-50%, -50%) rotateX(36deg);
  pointer-events: none;
  z-index: 1;
}

/* Inner golden rim line on the felt */
.table-surface-3d::after {
  content: "";
  position: absolute;
  inset: 22px;
  border-radius: 54px;
  border: 1.5px solid rgba(244, 196, 48, 0.16);
  pointer-events: none;
}

/* Active Turn Pill Ring */
.active-turn-ring {
  border-color: #f4c430 !important;
  background: rgba(30, 65, 38, 0.95) !important;
  box-shadow: 0 0 18px rgba(244, 196, 48, 0.65), 0 4px 12px rgba(0, 0, 0, 0.5) !important;
}

/* Card Landing Impact Bounce */
@keyframes impact-bounce {
  0% { transform: scale(1); }
  40% { transform: scale(1.08) rotate(-2deg); }
  100% { transform: scale(1); }
}
.impact-bounce {
  animation: impact-bounce 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

/* Skip Card Impact Shake */
@keyframes skip-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px) rotate(-3deg); }
  40%, 80% { transform: translateX(6px) rotate(3deg); }
}
.skip-shake {
  animation: skip-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

/* UNO Alert Pulse */
@keyframes uno-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 0 35px rgba(239, 68, 68, 0.95);
  }
}
.uno-alert-btn {
  animation: uno-pulse 1.1s infinite ease-in-out;
}

/* Steam UNO Rabbids Special Event Card Vanish / Fade-Out Animation on Discard Pile */
@keyframes rabbids-card-vanish {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0px);
    filter: brightness(1.15) drop-shadow(0 0 18px rgba(250, 204, 21, 0.85));
  }
  45% {
    opacity: 0.95;
    transform: scale(1.12) translateY(-8px);
    filter: brightness(1.35) drop-shadow(0 0 28px rgba(244, 114, 182, 0.95));
  }
  100% {
    opacity: 0;
    transform: scale(1.24) translateY(-18px);
    filter: brightness(1.6) blur(4px);
  }
}
.rabbids-vanish-card {
  animation: rabbids-card-vanish 1.05s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* Card Standing Mirror Reflection on the Table Gloss */
.card-reflection {
  -webkit-box-reflect: below 3px linear-gradient(transparent, transparent 62%, rgba(0, 0, 0, 0.32));
}

/* 3D Realistic Deck Stack Depth */
.deck-3d-stack {
  position: relative;
  box-shadow: 
    -1px 2px 0 #e2e8f0,
    -2px 4px 0 #cbd5e1,
    -3px 6px 0 #94a3b8,
    -4px 8px 0 #64748b,
    -5px 10px 0 #334155,
    -6px 12px 0 #1e293b,
    -8px 18px 24px rgba(0, 0, 0, 0.85);
  border-radius: 12px;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* ==========================================================
   STEAM UNO +4 CHALLENGE HAND INSPECTION ANIMATIONS
   ========================================================== */
@keyframes transport-from-top {
  0% {
    transform: translateY(-340px) scale(0.65);
    opacity: 0;
  }
  16% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  82% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-340px) scale(0.65);
    opacity: 0;
  }
}
.challenge-transport-top {
  animation: transport-from-top 2.45s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}

@keyframes transport-from-left {
  0% {
    transform: translateX(-420px) scale(0.65);
    opacity: 0;
  }
  16% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  82% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(-420px) scale(0.65);
    opacity: 0;
  }
}
.challenge-transport-left {
  animation: transport-from-left 2.45s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}

@keyframes transport-from-right {
  0% {
    transform: translateX(420px) scale(0.65);
    opacity: 0;
  }
  16% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  82% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateX(420px) scale(0.65);
    opacity: 0;
  }
}
.challenge-transport-right {
  animation: transport-from-right 2.45s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}

@keyframes challenge-culprit-lift {
  0% {
    transform: translateY(0) scale(1);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  }
  100% {
    transform: translateY(-28px) scale(1.15);
    box-shadow: 0 0 25px rgba(34, 197, 94, 0.95), 0 0 45px rgba(34, 197, 94, 0.6);
    filter: brightness(1.2) drop-shadow(0 0 16px rgba(34, 197, 94, 0.95));
  }
}
.challenge-card-lift {
  animation: challenge-culprit-lift 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s forwards;
  z-index: 30;
}

@keyframes challenge-hand-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-10px) rotate(-1.5deg); }
  20%, 40%, 60%, 80% { transform: translateX(10px) rotate(1.5deg); }
}
.challenge-hand-shake {
  animation: challenge-hand-shake 0.85s cubic-bezier(0.36, 0.07, 0.19, 0.97) 0.45s both;
}

@keyframes verdict-badge-pop {
  0% {
    transform: scale(0) rotate(-25deg);
    opacity: 0;
  }
  55% {
    transform: scale(1.2) rotate(6deg);
    opacity: 1;
  }
  75% {
    transform: scale(0.95) rotate(-2deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}
.challenge-verdict-pop {
  animation: verdict-badge-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both;
}

/* ==========================================================
   STEAM UNO STYLE BLACK-STROKE WHITE-FILL "+N" HAND INDICATOR
   ========================================================== */
@keyframes uno-plus-pop {
  0% {
    transform: scale(0.4) translateY(12px);
    opacity: 0;
  }
  60% {
    transform: scale(1.18) translateY(-4px);
    opacity: 1;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.uno-plus-indicator {
  font-family: "Arial Black", "Impact", system-ui, -apple-system, sans-serif;
  font-weight: 900;
  color: #ffffff;
  -webkit-text-stroke: 3.5px #000000;
  paint-order: stroke fill;
  text-shadow:
    0 4px 0 #000000,
    0 8px 18px rgba(0, 0, 0, 0.9);
  animation: uno-plus-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  letter-spacing: -0.03em;
  line-height: 1;
  user-select: none;
  pointer-events: none;
}


```

## src/game/unoEngine.js

```javascript
// 檔案位置：src/game/unoEngine.js
// Authoritative UNO Game Engine with Stacking, State Masking, 2v2 Team Mode & Rabbids DLC

export class UnoEngine {
  constructor(playerCount = 4, customPlayers = null, allowStacking = true, gameMode = 'ffa', options = {}) {
    this.gameMode = gameMode; // 'ffa' | '2v2'
    this.playerCount = this.gameMode === '2v2' ? 4 : Math.max(2, Math.min(4, playerCount));
    this.colors = ['red', 'yellow', 'green', 'blue'];
    this.colorHex = {
      red: '#ef4444',
      yellow: '#eab308',
      green: '#22c55e',
      blue: '#3b82f6',
      wild: '#1f2937'
    };
    this.colorNames = {
      red: '紅色',
      yellow: '黃色',
      green: '綠色',
      blue: '藍色',
      wild: '黑色萬用'
    };

    this.allowStacking = allowStacking;
    this.customPlayers = customPlayers;
    this.targetScore = options.targetScore !== undefined ? options.targetScore : 500;
    this.drawRule = options.drawRule || 'draw_one'; // 'draw_one' | 'draw_until_playable'
    this.allowChallengeWildDraw4 = options.allowChallengeWildDraw4 !== undefined ? options.allowChallengeWildDraw4 : true;
    this.deckTheme = options.deckTheme || 'classic'; // 'classic' | 'rabbids'
    this.isMatchOver = false;
    this.matchWinner = null;
    this.lastRoundPoints = 0;
    this.reset();
  }

  reset() {
    this.hurryUpCasterIndex = null;
    this.hurryUpCasterTurnsRemaining = 0;
    this.justCastHurryUp = false;
    this.explosiveActive = false;
    this.vanishingCardId = null;
    this.pendingAdvanceStep = null;

    this.drawPile = this.generateDeck();
    this.shuffle(this.drawPile);
    this.discardPile = [];

    this.stackedDrawCount = 0;
    this.stackedDrawType = null;
    this.lastWildDraw4Info = null;
    this.pendingWildDraw4Info = null;
    this.wild4ChallengeAnim = null;
    this.pendingChallengeResolution = null;
    this.activePenaltyBanner = null;

    this.isContinuousDrawing = false;
    this.drawingPlayerIndex = null;
    this.drawingStepCount = 0;

    const existingScores = this.players ? this.players.map(p => p.score) : null;

    this.players = [];
    for (let i = 0; i < this.playerCount; i++) {
      const pInfo = this.customPlayers ? this.customPlayers[i] : null;
      const teamId = this.gameMode === '2v2' ? (i % 2 === 0 ? 'team_a' : 'team_b') : null;
      const teamName = this.gameMode === '2v2' ? (i % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null;
      const teammateIndex = this.gameMode === '2v2' ? (i + 2) % 4 : null;

      const score = existingScores && existingScores[i] !== undefined
        ? existingScores[i]
        : (pInfo && pInfo.score ? pInfo.score : 0);

      this.players.push({
        id: i,
        name: pInfo ? pInfo.name : (i === 0 ? '房主' : `玩家 ${i + 1}`),
        isHost: pInfo ? !!pInfo.isHost : (i === 0),
        isAi: pInfo ? !!pInfo.isAi : (i !== 0),
        peerId: pInfo ? pInfo.peerId : null,
        teamId,
        teamName,
        teammateIndex,
        hand: [],
        calledUno: false,
        unoVulnerable: false,
        pendingUnoCall: false,
        timeoutCount: 0,
        score
      });
    }

    for (let r = 0; r < 7; r++) {
      for (let p = 0; p < this.playerCount; p++) {
        this.players[p].hand.push(this.drawCardRaw());
      }
    }

    let firstCard = this.drawCardRaw();
    while (firstCard.value === 'wild_draw4' || firstCard.color === 'wild' || firstCard.value.startsWith('rabbids_')) {
      this.drawPile.unshift(firstCard);
      this.shuffle(this.drawPile);
      firstCard = this.drawCardRaw();
    }
    this.discardPile.push(firstCard);

    this.currentColor = firstCard.color === 'wild' ? 'red' : firstCard.color;
    if (firstCard.color === 'wild') {
      firstCard.chosenColor = this.currentColor;
    }
    this.currentValue = firstCard.value;
    this.direction = 1;
    this.currentTurn = 0;
    this.gameStatus = 'playing';
    this.isDealing = true;
    this.winner = null;
    this.log = [];
    this.hasDrawnThisTurn = false;
    this.turnDuration = 15;
    this.turnStartTime = null;
    this.isChoosingColor = false;
    this.colorChoosingPlayerIndex = null;
    this.pendingWildCard = null;

    this.initialCard = firstCard;
  }

  // Steam UNO Rabbids: Remove temporary special card (Hurry Up, Explosive, Comin' Through, or Deflecting Shield)
  // after its tabletop animation finishes, AND unconditionally advance the turn to the next player!
  vanishTopSpecialCard(cardId) {
    const removedId = cardId || this.vanishingCardId;
    if (removedId) {
      const idx = this.discardPile.findIndex(c => c.id === removedId);
      if (idx !== -1 && this.discardPile.length > 1) {
        this.discardPile.splice(idx, 1);
      }
    }

    this.vanishingCardId = null;
    this.isContinuousDrawing = false;

    // 強制推進回合至下一位玩家（預設 step = 1），絕不留在原出牌者身上！
    const step = (this.pendingAdvanceStep !== null && this.pendingAdvanceStep !== undefined)
      ? this.pendingAdvanceStep
      : 1;
    this.pendingAdvanceStep = null;
    this.hasDrawnThisTurn = false;

    // 結算當前出牌者的個人回合
    this.processHurryUpTurnEnd(this.currentTurn, null);

    this.currentTurn = this.getNextTurnIndex(step);
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();

    // 明確標記本次狀態更新為「特殊牌淡出消失」，防止前端誤以為底下的舊頂牌被重新打出！
    this.lastAction = {
      type: 'special_vanished',
      cardId: removedId,
      timestamp: Date.now()
    };
  }

  // 當兔兔盾牌反彈罰抽時，將牌發給下一位玩家（下家），若抽牌堆有炸彈則一併引爆 (+3)！
  executeShieldDeflectDraw(victimIndex, count) {
    if (count <= 0 || !this.players[victimIndex]) return [];
    const extraBomb = this.checkAndTriggerExplosive(victimIndex);
    const totalCount = count + extraBomb;
    this.activePenaltyBanner = { playerId: victimIndex, count: totalCount };
    const drawn = this.drawCardsForPlayer(victimIndex, count);
    this.addLog(`🛡️ 兔兔盾牌反彈生效！【${this.players[victimIndex].name}】承受了 +${totalCount} 張抽牌${extraBomb > 0 ? ' (含炸彈引爆 +3 張)' : ''}，現在輪到 ${this.players[victimIndex].name} 出牌！`);
    return drawn;
  }

  // Steam UNO Rabbids Official Rule for Comin' Through!:
  // Wave 1: 5 cards are randomly distributed to everyone EXCEPT the caster.
  // Wave 2: 5 more cards are randomly distributed to EVERYONE including the caster.
  executeCominThroughWave(casterIndex, wave = 1) {
    const countMap = {};

    if (wave === 1) {
      // 找出除了出牌者以外的所有玩家索引
      const opponentIndices = this.players
        .map((_, idx) => idx)
        .filter(idx => idx !== casterIndex);

      if (opponentIndices.length > 0) {
        for (let i = 0; i < 5; i++) {
          const targetIdx = opponentIndices[Math.floor(Math.random() * opponentIndices.length)];
          this.drawCardsForPlayer(targetIdx, 1);
          countMap[targetIdx] = (countMap[targetIdx] || 0) + 1;
        }
      }

      const summary = Object.entries(countMap)
        .map(([idx, cnt]) => `${this.players[idx].name} +${cnt}張`)
        .join('、');
      this.addLog(`🌪️ 【瘋狂借過・第一波】隨機發出 5 張牌給其他玩家（${summary}）！`);
    } else if (wave === 2) {
      // 全場所有玩家（包含出牌者自己）皆可被隨機分配
      for (let i = 0; i < 5; i++) {
        const targetIdx = Math.floor(Math.random() * this.playerCount);
        this.drawCardsForPlayer(targetIdx, 1);
        countMap[targetIdx] = (countMap[targetIdx] || 0) + 1;
      }

      const summary = Object.entries(countMap)
        .map(([idx, cnt]) => `${this.players[idx].name} +${cnt}張`)
        .join('、');
      this.addLog(`🌪️ 【瘋狂借過・第二波】兔兔迴轉無差別隨機發出 5 張牌給全場（${summary}）！`);
    }

    return countMap;
  }

  finishDealing() {
    this.isDealing = false;
    this.turnStartTime = Date.now();
    this.addLog(`🎴 發牌完畢！`);
    if (this.initialCard) {
      this.applyInitialCardAction(this.initialCard);
      this.initialCard = null;
    }
    this.addLog(`輪到【${this.players[this.currentTurn]?.name || '第 1 位玩家'}】行動。`);
    return { success: true };
  }

  applyInitialCardAction(card) {
    const targetPlayer = this.players[this.currentTurn];
    const targetName = targetPlayer ? targetPlayer.name : '第 1 位玩家';

    if (card.value === 'skip') {
      this.addLog(`首張牌是【禁止牌】，跳過 ${targetName}！`);
      this.currentTurn = this.getNextTurnIndex();
    } else if (card.value === 'reverse') {
      if (this.playerCount === 2) {
        this.addLog(`首張牌是【反轉牌】(兩人局視為跳過)，跳過 ${targetName}！`);
        this.currentTurn = this.getNextTurnIndex();
      } else {
        this.direction *= -1;
        this.addLog(`首張牌是【反轉牌】，轉向為逆時針！`);
      }
    } else if (card.value === 'draw2') {
      if (this.allowStacking) {
        this.stackedDrawCount = 2;
        this.stackedDrawType = 'draw2';
        this.addLog(`首張牌是【+2 罰抽牌】，目前累積 +2 張！輪到 ${targetName}，可出 +2 疊牌或抽牌！`);
      } else {
        this.addLog(`首張牌是【+2 罰抽牌】，${targetName} 抽 2 張牌且跳過出牌！`);
        this.drawCardsForPlayer(this.currentTurn, 2);
        this.currentTurn = this.getNextTurnIndex();
      }
    } else if (card.value === 'wild') {
      this.addLog(`首張牌是【萬用牌】，起始玩家 ${targetName} 可自選任意顏色！`);
    }
  }

  generateDeck() {
    const deck = [];
    let idCounter = 1;

    for (const color of this.colors) {
      deck.push({
        id: `c_${idCounter++}`,
        color,
        value: '0',
        assetKey: `${color}_0`,
        points: 0
      });

      for (let n = 1; n <= 9; n++) {
        const val = n.toString();
        deck.push({
          id: `c_${idCounter++}`,
          color,
          value: val,
          assetKey: `${color}_${val}`,
          points: n
        });
        deck.push({
          id: `c_${idCounter++}`,
          color,
          value: val,
          assetKey: `${color}_${val}`,
          points: n
        });
      }

      ['skip', 'reverse', 'draw2'].forEach(action => {
        deck.push({
          id: `c_${idCounter++}`,
          color,
          value: action,
          assetKey: `${color}_${action}`,
          points: 20
        });
        deck.push({
          id: `c_${idCounter++}`,
          color,
          value: action,
          assetKey: `${color}_${action}`,
          points: 20
        });
      });
    }

    for (let i = 0; i < 4; i++) {
      deck.push({
        id: `c_${idCounter++}`,
        color: 'wild',
        value: 'wild',
        assetKey: 'wild',
        points: 50
      });
      deck.push({
        id: `c_${idCounter++}`,
        color: 'wild',
        value: 'wild_draw4',
        assetKey: 'wild_draw4',
        points: 50
      });
    }

    if (this.deckTheme === 'rabbids') {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `c_${idCounter++}`,
          color: 'wild',
          value: 'rabbids_hurry_up',
          assetKey: 'rabbids_hurry_up',
          points: 50
        });
        deck.push({
          id: `c_${idCounter++}`,
          color: 'wild',
          value: 'rabbids_explosive',
          assetKey: 'rabbids_explosive',
          points: 50
        });
        deck.push({
          id: `c_${idCounter++}`,
          color: 'wild',
          value: 'rabbids_comin_through',
          assetKey: 'rabbids_comin_through',
          points: 50
        });
        deck.push({
          id: `c_${idCounter++}`,
          color: 'wild',
          value: 'rabbids_wild_shield',
          assetKey: 'rabbids_wild_shield',
          points: 50
        });
      }
    }

    return deck;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  drawCardRaw() {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length <= 1) {
        this.drawPile = this.generateDeck();
        this.shuffle(this.drawPile);
      } else {
        const top = this.discardPile.pop();
        const recycledCards = this.discardPile.map((c) => {
          if (c.color === 'wild') {
            const { chosenColor, ...rest } = c;
            return { ...rest, displayAssetKey: c.assetKey };
          }
          return { ...c, displayAssetKey: c.assetKey };
        });
        this.drawPile = this.shuffle(recycledCards);
        this.discardPile = [top];
        this.addLog(`牌庫抽盡，棄牌堆重新洗牌放入抽牌堆！`);
      }
    }
    const card = this.drawPile.pop();
    if (card && card.color === 'wild') {
      delete card.chosenColor;
      card.displayAssetKey = card.assetKey;
    }
    return card;
  }

  drawCardsForPlayer(playerIndex, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = this.drawCardRaw();
      this.players[playerIndex].hand.push(card);
      drawn.push(card);
    }
    if (this.players[playerIndex].hand.length > 1) {
      this.players[playerIndex].calledUno = false;
      this.players[playerIndex].unoVulnerable = false;
      this.players[playerIndex].pendingUnoCall = false;
    }
    return drawn;
  }

  getTopCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  // Pure rule check (Never block on isContinuousDrawing here so 'draw_until_playable' can check drawn cards!)
  canPlayCard(card) {
    if (!card) return false;
    if (this.isChoosingColor) return false;

    if (this.stackedDrawCount > 0) {
      if (card.value === 'rabbids_wild_shield') return true;
      if (!this.allowStacking) return false;
      return card.value === this.stackedDrawType;
    }

    if (card.color === 'wild') return true;
    if (card.color === this.currentColor) return true;
    if (card.value === this.currentValue) return true;
    return false;
  }

  getValidCardsForPlayer(playerIndex) {
    if (this.isContinuousDrawing) return [];
    const p = this.players[playerIndex];
    if (!p) return [];
    return p.hand.filter(c => this.canPlayCard(c));
  }

  getNextTurnIndex(step = 1) {
    let next = (this.currentTurn + this.direction * step) % this.playerCount;
    if (next < 0) next += this.playerCount;
    return next;
  }

  getBestColorForPlayer(playerIndex) {
    const player = this.players[playerIndex];
    if (!player || player.hand.length === 0) return 'red';
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    player.hand.forEach(c => {
      if (counts[c.color] !== undefined) counts[c.color]++;
    });
    let best = 'red';
    let maxC = -1;
    for (const [col, count] of Object.entries(counts)) {
      if (count > maxC) {
        maxC = count;
        best = col;
      }
    }
    return best;
  }

  get hurryUpTurns() {
    return this.hurryUpCasterTurnsRemaining || 0;
  }

  set hurryUpTurns(val) {
    this.hurryUpCasterTurnsRemaining = val;
  }

  getActiveTurnDuration() {
    return this.hurryUpCasterTurnsRemaining > 0 ? 3 : 15;
  }

  consumeTurnDuration() {
    return this.getActiveTurnDuration();
  }

  processHurryUpTurnEnd(endingPlayerIndex, skippedPlayerIndex = null) {
    if (this.hurryUpCasterTurnsRemaining <= 0) return;

    if (this.justCastHurryUp) {
      // 本回合剛打出瘋狂快抽，此時出牌者結束的是打出該牌的當前回合，不計入後續 3 個個人回合！
      this.justCastHurryUp = false;
      return;
    }

    let shouldDecrement = false;
    let reason = '';

    if (endingPlayerIndex === this.hurryUpCasterIndex) {
      shouldDecrement = true;
      reason = '結束個人回合';
    } else if (skippedPlayerIndex !== null && skippedPlayerIndex === this.hurryUpCasterIndex) {
      shouldDecrement = true;
      reason = '個人回合被跳過';
    }

    if (shouldDecrement) {
      this.hurryUpCasterTurnsRemaining--;
      const caster = this.players[this.hurryUpCasterIndex];
      const casterName = caster ? caster.name : '出牌者';

      if (this.hurryUpCasterTurnsRemaining > 0) {
        this.addLog(`⚡ 瘋狂快抽：出牌者【${casterName}】${reason} (出牌者還剩 ${this.hurryUpCasterTurnsRemaining} 個個人回合)！`);
      } else {
        this.hurryUpCasterTurnsRemaining = 0;
        this.hurryUpCasterIndex = null;
        this.addLog(`⚡ 瘋狂快抽效果結束！【${casterName}】已完成 3 個個人回合，全場思考時間恢復為 15 秒！`);
      }
    }
  }

  checkAndTriggerExplosive(playerIndex) {
    if (!this.explosiveActive) return 0;
    this.explosiveActive = false;
    const player = this.players[playerIndex];
    this.activePenaltyBanner = { playerId: playerIndex, count: 3 };
    this.drawCardsForPlayer(playerIndex, 3);
    if (player) {
      this.addLog(`💥 轟！！！瘋狂定時炸彈在【${player.name}】抽牌時引爆！額外炸飛多抽 +3 張牌！`);
    }
    return 3;
  }

  playCard(playerIndex, cardId, chosenColor = null) {
    if (this.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能出牌！' };
    }
    if (this.isChoosingColor) {
      return { success: false, reason: '正在等待選擇顏色中！' };
    }
    if (this.isContinuousDrawing) {
      return { success: false, reason: '場上卡牌效果與動畫結算中，請稍候！' };
    }
    if (this.currentTurn !== playerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }

    const player = this.players[playerIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      return { success: false, reason: '找不到這張牌！' };
    }

    const card = player.hand[cardIdx];
    if (!this.canPlayCard(card)) {
      return { success: false, reason: '此牌不符合出牌規則！' };
    }

    if (card.value === 'wild_draw4') {
      const prevColor = this.currentColor;
      const matchingCards = player.hand.filter(c => c.id !== card.id && c.color === prevColor);
      this.pendingWildDraw4Info = {
        playerIndex,
        playerName: player.name,
        targetColorName: this.colorNames[prevColor] || prevColor,
        hasMatchingCard: matchingCards.length > 0,
        matchingCardNames: matchingCards.map(c => this.getCardDisplayName(c)),
        matchingCardIds: matchingCards.map(c => c.id),
        challengedHandSnapshot: player.hand.filter(c => c.id !== card.id).map(c => ({ ...c })),
        priorStackedCount: this.stackedDrawCount || 0
      };
    } else {
      this.pendingWildDraw4Info = null;
      this.lastWildDraw4Info = null;
    }

    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);

    let needsUnoGracePeriod = false;
    if (player.hand.length === 1) {
      if (player.calledUno) {
        player.unoVulnerable = false;
        player.pendingUnoCall = false;
      } else {
        if (player.isAi) {
          if (Math.random() < 0.8) {
            player.calledUno = true;
            player.unoVulnerable = false;
            this.addLog(`🚨 【${player.name}】大喊了「UNO！」 (剩最後 1 張牌)`);
          } else {
            player.calledUno = false;
            player.unoVulnerable = true;
            this.addLog(`👀 【${player.name}】剩最後 1 張牌但忘記喊 UNO！大家快抓漏！`);
          }
        } else {
          player.calledUno = false;
          player.unoVulnerable = true;
          player.pendingUnoCall = false;
          this.addLog(`👀 【${player.name}】打出牌剩最後 1 張，但尚未喊 UNO！大家快抓漏！`);
        }
      }
    } else {
      player.calledUno = false;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
    }

    if (player.hand.length === 0) {
      if (card.color === 'wild') {
        const winColor = chosenColor || this.getBestColorForPlayer(playerIndex);
        this.currentColor = winColor;
        card.chosenColor = winColor;
        if (card.value === 'wild_draw4') {
          card.displayAssetKey = `wild_draw4_${winColor}`;
        } else if (card.value === 'rabbids_wild_shield') {
          card.displayAssetKey = `rabbids_wild_shield_${winColor}`;
        } else if (card.value.startsWith('rabbids_')) {
          card.displayAssetKey = card.assetKey;
        } else {
          card.displayAssetKey = `wild_${winColor}`;
        }
      }
      this.gameStatus = 'game_over';
      this.winner = player;
      this.calculateScores();

      const winMsg = this.gameMode === '2v2'
        ? `🎉 恭喜！${player.name} 出完手牌，【${player.teamName}】贏得 2V2 勝利！`
        : `🎉 恭喜！${player.name} 出完所有手牌，贏得本局勝利！`;
      this.addLog(winMsg);

      this.lastAction = {
        type: 'play',
        playerId: playerIndex,
        playerName: player.name,
        card: { ...card },
        timestamp: Date.now()
      };

      return {
        success: true,
        gameOver: true,
        winner: player,
        card,
        effectMsg: ''
      };
    }

    const isVanishingRabbidsCard =
      card.value === 'rabbids_hurry_up' ||
      card.value === 'rabbids_explosive' ||
      card.value === 'rabbids_comin_through' ||
      (card.value === 'rabbids_wild_shield' && this.stackedDrawCount > 0);

    if (card.color === 'wild' && !chosenColor && !isVanishingRabbidsCard) {
      if (player.isAi) {
        chosenColor = this.getBestColorForPlayer(playerIndex);
      } else {
        this.isChoosingColor = true;
        this.colorChoosingPlayerIndex = playerIndex;
        this.pendingWildCard = card;
        this.currentColor = 'wild';
        this.currentValue = card.value;
        card.displayAssetKey = card.assetKey;
        this.turnStartTime = Date.now();
        this.turnDuration = 6;

        this.addLog(`🌈 ${player.name} 打出了【${this.getCardDisplayName(card)}】！進入選色階段 (限時 6 秒)...`);

        this.lastAction = {
          type: 'play',
          playerId: playerIndex,
          playerName: player.name,
          card: { ...card },
          timestamp: Date.now()
        };

        return {
          success: true,
          isChoosingColor: true,
          card,
          needsUnoGracePeriod
        };
      }
    }

    let effectMsg = '';
    let nextStep = 1;

    if (isVanishingRabbidsCard) {
      card.displayAssetKey = card.assetKey;
      this.vanishingCardId = card.id;
    } else if (card.color === 'wild') {
      this.currentColor = chosenColor || 'red';
      this.currentValue = card.value;
      card.chosenColor = this.currentColor;
      if (card.value === 'wild_draw4') {
        card.displayAssetKey = `wild_draw4_${this.currentColor}`;
      } else if (card.value === 'rabbids_wild_shield') {
        card.displayAssetKey = `rabbids_wild_shield_${this.currentColor}`;
      } else {
        card.displayAssetKey = `wild_${this.currentColor}`;
      }
      effectMsg = `指定顏色為【${this.colorNames[this.currentColor]}】！`;
    } else {
      this.currentColor = card.color;
      this.currentValue = card.value;
      card.displayAssetKey = card.assetKey;
    }

    if (card.value === 'draw2') {
      this.stackedDrawCount += 2;
      this.stackedDrawType = 'draw2';
      const nextVictim = this.players[this.getNextTurnIndex(1)];
      nextStep = 1;
      if (this.allowStacking) {
        effectMsg += ` ⚡ +2 疊加！目前累積罰抽【+${this.stackedDrawCount} 張】！輪到 ${nextVictim.name}！`;
      } else {
        effectMsg += ` 💥 +2 罰抽牌！輪到 ${nextVictim.name} 承受 2 張罰抽！`;
      }
    } else if (card.value === 'wild_draw4') {
      if (this.pendingWildDraw4Info) {
        this.lastWildDraw4Info = this.pendingWildDraw4Info;
        this.pendingWildDraw4Info = null;
      }
      this.stackedDrawCount += 4;
      this.stackedDrawType = 'wild_draw4';
      const nextVictim = this.players[this.getNextTurnIndex(1)];
      nextStep = 1;
      if (this.allowStacking) {
        effectMsg += ` 🔥 +4 萬用疊加！目前累積罰抽【+${this.stackedDrawCount} 張】！輪到 ${nextVictim.name}！`;
      } else if (this.allowChallengeWildDraw4) {
        effectMsg += ` 🔥 +4 萬用牌！輪到 ${nextVictim.name}，可質疑出牌合法性或承受罰抽！`;
      } else {
        effectMsg += ` 🔥 +4 萬用牌！輪到 ${nextVictim.name} 承受 4 張罰抽！`;
      }
    }

    if (card.value === 'rabbids_hurry_up') {
      this.hurryUpCasterIndex = playerIndex;
      this.hurryUpCasterTurnsRemaining = 3;
      this.justCastHurryUp = true;
      effectMsg += ` ⚡ 瘋狂快抽觸發 (保留當前${this.colorNames[this.currentColor] || '底牌'})！全場進入 3 秒極限思考，效果持續至出牌者【${player.name}】再經過 3 個自己的回合為止！`;
    } else if (card.value === 'rabbids_explosive') {
      this.explosiveActive = true;
      effectMsg += ` 💣 炸彈已安裝在抽牌堆 (保留當前${this.colorNames[this.currentColor] || '底牌'})！下一位抽牌或受罰抽的玩家將引爆炸彈 (額外 +3 張)！`;
    } else if (card.value === 'rabbids_comin_through') {
      effectMsg += ` 🌪️ 瘋狂借過發動 (保留當前${this.colorNames[this.currentColor] || '底牌'})！準備展開兩波全場瘋狂發牌！`;
    } else if (card.value === 'rabbids_wild_shield') {
      if (this.stackedDrawCount > 0) {
        const deflectedCount = this.stackedDrawCount;
        const nextVictimIdx = this.getNextTurnIndex(1);
        const nextVictim = this.players[nextVictimIdx];

        // 紀錄待反彈的張數與目標，交由控制器在盾牌動畫後逐張發牌，並清空罰抽池讓下家加完牌後可以直接出牌！
        card.deflectedCount = deflectedCount;
        card.deflectedVictimIdx = nextVictimIdx;
        this.stackedDrawCount = 0;
        this.stackedDrawType = null;
        this.lastWildDraw4Info = null;

        effectMsg += ` 🛡️ 兔兔盾牌反彈防禦！將【+${deflectedCount} 張】抽牌直接轉嫁給 ${nextVictim.name} (加完牌後由 ${nextVictim.name} 出牌)！`;
        nextStep = 1;
      } else {
        effectMsg += ` 🛡️ 兔兔盾牌安全變色！`;
      }
    }

    let skippedPlayer = null;
    if (card.value === 'skip') {
      skippedPlayer = this.players[this.getNextTurnIndex(1)];
      nextStep = 2;
      effectMsg += ` 🚫 跳過 ${skippedPlayer.name} 的回合！`;
    } else if (card.value === 'reverse') {
      if (this.playerCount === 2) {
        skippedPlayer = this.players[this.getNextTurnIndex(1)];
        nextStep = 2;
        effectMsg += ` 🔄 兩人局反轉牌視同跳過！`;
      } else {
        this.direction *= -1;
        effectMsg += ` 🔄 出牌方向反轉為${this.direction === 1 ? '順時針' : '逆時針'}！`;
      }
    }

    this.addLog(`${player.name} 打出【${this.getCardDisplayName(card)}】。${effectMsg}`);

    this.lastAction = {
      type: 'play',
      playerId: playerIndex,
      playerName: player.name,
      card: { ...card },
      isVanishing: isVanishingRabbidsCard,
      skippedPlayerId: skippedPlayer ? skippedPlayer.id : null,
      skippedPlayerName: skippedPlayer ? skippedPlayer.name : null,
      timestamp: Date.now()
    };

    this.hasDrawnThisTurn = false;

    if (isVanishingRabbidsCard) {
      this.pendingAdvanceStep = nextStep;
      this.isContinuousDrawing = true;
      this.turnStartTime = null;
      return {
        success: true,
        card,
        isVanishing: true,
        effectMsg,
        needsUnoGracePeriod,
        stackedCount: this.stackedDrawCount,
        nextPlayer: this.players[this.getNextTurnIndex(nextStep)]
      };
    }

    const skippedPlayerId = skippedPlayer ? skippedPlayer.id : null;
    this.processHurryUpTurnEnd(playerIndex, skippedPlayerId);

    this.currentTurn = this.getNextTurnIndex(nextStep);
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();

    return {
      success: true,
      card,
      isVanishing: false,
      effectMsg,
      needsUnoGracePeriod,
      stackedCount: this.stackedDrawCount,
      nextPlayer: this.players[this.currentTurn]
    };
  }

  confirmWildColor(playerIndex, chosenColor) {
    if (!this.isChoosingColor || this.colorChoosingPlayerIndex !== playerIndex) {
      return { success: false, reason: '目前非選色階段或不是你的選色回合！' };
    }

    const player = this.players[playerIndex];
    const card = this.pendingWildCard || this.getTopCard();
    if (!card) return { success: false };

    const validColors = ['red', 'yellow', 'green', 'blue'];
    const finalColor = validColors.includes(chosenColor) ? chosenColor : this.getBestColorForPlayer(playerIndex);

    this.currentColor = finalColor;
    this.currentValue = card.value;
    card.chosenColor = finalColor;

    if (card.value === 'wild_draw4') {
      card.displayAssetKey = `wild_draw4_${finalColor}`;
    } else if (card.value === 'rabbids_wild_shield') {
      card.displayAssetKey = `rabbids_wild_shield_${finalColor}`;
    } else if (card.value.startsWith('rabbids_')) {
      card.displayAssetKey = card.assetKey;
    } else {
      card.displayAssetKey = `wild_${finalColor}`;
    }

    this.isChoosingColor = false;
    this.colorChoosingPlayerIndex = null;
    this.pendingWildCard = null;

    let effectMsg = `指定顏色為【${this.colorNames[finalColor]}】！`;
    let nextStep = 1;

    if (card.value === 'rabbids_wild_shield') {
      effectMsg += ` 🛡️ 兔兔盾牌安全防護！`;
    } else if (card.value === 'wild_draw4') {
      if (this.pendingWildDraw4Info) {
        this.lastWildDraw4Info = this.pendingWildDraw4Info;
        this.pendingWildDraw4Info = null;
      }
      this.stackedDrawCount += 4;
      this.stackedDrawType = 'wild_draw4';
      const nextVictim = this.players[this.getNextTurnIndex(1)];
      nextStep = 1;
      if (this.allowStacking) {
        effectMsg += ` 🔥 +4 萬用疊加！目前累積罰抽【+${this.stackedDrawCount} 張】！輪到 ${nextVictim.name}！`;
      } else if (this.allowChallengeWildDraw4) {
        effectMsg += ` 🔥 +4 萬用牌！輪到 ${nextVictim.name}，可質疑出牌合法性或承受罰抽！`;
      } else {
        effectMsg += ` 🔥 +4 萬用牌！輪到 ${nextVictim.name} 承受 4 張罰抽！`;
      }
    }

    this.addLog(`${player.name} ${effectMsg}`);

    this.lastAction = {
      type: 'color_chosen',
      playerId: playerIndex,
      playerName: player.name,
      chosenColor: finalColor,
      card: { ...card },
      timestamp: Date.now()
    };

    this.processHurryUpTurnEnd(playerIndex, null);
    this.hasDrawnThisTurn = false;
    this.currentTurn = this.getNextTurnIndex(nextStep);
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();

    return {
      success: true,
      card,
      chosenColor: finalColor,
      nextPlayer: this.players[this.currentTurn]
    };
  }

  playerDrawCard(playerIndex) {
    if (this.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能抽牌！' };
    }
    if (this.isChoosingColor) {
      return { success: false, reason: '正在等待選擇顏色中！' };
    }
    if (this.isContinuousDrawing) {
      return { success: false, reason: '場上卡牌效果與動畫結算中，請稍候！' };
    }
    if (this.currentTurn !== playerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }
    if (this.hasDrawnThisTurn) {
      return { success: false, reason: '本回合已經主動抽過牌了，無法重複抽牌！' };
    }

    const extraBombCards = this.checkAndTriggerExplosive(playerIndex);

    const card = this.drawCardRaw();
    this.players[playerIndex].hand.push(card);
    if (extraBombCards > 0) {
      // 主動抽 1 張 + 炸彈 3 張 = 手牌上方顯示 +4
      this.activePenaltyBanner = { playerId: playerIndex, count: 1 + extraBombCards };
    }
    if (this.players[playerIndex].hand.length > 1) {
      this.players[playerIndex].calledUno = false;
      this.players[playerIndex].unoVulnerable = false;
      this.players[playerIndex].pendingUnoCall = false;
    }

    const canPlay = extraBombCards > 0 ? false : this.canPlayCard(card);
    this.addLog(`${this.players[playerIndex].name} 抽了一張牌。`);

    if (!canPlay) {
      this.hasDrawnThisTurn = false;
      this.lastAction = {
        type: 'draw_step',
        playerId: playerIndex,
        playerName: this.players[playerIndex].name,
        card: { ...card },
        canPlay: false,
        extraBombCards,
        timestamp: Date.now()
      };
      return {
        success: true,
        card,
        extraBombCards,
        drawnCards: [card],
        wasPenalty: false,
        canPlay: false,
        autoPassed: true
      };
    }

    this.hasDrawnThisTurn = true;
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();
    this.lastAction = {
      type: 'draw_step',
      playerId: playerIndex,
      playerName: this.players[playerIndex].name,
      card: { ...card },
      canPlay: true,
      extraBombCards,
      timestamp: Date.now()
    };
    return {
      success: true,
      card,
      extraBombCards,
      drawnCards: [card],
      wasPenalty: false,
      canPlay: true,
      autoPassed: false
    };
  }

  advanceTurn(step = 1) {
    this.processHurryUpTurnEnd(this.currentTurn, null);
    this.hasDrawnThisTurn = false;
    this.currentTurn = this.getNextTurnIndex(step);
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();
    return this.currentTurn;
  }

  finishAutoPass(playerIndex, card) {
    const player = this.players[playerIndex];
    if (!player) return;
    this.hasDrawnThisTurn = false;
    this.addLog(`💨 ${player.name} 抽牌後結束回合！`);
    this.advanceTurn(1);
    this.lastAction = {
      type: 'draw_autopass',
      playerId: playerIndex,
      playerName: player.name,
      card: card ? { ...card } : null,
      timestamp: Date.now()
    };
  }

  finishPenaltyDraw(playerIndex, count) {
    const player = this.players[playerIndex];
    if (!player) return;
    this.activePenaltyBanner = null;
    this.stackedDrawCount = 0;
    this.stackedDrawType = null;
    this.lastWildDraw4Info = null;
    this.hasDrawnThisTurn = false;
    this.addLog(`💥 ${player.name} 承受累積罰抽【+${count} 張】完畢！回合結束！`);
    this.advanceTurn(1);
    this.lastAction = {
      type: 'penalty_finish',
      playerId: playerIndex,
      playerName: player.name,
      count,
      timestamp: Date.now()
    };
  }

  drawSingleCardStep(playerIndex) {
    if (this.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能抽牌！' };
    }
    if (this.currentTurn !== playerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }
    const player = this.players[playerIndex];
    if (!player) return { success: false, reason: '玩家不存在' };

    const card = this.drawCardRaw();
    player.hand.push(card);
    if (player.hand.length > 1) {
      player.calledUno = false;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
    }

    const canPlay = this.canPlayCard(card);
    this.lastAction = {
      type: 'draw_step',
      playerId: playerIndex,
      playerName: player.name,
      card: { ...card },
      timestamp: Date.now()
    };

    return {
      success: true,
      card,
      canPlay,
      handCount: player.hand.length
    };
  }

  finishContinuousDraw(playerIndex, drawnCards, canPlay) {
    const player = this.players[playerIndex];
    if (!player) return { success: false };

    const lastCard = drawnCards[drawnCards.length - 1];

    if (drawnCards.length > 1) {
      this.addLog(`${player.name} 連續抽取了 ${drawnCards.length} 張牌，直到抽到可出的牌！`);
    } else {
      this.addLog(`${player.name} 抽了一張牌。`);
    }

    if (!canPlay) {
      this.hasDrawnThisTurn = false;
      this.addLog(`💨 ${player.name} 連續抽牌已達上限仍無法出牌，自動跳過回合！`);
      this.advanceTurn(1);
      this.lastAction = {
        type: 'draw_autopass',
        playerId: playerIndex,
        playerName: player.name,
        card: { ...lastCard },
        drawnCount: drawnCards.length,
        timestamp: Date.now()
      };
      return {
        success: true,
        canPlay: false,
        autoPassed: true,
        nextPlayer: this.players[this.currentTurn]
      };
    }

    this.hasDrawnThisTurn = true;
    this.turnStartTime = Date.now();
    this.turnDuration = this.getActiveTurnDuration();
    this.lastAction = {
      type: 'draw_finished',
      playerId: playerIndex,
      playerName: player.name,
      card: { ...lastCard },
      drawnCount: drawnCards.length,
      canPlay: true,
      timestamp: Date.now()
    };

    return {
      success: true,
      card: lastCard,
      drawnCards,
      canPlay: true,
      autoPassed: false
    };
  }

  passTurn(playerIndex) {
    if (this.isDealing) {
      return { success: false, reason: '開局發牌中！' };
    }
    if (this.isChoosingColor) {
      return { success: false, reason: '正在等待選擇顏色中！' };
    }
    if (this.isContinuousDrawing) {
      return { success: false, reason: '正在結算動畫中！' };
    }
    if (this.currentTurn !== playerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }
    if (this.stackedDrawCount > 0) {
      return { success: false, reason: '有累積罰抽未承受，無法直接過牌！' };
    }
    if (!this.hasDrawnThisTurn) {
      return { success: false, reason: '必須先抽一張牌後才能過牌！' };
    }
    this.hasDrawnThisTurn = false;
    this.addLog(`${this.players[playerIndex].name} 選擇過牌。`);
    this.advanceTurn(1);
    return {
      success: true,
      nextPlayer: this.players[this.currentTurn]
    };
  }

  callUno(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) return { success: false };
    if (player.hand.length === 2) {
      const validCards = this.getValidCardsForPlayer(playerIndex);
      if (validCards.length === 0) {
        return { success: false, reason: '手牌剩 2 張但無牌可出，無法喊 UNO！' };
      }
      player.calledUno = true;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
      this.addLog(`🚨 【${player.name}】預先大喊「UNO！」 (準備出牌剩 1 張)`);
      return { success: true };
    } else if (player.hand.length === 1) {
      player.calledUno = true;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
      this.addLog(`🚨 【${player.name}】及時大喊「UNO！」！解除被抓漏危機！`);
      return { success: true };
    }
    return { success: false, reason: '手牌超過 2 張時不能喊 UNO！' };
  }

  challengeUno(challengerIndex, targetIndex) {
    const challenger = this.players[challengerIndex];
    const target = this.players[targetIndex];
    if (this.gameMode === '2v2' && challenger && target) {
      if (challenger.teamId === target.teamId || (challengerIndex + 2) % 4 === targetIndex) {
        return { success: false, reason: '2V2 組隊模式中不能抓漏自己的隊友！' };
      }
    }
    if (target && target.hand.length === 1 && target.unoVulnerable) {
      const extraBomb = this.checkAndTriggerExplosive(targetIndex);
      const totalPenalty = 2 + extraBomb;
      this.activePenaltyBanner = { playerId: targetIndex, count: totalPenalty };
      this.drawCardsForPlayer(targetIndex, 2);
      target.calledUno = false;
      target.unoVulnerable = false;
      target.pendingUnoCall = false;
      this.addLog(`⚖️ 【${this.players[challengerIndex].name}】眼明手快抓到了【${target.name}】沒喊 UNO！${target.name} 被罰抽 ${totalPenalty} 張牌${extraBomb > 0 ? ' (含炸彈 +3 張)' : ''}！`);
      return { success: true, caught: true, targetName: target.name };
    }
    return { success: false, reason: '對方已喊 UNO 或目前不可抓漏！' };
  }

  challengeWildDraw4(challengerIndex) {
    if (this.isDealing || this.isChoosingColor || this.isContinuousDrawing || this.gameStatus !== 'playing') {
      return { success: false, reason: '目前無法進行質疑！' };
    }
    if (this.currentTurn !== challengerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }
    if (!this.allowChallengeWildDraw4 || !this.lastWildDraw4Info) {
      return { success: false, reason: '目前無可質疑的 +4 牌！' };
    }

    const info = this.lastWildDraw4Info;
    const challengedPlayer = this.players[info.playerIndex];
    const challenger = this.players[challengerIndex];
    if (!challengedPlayer || !challenger) {
      return { success: false, reason: '玩家資訊異常' };
    }

    const isSuccess = info.hasMatchingCard;
    const handCards = (info.challengedHandSnapshot && info.challengedHandSnapshot.length > 0)
      ? info.challengedHandSnapshot
      : challengedPlayer.hand.map(c => ({ ...c }));
    const matchingCardIds = info.matchingCardIds || [];

    // 進入質疑驗牌演出鎖定，不讓計時器跑動或提早出牌
    this.isContinuousDrawing = true;
    this.turnStartTime = null;

    this.wild4ChallengeAnim = {
      challengerId: challengerIndex,
      challengerName: challenger.name,
      challengedId: info.playerIndex,
      challengedName: challengedPlayer.name,
      targetColorName: info.targetColorName,
      isSuccess,
      handCards,
      matchingCardIds,
      timestamp: Date.now()
    };

    // 暫存結算資料，等待 2450ms 驗牌動畫播放完畢後再行結算罰抽
    this.pendingChallengeResolution = {
      challengerIndex,
      challengedIndex: info.playerIndex,
      isSuccess,
      info: { ...info }
    };

    this.addLog(`⚖️ 【${challenger.name}】對【${challengedPlayer.name}】的 +4 提出質疑！驗牌檢視中...`);

    this.lastAction = {
      type: 'challenge_wild4_started',
      challengerIndex,
      challengedIndex: info.playerIndex,
      isSuccess,
      timestamp: Date.now()
    };

    return {
      success: true,
      isSuccess,
      animDuration: 2450
    };
  }

  resolveWildDraw4ChallengePenalty() {
    if (!this.pendingChallengeResolution) return { success: false };
    const { challengerIndex, challengedIndex, isSuccess, info } = this.pendingChallengeResolution;
    this.pendingChallengeResolution = null;
    this.wild4ChallengeAnim = null;

    const challengedPlayer = this.players[challengedIndex];
    const challenger = this.players[challengerIndex];
    if (!challengedPlayer || !challenger) return { success: false };

    if (isSuccess) {
      // 質疑成功：違規出 +4 的上家最優先去抽牌堆受罰，因此若抽牌堆有炸彈 (+3)，由違規者引爆！(4 + 3 = 7 張)
      const extraBomb = this.checkAndTriggerExplosive(challengedIndex);
      const cheaterTotal = 4 + extraBomb;
      this.activePenaltyBanner = { playerId: challengedIndex, count: cheaterTotal };
      this.drawCardsForPlayer(challengedIndex, 4);

      const priorCount = info.priorStackedCount || 0;

      let msg = `⚖️ 【${challenger.name}】質疑成功！【${challengedPlayer.name}】手牌中明明有【${info.targetColorName}】的牌 (${info.matchingCardNames.join('、')})，違規出 +4！${challengedPlayer.name} 被罰抽 ${cheaterTotal} 張${extraBomb > 0 ? ' (含引爆炸彈 +3 張)' : ''}！`;

      this.lastWildDraw4Info = null;
      this.stackedDrawCount = 0;
      this.stackedDrawType = null;
      this.hasDrawnThisTurn = false;

      let drawnCount = cheaterTotal;
      let penaltyTargetIndex = challengedIndex;
      let nextPlayerTurn = challengerIndex;

      if (priorCount > 0) {
        // 先前合法的累積罰抽仍由質疑者承受（此時炸彈已被違規者引爆完畢）
        this.drawCardsForPlayer(challengerIndex, priorCount);
        drawnCount += priorCount;
        msg += ` 先前累積的罰抽 (+${priorCount} 張) 仍由 ${challenger.name} 承受，回合結束！`;
        this.addLog(msg);
        this.advanceTurn(1);
        nextPlayerTurn = this.currentTurn;
      } else {
        msg += ` ${challenger.name} 免受罰抽，回合繼續，請出牌或抽牌！`;
        this.addLog(msg);
        this.turnStartTime = Date.now();
        this.turnDuration = this.getActiveTurnDuration();
      }

      this.lastAction = {
        type: 'challenge_wild4_penalty',
        penaltyTargetIndex,
        drawnCount,
        isSuccess: true,
        timestamp: Date.now()
      };

      return {
        success: true,
        challengedWon: false,
        drawnCount,
        penaltyTargetIndex,
        nextPlayerTurn,
        msg
      };
    } else {
      // 質疑失敗：被質疑者無罪，由質疑者承受原有罰抽 + 額外 2 張；若抽牌堆有炸彈 (+3) 也由質疑者引爆！
      const extraBomb = this.checkAndTriggerExplosive(challengerIndex);
      const basePenalty = (this.stackedDrawCount || 4) + 2;
      const totalPenalty = basePenalty + extraBomb;
      this.activePenaltyBanner = { playerId: challengerIndex, count: totalPenalty };
      this.drawCardsForPlayer(challengerIndex, basePenalty);

      const msg = `⚖️ 【${challenger.name}】質疑失敗！【${challengedPlayer.name}】當時確實無【${info.targetColorName}】的手牌！${challenger.name} 承受罰抽共 ${totalPenalty} 張${extraBomb > 0 ? ' (含引爆炸彈 +3 張)' : ''}並跳過回合！`;
      this.addLog(msg);

      this.lastWildDraw4Info = null;
      this.stackedDrawCount = 0;
      this.stackedDrawType = null;
      this.hasDrawnThisTurn = false;
      this.advanceTurn(1);

      this.lastAction = {
        type: 'challenge_wild4_penalty',
        penaltyTargetIndex: challengerIndex,
        drawnCount: totalPenalty,
        isSuccess: false,
        timestamp: Date.now()
      };

      return {
        success: true,
        challengedWon: true,
        drawnCount: totalPenalty,
        penaltyTargetIndex: challengerIndex,
        nextPlayerTurn: this.currentTurn,
        penalty: totalPenalty,
        msg
      };
    }
  }

  calculateScores() {
    let totalPoints = 0;
    if (this.gameMode === '2v2' && this.winner) {
      const winningTeamId = this.winner.teamId;
      this.players.forEach(p => {
        if (p.teamId !== winningTeamId) {
          p.hand.forEach(c => {
            totalPoints += c.points;
          });
        }
      });
      this.players.forEach(p => {
        if (p.teamId === winningTeamId) {
          p.score += totalPoints;
        }
      });
      this.lastRoundPoints = totalPoints;

      if (this.targetScore > 0) {
        const winningPlayer = this.players.find(p => p.teamId === winningTeamId);
        if (winningPlayer && winningPlayer.score >= this.targetScore) {
          this.isMatchOver = true;
          this.matchWinner = {
            teamId: winningTeamId,
            teamName: winningPlayer.teamName,
            score: winningPlayer.score
          };
          this.addLog(`🏆 賽事總冠軍誕生！【${winningPlayer.teamName}】累積達到 ${winningPlayer.score} 分，奪得最終冠軍！`);
        }
      }
    } else {
      this.players.forEach(p => {
        if (p !== this.winner) {
          p.hand.forEach(c => {
            totalPoints += c.points;
          });
        }
      });
      if (this.winner) {
        this.winner.score += totalPoints;
        this.lastRoundPoints = totalPoints;

        if (this.targetScore > 0 && this.winner.score >= this.targetScore) {
          this.isMatchOver = true;
          this.matchWinner = {
            id: this.winner.id,
            name: this.winner.name,
            score: this.winner.score
          };
          this.addLog(`🏆 賽事總冠軍誕生！【${this.winner.name}】累積達到 ${this.winner.score} 分，奪得最終冠軍！`);
        }
      }
    }
  }

  getCardDisplayName(card) {
    const colName = this.colorNames[card.color] || '';
    if (card.value === 'skip') return `${colName} 禁止牌`;
    if (card.value === 'reverse') return `${colName} 反轉牌`;
    if (card.value === 'draw2') return `${colName} +2 罰抽牌`;
    if (card.value === 'wild') return `萬用牌 (Wild)`;
    if (card.value === 'wild_draw4') return `萬用 +4 罰抽牌 (Wild Draw 4)`;
    if (card.value === 'rabbids_hurry_up') return `瘋狂快抽 Hurry Up! (3秒限時)`;
    if (card.value === 'rabbids_explosive') return `瘋狂定時炸彈 Explosive (+3 Extra)`;
    if (card.value === 'rabbids_comin_through') return `瘋狂借過 Comin' Through (兩波發牌)`;
    if (card.value === 'rabbids_wild_shield') return `瘋狂兔兔盾牌 Wild Shield (防禦/變色)`;
    return `${colName} ${card.value}`;
  }

  addLog(msg) {
    this.log.unshift({
      time: new Date().toLocaleTimeString(),
      text: msg
    });
    if (this.log.length > 50) this.log.pop();
  }

  getClientState(playerIndex = 0, isSpectator = false) {
    const viewIndex = isSpectator ? 0 : playerIndex;
    const top = this.getTopCard();
    let topDisplayKey = top ? (top.displayAssetKey || top.assetKey) : 'card_back';
    if (top && top.color === 'wild') {
      if (this.isChoosingColor || !top.chosenColor) {
        if (top.value === 'wild_draw4') topDisplayKey = 'wild_draw4';
        else if (top.value.startsWith('rabbids_')) topDisplayKey = top.assetKey;
        else topDisplayKey = 'wild';
      } else {
        if (top.value === 'wild_draw4') {
          topDisplayKey = `wild_draw4_${top.chosenColor}`;
        } else if (top.value === 'rabbids_wild_shield') {
          topDisplayKey = `rabbids_wild_shield_${top.chosenColor}`;
        } else if (top.value.startsWith('rabbids_')) {
          topDisplayKey = top.assetKey;
        } else {
          topDisplayKey = `wild_${top.chosenColor}`;
        }
      }
    }

    const teammateIndex = (!isSpectator && this.gameMode === '2v2') ? (viewIndex + 2) % 4 : null;
    const teammatePlayer = teammateIndex !== null ? this.players[teammateIndex] : null;

    const sanitizeHandCard = (c) => {
      if (c && c.color === 'wild') {
        const { chosenColor, ...rest } = c;
        return { ...rest, displayAssetKey: c.assetKey };
      }
      return c;
    };

    // 計算目前哪位玩家的手牌上方要顯示黑框白底「+幾」
    let plusIndicator = null;
    if (this.activePenaltyBanner && this.activePenaltyBanner.count > 0) {
      plusIndicator = {
        playerId: this.activePenaltyBanner.playerId,
        count: this.activePenaltyBanner.count
      };
    } else if (this.stackedDrawCount > 0) {
      plusIndicator = {
        playerId: this.currentTurn,
        count: this.stackedDrawCount
      };
    }

    return {
      isSpectator: !!isSpectator,
      plusIndicator,
      deckTheme: this.deckTheme || 'classic',
      hurryUpTurns: this.hurryUpCasterTurnsRemaining || 0,
      hurryUpCasterIndex: this.hurryUpCasterIndex !== null ? this.hurryUpCasterIndex : null,
      hurryUpCasterName: (this.hurryUpCasterIndex !== null && this.players[this.hurryUpCasterIndex]) ? this.players[this.hurryUpCasterIndex].name : null,
      explosiveActive: !!this.explosiveActive,
      vanishingCardId: this.vanishingCardId || null,
      gameMode: this.gameMode,
      targetScore: this.targetScore,
      drawRule: this.drawRule,
      isMatchOver: !!this.isMatchOver,
      matchWinner: this.matchWinner || null,
      lastRoundPoints: this.lastRoundPoints || 0,
      isContinuousDrawing: !!this.isContinuousDrawing,
      drawingPlayerIndex: this.drawingPlayerIndex !== undefined ? this.drawingPlayerIndex : null,
      drawingStepCount: this.drawingStepCount || 0,
      myIndex: viewIndex,
      teammateIndex,
      teammateHand: teammatePlayer ? teammatePlayer.hand.map(sanitizeHandCard) : [],
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: !!p.isHost,
        isAi: p.isAi,
        teamId: p.teamId,
        teamName: p.teamName,
        cardCount: p.hand.length,
        calledUno: p.calledUno,
        unoVulnerable: p.unoVulnerable,
        timeoutCount: p.timeoutCount || 0,
        score: p.score
      })),
      myHand: (!isSpectator && this.players[viewIndex]) ? this.players[viewIndex].hand.map(sanitizeHandCard) : [],
      validCards: (!isSpectator) ? this.getValidCardsForPlayer(viewIndex).map(c => c.id) : [],
      topCard: top ? {
        ...top,
        displayAssetKey: topDisplayKey
      } : null,
      recentDiscardPile: this.discardPile.slice(-6).map((c, i) => {
        let displayAssetKey = c.assetKey;
        if (c.color === 'wild' && c.chosenColor) {
          if (c.value === 'wild_draw4') {
            displayAssetKey = `wild_draw4_${c.chosenColor}`;
          } else if (c.value === 'rabbids_wild_shield') {
            displayAssetKey = `rabbids_wild_shield_${c.chosenColor}`;
          } else if (c.value.startsWith('rabbids_')) {
            displayAssetKey = c.assetKey;
          } else {
            displayAssetKey = `wild_${c.chosenColor}`;
          }
        }
        const hash = c.id ? c.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) : i * 17;
        const rot = ((hash % 19) - 9);
        const offsetX = ((hash % 9) - 4);
        const offsetY = (((hash >> 2) % 9) - 4);
        return {
          ...c,
          displayAssetKey,
          rot,
          offsetX,
          offsetY
        };
      }),
      currentColor: this.currentColor,
      currentValue: this.currentValue,
      direction: this.direction,
      currentTurn: this.currentTurn,
      turnStartTime: this.turnStartTime,
      turnDuration: this.turnDuration || 15,
      isChoosingColor: !!this.isChoosingColor,
      colorChoosingPlayerIndex: this.colorChoosingPlayerIndex !== undefined ? this.colorChoosingPlayerIndex : null,
      pendingWildCard: this.pendingWildCard ? { ...this.pendingWildCard } : null,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      stackedDrawCount: this.stackedDrawCount,
      stackedDrawType: this.stackedDrawType,
      allowStacking: this.allowStacking,
      allowChallengeWildDraw4: !!this.allowChallengeWildDraw4,
      canChallengeWildDraw4: !isSpectator &&
        !!this.allowChallengeWildDraw4 &&
        !!this.lastWildDraw4Info &&
        this.currentTurn === viewIndex &&
        this.stackedDrawType === 'wild_draw4' &&
        !this.isDealing &&
        !this.isChoosingColor &&
        !this.isContinuousDrawing &&
        this.gameStatus === 'playing',
      lastWildDraw4PlayerName: this.lastWildDraw4Info ? this.lastWildDraw4Info.playerName : null,
      wild4ChallengeAnim: (() => {
        if (!this.wild4ChallengeAnim) return null;
        const isChallenger = !isSpectator && viewIndex === this.wild4ChallengeAnim.challengerId;
        const isChallenged = !isSpectator && viewIndex === this.wild4ChallengeAnim.challengedId;
        if (isChallenger || isChallenged) {
          return { ...this.wild4ChallengeAnim };
        }
        // 第三方其他玩家與觀戰者：依 UNO 正規規則手牌僅對質疑者公開，其餘人一律只看見牌背！
        return {
          ...this.wild4ChallengeAnim,
          handCards: (this.wild4ChallengeAnim.handCards || []).map(c => ({
            id: c.id,
            color: 'wild',
            value: 'card_back',
            assetKey: 'card_back',
            displayAssetKey: 'card_back'
          })),
          matchingCardIds: []
        };
      })(),
      gameStatus: this.gameStatus,
      isDealing: !!this.isDealing,
      winner: this.winner ? {
        id: this.winner.id,
        name: this.winner.name,
        teamId: this.winner.teamId,
        teamName: this.winner.teamName
      } : null,
      drawPileCount: this.drawPile.length,
      lastAction: this.lastAction || null,
      log: this.log.slice(0, 30)
    };
  }
}
```

## src/game/unoAi.js

```javascript
// unoAi.js - Intelligent UNO AI Bot with 2v2 Team Cooperative Heuristics

export class UnoAI {
  constructor(engine) {
    this.engine = engine;
  }

  decideMove(playerIndex) {
    const player = this.engine.players[playerIndex];
    if (!player || !player.isAi) return null;

    const is2v2 = this.engine.gameMode === '2v2';
    const teammate = is2v2 ? this.engine.players[(playerIndex + 2) % 4] : null;

    // AI Step 1: Challenge Check (Do NOT challenge your own teammate in 2v2!)
    for (let pIdx = 0; pIdx < this.engine.players.length; pIdx++) {
      if (pIdx !== playerIndex) {
        if (is2v2 && teammate && pIdx === teammate.id) {
          continue; // Protect teammate
        }
        const target = this.engine.players[pIdx];
        if (target.hand.length === 1 && target.unoVulnerable) {
          if (Math.random() < 0.65) {
            return {
              action: 'challenge',
              targetIndex: pIdx
            };
          }
        }
      }
    }

    // AI Step 2: Stacking Penalty Defense Check (+2/+4 stack defense, Wild Shield or +4 challenge)
    if (this.engine.stackedDrawCount > 0) {
      const validStackCards = this.engine.getValidCardsForPlayer(playerIndex);
      if (validStackCards.length > 0) {
        // Prefer rabbids_wild_shield to deflect incoming draw, then matching stack cards
        const shieldCard = validStackCards.find(c => c.value === 'rabbids_wild_shield');
        const chosenCard = shieldCard || validStackCards.find(c => c.value === 'draw2') || validStackCards[0];
        let chosenColor = null;
        if (chosenCard.color === 'wild') {
          chosenColor = this.getBestColorForHand(player.hand, teammate);
        }
        return {
          action: 'play',
          card: chosenCard,
          chosenColor,
          callUno: player.hand.length === 2 && Math.random() < 0.85
        };
      } else {
        // AI has no card to stack: If facing wild_draw4, consider challenging!
        if (this.engine.stackedDrawType === 'wild_draw4' && this.engine.allowChallengeWildDraw4 && this.engine.lastWildDraw4Info) {
          // In 2v2, do not challenge teammate
          if (is2v2 && teammate && this.engine.lastWildDraw4Info.playerIndex === teammate.id) {
            return { action: 'draw' };
          }
          if (Math.random() < 0.5) {
            return { action: 'challenge_wild_draw4' };
          }
        }
        return { action: 'draw' };
      }
    }

    // AI Step 3: Legal Cards Check
    const validCards = this.engine.getValidCardsForPlayer(playerIndex);
    if (validCards.length === 0) {
      return { action: 'draw' };
    }

    // AI Step 4: Self-UNO Check
    const shouldCallUno = player.hand.length === 2 && Math.random() < 0.85;

    // AI Step 5: Strategic Card Selection
    const nextPlayerIndex = this.engine.getNextTurnIndex(1);
    const nextPlayer = this.engine.players[nextPlayerIndex];
    const isNextTeammate = is2v2 && teammate && nextPlayer.id === teammate.id;
    const isNextPlayerDanger = nextPlayer && !isNextTeammate && nextPlayer.hand.length <= 2;

    let chosenCard = null;

    if (isNextPlayerDanger) {
      // Emergency attack against danger opponent
      chosenCard = validCards.find(c => c.value === 'wild_draw4') ||
                   validCards.find(c => c.value === 'rabbids_explosive') ||
                   validCards.find(c => c.value === 'rabbids_hurry_up') ||
                   validCards.find(c => c.value === 'rabbids_comin_through') ||
                   validCards.find(c => c.value === 'draw2') ||
                   validCards.find(c => c.value === 'skip') ||
                   validCards.find(c => c.value === 'reverse');
    }

    // In 2v2: If next player is your teammate, avoid attacking them!
    if (!chosenCard && isNextTeammate) {
      // Filter out +2, +4, skip if possible so we don't penalize teammate
      const gentleCards = validCards.filter(c => !['draw2', 'wild_draw4', 'skip'].includes(c.value));
      if (gentleCards.length > 0) {
        // Prefer reverse (reverses away from teammate) or matching teammate's color
        const teammateColors = this.getColorCounts(teammate.hand);
        gentleCards.sort((a, b) => (teammateColors[b.color] || 0) - (teammateColors[a.color] || 0));
        chosenCard = gentleCards[0];
      }
    }

    if (!chosenCard) {
      // Normal attack against opponent (including Rabbids special cards)
      const actionCards = validCards.filter(c => ['draw2', 'skip', 'reverse', 'rabbids_comin_through', 'rabbids_explosive', 'rabbids_hurry_up'].includes(c.value));
      if (actionCards.length > 0 && !isNextTeammate) {
        chosenCard = actionCards[0];
      }
    }

    if (!chosenCard) {
      const numCards = validCards.filter(c => c.color !== 'wild');
      if (numCards.length > 0) {
        const colorCounts = this.getColorCounts(player.hand);
        numCards.sort((a, b) => (colorCounts[b.color] || 0) - (colorCounts[a.color] || 0));
        chosenCard = numCards[0];
      }
    }

    if (!chosenCard) {
      chosenCard = validCards.find(c => c.value === 'wild') || validCards[0];
    }

    let chosenColor = null;
    if (chosenCard.color === 'wild') {
      chosenColor = this.getBestColorForHand(player.hand, teammate);
    }

    return {
      action: 'play',
      card: chosenCard,
      chosenColor,
      callUno: shouldCallUno
    };
  }

  getColorCounts(hand) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    if (!hand) return counts;
    hand.forEach(c => {
      if (counts[c.color] !== undefined) {
        counts[c.color]++;
      }
    });
    return counts;
  }

  // In 2v2 mode, if teammate has 1-2 cards, choose the color teammate holds to assist win!
  getBestColorForHand(hand, teammate = null) {
    if (teammate && teammate.hand.length <= 2) {
      const teamCounts = this.getColorCounts(teammate.hand);
      for (const [col, count] of Object.entries(teamCounts)) {
        if (count > 0) return col;
      }
    }

    const counts = this.getColorCounts(hand);
    let bestColor = 'red';
    let maxCount = -1;
    for (const [col, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestColor = col;
      }
    }
    return bestColor;
  }
}

```

## src/game/hostGameController.js

```javascript
// 檔案位置：src/game/hostGameController.js
// Decoupled Host-Authoritative Game Loop, Timers, AI Scheduler & Effect Sequencer
import { UnoEngine } from './unoEngine';
import { UnoAI } from './unoAi';
import { soundManager } from '../services/sound';

export class HostGameController {
  /**
   * @param {Object} callbacks
   * @param {Function} callbacks.onBroadcastState - () => void
   * @param {Function} callbacks.onBroadcastSound - (soundName: string) => void
   * @param {Function} callbacks.onAutoKickPlayer - (slotIndex: number, reason: string) => void
   * @param {Function} callbacks.getHostIndex - () => number
   */
  constructor(callbacks = {}) {
    this.onBroadcastState = callbacks.onBroadcastState || (() => {});
    this.onBroadcastSound = callbacks.onBroadcastSound || (() => {});
    this.onAutoKickPlayer = callbacks.onAutoKickPlayer || (() => {});
    this.getHostIndex = callbacks.getHostIndex || (() => 0);

    this.engine = null;
    this.ai = null;

    this.dealTimer = null;
    this.aiTimer = null;
    this.turnTimeoutTimer = null;
    this.continuousDrawTimer = null;
    this.drawLandingTimer = null;
    this.challengeTimer = null;
    this.isContinuousDrawing = false;
  }

  emitSound(soundName) {
    if (soundName === 'card') soundManager.playCard();
    else if (soundName === 'draw') soundManager.playDraw();
    else if (soundName === 'action') soundManager.playAction();
    else if (soundName === 'wild') soundManager.playWild();
    else if (soundName === 'uno') soundManager.playUno();
    else if (soundName === 'penalty') soundManager.playPenalty();
    this.onBroadcastSound(soundName);
  }

  startNewMatch(lobbyPlayers, allowStacking, gameMode, options = {}) {
    this.cleanupTimers();

    this.engine = new UnoEngine(
      lobbyPlayers.length,
      lobbyPlayers,
      allowStacking,
      gameMode,
      options
    );
    this.ai = new UnoAI(this.engine);

    this.onBroadcastState();
    this.scheduleOpeningDeal();
  }

  startNextRound(lobbyPlayers, resetMatch = false) {
    if (!this.engine) return;
    this.cleanupTimers();

    if (resetMatch) {
      lobbyPlayers.forEach(p => { p.score = 0; });
      if (this.engine.players) this.engine.players.forEach(p => { p.score = 0; });
      this.engine.isMatchOver = false;
      this.engine.matchWinner = null;
    } else if (this.engine.players) {
      this.engine.players.forEach(ep => {
        const lp = lobbyPlayers.find(p => p.id === ep.id);
        if (lp) lp.score = ep.score;
      });
    }

    this.engine.customPlayers = lobbyPlayers;
    this.engine.reset();
    this.onBroadcastState();
    this.scheduleOpeningDeal();
  }

  scheduleOpeningDeal() {
    if (this.dealTimer) clearTimeout(this.dealTimer);
    this.dealTimer = setTimeout(() => {
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.finishDealing();
      this.onBroadcastState();

      const hostIdx = this.getHostIndex();
      if (this.engine.currentTurn === hostIdx) {
        soundManager.playTurn();
      } else {
        this.checkAiTurn();
      }
    }, 2200);
  }

  // ==========================================================
  // UNIFIED PLAYER ACTIONS (Used by Host, Guests, and AI!)
  // ==========================================================
  playCard(playerIndex, cardId, chosenColor = null, calledUno = false) {
    if (!this.engine || this.engine.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能出牌' };
    }

    // 關鍵修正：如果玩家剛抽完可出的牌（還在 drawLandingTimer 緩衝內）就立刻點出牌，
    // 直接清除 drawLandingTimer 並允許出牌，避免出牌被拒絕導致前端吃牌！
    if (this.drawLandingTimer) {
      clearTimeout(this.drawLandingTimer);
      this.drawLandingTimer = null;
      this.finishDrawingCleanup();
    }

    if (this.isContinuousDrawing) {
      return { success: false, reason: '場上效果結算中，請稍候' };
    }

    if (calledUno) {
      this.engine.callUno(playerIndex);
    }

    const res = this.engine.playCard(playerIndex, cardId, chosenColor);
    if (!res.success) {
      // 若出牌不合法，強制廣播一次真實狀態讓客端手牌立即校正回原狀
      this.onBroadcastState();
      return res;
    }

    if (res.isChoosingColor) {
      this.emitSound('card');
      this.onBroadcastState();
      this.resetTurnTimer();
      return res;
    }

    const sfx = res.card.color === 'wild'
      ? 'wild'
      : (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value) ? 'action' : 'card');
    this.emitSound(sfx);

    if (res.gameOver) {
      soundManager.playVictory();
    }

    this.onBroadcastState();

    if (!res.gameOver && res.isVanishing) {
      this.handleSpecialVanishAndEffects(playerIndex, res.card);
    } else if (!res.gameOver && ['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value)) {
      this.isContinuousDrawing = true;
      this.engine.isContinuousDrawing = true;
      this.onBroadcastState();
      setTimeout(() => {
        this.finishDrawingCleanup();
        if (this.engine) {
          this.engine.turnStartTime = Date.now();
          this.onBroadcastState();
        }
        this.checkAiTurn();
      }, 650);
    } else {
      this.checkAiTurn();
    }

    return res;
  }

  chooseColor(playerIndex, chosenColor) {
    if (!this.engine) return { success: false };
    const res = this.engine.confirmWildColor(playerIndex, chosenColor);
    if (res.success) {
      this.emitSound('wild');
      this.onBroadcastState();
      this.checkAiTurn();
    }
    return res;
  }

  drawCard(playerIndex, onDrawComplete = null) {
    if (!this.engine || this.engine.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能抽牌' };
    }
    if (this.engine.isChoosingColor) {
      return { success: false, reason: '正在選擇顏色中，無法抽牌' };
    }
    if (this.isContinuousDrawing) {
      return { success: false, reason: '正在抽牌或結算動畫中' };
    }
    if (this.engine.currentTurn !== playerIndex) {
      return { success: false, reason: '不是你的回合！' };
    }

    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    if (this.engine.stackedDrawCount > 0) {
      this.executePenaltyDraw(playerIndex, onDrawComplete);
      return { success: true, penalty: true };
    }

    if (this.engine.hasDrawnThisTurn) {
      return { success: false, reason: '本回合已經主動抽過牌了！' };
    }

    if (this.engine.drawRule === 'draw_until_playable') {
      this.executeContinuousDraw(playerIndex, onDrawComplete);
      return { success: true, continuous: true };
    }

    const res = this.engine.playerDrawCard(playerIndex);
    if (res.success) {
      this.emitSound(res.extraBombCards > 0 ? 'penalty' : 'draw');

      const totalDrawn = 1 + (res.extraBombCards || 0);
      const flightAndBufferMs = totalDrawn * 240 + 600;

      if (!res.canPlay) {
        this.isContinuousDrawing = true;
        this.engine.isContinuousDrawing = true;
        this.onBroadcastState();

        this.drawLandingTimer = setTimeout(() => {
          this.drawLandingTimer = null;
          this.finishDrawingCleanup();
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.finishAutoPass(playerIndex, res.card);
          this.onBroadcastState();
          this.checkAiTurn();
          if (onDrawComplete) onDrawComplete(res);
        }, flightAndBufferMs);
      } else {
        // 抽到可出的牌：不鎖死 isContinuousDrawing，直接重置計時器並廣播讓玩家可隨時出牌！
        this.engine.turnStartTime = Date.now();
        this.engine.turnDuration = this.engine.getActiveTurnDuration();
        this.resetTurnTimer();
        this.onBroadcastState();
        if (onDrawComplete) {
          this.drawLandingTimer = setTimeout(() => {
            this.drawLandingTimer = null;
            onDrawComplete(res);
          }, 420);
        }
      }
    }
    return res;
  }

  passTurn(playerIndex) {
    if (!this.engine) return { success: false, reason: '未在遊戲中' };
    if (this.drawLandingTimer) {
      clearTimeout(this.drawLandingTimer);
      this.drawLandingTimer = null;
      this.finishDrawingCleanup();
    }
    const res = this.engine.passTurn(playerIndex);
    if (res.success) {
      this.onBroadcastState();
      this.checkAiTurn();
    }
    return res;
  }

  callUno(playerIndex) {
    if (!this.engine) return { success: false };
    const res = this.engine.callUno(playerIndex);
    if (res.success) {
      this.emitSound('uno');
      this.onBroadcastState();
    }
    return res;
  }

  challengeUno(challengerIndex, targetIndex) {
    if (!this.engine) return { success: false };
    const res = this.engine.challengeUno(challengerIndex, targetIndex);
    if (res.success && res.caught) {
      this.emitSound('penalty');
      this.onBroadcastState();
      setTimeout(() => {
        if (this.engine && this.engine.activePenaltyBanner?.playerId === targetIndex) {
          this.engine.activePenaltyBanner = null;
          this.onBroadcastState();
        }
      }, 1500);
    }
    return res;
  }

  challengeWildDraw4(challengerIndex) {
    if (!this.engine || this.isContinuousDrawing) return { success: false };
    const res = this.engine.challengeWildDraw4(challengerIndex);
    if (res.success) {
      if (this.turnTimeoutTimer) {
        clearTimeout(this.turnTimeoutTimer);
        this.turnTimeoutTimer = null;
      }
      this.isContinuousDrawing = true;
      this.emitSound('action');
      this.onBroadcastState();

      // 第一階段：等待 2450ms 驗牌演出完畢
      this.challengeTimer = setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') {
          this.finishDrawingCleanup();
          return;
        }

        // 第二階段：驗牌動畫結束，正式發放罰抽卡牌並結算
        const penaltyRes = this.engine.resolveWildDraw4ChallengePenalty();
        this.emitSound('penalty');
        this.onBroadcastState();

        // 預留卡牌飛入牌組的飛行時間 (每張 220ms + 750ms 緩衝)
        const drawnCount = penaltyRes.drawnCount || 4;
        const flightWait = drawnCount * 220 + 750;

        this.challengeTimer = setTimeout(() => {
          this.finishDrawingCleanup();
          if (this.engine) {
            this.resetTurnTimer();
            this.onBroadcastState();
          }
          this.checkAiTurn();
        }, flightWait);
      }, 2450);
    }
    return res;
  }

  // ==========================================================
  // MULTI-STEP SEQUENCES (Continuous Draw, Penalty, Rabbids)
  // ==========================================================
  executeContinuousDraw(playerIndex, onComplete) {
    if (!this.engine || this.engine.currentTurn !== playerIndex) return;
    if (this.isContinuousDrawing || this.engine.hasDrawnThisTurn || this.engine.isChoosingColor) return;

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.engine.drawingPlayerIndex = playerIndex;
    this.engine.drawingStepCount = 0;

    if (this.engine.explosiveActive) {
      const extraBomb = this.engine.checkAndTriggerExplosive(playerIndex);
      const stepRes = this.engine.drawSingleCardStep(playerIndex);
      this.engine.activePenaltyBanner = { playerId: playerIndex, count: extraBomb + 1 };
      this.emitSound('penalty');
      this.onBroadcastState();

      const totalWait = (extraBomb + 1) * 240 + 650;
      this.continuousDrawTimer = setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') return;
        this.finishDrawingCleanup();
        this.engine.finishAutoPass(playerIndex, stepRes.card);
        this.onBroadcastState();
        this.checkAiTurn();
        if (onComplete) onComplete({ success: true, canPlay: false, autoPassed: true });
      }, totalWait);
      return;
    }

    const drawnCards = [];
    const maxLimit = 25;

    const drawStep = () => {
      if (!this.engine || this.engine.currentTurn !== playerIndex || this.engine.gameStatus === 'game_over') {
        this.finishDrawingCleanup();
        this.onBroadcastState();
        this.checkAiTurn();
        if (onComplete) onComplete({ success: false });
        return;
      }

      const res = this.engine.drawSingleCardStep(playerIndex);
      if (!res.success) {
        this.finishDrawingCleanup();
        this.onBroadcastState();
        this.checkAiTurn();
        if (onComplete) onComplete(res);
        return;
      }

      drawnCards.push(res.card);
      this.engine.drawingStepCount = drawnCards.length;

      this.emitSound('draw');
      this.onBroadcastState();

      if (res.canPlay || drawnCards.length >= maxLimit || (this.engine.drawPile.length === 0 && this.engine.discardPile.length <= 1)) {
        this.continuousDrawTimer = setTimeout(() => {
          if (!this.engine) return;
          this.finishDrawingCleanup();
          const finalRes = this.engine.finishContinuousDraw(playerIndex, drawnCards, res.canPlay);
          this.onBroadcastState();

          if (finalRes.canPlay) {
            this.resetTurnTimer();
          } else {
            this.checkAiTurn();
          }

          if (onComplete) onComplete(finalRes);
        }, 480);
      } else {
        this.continuousDrawTimer = setTimeout(() => {
          drawStep();
        }, 420);
      }
    };

    drawStep();
  }

  executePenaltyDraw(playerIndex, onComplete) {
    if (!this.engine || this.isContinuousDrawing || this.engine.isChoosingColor) return;

    if (this.engine.explosiveActive) {
      this.engine.explosiveActive = false;
      this.engine.stackedDrawCount += 3;
      const victimName = this.engine.players[playerIndex]?.name || '玩家';
      this.engine.addLog(`💥 轟！！！瘋狂定時炸彈在【${victimName}】承受罰抽時引爆！罰抽瞬間暴增 +3 張 (共 ${this.engine.stackedDrawCount} 張)！`);
      this.emitSound('penalty');
    }

    const countToDraw = this.engine.stackedDrawCount;
    if (countToDraw <= 0) return;

    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.engine.drawingPlayerIndex = playerIndex;
    this.engine.drawingStepCount = 0;

    let drawn = 0;

    const step = () => {
      if (!this.engine || this.engine.gameStatus === 'game_over') {
        this.finishDrawingCleanup();
        this.onBroadcastState();
        if (onComplete) onComplete({ success: false });
        return;
      }

      const res = this.engine.drawSingleCardStep(playerIndex);
      if (!res.success) {
        this.finishDrawingCleanup();
        this.onBroadcastState();
        this.checkAiTurn();
        if (onComplete) onComplete(res);
        return;
      }

      drawn++;
      this.engine.drawingStepCount = drawn;

      this.emitSound('draw');
      this.onBroadcastState();

      if (drawn >= countToDraw) {
        this.continuousDrawTimer = setTimeout(() => {
          if (!this.engine) return;
          this.engine.finishPenaltyDraw(playerIndex, countToDraw);
          this.finishDrawingCleanup();
          this.emitSound('penalty');
          this.onBroadcastState();
          this.checkAiTurn();
          if (onComplete) onComplete({ success: true, count: countToDraw });
        }, 1050);
      } else {
        this.continuousDrawTimer = setTimeout(() => {
          step();
        }, 340);
      }
    };

    step();
  }

  handleSpecialVanishAndEffects(casterIndex, card) {
    if (!this.engine || !card) return;

    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }
    if (this.drawLandingTimer) {
      clearTimeout(this.drawLandingTimer);
      this.drawLandingTimer = null;
    }

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.onBroadcastState();

    if (card.value === 'rabbids_comin_through') {
      setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') return;
        this.engine.executeCominThroughWave(casterIndex, 1);
        this.emitSound('draw');
        this.onBroadcastState();

        setTimeout(() => {
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.executeCominThroughWave(casterIndex, 2);
          this.emitSound('draw');
          this.onBroadcastState();

          setTimeout(() => {
            if (!this.engine || this.engine.gameStatus === 'game_over') return;
            this.engine.vanishTopSpecialCard(card.id);
            this.finishDrawingCleanup();
            this.onBroadcastState();
            this.checkAiTurn();
          }, 1350);
        }, 1250);
      }, 700);
    } else if (card.value === 'rabbids_wild_shield' && card.deflectedCount > 0) {
      setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') return;
        const victimIdx = card.deflectedVictimIdx;
        const count = card.deflectedCount;

        this.engine.executeShieldDeflectDraw(victimIdx, count);
        this.emitSound('penalty');
        this.onBroadcastState();

        const actualCount = this.engine.activePenaltyBanner?.count || count;
        const totalFlightWaitMs = actualCount * 220 + 850;
        setTimeout(() => {
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.vanishTopSpecialCard(card.id);
          this.finishDrawingCleanup();
          this.onBroadcastState();
          this.checkAiTurn();
        }, totalFlightWaitMs);
      }, 750);
    } else {
      // 瘋狂快抽 (Hurry Up!) 或 定時炸彈 (Explosive Results)：
      // 展示並淡出 1250ms 後推進至下一家
      setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') return;
        this.engine.vanishTopSpecialCard(card.id);
        this.finishDrawingCleanup();
        this.onBroadcastState();
        this.checkAiTurn();
      }, 1250);
    }
  }

  // ==========================================================
  // TIMERS, TIMEOUT STRIKES & AI SCHEDULING
  // ==========================================================
  resetTurnTimer() {
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    if (!this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) {
      return;
    }

    if (this.engine.isChoosingColor) {
      const choosingIdx = this.engine.colorChoosingPlayerIndex;
      const choosingPlayer = this.engine.players[choosingIdx];
      if (choosingPlayer && !choosingPlayer.isAi) {
        this.turnTimeoutTimer = setTimeout(() => {
          this.handleColorTimeout(choosingIdx);
        }, 6000);
      }
      return;
    }

    const curIdx = this.engine.currentTurn;
    const curPlayer = this.engine.players[curIdx];
    if (!curPlayer) return;

    if (!curPlayer.isAi) {
      const durationMs = (this.engine.turnDuration || 15) * 1000;
      this.turnTimeoutTimer = setTimeout(() => {
        this.handleTurnTimeout(curIdx);
      }, durationMs);
    }
  }

  recordPlayerTimeoutStrike(playerIndex) {
    if (!this.engine) return false;
    const isHurryUp = (this.engine.hurryUpTurns > 0 || (this.engine.hurryUpCasterTurnsRemaining || 0) > 0 || this.engine.turnDuration <= 3);
    if (isHurryUp) return false;
    const player = this.engine.players[playerIndex];
    const hostIdx = this.getHostIndex();
    if (!player || player.isAi || playerIndex === hostIdx || player.isHost) {
      return false;
    }
    player.timeoutCount = (player.timeoutCount || 0) + 1;
    return player.timeoutCount >= 2;
  }

  handleColorTimeout(playerIndex) {
    if (!this.engine || !this.engine.isChoosingColor) return;
    if (this.engine.colorChoosingPlayerIndex !== playerIndex) return;

    const player = this.engine.players[playerIndex];
    const isHurryUp = (this.engine.hurryUpTurns > 0 || (this.engine.hurryUpCasterTurnsRemaining || 0) > 0 || this.engine.turnDuration <= 3);
    const shouldKick = this.recordPlayerTimeoutStrike(playerIndex);
    const strikeTag = (!isHurryUp && !player.isHost && playerIndex !== this.getHostIndex())
      ? ` (本局累計超時 ${player.timeoutCount}/2 次)`
      : '';

    const autoColor = this.engine.getBestColorForPlayer(playerIndex);
    this.engine.addLog(`⏰ 【${player?.name || '玩家'}】選色超時 (6 秒)，系統自動指定【${this.engine.colorNames[autoColor]}】！${strikeTag}`);

    const res = this.engine.confirmWildColor(playerIndex, autoColor);
    if (res.success) {
      this.emitSound('wild');

      if (shouldKick) {
        this.onAutoKickPlayer(playerIndex, '單局思考/選色超時累計達 2 次，系統已自動將你移出並由 AI 接管！');
        return;
      }

      this.onBroadcastState();
      this.checkAiTurn();
    }
  }

  handleTurnTimeout(playerIndex) {
    if (!this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) return;
    if (this.engine.currentTurn !== playerIndex) return;

    const player = this.engine.players[playerIndex];
    if (!player) return;

    const isHurryUp = (this.engine.hurryUpTurns > 0 || (this.engine.hurryUpCasterTurnsRemaining || 0) > 0 || this.engine.turnDuration <= 3);
    const shouldKick = this.recordPlayerTimeoutStrike(playerIndex);
    const strikeTag = (!isHurryUp && !player.isHost && playerIndex !== this.getHostIndex())
      ? ` (本局累計超時 ${player.timeoutCount}/2 次)`
      : '';

    const limitSec = this.engine.turnDuration || 15;

    if (this.engine.stackedDrawCount > 0) {
      this.engine.addLog(`⏰ 【${player.name}】思考超時 (${limitSec} 秒)，系統自動承受罰抽！${strikeTag}`);
      this.executePenaltyDraw(playerIndex, () => {
        if (shouldKick) {
          this.onAutoKickPlayer(playerIndex, '單局思考超時累計達 2 次，系統已自動將你移出並由 AI 接管！');
        }
      });
      return;
    }

    if (this.engine.hasDrawnThisTurn) {
      this.engine.addLog(`⏰ 【${player.name}】思考超時 (${limitSec} 秒)，系統自動過牌！${strikeTag}`);
      const passRes = this.engine.passTurn(playerIndex);
      if (passRes.success) {
        if (shouldKick) {
          this.onAutoKickPlayer(playerIndex, '單局思考超時累計達 2 次，系統已自動將你移出並由 AI 接管！');
          return;
        }
        this.onBroadcastState();
        this.checkAiTurn();
      }
      return;
    }

    const extraBombCards = this.engine.checkAndTriggerExplosive(playerIndex);
    const card = this.engine.drawCardRaw();
    player.hand.push(card);
    if (player.hand.length > 1) {
      player.calledUno = false;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
    }

    this.engine.addLog(`⏰ 【${player.name}】思考超時 (${limitSec} 秒)，系統自動抽一張牌並過牌！${strikeTag}`);
    this.emitSound(extraBombCards > 0 ? 'penalty' : 'draw');

    const totalCards = 1 + (extraBombCards || 0);
    const waitMs = totalCards * 240 + 600;

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.onBroadcastState();

    setTimeout(() => {
      this.finishDrawingCleanup();
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.advanceTurn(1);

      if (shouldKick) {
        this.onAutoKickPlayer(playerIndex, '單局思考超時累計達 2 次，系統已自動將你移出並由 AI 接管！');
        return;
      }

      this.onBroadcastState();
      this.checkAiTurn();
    }, waitMs);
  }

  checkAiTurn() {
    if (!this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) return;

    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }

    this.resetTurnTimer();

    const curIdx = this.engine.currentTurn;
    const curPlayer = this.engine.players[curIdx];
    const hostIdx = this.getHostIndex();

    if (!curPlayer || !curPlayer.isAi) {
      if (curIdx === hostIdx) {
        soundManager.playTurn();
      }
      return;
    }

    const delay = 850 + Math.random() * 400;
    this.aiTimer = setTimeout(() => {
      this.executeAiTurn(curIdx);
    }, delay);
  }

  executeAiTurn(aiIndex) {
    if (!this.engine || this.engine.currentTurn !== aiIndex || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) return;

    const move = this.ai.decideMove(aiIndex);
    if (!move) return;

    if (move.action === 'challenge') {
      this.challengeUno(aiIndex, move.targetIndex);
      this.checkAiTurn();
      return;
    }

    if (move.action === 'challenge_wild_draw4') {
      this.challengeWildDraw4(aiIndex);
      return;
    }

    if (move.action === 'play') {
      this.playCard(aiIndex, move.card.id, move.chosenColor, !!move.callUno);
    } else if (move.action === 'draw') {
      this.drawCard(aiIndex, (res) => {
        if (res && res.canPlay && res.card) {
          setTimeout(() => {
            if (this.engine && this.engine.currentTurn === aiIndex && !this.isContinuousDrawing) {
              const card = res.card;
              const chosenColor = card.color === 'wild'
                ? this.ai.getBestColorForHand(this.engine.players[aiIndex].hand)
                : null;
              const shouldCallUno = this.engine.players[aiIndex].hand.length === 2 && Math.random() < 0.85;
              this.playCard(aiIndex, card.id, chosenColor, shouldCallUno);
            }
          }, 550);
        }
      });
    }
  }

  finishDrawingCleanup() {
    this.isContinuousDrawing = false;
    if (this.continuousDrawTimer) {
      clearTimeout(this.continuousDrawTimer);
      this.continuousDrawTimer = null;
    }
    if (this.drawLandingTimer) {
      clearTimeout(this.drawLandingTimer);
      this.drawLandingTimer = null;
    }
    if (this.challengeTimer) {
      clearTimeout(this.challengeTimer);
      this.challengeTimer = null;
    }
    if (this.engine) {
      this.engine.isContinuousDrawing = false;
      this.engine.drawingPlayerIndex = null;
      this.engine.drawingStepCount = 0;
      this.engine.wild4ChallengeAnim = null;
      this.engine.activePenaltyBanner = null;
    }
  }

  cleanupTimers() {
    this.finishDrawingCleanup();
    if (this.dealTimer) {
      clearTimeout(this.dealTimer);
      this.dealTimer = null;
    }
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }
    if (this.challengeTimer) {
      clearTimeout(this.challengeTimer);
      this.challengeTimer = null;
    }
  }

  destroy() {
    this.cleanupTimers();
    this.engine = null;
    this.ai = null;
  }
}

```

## src/services/p2p.js

```javascript
// 檔案位置：src/services/p2p.js
// Decoupled WebRTC P2P Networking, Non-Destructive Mode Switching & Spectator Manager
import Peer from 'peerjs';
import { HostGameController } from '../game/hostGameController';
import { soundManager } from './sound';

export class P2PNetwork {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this.playerName = '玩家';
    this.hostConn = null;
    this.guestConns = new Map(); // peerId -> { conn, name, slotIndex, isSpectator }

    // Callbacks for React state
    this.onLobbyUpdate = null;
    this.onStateUpdate = null;
    this.onConnectionStatus = null;
    this.onError = null;
    this.onRoomDisbanded = null;
    this.onReturnToLobby = null;

    // Lobby configuration state
    this.lobbyPlayers = [];
    this.spectators = []; // Array of { peerId, name }
    this.allowStacking = true;
    this.allowChallengeWildDraw4 = true;
    this.gameMode = 'ffa';
    this.targetScore = 500;
    this.drawRule = 'draw_one';
    this.deckTheme = 'classic';
    this.gameStarted = false;
    this.lobbyIdleTimer = null;

    this.controller = new HostGameController({
      onBroadcastState: () => this.broadcastGameState(),
      onBroadcastSound: (soundName) => this.broadcastSoundEvent(soundName),
      onAutoKickPlayer: (slotIndex, reason) => this.kickPlayer(slotIndex, reason),
      getHostIndex: () => this.getHostIndex()
    });
  }

  get engine() {
    return this.controller.engine;
  }

  static generateRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `UNO-${num}`;
  }

  formatPeerId(code) {
    const clean = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `uno-p2p-${clean}`;
  }

  resetLobbyIdleTimer() {
    if (this.lobbyIdleTimer) {
      clearTimeout(this.lobbyIdleTimer);
      this.lobbyIdleTimer = null;
    }
    if (this.isHost && !this.gameStarted) {
      this.lobbyIdleTimer = setTimeout(() => {
        const msg = '房間在大廳閒置超過 15 分鐘無操作，系統已自動解散房間！';
        this.disbandRoom(msg);
        if (this.onRoomDisbanded) this.onRoomDisbanded(msg);
      }, 15 * 60 * 1000);
    }
  }

  disbandRoom(reason = '房主已解散房間') {
    if (this.isHost) {
      const packet = { type: 'ROOM_DISBANDED', reason };
      for (const guest of this.guestConns.values()) {
        if (guest.conn && guest.conn.open) {
          try {
            guest.conn.send(packet);
          } catch (e) {
            console.warn('Error sending disband packet to guest:', e);
          }
        }
      }
    }
    this.disconnect();
  }

  // ==========================================
  // HOST ROOM & LOBBY MANAGEMENT
  // ==========================================
  createRoom(roomCode, hostName = '房主', allowStacking = true, gameMode = 'ffa') {
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = hostName.trim() || '房主';
    this.allowStacking = allowStacking;
    this.allowChallengeWildDraw4 = true;
    this.gameMode = gameMode;
    this.deckTheme = 'classic';
    this.gameStarted = false;
    this.guestConns.clear();
    this.spectators = [];
    this.resetLobbyIdleTimer();
    this.controller.destroy();

    const hostPeerId = this.formatPeerId(this.roomCode);
    this.initLobbySlots();

    if (this.peer) this.peer.destroy();

    this.peer = new Peer(hostPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      if (this.onConnectionStatus) this.onConnectionStatus({ status: 'connected', peerId: id, isHost: true });
      this.broadcastLobbyUpdate();
    });

    this.peer.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS Host Error:', err);
      if (this.onError) this.onError(err.type === 'unavailable-id' ? '該房號已被佔用，請重新產生房號！' : `連線錯誤: ${err.message}`);
    });
  }

  initLobbySlots() {
    const count = 4;
    const slots = [];
    for (let i = 0; i < count; i++) {
      const isHost = i === 0;
      slots.push({
        id: i,
        name: isHost ? this.playerName : `電腦 ${i}`,
        isHost,
        isAi: !isHost,
        isReady: true,
        peerId: isHost ? 'host' : null,
        teamId: this.gameMode === '2v2' ? (i % 2 === 0 ? 'team_a' : 'team_b') : null,
        teamName: this.gameMode === '2v2' ? (i % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null,
        partnerIdx: this.gameMode === '2v2' ? (i + 2) % 4 : null
      });
    }
    this.lobbyPlayers = slots;
  }

  // Helper: Refresh slot indices and team tags without wiping any players!
  refreshSlotTeamMetadata() {
    this.lobbyPlayers = this.lobbyPlayers.map((p, idx) => ({
      ...p,
      id: idx,
      teamId: this.gameMode === '2v2' ? (idx % 2 === 0 ? 'team_a' : 'team_b') : null,
      teamName: this.gameMode === '2v2' ? (idx % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null,
      partnerIdx: this.gameMode === '2v2' ? (idx + 2) % 4 : null
    }));

    // Keep guestConns slotIndex synced
    this.lobbyPlayers.forEach((p, idx) => {
      if (p.peerId && p.peerId !== 'host' && this.guestConns.has(p.peerId)) {
        const g = this.guestConns.get(p.peerId);
        g.slotIndex = idx;
        g.isSpectator = false;
      }
    });
  }

  handleIncomingConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (data) => {
        this.handleHostData(conn, data);
      });
    });

    conn.on('close', () => {
      this.handleGuestDisconnect(conn.peer);
    });

    conn.on('error', (err) => {
      console.warn('Guest connection error:', err);
      this.handleGuestDisconnect(conn.peer);
    });
  }

  handleGuestDisconnect(peerId) {
    const guestInfo = this.guestConns.get(peerId);
    if (!guestInfo) return;

    this.guestConns.delete(peerId);

    if (guestInfo.isSpectator) {
      this.spectators = this.spectators.filter(s => s.peerId !== peerId);
      if (!this.gameStarted) {
        this.broadcastLobbyUpdate();
      } else {
        this.broadcastGameState();
      }
      return;
    }

    const slotIndex = guestInfo.slotIndex;

    if (!this.gameStarted) {
      if (this.lobbyPlayers[slotIndex]) {
        this.lobbyPlayers[slotIndex].name = `開放玩家加入...`;
        this.lobbyPlayers[slotIndex].isAi = false;
        this.lobbyPlayers[slotIndex].peerId = null;
        this.broadcastLobbyUpdate();
      }
    } else {
      if (this.lobbyPlayers[slotIndex]) {
        this.lobbyPlayers[slotIndex].isAi = true;
        this.lobbyPlayers[slotIndex].peerId = null;
      }
      if (this.engine && this.engine.players[slotIndex]) {
        this.engine.players[slotIndex].isAi = true;
        this.engine.players[slotIndex].peerId = null;
        if (!this.engine.players[slotIndex].name.includes('AI')) {
          this.engine.players[slotIndex].name = `${guestInfo.name} (AI 接管)`;
        }
        this.engine.addLog(`⚠️ 玩家【${guestInfo.name}】斷線，已自動切換為 AI 電腦接管！`);
        this.broadcastGameState();
        this.controller.checkAiTurn();
      }
    }
  }

  // Kick a spectator by peerId
  kickSpectator(peerId, reason = '你已被房主移出觀戰席！') {
    if (!this.isHost) return { success: false };
    this.spectators = this.spectators.filter(s => s.peerId !== peerId);
    if (this.guestConns.has(peerId)) {
      const guest = this.guestConns.get(peerId);
      this.guestConns.delete(peerId);
      if (guest && guest.conn) {
        try {
          guest.conn.send({ type: 'KICKED', reason });
          setTimeout(() => {
            try { guest.conn.close(); } catch {}
          }, 120);
        } catch {}
      }
    }
    this.broadcastLobbyUpdate();
    return { success: true };
  }

  // Move a seated human player to the Spectator section
  moveToSpectator(slotIndex) {
    if (!this.isHost || this.gameStarted) return { success: false };
    const slot = this.lobbyPlayers[slotIndex];
    if (!slot || slot.isHost || slot.isAi || !slot.peerId) return { success: false };

    const peerId = slot.peerId;
    const playerName = slot.name;

    if (!this.spectators.some(s => s.peerId === peerId)) {
      this.spectators.push({ peerId, name: playerName });
    }

    if (this.guestConns.has(peerId)) {
      const g = this.guestConns.get(peerId);
      g.slotIndex = -1;
      g.isSpectator = true;
    }

    slot.isAi = false;
    slot.name = '開放玩家加入...';
    slot.peerId = null;

    this.broadcastLobbyUpdate();
    return { success: true };
  }

  // Move a spectator into an open or AI table seat
  moveSpectatorToSlot(peerId, targetSlotIndex = null) {
    if (!this.isHost || this.gameStarted) return { success: false };
    const specIdx = this.spectators.findIndex(s => s.peerId === peerId);
    if (specIdx === -1) return { success: false };

    const spec = this.spectators[specIdx];

    let slotIdx = targetSlotIndex;
    if (slotIdx === null || slotIdx === undefined) {
      slotIdx = this.lobbyPlayers.findIndex(p => !p.isHost && !p.isAi && !p.peerId);
      if (slotIdx === -1) {
        slotIdx = this.lobbyPlayers.findIndex(p => !p.isHost && p.isAi);
      }
    }

    if (slotIdx === -1 || !this.lobbyPlayers[slotIdx] || (this.lobbyPlayers[slotIdx].peerId && !this.lobbyPlayers[slotIdx].isAi)) {
      if (this.onError) this.onError('目前牌桌沒有空位可供入座！');
      return { success: false };
    }

    this.spectators.splice(specIdx, 1);
    const slot = this.lobbyPlayers[slotIdx];
    slot.name = spec.name;
    slot.isAi = false;
    slot.peerId = spec.peerId;

    if (this.guestConns.has(spec.peerId)) {
      const g = this.guestConns.get(spec.peerId);
      g.slotIndex = slotIdx;
      g.isSpectator = false;
    }

    this.broadcastLobbyUpdate();
    return { success: true };
  }

  kickPlayer(slotIndex, reason = '你已被房主移出房間！', convertToOpenInLobby = true) {
    if (!this.isHost) return { success: false };
    const hostIdx = this.getHostIndex();
    if (slotIndex === hostIdx) return { success: false, reason: '不能踢除房主自己！' };

    const lobbySlot = this.lobbyPlayers[slotIndex];
    const enginePlayer = this.engine && this.engine.players ? this.engine.players[slotIndex] : null;

    let targetPeerId = lobbySlot?.peerId || enginePlayer?.peerId || null;
    if (!targetPeerId || targetPeerId === 'host') {
      for (const [pId, gInfo] of this.guestConns.entries()) {
        if (!gInfo.isSpectator && gInfo.slotIndex === slotIndex) {
          targetPeerId = pId;
          break;
        }
      }
    }

    const kickedName = enginePlayer?.name || lobbySlot?.name || `玩家 ${slotIndex + 1}`;

    if (targetPeerId && this.guestConns.has(targetPeerId)) {
      const guest = this.guestConns.get(targetPeerId);
      this.guestConns.delete(targetPeerId);
      if (guest && guest.conn) {
        try {
          guest.conn.send({ type: 'KICKED', reason });
          setTimeout(() => {
            try { guest.conn.close(); } catch {}
          }, 120);
        } catch (e) {
          console.warn('Error sending kick packet:', e);
        }
      }
    }

    if (!this.gameStarted) {
      if (lobbySlot) {
        if (convertToOpenInLobby) {
          lobbySlot.isAi = false;
          lobbySlot.name = '開放玩家加入...';
          lobbySlot.peerId = null;
        } else {
          lobbySlot.isAi = true;
          lobbySlot.name = `電腦 ${slotIndex}`;
          lobbySlot.peerId = null;
        }
      }
      this.broadcastLobbyUpdate();
    } else {
      if (lobbySlot) {
        lobbySlot.isAi = true;
        lobbySlot.peerId = null;
        lobbySlot.name = `電腦 ${slotIndex}`;
      }
      if (enginePlayer) {
        const cleanName = kickedName.replace(/ \(AI 接管\)$/g, '');
        enginePlayer.isAi = true;
        enginePlayer.peerId = null;
        enginePlayer.name = `${cleanName} (AI 接管)`;
        this.engine.addLog(`🚫 【${cleanName}】已被移出牌局 (${reason})，由 AI 電腦自動接管！`);

        if (this.engine.isChoosingColor && this.engine.colorChoosingPlayerIndex === slotIndex) {
          const autoColor = this.engine.getBestColorForPlayer(slotIndex);
          this.engine.confirmWildColor(slotIndex, autoColor);
        }

        this.controller.emitSound('penalty');
        this.broadcastGameState();
        this.controller.checkAiTurn();
      }
    }

    return { success: true, kickedName };
  }

  handleHostData(conn, packet) {
    if (!packet || !packet.type) return;

    switch (packet.type) {
      case 'JOIN': {
        const guestName = (packet.name || '訪客').trim();
        const preferSpectate = !!packet.asSpectator || this.gameStarted;

        let targetSlotIdx = -1;
        if (!preferSpectate) {
          targetSlotIdx = this.lobbyPlayers.findIndex((p) => !p.isHost && !p.isAi && !p.peerId);
          if (targetSlotIdx === -1) {
            targetSlotIdx = this.lobbyPlayers.findIndex((p) => !p.isHost && p.isAi);
          }
        }

        // If all seats are full or game already started, automatically place in Spectators!
        if (targetSlotIdx === -1) {
          this.spectators = this.spectators.filter(s => s.peerId !== conn.peer);
          this.spectators.push({ peerId: conn.peer, name: guestName });

          this.guestConns.set(conn.peer, {
            conn,
            name: guestName,
            slotIndex: -1,
            isSpectator: true
          });

          conn.send({
            type: 'JOIN_ACCEPTED',
            slotIndex: -1,
            isSpectator: true,
            roomCode: this.roomCode,
            gameMode: this.gameMode,
            allowStacking: this.allowStacking,
            allowChallengeWildDraw4: this.allowChallengeWildDraw4,
            targetScore: this.targetScore,
            drawRule: this.drawRule,
            deckTheme: this.deckTheme || 'classic'
          });

          this.broadcastLobbyUpdate();

          if (this.gameStarted && this.engine) {
            conn.send({
              type: 'SYNC_STATE',
              state: this.engine.getClientState(0, true)
            });
          }
          return;
        }

        this.lobbyPlayers[targetSlotIdx].name = guestName;
        this.lobbyPlayers[targetSlotIdx].isAi = false;
        this.lobbyPlayers[targetSlotIdx].isReady = true;
        this.lobbyPlayers[targetSlotIdx].peerId = conn.peer;

        this.guestConns.set(conn.peer, {
          conn,
          name: guestName,
          slotIndex: targetSlotIdx,
          isSpectator: false
        });

        conn.send({
          type: 'JOIN_ACCEPTED',
          slotIndex: targetSlotIdx,
          isSpectator: false,
          roomCode: this.roomCode,
          gameMode: this.gameMode,
          allowStacking: this.allowStacking,
          allowChallengeWildDraw4: this.allowChallengeWildDraw4,
          targetScore: this.targetScore,
          drawRule: this.drawRule,
          deckTheme: this.deckTheme || 'classic'
        });

        this.broadcastLobbyUpdate();

        if (this.gameStarted && this.engine) {
          conn.send({
            type: 'SYNC_STATE',
            state: this.engine.getClientState(targetSlotIdx, false)
          });
        }
        break;
      }

      case 'ACTION_TOGGLE_SPECTATE': {
        if (this.gameStarted) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        if (guest.isSpectator) {
          this.moveSpectatorToSlot(conn.peer);
        } else if (guest.slotIndex >= 0) {
          this.moveToSpectator(guest.slotIndex);
        }
        break;
      }

      case 'ACTION_PLAY': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        const res = this.controller.playCard(guest.slotIndex, packet.cardId, packet.chosenColor, packet.calledUno);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_CHOOSE_COLOR': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.controller.chooseColor(guest.slotIndex, packet.chosenColor);
        break;
      }

      case 'ACTION_DRAW': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        const res = this.controller.drawCard(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_PASS': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        const res = this.controller.passTurn(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_UNO': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.controller.callUno(guest.slotIndex);
        break;
      }

      case 'ACTION_CHALLENGE': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        const res = this.controller.challengeUno(guest.slotIndex, packet.targetIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_CHALLENGE_WILD_DRAW4': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        const res = this.controller.challengeWildDraw4(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      default:
        break;
    }
  }

  // ==========================================
  // LOBBY SETTINGS & NON-DESTRUCTIVE MODE SWITCHING
  // ==========================================
  setGameMode(mode) {
    if (!this.isHost || this.gameStarted) return;
    if (this.gameMode === mode) return;
    this.gameMode = mode;

    // 2V2 mode requires 4 seats: if currently 2 or 3 seats, pad up to 4 without touching existing friends!
    if (mode === '2v2' && this.lobbyPlayers.length < 4) {
      for (let i = this.lobbyPlayers.length; i < 4; i++) {
        // If there is a spectator waiting, let them fill the newly opened seat; otherwise add AI
        if (this.spectators.length > 0) {
          const spec = this.spectators.shift();
          this.lobbyPlayers.push({
            id: i,
            name: spec.name,
            isHost: false,
            isAi: false,
            isReady: true,
            peerId: spec.peerId
          });
          if (this.guestConns.has(spec.peerId)) {
            const g = this.guestConns.get(spec.peerId);
            g.slotIndex = i;
            g.isSpectator = false;
          }
        } else {
          this.lobbyPlayers.push({
            id: i,
            name: `電腦 ${i}`,
            isHost: false,
            isAi: true,
            isReady: true,
            peerId: null
          });
        }
      }
    }

    // Update teamId & partnerIdx in-place while keeping all seated friends intact!
    this.refreshSlotTeamMetadata();
    this.broadcastLobbyUpdate();
  }

  setFfaPlayerCount(count) {
    if (!this.isHost || this.gameStarted || this.gameMode === '2v2') return;
    const targetCount = Math.max(2, Math.min(4, count));
    if (targetCount === this.lobbyPlayers.length) return;

    if (targetCount > this.lobbyPlayers.length) {
      for (let i = this.lobbyPlayers.length; i < targetCount; i++) {
        if (this.spectators.length > 0) {
          const spec = this.spectators.shift();
          this.lobbyPlayers.push({
            id: i,
            name: spec.name,
            isHost: false,
            isAi: false,
            isReady: true,
            peerId: spec.peerId
          });
          if (this.guestConns.has(spec.peerId)) {
            const g = this.guestConns.get(spec.peerId);
            g.slotIndex = i;
            g.isSpectator = false;
          }
        } else {
          this.lobbyPlayers.push({
            id: i,
            name: `電腦 ${i}`,
            isHost: false,
            isAi: true,
            isReady: true,
            peerId: null
          });
        }
      }
    } else {
      // Shrinking player count: preserve human friends whenever possible!
      const keptSlots = this.lobbyPlayers.slice(0, targetCount);
      const removedSlots = this.lobbyPlayers.slice(targetCount);

      for (const removed of removedSlots) {
        if (!removed.isAi && removed.peerId && removed.peerId !== 'host') {
          // Try to find an AI or open slot inside keptSlots to relocate this friend
          const replaceableIdx = keptSlots.findIndex(s => !s.isHost && (s.isAi || !s.peerId));
          if (replaceableIdx !== -1) {
            keptSlots[replaceableIdx] = {
              ...removed,
              id: replaceableIdx
            };
          } else {
            // All kept slots are occupied by humans -> Move friend to Spectators instead of kicking!
            if (!this.spectators.some(s => s.peerId === removed.peerId)) {
              this.spectators.push({ peerId: removed.peerId, name: removed.name });
            }
            if (this.guestConns.has(removed.peerId)) {
              const g = this.guestConns.get(removed.peerId);
              g.slotIndex = -1;
              g.isSpectator = true;
            }
          }
        }
      }

      this.lobbyPlayers = keptSlots;
    }

    this.refreshSlotTeamMetadata();
    this.broadcastLobbyUpdate();
  }

  swapSlots(idxA, idxB) {
    if (!this.isHost || this.gameStarted) return;
    if (idxA === idxB || !this.lobbyPlayers[idxA] || !this.lobbyPlayers[idxB]) return;

    const pA = { ...this.lobbyPlayers[idxA] };
    const pB = { ...this.lobbyPlayers[idxB] };

    this.lobbyPlayers[idxA] = { ...pB, id: idxA, isHost: !!pB.isHost };
    this.lobbyPlayers[idxB] = { ...pA, id: idxB, isHost: !!pA.isHost };

    this.refreshSlotTeamMetadata();
    this.broadcastLobbyUpdate();
  }

  toggleSlotAi(slotIndex) {
    if (!this.isHost || slotIndex === this.getHostIndex() || this.gameStarted) return;
    const p = this.lobbyPlayers[slotIndex];
    if (!p) return;

    if (!p.isAi && p.peerId) {
      // Move human guest to Spectators and set slot to AI
      this.moveToSpectator(slotIndex);
      p.isAi = true;
      p.name = `電腦 ${slotIndex}`;
      p.peerId = null;
      this.broadcastLobbyUpdate();
      return;
    } else if (p.isAi) {
      p.isAi = false;
      p.name = `開放玩家加入...`;
      p.peerId = null;
    } else {
      p.isAi = true;
      p.name = `電腦 ${slotIndex}`;
      p.peerId = null;
    }

    this.broadcastLobbyUpdate();
  }

  toggleStackingRule() {
    if (!this.isHost || this.gameStarted) return;
    this.allowStacking = !this.allowStacking;
    this.broadcastLobbyUpdate();
  }

  toggleChallengeRule() {
    if (!this.isHost || this.gameStarted) return;
    this.allowChallengeWildDraw4 = !this.allowChallengeWildDraw4;
    this.broadcastLobbyUpdate();
  }

  setTargetScore(score) {
    if (!this.isHost || this.gameStarted) return;
    this.targetScore = Number(score);
    this.broadcastLobbyUpdate();
  }

  setDrawRule(rule) {
    if (!this.isHost || this.gameStarted) return;
    this.drawRule = rule;
    this.broadcastLobbyUpdate();
  }

  setDeckTheme(theme) {
    if (!this.isHost || this.gameStarted) return;
    this.deckTheme = theme === 'rabbids' ? 'rabbids' : 'classic';
    this.broadcastLobbyUpdate();
  }

  // ==========================================
  // MATCH LIFECYCLE & HOST ACTION DELEGATES
  // ==========================================
  startGame() {
    if (!this.isHost || this.gameStarted) return;

    this.lobbyPlayers.forEach((p, idx) => {
      if (!p.peerId && !p.isHost && !p.isAi) {
        p.isAi = true;
        p.name = `電腦 ${idx}`;
      }
    });

    this.gameStarted = true;
    if (this.lobbyIdleTimer) {
      clearTimeout(this.lobbyIdleTimer);
      this.lobbyIdleTimer = null;
    }

    this.controller.startNewMatch(
      this.lobbyPlayers,
      this.allowStacking,
      this.gameMode,
      {
        targetScore: this.targetScore,
        drawRule: this.drawRule,
        allowChallengeWildDraw4: this.allowChallengeWildDraw4,
        deckTheme: this.deckTheme || 'classic'
      }
    );
  }

  startNextRound(resetMatch = false) {
    if (!this.isHost) return;
    this.controller.startNextRound(this.lobbyPlayers, resetMatch);
  }

  restartGame() {
    this.startNextRound(false);
  }

  returnToLobby() {
    if (!this.isHost) return;
    this.controller.cleanupTimers();
    this.gameStarted = false;
    this.resetLobbyIdleTimer();

    if (this.engine && this.engine.players) {
      this.engine.players.forEach(ep => {
        const lp = this.lobbyPlayers.find(p => p.id === ep.id);
        if (lp) lp.score = ep.score;
      });
    }
    this.broadcastReturnToLobby();
  }

  getHostIndex() {
    const idx = this.lobbyPlayers.findIndex(p => p.isHost);
    return idx !== -1 ? idx : 0;
  }

  hostPlayCard(cardId, chosenColor, calledUno) {
    if (!this.isHost) return { success: false };
    return this.controller.playCard(this.getHostIndex(), cardId, chosenColor, calledUno);
  }

  hostChooseColor(chosenColor) {
    if (!this.isHost) return { success: false };
    return this.controller.chooseColor(this.getHostIndex(), chosenColor);
  }

  hostDrawCard() {
    if (!this.isHost) return { success: false };
    return this.controller.drawCard(this.getHostIndex());
  }

  hostPassTurn() {
    if (!this.isHost) return { success: false };
    return this.controller.passTurn(this.getHostIndex());
  }

  hostCallUno() {
    if (!this.isHost) return { success: false };
    return this.controller.callUno(this.getHostIndex());
  }

  hostChallengeUno(targetIndex) {
    if (!this.isHost) return { success: false };
    return this.controller.challengeUno(this.getHostIndex(), targetIndex);
  }

  hostChallengeWildDraw4() {
    if (!this.isHost) return { success: false };
    return this.controller.challengeWildDraw4(this.getHostIndex());
  }

  // ==========================================
  // BROADCAST HELPERS
  // ==========================================
  broadcastLobbyUpdate() {
    this.resetLobbyIdleTimer();
    const data = {
      type: 'LOBBY_UPDATE',
      players: this.lobbyPlayers,
      spectators: this.spectators,
      gameMode: this.gameMode,
      allowStacking: this.allowStacking,
      allowChallengeWildDraw4: this.allowChallengeWildDraw4,
      targetScore: this.targetScore,
      drawRule: this.drawRule,
      deckTheme: this.deckTheme || 'classic',
      roomCode: this.roomCode
    };

    if (this.onLobbyUpdate) this.onLobbyUpdate(data);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        guest.conn.send({
          ...data,
          myPeerId: guest.conn.peer,
          isSpectator: !!guest.isSpectator
        });
      }
    }
  }

  broadcastReturnToLobby() {
    const data = {
      type: 'RETURN_TO_LOBBY',
      players: this.lobbyPlayers,
      spectators: this.spectators,
      gameMode: this.gameMode,
      allowStacking: this.allowStacking,
      allowChallengeWildDraw4: this.allowChallengeWildDraw4,
      targetScore: this.targetScore,
      drawRule: this.drawRule,
      deckTheme: this.deckTheme || 'classic',
      roomCode: this.roomCode
    };

    if (this.onReturnToLobby) this.onReturnToLobby(data);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        guest.conn.send({
          ...data,
          myPeerId: guest.conn.peer,
          isSpectator: !!guest.isSpectator
        });
      }
    }
  }

  broadcastGameState() {
    if (!this.engine) return;

    const hostIdx = this.getHostIndex();
    const hostState = {
      ...this.engine.getClientState(hostIdx, false),
      spectators: this.spectators
    };
    if (this.onStateUpdate) this.onStateUpdate(hostState);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        const isSpec = !!guest.isSpectator || guest.slotIndex < 0;
        const guestState = {
          ...this.engine.getClientState(isSpec ? 0 : guest.slotIndex, isSpec),
          spectators: this.spectators
        };
        guest.conn.send({
          type: 'SYNC_STATE',
          state: guestState
        });
      }
    }
  }

  broadcastSoundEvent(soundName) {
    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        guest.conn.send({
          type: 'SOUND_EVENT',
          sound: soundName
        });
      }
    }
  }

  // ==========================================
  // GUEST / CLIENT JOIN & ACTION SENDERS
  // ==========================================
  joinRoom(roomCode, guestName = '玩家') {
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = guestName.trim() || '玩家';
    this.gameStarted = false;

    const hostPeerId = this.formatPeerId(this.roomCode);

    if (this.peer) this.peer.destroy();

    this.peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      if (this.onConnectionStatus) this.onConnectionStatus({ status: 'connecting', peerId: id, isHost: false });

      this.hostConn = this.peer.connect(hostPeerId, { reliable: true });

      this.hostConn.on('open', () => {
        if (this.onConnectionStatus) this.onConnectionStatus({ status: 'connected', peerId: id, isHost: false });
        this.hostConn.send({ type: 'JOIN', name: this.playerName });
      });

      this.hostConn.on('data', (packet) => {
        this.handleClientData(packet);
      });

      this.hostConn.on('close', () => {
        if (this.onRoomDisbanded) {
          this.onRoomDisbanded('與房主的連線已中斷，已返回首頁！');
        } else if (this.onError) {
          this.onError('與房主之連線已中斷！');
        }
        if (this.onConnectionStatus) this.onConnectionStatus({ status: 'disconnected', isHost: false });
        this.disconnect();
      });

      this.hostConn.on('error', (err) => {
        console.error('Host connection error:', err);
        if (this.onError) this.onError('無法連線至房主，請確認房號是否正確！');
      });
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS Client Error:', err);
      if (this.onError) this.onError(`連線錯誤: ${err.message}`);
    });
  }

  handleClientData(packet) {
    if (!packet || !packet.type) return;

    switch (packet.type) {
      case 'ROOM_DISBANDED':
      case 'JOIN_REJECTED':
      case 'KICKED': {
        const msg = packet.reason || (packet.type === 'KICKED' ? '你已被移出房間！' : '房主已解散房間！');
        const disbandCb = this.onRoomDisbanded;
        this.disconnect();
        if (disbandCb) {
          disbandCb(msg);
        } else if (this.onError) {
          this.onError(msg);
        }
        break;
      }

      case 'JOIN_ACCEPTED':
        this.mySlotIndex = packet.slotIndex;
        this.isSpectator = !!packet.isSpectator;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        this.deckTheme = packet.deckTheme || 'classic';
        break;

      case 'LOBBY_UPDATE':
        this.lobbyPlayers = packet.players;
        this.spectators = packet.spectators || [];
        this.isSpectator = !!packet.isSpectator;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        this.deckTheme = packet.deckTheme || 'classic';
        if (this.onLobbyUpdate) this.onLobbyUpdate(packet);
        break;

      case 'RETURN_TO_LOBBY':
        this.gameStarted = false;
        this.lobbyPlayers = packet.players || this.lobbyPlayers;
        this.spectators = packet.spectators || [];
        this.isSpectator = !!packet.isSpectator;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        this.deckTheme = packet.deckTheme || 'classic';
        if (this.onReturnToLobby) this.onReturnToLobby(packet);
        break;

      case 'SYNC_STATE':
        this.gameStarted = true;
        if (this.onStateUpdate) this.onStateUpdate(packet.state);
        if (packet.state && !packet.state.isSpectator && packet.state.currentTurn === packet.state.myIndex && !packet.state.isContinuousDrawing && !packet.state.isDealing) {
          soundManager.playTurn();
        }
        break;

      case 'SOUND_EVENT':
        if (packet.sound === 'card') soundManager.playCard();
        else if (packet.sound === 'draw') soundManager.playDraw();
        else if (packet.sound === 'action') soundManager.playAction();
        else if (packet.sound === 'wild') soundManager.playWild();
        else if (packet.sound === 'uno') soundManager.playUno();
        else if (packet.sound === 'penalty') soundManager.playPenalty();
        break;

      case 'ACTION_FAILED':
        if (this.onError) this.onError(packet.reason || '動作不合法');
        break;

      default:
        break;
    }
  }

  clientToggleSpectate() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_TOGGLE_SPECTATE' });
  }

  clientPlayCard(cardId, chosenColor, calledUno) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_PLAY', cardId, chosenColor, calledUno });
  }

  clientDrawCard() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_DRAW' });
  }

  clientPassTurn() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_PASS' });
  }

  clientCallUno() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_UNO' });
  }

  clientChallengeUno(targetIndex) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_CHALLENGE', targetIndex });
  }

  clientChallengeWildDraw4() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_CHALLENGE_WILD_DRAW4' });
  }

  clientChooseColor(chosenColor) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({ type: 'ACTION_CHOOSE_COLOR', chosenColor });
  }

  disconnect() {
    this.controller.destroy();
    if (this.lobbyIdleTimer) {
      clearTimeout(this.lobbyIdleTimer);
      this.lobbyIdleTimer = null;
    }
    if (this.hostConn) {
      this.hostConn.onclose = null;
      this.hostConn.close();
      this.hostConn = null;
    }
    for (const g of this.guestConns.values()) {
      if (g.conn) g.conn.close();
    }
    this.guestConns.clear();
    this.spectators = [];
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.gameStarted = false;
  }
}

export const p2pNetwork = new P2PNetwork();
```

## src/services/sound.js

```javascript
// sound.js - Web Audio API Sound Synthesizer (No external audio files needed)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.hurryUpAudio = null;
    this.isHurryUpMyTurn = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = this.muted ? 0 : (this.isHurryUpMyTurn ? 0.75 : 0.18);
    }
    return this.muted;
  }

  // Card slide / draw sound
  playDraw() {
    if (this.muted) return;
    if (this.lastDrawTime && Date.now() - this.lastDrawTime < 60) return;
    this.lastDrawTime = Date.now();
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    } catch {
      // AudioContext error handling
    }
  }

  // Card play / snap sound
  playCard() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, t);
      osc1.frequency.exponentialRampToValueAtTime(220, t + 0.08);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(180, t);
      osc2.frequency.exponentialRampToValueAtTime(60, t + 0.08);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.09);
      osc2.stop(t + 0.09);
    } catch {
      // AudioContext error handling
    }
  }

  // Action card sound (Skip, Reverse, +2)
  playAction() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.16); // G5

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // AudioContext error handling
    }
  }

  // Distinct "WHOOSH-BUZZ / DENIED" Skip sound
  playSkip() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.28);

      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.28);
    } catch {
      // AudioContext error handling
    }
  }

  // Wild Card change color chime
  playWild() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);

        gain.gain.setValueAtTime(0.18, t + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.25);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Dramatic "UNO!" alert
  playUno() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);

        gain.gain.setValueAtTime(0.22, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.35);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Penalty / Caught sound
  playPenalty() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.setValueAtTime(120, t + 0.15);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.4);
    } catch {
      // AudioContext error handling
    }
  }

  // Player turn notification
  playTurn() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.1);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.18);
    } catch {
      // AudioContext error handling
    }
  }

  // Victory fanfare
  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
      const times = [0, 0.12, 0.24, 0.36, 0.48, 0.65];
      const durs = [0.1, 0.1, 0.1, 0.1, 0.15, 0.6];

      const t = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + times[i]);

        gain.gain.setValueAtTime(0.25, t + times[i]);
        gain.gain.exponentialRampToValueAtTime(0.001, t + times[i] + durs[i]);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + times[i]);
        osc.stop(t + times[i] + durs[i]);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Fast dealing card sound with pitch stepping
  playDeal(step = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 260 + (step % 7) * 35;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.08);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // AudioContext error handling
    }
  }

  // Card shuffle / fanning flutter sound
  playShuffle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const delay = i * 0.045;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380 + i * 40, t + delay);
        osc.frequency.exponentialRampToValueAtTime(160, t + delay + 0.07);

        gain.gain.setValueAtTime(0.12, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + delay);
        osc.stop(t + delay + 0.07);
      }
    } catch {
      // AudioContext error handling
    }
  }

  // Subtle countdown tick sound
  playTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // AudioContext error handling
    }
  }

  // Rabbids Hurry Up: Toothless Dancing Meme BGM with Dynamic Proximity Volume
  playHurryUpBgm(isMyTurn = false) {
    this.isHurryUpMyTurn = isMyTurn;
    const targetVolume = this.muted ? 0 : (isMyTurn ? 0.75 : 0.18);

    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = targetVolume;
      if (this.hurryUpAudio.paused && !this.muted) {
        this.hurryUpAudio.play().catch(() => {
          const retryOnInteraction = () => {
            if (this.hurryUpAudio && this.hurryUpAudio.paused && !this.muted) {
              this.hurryUpAudio.play().catch(() => {});
            }
            window.removeEventListener('click', retryOnInteraction);
            window.removeEventListener('keydown', retryOnInteraction);
          };
          window.addEventListener('click', retryOnInteraction, { once: true });
          window.addEventListener('keydown', retryOnInteraction, { once: true });
        });
      }
      return;
    }

    try {
      const audio = new Audio('/cards_rabbids/effects/hurry_up/toothless-dancing.mp3');
      audio.loop = true;
      audio.volume = targetVolume;
      audio.onerror = () => {
        audio.src = '/cards_rabbids/effects/hurry_up/' + encodeURIComponent('Toothless Dancing Meme [NEW VARIATIONS] - Cas van de Pol.mp3');
        audio.play().catch(() => {});
      };

      this.hurryUpAudio = audio;
      audio.play().catch(() => {
        const retryOnInteraction = () => {
          if (this.hurryUpAudio && this.hurryUpAudio.paused && !this.muted) {
            this.hurryUpAudio.play().catch(() => {});
          }
          window.removeEventListener('click', retryOnInteraction);
          window.removeEventListener('keydown', retryOnInteraction);
        };
        window.addEventListener('click', retryOnInteraction, { once: true });
        window.addEventListener('keydown', retryOnInteraction, { once: true });
      });
    } catch {
      // Audio error handling
    }
  }

  setHurryUpTurn(isMyTurn = false) {
    this.isHurryUpMyTurn = isMyTurn;
    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = this.muted ? 0 : (isMyTurn ? 0.75 : 0.18);
    }
  }

  stopHurryUpBgm() {
    if (this.hurryUpAudio) {
      try {
        this.hurryUpAudio.pause();
        this.hurryUpAudio.currentTime = 0;
      } catch {}
      this.hurryUpAudio = null;
    }
  }
}

export const soundManager = new SoundManager();

```

## src/services/animation.js

```javascript
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
      onComplete: () => {
        if (toEl) {
          toEl.classList.remove('impact-bounce');
          void toEl.offsetWidth; // trigger reflow
          toEl.classList.add('impact-bounce');
          setTimeout(() => {
            toEl.classList.remove('impact-bounce');
          }, 320);
        }
        if (onComplete) onComplete();
      }
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

```

## src/components/HomeView.jsx

```javascript
// HomeView.jsx - Streamlined Casino Tabletop Entry (Nickname + Create / Join Room)
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  LogIn,
  Users,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { P2PNetwork } from '../services/p2p';
import { soundManager } from '../services/sound';

export function HomeView({ onCreateRoom, onJoinRoom }) {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('uno_player_name') || '玩家');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [tab, setTab] = useState('create'); // 'create' | 'join'

  useEffect(() => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && hash.startsWith('UNO-')) {
      setRoomCodeInput(hash.toUpperCase());
      setTab('join');
    }
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setPlayerName(val);
    localStorage.setItem('uno_player_name', val);
  };

  const handleTabSwitch = (newTab) => {
    soundManager.playTick();
    setTab(newTab);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    soundManager.playShuffle();
    const code = P2PNetwork.generateRoomCode();
    // Default to stacking = true, mode = 'ffa'; all rules are configured inside LobbyView
    onCreateRoom(code, playerName.trim() || '房主', true, 'ffa');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    soundManager.playShuffle();
    onJoinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim() || '玩家');
  };

  return (
    <div
      className="fixed inset-0 felt-table overflow-y-auto overflow-x-hidden select-none z-30 flex flex-col items-center p-4 py-8 pb-12 custom-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      {/* Ambient Casino Spotlight & Table Rim Vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 42%, rgba(28, 98, 52, 0.45) 0%, rgba(10, 38, 20, 0.75) 55%, rgba(3, 12, 6, 0.98) 100%)'
        }}
      />

      {/* Decorative Background Floating Cards */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-20 sm:opacity-30">
        <img
          src="/cards_modern/red_skip.png"
          alt=""
          className="absolute -top-8 -left-8 w-36 sm:w-48 rotate-[22deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/blue_reverse.png"
          alt=""
          className="absolute top-12 -right-10 w-36 sm:w-48 -rotate-[18deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/yellow_draw2.png"
          alt=""
          className="absolute -bottom-10 left-8 w-36 sm:w-48 -rotate-[15deg] blur-[1px] drop-shadow-2xl"
        />
        <img
          src="/cards_modern/wild_draw4.png"
          alt=""
          className="absolute -bottom-8 right-10 w-36 sm:w-48 rotate-[16deg] blur-[1px] drop-shadow-2xl"
        />
      </div>

      {/* Main Casino Wood & Gold Framed Panel */}
      <div className="relative z-10 w-full max-w-md my-auto rounded-3xl bg-gradient-to-b from-[#133822]/95 via-[#0b2315]/98 to-[#06140c] border-2 border-amber-500/40 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_0_6px_rgba(38,23,12,0.95)] p-6 sm:p-8 backdrop-blur-xl shrink-0">
        {/* Subtle Inner Gold Hairline */}
        <div className="pointer-events-none absolute inset-2.5 rounded-2xl border border-amber-400/15" />

        {/* Hero Brand Showcase with Fanned Actual Cards */}
        <div className="relative flex flex-col items-center mb-6 pt-2">
          <div className="relative h-24 sm:h-28 w-48 flex items-center justify-center mb-1">
            <img
              src="/cards_modern/red_draw2.png"
              alt="Red +2"
              className="w-16 sm:w-20 rounded-lg shadow-xl -rotate-[22deg] -translate-x-9 translate-y-1.5 transition-transform duration-500 hover:-translate-y-1"
            />
            <img
              src="/cards_modern/wild.png"
              alt="Wild"
              className="w-18 sm:w-22 rounded-lg shadow-2xl z-10 -translate-y-1 transition-transform duration-500 hover:-translate-y-3"
            />
            <img
              src="/cards_modern/blue_skip.png"
              alt="Blue Skip"
              className="w-16 sm:w-20 rounded-lg shadow-xl rotate-[22deg] translate-x-9 translate-y-1.5 transition-transform duration-500 hover:-translate-y-1"
            />

            {/* Classic Tilted UNO Emblem Overlay */}
            <div className="absolute -bottom-2 z-20 px-5 py-1 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 border-[3px] border-amber-300 shadow-[0_10px_25px_rgba(0,0,0,0.85)] -rotate-6">
              <span className="font-black text-2xl sm:text-3xl tracking-wider text-amber-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                UNO!
              </span>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-black tracking-wide text-white mt-3">
            線上多人派對牌桌
          </h1>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            支援單人 AI 練習、好友房號連線與 2V2 組隊共視手牌
          </p>
        </div>

        {/* Player Nickname Input Box */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-amber-300/90 tracking-wider">
              玩家名稱
            </label>
            <span className="text-[11px] text-emerald-400/60">
              最多 12 字元
            </span>
          </div>
          <input
            type="text"
            value={playerName}
            onChange={handleNameChange}
            maxLength={12}
            placeholder="輸入你的牌桌名稱..."
            className="w-full px-4 py-3 bg-[#05120a] border border-emerald-500/35 rounded-xl text-white font-bold text-sm placeholder-emerald-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 transition shadow-inner"
          />
        </div>

        {/* Create / Join Segmented Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#05120a] rounded-2xl border border-emerald-500/25 mb-5 shadow-inner">
          <button
            type="button"
            onClick={() => handleTabSwitch('create')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'create'
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'text-emerald-300/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            開設新牌局
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('join')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'join'
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'text-emerald-300/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <LogIn className="w-4 h-4" />
            輸入房號加入
          </button>
        </div>

        {/* TAB 1: CREATE ROOM (Clean One-Click Entry to Lobby) */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#06150c] border border-emerald-500/25 text-xs text-emerald-200/85 space-y-1.5 leading-relaxed">
              <div className="font-extrabold text-amber-300 text-sm">
                建立專屬牌桌房間
              </div>
              <p className="text-emerald-300/70">
                進入房間大廳後，可自由設定 <span className="text-white font-bold">個人混戰 / 2V2 組隊</span>、<span className="text-white font-bold">目標積分</span>、<span className="text-white font-bold">+2/+4 疊牌</span> 與 <span className="text-white font-bold">AI 電腦或真人座位</span>。
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-sm sm:text-base rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.35)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 cursor-pointer border border-amber-200/60"
            >
              <Users className="w-5 h-5" />
              <span>開設房間並前往大廳</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* TAB 2: JOIN ROOM */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="bg-[#06150c] border border-emerald-500/25 rounded-2xl p-5 text-center">
              <label className="block text-xs font-bold text-amber-300/90 mb-2 tracking-wider">
                輸入好友房間代碼
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="UNO-0000"
                className="w-full px-4 py-3.5 bg-[#040d07] border-2 border-emerald-500/35 rounded-xl text-amber-400 font-mono font-black text-center tracking-[0.2em] text-2xl placeholder-emerald-800/70 focus:outline-none focus:border-amber-400 transition shadow-inner"
                autoFocus
              />
              <p className="text-[11px] text-emerald-300/60 mt-2.5">
                請向房主索取 8 碼房號（例如 UNO-7829），或直接開啟房主分享的邀請網址
              </p>
            </div>

            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="w-full py-3.5 px-5 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-sm sm:text-base rounded-2xl shadow-[0_8px_25px_rgba(16,185,129,0.3)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 cursor-pointer border border-emerald-200/50"
            >
              <Sparkles className="w-5 h-5" />
              <span>立即連線加入房間</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

## src/components/LobbyView.jsx

```javascript
// 檔案位置：src/components/LobbyView.jsx
// Casino Tabletop Seat Compass, Spectator Section & House Rules Lobby
import React, { useState } from 'react';
import {
  Copy,
  Check,
  Bot,
  User,
  Play,
  LogOut,
  Flame,
  Crown,
  Link as LinkIcon,
  Swords,
  UserCheck,
  ArrowLeftRight,
  Trophy,
  Layers,
  Scale,
  Settings2,
  Sparkles,
  Eye
} from 'lucide-react';
import { soundManager } from '../services/sound';

const SEAT_LABELS = [
  { pos: '南席 (主位)', dir: 'SOUTH' },
  { pos: '西席 (左側下家)', dir: 'WEST' },
  { pos: '北席 (對面座位)', dir: 'NORTH' },
  { pos: '東席 (右側上家)', dir: 'EAST' }
];

export function LobbyView({
  roomCode,
  isHost,
  players = [],
  spectators = [],
  isSpectator = false,
  gameMode = 'ffa',
  allowStacking,
  allowChallengeWildDraw4 = true,
  targetScore = 500,
  drawRule = 'draw_one',
  deckTheme = 'classic',
  onSetDeckTheme,
  onToggleAi,
  onToggleStacking,
  onToggleChallengeRule,
  onSetTargetScore,
  onSetDrawRule,
  onSetGameMode,
  onSetFfaCount,
  onSwapSlots,
  onKickPlayer,
  onMoveToSpectator,
  onMoveSpectatorToSlot,
  onKickSpectator,
  onClientToggleSpectate,
  onStartGame,
  onLeaveRoom
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [swapSource, setSwapSource] = useState(null);

  const inviteLink = `${window.location.origin}${window.location.pathname}#${roomCode}`;
  const is2v2 = gameMode === '2v2';

  const handleCopyCode = () => {
    soundManager.playTick();
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    soundManager.playTick();
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSlotClickForSwap = (idx) => {
    if (!isHost) return;
    soundManager.playCard();
    if (swapSource === null) {
      setSwapSource(idx);
    } else if (swapSource === idx) {
      setSwapSource(null);
    } else {
      onSwapSlots(swapSource, idx);
      setSwapSource(null);
    }
  };

  return (
    <div
      className="fixed inset-0 felt-table overflow-y-auto overflow-x-hidden select-none z-30 flex flex-col items-center p-3 sm:p-6 py-6 sm:py-8 pb-16 sm:pb-12 custom-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(28, 98, 52, 0.42) 0%, rgba(10, 38, 20, 0.78) 58%, rgba(3, 12, 6, 0.98) 100%)'
        }}
      />

      <div className="relative z-10 w-full max-w-3xl my-auto rounded-3xl bg-gradient-to-b from-[#133822]/95 via-[#0b2315]/98 to-[#06140c] border-2 border-amber-500/40 shadow-[0_28px_70px_rgba(0,0,0,0.9),0_0_0_6px_rgba(38,23,12,0.95)] p-5 sm:p-7 backdrop-blur-xl shrink-0">
        <div className="pointer-events-none absolute inset-2.5 rounded-2xl border border-amber-400/15" />

        {/* TOP HEADER */}
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-emerald-500/20">
          <div className="flex items-center gap-3.5">
            <div className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 border-2 border-amber-300 shadow-lg -rotate-3 shrink-0">
              <span className="font-black text-lg tracking-wider text-amber-300">
                UNO!
              </span>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-bold">
                房間號碼 (點擊可複製)
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="group flex items-center gap-2 px-3 py-1 rounded-xl bg-[#05120a] border border-amber-400/40 hover:border-amber-400 transition cursor-pointer shadow-inner"
                >
                  <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-wider">
                    {roomCode}
                  </span>
                  <span className="p-1 rounded-lg bg-emerald-950/90 text-emerald-300 group-hover:text-white transition">
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </span>
                </button>
                {copiedCode && (
                  <span className="text-xs font-bold text-green-400 animate-fade-in">
                    已複製房號
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isHost && onClientToggleSpectate && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playTick();
                  onClientToggleSpectate();
                }}
                className="py-2.5 px-3.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/40 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <Eye className="w-4 h-4" />
                <span>{isSpectator ? '入座參戰' : '切換觀戰'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/40 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              <span>{copiedLink ? '邀請連結已複製' : '複製邀請網址'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isHost) {
                  if (window.confirm('確定要解散房間嗎？解散後所有玩家將返回首頁。')) {
                    onLeaveRoom();
                  }
                } else {
                  onLeaveRoom();
                }
              }}
              className="py-2.5 px-3.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/40 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              <LogOut className="w-4 h-4" />
              <span>{isHost ? '解散房間' : '離開房間'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: TABLE SEATS COMPASS */}
        <div className="my-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                牌桌席位配置
              </span>
              {is2v2 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 font-bold">
                  2V2 規則：南席與北席同隊（對座共享明牌）、西席與東席同隊
                </span>
              )}
            </div>

            {isHost && (
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                  swapSource !== null
                    ? 'bg-amber-500 text-black border-amber-300 animate-pulse'
                    : 'bg-[#05120a] text-emerald-300/80 border-emerald-500/25'
                }`}
              >
                {swapSource !== null
                  ? `已選取席位 #${swapSource + 1}，請點擊另一席位互換位置`
                  : '房主提示：點擊任兩個座位可交換出牌順序與隊友'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p, idx) => {
              const isSelectedForSwap = swapSource === idx;
              const isTeamA = is2v2 && idx % 2 === 0;
              const isTeamB = is2v2 && idx % 2 === 1;
              const seatMeta = SEAT_LABELS[idx] || { pos: `席位 ${idx + 1}`, dir: `SEAT ${idx + 1}` };
              const isHuman = !p.isAi && (p.peerId || p.isHost);

              return (
                <div
                  key={idx}
                  onClick={isHost ? () => handleSlotClickForSwap(idx) : undefined}
                  className={`relative flex items-center justify-between p-3.5 rounded-2xl transition border-2 ${
                    isSelectedForSwap
                      ? 'bg-amber-500/25 border-amber-300 ring-2 ring-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                      : isTeamA
                      ? 'bg-gradient-to-r from-amber-950/35 to-[#06150c] border-amber-500/45'
                      : isTeamB
                      ? 'bg-gradient-to-r from-sky-950/35 to-[#06150c] border-sky-500/45'
                      : 'bg-[#06150c] border-emerald-500/25'
                  } ${isHost ? 'cursor-pointer hover:border-amber-400/70' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`relative w-11 h-11 rounded-xl flex items-center justify-center font-bold border-2 shrink-0 shadow-md ${
                        p.isHost
                          ? 'bg-amber-500/25 border-amber-300 text-amber-300'
                          : isHuman
                          ? 'bg-emerald-500/25 border-emerald-300 text-emerald-200'
                          : p.isAi
                          ? 'bg-slate-800/90 border-slate-500 text-slate-300'
                          : 'bg-emerald-950/50 border-dashed border-emerald-500/50 text-emerald-400'
                      }`}
                    >
                      {p.isHost ? (
                        <Crown className="w-5 h-5 text-amber-300" />
                      ) : p.isAi ? (
                        <Bot className="w-5 h-5" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                      <span className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 rounded-md bg-black border border-white/30 text-[10px] font-mono font-black text-white flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-extrabold text-emerald-400/80">
                          {seatMeta.pos}
                        </span>
                        {is2v2 && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                              isTeamA
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-sky-400/20 text-sky-300 border-sky-400/40'
                            }`}
                          >
                            {isTeamA ? '金隊 A' : '藍隊 B'}
                          </span>
                        )}
                      </div>

                      <div className="font-extrabold text-white text-sm flex items-center gap-1.5 mt-0.5">
                        <span className="truncate max-w-[120px]">{p.name}</span>
                        {p.isHost && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400 text-black font-black shrink-0">
                            房主
                          </span>
                        )}
                        {p.score > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-400/30 shrink-0">
                            {p.score}分
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-emerald-300/65">
                        {p.isAi
                          ? 'AI 電腦託管'
                          : isHuman
                          ? '真人玩家已就緒'
                          : '等待真人玩家加入...'}
                      </div>
                    </div>
                  </div>

                  {/* Host Seat Controls */}
                  {isHost && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!p.isHost && !p.isAi && p.peerId && onMoveToSpectator && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundManager.playTick();
                            onMoveToSpectator(idx);
                          }}
                          title="將此玩家移至觀戰席"
                          className="text-[11px] py-1.5 px-2 rounded-xl font-extrabold bg-sky-950/90 hover:bg-sky-900 text-sky-300 border border-sky-500/40 transition cursor-pointer"
                        >
                          觀戰
                        </button>
                      )}
                      {!p.isHost && (!p.peerId || p.isAi) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundManager.playTick();
                            onToggleAi(idx);
                          }}
                          className={`text-[11px] py-1.5 px-2.5 rounded-xl font-extrabold border transition cursor-pointer ${
                            p.isAi
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                              : 'bg-amber-950/90 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                          }`}
                        >
                          {p.isAi ? '設為開放' : '換成電腦'}
                        </button>
                      )}
                      {!p.isHost && !p.isAi && p.peerId && onKickPlayer && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`確定要將玩家【${p.name}】移出房間嗎？`)) {
                              soundManager.playPenalty();
                              onKickPlayer(idx);
                            }
                          }}
                          title="將該玩家踢出房間"
                          className="text-[11px] py-1.5 px-2 rounded-xl font-extrabold bg-red-950/90 hover:bg-red-900 text-red-300 border border-red-500/40 transition cursor-pointer"
                        >
                          踢除
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSlotClickForSwap(idx);
                        }}
                        title="與其他座位交換順序"
                        className={`p-2 rounded-xl border transition cursor-pointer ${
                          isSelectedForSwap
                            ? 'bg-amber-400 text-black border-white'
                            : 'bg-white/5 hover:bg-white/15 text-emerald-200 border-white/10'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SPECTATOR SEATS SECTION */}
          <div className="mt-3 p-3.5 rounded-2xl bg-[#05120a]/90 border border-sky-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-sky-300 shrink-0">
              <Eye className="w-4 h-4 text-sky-400" />
              <span>觀戰席位 ({spectators.length} 人)</span>
              {isSpectator && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200">
                  你目前在觀戰席
                </span>
              )}
            </div>

            {spectators.length === 0 ? (
              <span className="text-[11px] text-emerald-400/60">
                目前無觀戰者（房間滿座時加入的好友，或點擊「觀戰」的玩家會自動進入此區）
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {spectators.map((spec) => (
                  <div
                    key={spec.peerId}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-950/60 border border-sky-400/35 text-xs text-white font-bold"
                  >
                    <span>👀 {spec.name}</span>
                    {isHost && onMoveSpectatorToSlot && (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playTick();
                          onMoveSpectatorToSlot(spec.peerId);
                        }}
                        className="ml-1 px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] text-white font-black transition cursor-pointer"
                        title="排入牌桌參戰"
                      >
                        入座
                      </button>
                    )}
                    {isHost && onKickSpectator && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`確定要將觀戰者【${spec.name}】移出房間嗎？`)) {
                            onKickSpectator(spec.peerId);
                          }
                        }}
                        className="px-1.5 py-0.5 rounded bg-red-800 hover:bg-red-700 text-[10px] text-red-100 font-black transition cursor-pointer"
                        title="踢出房間"
                      >
                        踢除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: HOUSE RULES CONFIGURATION PANEL */}
        <div className="my-5 p-4 sm:p-5 bg-[#05120a] border border-emerald-500/25 rounded-2xl space-y-4 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300 tracking-wider uppercase">
            <Settings2 className="w-4 h-4" />
            <span>牌局規則與 DLC 模式設定 {isHost ? '(房主可即時切換)' : '(由房主設定)'}</span>
          </div>

          {/* Row 0: Deck Theme / DLC Mode Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-emerald-500/15">
            <div>
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                卡牌主題與 DLC 擴充模式
              </span>
              <div className="text-[10px] text-emerald-300/70 mt-0.5">
                {deckTheme === 'rabbids'
                  ? '🐰 瘋狂兔子 DLC：包含 4 種特殊功能牌 (3秒限時快抽、定時炸彈+4、全員抽牌、兔兔盾牌反彈)'
                  : '🃏 經典現代版：Ubisoft 原版乾淨卡面與官方標準牌庫'}
              </div>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    if (onSetDeckTheme) onSetDeckTheme('classic');
                  }}
                  className={`py-1 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    deckTheme === 'classic'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                  }`}
                >
                  <span>🃏 經典現代</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    if (onSetDeckTheme) onSetDeckTheme('rabbids');
                  }}
                  className={`py-1 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    deckTheme === 'rabbids'
                      ? 'bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-lg shadow-pink-500/25 ring-2 ring-pink-300/50'
                      : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                  }`}
                >
                  <span>🐰 瘋狂兔子 DLC</span>
                </button>
              </div>
            ) : (
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                deckTheme === 'rabbids'
                  ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {deckTheme === 'rabbids' ? '🐰 瘋狂兔子 DLC 模式' : '🃏 經典現代模式'}
              </span>
            )}
          </div>

          {/* Row 1: Mode & Player Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3.5 border-b border-emerald-500/15">
            <div className="flex items-center justify-between bg-[#081c10] p-2.5 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                對戰模式
              </span>
              {isHost ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetGameMode('ffa');
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      !is2v2
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-emerald-300 hover:bg-white/5'
                    }`}
                  >
                    個人混戰
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetGameMode('2v2');
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      is2v2
                        ? 'bg-amber-500 text-black shadow'
                        : 'text-emerald-300 hover:bg-white/5'
                    }`}
                  >
                    2V2 組隊
                  </button>
                </div>
              ) : (
                <span className="text-xs font-extrabold text-amber-400">
                  {is2v2 ? '2V2 雙人組隊' : '個人混戰'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between bg-[#081c10] p-2.5 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                牌桌人數
              </span>
              {!is2v2 && isHost ? (
                <div className="flex items-center gap-1">
                  {[2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        soundManager.playTick();
                        onSetFfaCount(cnt);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold transition cursor-pointer ${
                        players.length === cnt
                          ? 'bg-amber-500 text-black shadow'
                          : 'text-emerald-300 hover:bg-white/5'
                      }`}
                    >
                      {cnt}人
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-extrabold text-amber-400">
                  {players.length} 人局 {is2v2 ? '(固定 2V2)' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Target Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-emerald-500/15">
            <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              賽制目標積分
            </span>
            {isHost ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '單局暢玩 (無積分)', value: 0 },
                  { label: '250 分', value: 250 },
                  { label: '500 分 (標準)', value: 500 },
                  { label: '1000 分', value: 1000 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetTargetScore(opt.value);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      targetScore === opt.value
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-[#081c10] text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-extrabold text-amber-400">
                {targetScore > 0 ? `${targetScore} 分奪冠制` : '單局暢玩 (無積分)'}
              </span>
            )}
          </div>

          {/* Row 3: 3 Custom House Rules Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                無牌可出時
              </span>
              {isHost ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetDrawRule('draw_one');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                      drawRule === 'draw_one'
                        ? 'bg-sky-500 text-black'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    抽1張
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTick();
                      onSetDrawRule('draw_until_playable');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                      drawRule === 'draw_until_playable'
                        ? 'bg-sky-500 text-black'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    抽到能出
                  </button>
                </div>
              ) : (
                <span className="font-extrabold text-sky-300">
                  {drawRule === 'draw_until_playable' ? '抽到能出' : '僅抽 1 張'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                +2 / +4 疊牌
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    onToggleStacking();
                  }}
                  className={`px-3 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                    allowStacking
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {allowStacking ? '允許疊加' : '禁止疊加'}
                </button>
              ) : (
                <span className="font-extrabold text-amber-400">
                  {allowStacking ? '允許疊加' : '禁止疊加'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#081c10] border border-emerald-500/20">
              <span className="text-emerald-200 font-bold flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-300" />
                質疑違規 +4
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    onToggleChallengeRule();
                  }}
                  className={`px-3 py-0.5 rounded-md text-[11px] font-extrabold transition cursor-pointer ${
                    allowChallengeWildDraw4
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {allowChallengeWildDraw4 ? '啟用質疑' : '關閉質疑'}
                </button>
              ) : (
                <span className="font-extrabold text-amber-400">
                  {allowChallengeWildDraw4 ? '啟用質疑' : '關閉質疑'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* START GAME CTA */}
        {isHost ? (
          <button
            type="button"
            onClick={() => {
              soundManager.playShuffle();
              onStartGame();
            }}
            className="w-full py-4 px-6 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-base sm:text-lg rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.35)] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer border border-amber-200/60"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{is2v2 ? '發牌開局 (2V2 組隊戰)' : '發牌開局 (多人混戰)'}</span>
          </button>
        ) : (
          <div className="w-full py-4 px-6 rounded-2xl bg-[#05120a] border border-emerald-500/30 text-center text-sm font-bold text-emerald-300 flex items-center justify-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>{isSpectator ? '你目前位於觀戰席，等待房主開局...' : '已就緒，等待房主發牌開局...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

## src/components/GameTableView.jsx

```javascript
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
  LogOut,
  Eye
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
    hurryUpCasterIndex = null,
    hurryUpCasterName = null,
    explosiveActive = false,
    vanishingCardId = null,
    wild4ChallengeAnim = null,
    plusIndicator = null,
    isSpectator = false,
    spectators = []
  } = gameState || {};

  const is2v2 = gameMode === '2v2';
  // 關鍵修正：加上 !isChoosingColor，避免玩家打出 +4 正在選色時被誤判為無牌可疊！
  const isForcedPenalty = !isSpectator && !isChoosingColor && stackedDrawCount > 0 && validCards.length === 0 && !canChallengeWildDraw4;
  const isMyTurn = !isSpectator && currentTurn === myIndex && !isContinuousDrawing && !isDealing && !isForcedPenalty;

  const [displayedHand, setDisplayedHand] = useState(myHand);
  const [displayedCounts, setDisplayedCounts] = useState({});
  // 視覺緩衝棄牌堆：當對手/AI 出牌正在空中飛行 (380ms) 時，棄牌堆先維持舊頂牌，落地瞬間才更新為新頂牌！
  const [displayedTopCard, setDisplayedTopCard] = useState(topCard);
  const [displayedDiscardPile, setDisplayedDiscardPile] = useState(recentDiscardPile);
  const isRemotePlayFlyingRef = useRef(false);
  const initialSyncRef = useRef(false);
  const inflightCardIdsRef = useRef(new Set());
  const inflightOpponentCountsRef = useRef({});
  const isCardPlayingRef = useRef(false);
  const [isCardPlaying, setIsCardPlaying] = useState(false);

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

  // Rabbids Hurry Up: Toothless Dancing Meme BGM management (Continuous playback, only adjust volume)
  const isHurryUpActive = hurryUpTurns > 0 && gameState?.gameStatus === 'playing';

  useEffect(() => {
    if (isHurryUpActive) {
      const isMyTurnNow = !isSpectator && currentTurn === myIndex;
      soundManager.playHurryUpBgm(isMyTurnNow);
    } else {
      soundManager.stopHurryUpBgm();
    }
    return () => {
      soundManager.stopHurryUpBgm();
    };
  }, [isHurryUpActive]);

  useEffect(() => {
    if (isHurryUpActive) {
      const isMyTurnNow = !isSpectator && currentTurn === myIndex;
      soundManager.setHurryUpTurn(isMyTurnNow);
    }
  }, [isHurryUpActive, currentTurn, myIndex, isSpectator]);

  const [localHasDrawn, setLocalHasDrawn] = useState(false);
  const hasDrawnThisTurn = isMyTurn && (localHasDrawn || remoteHasDrawn);

  useEffect(() => {
    isCardPlayingRef.current = false;
    setIsCardPlaying(false);
    setLocalHasDrawn(false);
  }, [currentTurn]);

  useEffect(() => {
    if (isChoosingColor) {
      isCardPlayingRef.current = false;
      setIsCardPlaying(false);
    }
  }, [isChoosingColor]);

  useEffect(() => {
    if (currentTurn !== myIndex) {
      isCardPlayingRef.current = false;
      setIsCardPlaying(false);
    }
  }, [currentTurn, myIndex]);

  const autoPenaltyTimerRef = useRef(null);

  useEffect(() => {
    if (currentTurn === myIndex && !isDealing && !isContinuousDrawing && !isChoosingColor && isForcedPenalty) {
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
  }, [currentTurn, myIndex, isDealing, isContinuousDrawing, isChoosingColor, isForcedPenalty, stackedDrawCount]);

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

  const renderHandPlusBadge = (playerId, positionClass = '-top-11 left-1/2 -translate-x-1/2') => {
    if (!plusIndicator || plusIndicator.playerId !== playerId || !plusIndicator.count) return null;
    return (
      <div
        key={`plus-${playerId}-${plusIndicator.count}`}
        className={`absolute ${positionClass} z-50 uno-plus-indicator text-4xl sm:text-5xl pointer-events-none select-none`}
      >
        +{plusIndicator.count}
      </div>
    );
  };

  // 判斷是否要在某個對手的座位原地顯示質疑勾勾/叉叉（當我既不是質疑者、也不是被質疑者時，或我是觀戰者時）
  const isThirdPartyWatchingChallenge =
    !!wild4ChallengeAnim &&
    (isSpectator || (wild4ChallengeAnim.challengerId !== myIndex && wild4ChallengeAnim.challengedId !== myIndex));

  const getInPlaceChallengeHandClass = (playerId) => {
    if (!isThirdPartyWatchingChallenge || wild4ChallengeAnim.challengedId !== playerId) return '';
    return wild4ChallengeAnim.isSuccess ? 'challenge-card-lift' : 'challenge-hand-shake';
  };

  const renderInPlaceChallengeBadge = (playerId, posClass = '-top-12 left-1/2 -translate-x-1/2') => {
    if (!isThirdPartyWatchingChallenge || wild4ChallengeAnim.challengedId !== playerId) return null;
    const isSuccess = wild4ChallengeAnim.isSuccess;
    return (
      <div className={`absolute ${posClass} z-50 pointer-events-none challenge-verdict-pop`}>
        {isSuccess ? (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-600 border-3 border-green-200 shadow-[0_0_30px_rgba(34,197,94,0.95)] flex items-center justify-center">
            <Check className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[4]" />
          </div>
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 border-3 border-red-200 shadow-[0_0_30px_rgba(239,68,68,0.95)] flex items-center justify-center">
            <X className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[4]" />
          </div>
        )}
      </div>
    );
  };

  // 瘋狂快抽 Hurry Up: 在當前回合出牌者（玩家或 AI）的手牌前跳舞催促（適中尺寸，完全不遮擋卡牌）
  const renderToothlessDancer = (playerId, positionClass = '-top-28 sm:-top-32 left-1/2 -translate-x-1/2', sizeClass = 'w-18 sm:w-22 md:w-26', showBadge = false) => {
    if (hurryUpTurns <= 0 || currentTurn !== playerId || isDealing) return null;
    return (
      <div className={`absolute ${positionClass} z-40 pointer-events-none flex flex-col items-center select-none`}>
        {showBadge && (
          <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[10px] sm:text-xs tracking-wider shadow-lg mb-1.5 border border-yellow-100 flex items-center gap-1 whitespace-nowrap">
            <span>⚡ 快出牌！沒牙跳舞催促中</span>
          </div>
        )}
        <img
          src="/cards_rabbids/effects/hurry_up/toothless-dancing-toothless.gif"
          alt="Toothless Dancing"
          className={`${sizeClass} h-auto drop-shadow-[0_0_16px_rgba(245,158,11,0.95)] filter brightness-105`}
        />
      </div>
    );
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
    let triggeredRemotePlayAnim = false;

    if (lastAction && lastAction.timestamp && lastAction.timestamp !== prevActionTimeRef.current) {
      prevActionTimeRef.current = lastAction.timestamp;

      if (lastAction.type === 'play') {
        if (lastAction.playerId !== myIndex) {
          const fromEl = getPlayerRef(lastAction.playerId);
          if (fromEl && discardPileRef.current) {
            triggeredRemotePlayAnim = true;
            isRemotePlayFlyingRef.current = true;
            const cardKey = lastAction.card.displayAssetKey || lastAction.card.assetKey;
            cardAnimationService.animatePlayCard(fromEl, discardPileRef.current, cardKey, () => {
              isRemotePlayFlyingRef.current = false;
              setDisplayedTopCard(topCard);
              setDisplayedDiscardPile(recentDiscardPile);
            });
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
          setRabbidsEventBanner(`💣 【${lastAction.playerName}】在抽牌堆安裝了瘋狂定時炸彈 (+3)！`);
          setTimeout(() => setRabbidsEventBanner(''), 1800);
        } else if (lastAction.card.value === 'rabbids_hurry_up') {
          soundManager.playWild();
          setRabbidsEventBanner(`⚡ 【${lastAction.playerName}】啟動瘋狂快抽！全場 3 秒極限思考 (持續至出牌者再經 3 個回合)！`);
          setTimeout(() => setRabbidsEventBanner(''), 2200);
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
    }

    // 若非對手出牌飛行中（例如自己出牌已飛完、選色變色、或特殊牌淡出消失），立即同步棄牌堆頂牌
    if (!triggeredRemotePlayAnim && !isRemotePlayFlyingRef.current) {
      setDisplayedTopCard(topCard);
      setDisplayedDiscardPile(recentDiscardPile);
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
    if (isCardPlayingRef.current) return;
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

    // 防呆鎖定：出牌動畫進行中，嚴防玩家連點出多張牌或觸發幽靈飛牌
    isCardPlayingRef.current = true;
    setIsCardPlaying(true);

    const hasPreCalledUno = !!myPlayer.calledUno;

    const unlockFallback = () => {
      if (isCardPlayingRef.current) {
        isCardPlayingRef.current = false;
        setIsCardPlaying(false);
        setDisplayedHand(myHand);
      }
    };

    const executePlay = () => {
      onPlayCard(card.id, null, hasPreCalledUno);
      setTimeout(unlockFallback, 1500);
    };

    if (card.color === 'wild') {
      soundManager.playWild();
      setLocalHasDrawn(false);
      setDisplayedHand(prev => prev.filter(c => c.id !== card.id));

      if (cardEl && discardPileRef.current) {
        const cardKey = card.displayAssetKey || card.assetKey;
        cardAnimationService.animatePlayCard(cardEl, discardPileRef.current, cardKey, executePlay);
      } else {
        executePlay();
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
        cardAnimationService.animatePlayCard(cardEl, discardPileRef.current, cardKey, executePlay);
      } else {
        executePlay();
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
    if (isCardPlayingRef.current) return;
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

          {isSpectator && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 font-bold text-xs shadow-[0_0_15px_rgba(56,189,248,0.3)] animate-pulse">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>觀戰中</span>
            </div>
          )}

          {spectators && spectators.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-xs text-gray-400" title={`觀戰者: ${spectators.map(s => s.name).join(', ')}`}>
              <Eye className="w-3.5 h-3.5 text-gray-400" />
              <span>{spectators.length} 人觀戰</span>
            </div>
          )}

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
            {renderHandPlusBadge(topPlayer.id, '-bottom-10 left-1/2 -translate-x-1/2')}
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

            <div className={`relative flex items-center justify-center mt-0.5 ${getInPlaceChallengeHandClass(topPlayer.id)}`}>
              {renderInPlaceChallengeBadge(topPlayer.id, '-bottom-12 left-1/2 -translate-x-1/2')}
              {renderToothlessDancer(topPlayer.id, '-bottom-20 sm:-bottom-24 left-1/2 -translate-x-1/2', 'w-15 sm:w-18 md:w-20', false)}
              <OpponentHand3D
                side="top"
                count={displayedCounts[topPlayer.id] !== undefined ? displayedCounts[topPlayer.id] : topPlayer.cardCount}
                deckTheme={deckTheme}
                isTeammateTop={isTeammateTop}
                teammateHand={teammateHand}
              />
            </div>

            {topPlayer.unoVulnerable && !isTeammateTop && !(is2v2 && topPlayer.id === teammateIndex) && !isSpectator && (
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
            {renderHandPlusBadge(leftPlayer.id, '-top-9 left-1/2 -translate-x-1/2')}
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

            <div className={`relative flex items-center justify-center ${getInPlaceChallengeHandClass(leftPlayer.id)}`}>
              {renderInPlaceChallengeBadge(leftPlayer.id, '-top-10 left-1/2 -translate-x-1/2')}
              {renderToothlessDancer(leftPlayer.id, '-right-14 sm:-right-18 top-1/2 -translate-y-1/2', 'w-15 sm:w-18 md:w-20', false)}
              <OpponentHand3D
                side="left"
                count={displayedCounts[leftPlayer.id] !== undefined ? displayedCounts[leftPlayer.id] : leftPlayer.cardCount}
                deckTheme={deckTheme}
              />
            </div>

            {leftPlayer.unoVulnerable && !(is2v2 && leftPlayer.id === teammateIndex) && !isSpectator && (
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
            {renderHandPlusBadge(rightPlayer.id, '-top-9 left-1/2 -translate-x-1/2')}
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

            <div className={`relative flex items-center justify-center ${getInPlaceChallengeHandClass(rightPlayer.id)}`}>
              {renderInPlaceChallengeBadge(rightPlayer.id, '-top-10 left-1/2 -translate-x-1/2')}
              {renderToothlessDancer(rightPlayer.id, '-left-14 sm:-left-18 top-1/2 -translate-y-1/2', 'w-15 sm:w-18 md:w-20', false)}
              <OpponentHand3D
                side="right"
                count={displayedCounts[rightPlayer.id] !== undefined ? displayedCounts[rightPlayer.id] : rightPlayer.cardCount}
                deckTheme={deckTheme}
              />
            </div>

            {rightPlayer.unoVulnerable && !(is2v2 && rightPlayer.id === teammateIndex) && !isSpectator && (
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
                    <span>💣 +3 炸彈</span>
                  </div>
                )}
                <div
                  ref={drawPileRef}
                  onClick={isContinuousDrawing || isCardPlaying ? undefined : handleDrawWithAnimation}
                  title={
                    (isContinuousDrawing || isCardPlaying)
                      ? '正在出牌或結算動畫中...'
                      : (hasDrawnThisTurn && stackedDrawCount === 0)
                      ? '本回合已抽過牌，請打出手牌或點擊過牌'
                      : '點擊抽一張牌'
                  }
                  className={`relative deck-3d-stack ${
                    explosiveActive ? 'ring-4 ring-red-500 shadow-[0_0_25px_rgba(239,68,68,0.85)] rounded-xl' : ''
                  } ${
                    (isContinuousDrawing || isCardPlaying)
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
                {displayedDiscardPile && displayedDiscardPile.length > 1 && displayedDiscardPile.slice(0, -1).map((discardedCard, idx) => (
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
                    displayedTopCard && vanishingCardId === displayedTopCard.id ? 'rabbids-vanish-card' : ''
                  }`}
                  style={{
                    transform: displayedDiscardPile?.length
                      ? `translate(${displayedDiscardPile[displayedDiscardPile.length - 1].offsetX || 0}px, ${displayedDiscardPile[displayedDiscardPile.length - 1].offsetY || 0}px) rotate(${displayedDiscardPile[displayedDiscardPile.length - 1].rot || -3}deg)`
                      : 'rotate(-3deg)'
                  }}
                >
                  <CardView deckTheme={deckTheme} card={displayedTopCard || topCard} isTopCard className="shadow-xl" />
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
                  <span>💣 炸彈已安裝！下位抽牌者將額外承受 +3 張炸彈重創！</span>
                </div>
              )}
              {hurryUpTurns > 0 && (
                <div className="animate-pulse flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 border border-yellow-200 text-black text-[11px] font-black shadow-[0_0_20px_rgba(245,158,11,0.9)]">
                  <span>⚡ 瘋狂快抽 3秒極限思考 (出牌者【{hurryUpCasterIndex === myIndex ? '你' : (hurryUpCasterName || '出牌者')}】再經 {hurryUpTurns} 個回合結束)</span>
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
              player={isSpectator ? myPlayer : { ...myPlayer, name: myPlayer.name || '你 (玩家)' }}
              cardCount={isSpectator ? (displayedCounts[myPlayer.id] !== undefined ? displayedCounts[myPlayer.id] : (myPlayer.cardCount || 0)) : displayedHand.length}
              avatar={isSpectator ? (myPlayer.isHost ? '👑' : (myPlayer.isAi ? '🤖' : '👤')) : '👤'}
              isLocal={!isSpectator}
              isHost={isHost}
              isActiveTurn={!isSpectator && currentTurn === myIndex && !isDealing && !isContinuousDrawing}
              isSkipped={skippedPlayerInfo && skippedPlayerInfo.playerId === myIndex}
              isChoosingColor={isChoosingColor && colorChoosingPlayerIndex === myIndex}
              isContinuousDrawing={isContinuousDrawing && drawingPlayerIndex === myIndex}
              drawingStepCount={drawingStepCount}
              showTimer={((currentTurn === myIndex && !isChoosingColor) || (isChoosingColor && colorChoosingPlayerIndex === myIndex)) && !isDealing && !isContinuousDrawing && gameState?.gameStatus !== 'game_over'}
              turnStartTime={turnStartTime}
              turnDuration={turnDuration || (isChoosingColor ? 6 : 15)}
              timerPosition="right"
              onKickPlayer={onKickPlayer}
            />

            {/* Action Buttons Group */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {!isSpectator && (
                <button
                  type="button"
                  onClick={handleSortHand}
                  title="依顏色與數字整理手牌並重新展開"
                  className="py-1.5 px-3 sm:px-3.5 rounded-full bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/40 text-emerald-300 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>整理手牌</span>
                </button>
              )}

              {isSpectator ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-400/40 text-sky-300 font-bold text-xs shadow-lg animate-pulse">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>觀戰視角 (座席: {myPlayer.name})</span>
                </div>
              ) : isDealing ? (
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

                  {!isSpectator && players.some((p) => p.unoVulnerable && p.id !== myIndex && !(is2v2 && p.id === teammateIndex)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = players.find((p) => p.unoVulnerable && p.id !== myIndex && !(is2v2 && p.id === teammateIndex));
                        if (target) onChallengeUno(target.id);
                      }}
                      className="py-1.5 px-3.5 rounded-full bg-red-600/80 hover:bg-red-600 border border-red-400 text-white font-bold text-xs shadow-lg animate-pulse"
                    >
                      抓漏
                    </button>
                  )}

                  {isMyTurn && !isChoosingColor && !isCardPlaying && hasDrawnThisTurn && stackedDrawCount === 0 && (
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

                  {!isDealing && !isSpectator && !isCardPlaying && (
                    ((isMyTurn && !isChoosingColor && myHand.length === 2 && (validCards.length > 0 || myPlayer.calledUno))) ||
                    (myHand.length === 1)
                  ) && (
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

                  {isMyTurn && !isChoosingColor && !isCardPlaying && canChallengeWildDraw4 && (
                    <button
                      type="button"
                      onClick={onChallengeWildDraw4}
                      className="py-1.5 px-4 rounded-full font-black text-xs shadow-xl transition active:scale-95 bg-amber-500 hover:bg-amber-400 text-black border-2 border-yellow-200 animate-bounce flex items-center gap-1.5"
                    >
                      <span>質疑 +4！{lastWildDraw4PlayerName ? `(${lastWildDraw4PlayerName})` : ''}</span>
                    </button>
                  )}

                  {currentTurn === myIndex && !isDealing && !isContinuousDrawing && !isChoosingColor && !isCardPlaying && (
                    isForcedPenalty ? (
                      <div className="py-1.5 px-3.5 sm:px-4 rounded-full font-bold text-xs bg-red-950/90 border border-red-500/60 text-red-300 flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span>自動承受罰抽 (+{stackedDrawCount})</span>
                      </div>
                    ) : (!hasDrawnThisTurn || stackedDrawCount > 0) && (
                      <button
                        type="button"
                        disabled={isContinuousDrawing || isCardPlaying}
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

          {/* Straight Level Hand Cards with Steam-style Dynamic Overlap & Accordion Hover */}
          {(() => {
            const isMeChallenged = !isSpectator && wild4ChallengeAnim && wild4ChallengeAnim.challengedId === myIndex;
            const totalCards = handToDisplay.length;

            // Steam-style dynamic negative margin calculation:
            // Keeps total hand width within ~760px even if player holds 25+ cards!
            // Card base width is ~96px on desktop.
            const maxHandTrackWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 820) : 760;
            const cardBaseWidth = 96;
            let dynamicOverlap = -24; // Default comfortable overlap for <= 8 cards
            if (totalCards > 8) {
              const allowedStep = (maxHandTrackWidth - cardBaseWidth) / (totalCards - 1);
              // Clamp overlap so at least 18px (the corner number/color index) is always visible
              const clampedStep = Math.max(18, Math.min(72, allowedStep));
              dynamicOverlap = clampedStep - cardBaseWidth;
            }

            // Slightly scale down card size if holding 16+ cards
            const densityScale = totalCards > 18 ? 0.88 : totalCards > 13 ? 0.93 : 1;

            return (
              <div
                ref={myHandRef}
                className={`relative w-full max-w-5xl px-4 pt-1 pb-1 overflow-visible flex items-center justify-center min-h-[125px] ${
                  isMeChallenged && !wild4ChallengeAnim.isSuccess ? 'challenge-hand-shake' : ''
                }`}
              >
                {renderHandPlusBadge && renderHandPlusBadge(isSpectator ? myPlayer.id : myIndex, '-top-12 left-1/2 -translate-x-1/2')}
                {renderToothlessDancer(isSpectator ? myPlayer.id : myIndex, '-top-28 sm:-top-34 left-1/2 -translate-x-1/2', 'w-18 sm:w-22 md:w-26', true)}

                {isSpectator ? (
                  <div className={`relative flex flex-col items-center gap-2 ${getInPlaceChallengeHandClass(myPlayer.id)}`}>
                    {renderInPlaceChallengeBadge(myPlayer.id, '-top-14 left-1/2 -translate-x-1/2')}
                    <OpponentHand3D
                      side="top"
                      count={displayedCounts[myPlayer.id] !== undefined ? displayedCounts[myPlayer.id] : (myPlayer.cardCount || 1)}
                      deckTheme={deckTheme}
                    />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-sky-500/30 text-[11px] text-sky-300/90 backdrop-blur-sm">
                      <Eye className="w-3 h-3 text-sky-400" />
                      <span>觀戰中：本席手牌不公開</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center overflow-visible transition-all">
                    {handToDisplay.map((card, idx) => {
                      const isPlayable = isMyTurn && validCards.includes(card.id);
                      const isCulpritCard = isMeChallenged && wild4ChallengeAnim.matchingCardIds?.includes(card.id);

                      let translateY = isHandCollapsed ? 16 : (isMyTurn ? 0 : 8);
                      let scale = (isMyTurn ? (isHandCollapsed ? 0.94 : 1) : 0.95) * densityScale;
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
                            marginLeft: idx === 0 ? '0px' : `${dynamicOverlap}px`,
                            transform: `translateY(${translateY}px) scale(${scale})`,
                            transformOrigin: 'bottom center',
                            filter,
                            transitionProperty: 'transform, filter, margin',
                            transitionDuration: '240ms',
                            transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
                            transitionDelay: isHandCollapsed ? '0ms' : `${Math.min(idx * 15, 240)}ms`,
                            pointerEvents: (isMyTurn && !isCardPlaying) ? 'auto' : 'none',
                            zIndex: isCulpritCard ? 50 : idx + 1
                          }}
                          className={`relative overflow-visible ${
                            (isMyTurn && !isCardPlaying)
                              ? `hover:!z-50 hover:!-translate-y-6 hover:!scale-105 ${
                                  totalCards > 9 ? 'hover:mr-5 hover:ml-1' : ''
                                } cursor-pointer`
                              : 'select-none pointer-events-none'
                          }`}
                        >
                          <CardView
                            deckTheme={deckTheme}
                            card={card}
                            isPlayable={isPlayable && !isCardPlaying}
                            onClick={(e) => handleCardClick(card, e?.currentTarget)}
                            className={isCulpritCard ? 'shadow-[0_0_25px_rgba(34,197,94,0.95)] ring-2 ring-green-400' : 'shadow-2xl'}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
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
          isSpectator={isSpectator}
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
```

## src/components/table/TurnTimerCircle.jsx

```javascript
// 檔案位置：src/components/table/TurnTimerCircle.jsx
import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../../services/sound';

export function TurnTimerCircle({ turnStartTime, duration = 15, isLocal = false }) {
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
        <circle
          cx="17"
          cy="17"
          r={r}
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="3.2"
          fill="rgba(10, 28, 18, 0.85)"
        />
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

```

## src/components/table/OpponentHand3D.jsx

```javascript
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
    const tCount = teammateHand.length;
    // Keep teammate's face-up hand within ~460px at the top of the table
    const maxTopWidth = 460;
    const cardW = 74;
    let topOverlap = -16;
    if (tCount > 7) {
      const step = Math.max(14, Math.min(58, (maxTopWidth - cardW) / (tCount - 1)));
      topOverlap = step - cardW;
    }

    return (
      <div className="flex items-center justify-center card-reflection">
        {teammateHand.map((c, cIdx) => (
          <div
            key={c.id || cIdx}
            style={{
              marginLeft: cIdx === 0 ? '0px' : `${topOverlap}px`,
              zIndex: cIdx + 1
            }}
            className="transition-all duration-150 hover:-translate-y-2 hover:scale-115 hover:!z-40 hover:mr-3 cursor-pointer"
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

```

## src/components/table/PlayerInfoPill.jsx

```javascript
// 檔案位置：src/components/table/PlayerInfoPill.jsx
import React from 'react';
import { RotateCw, UserMinus } from 'lucide-react';
import { TurnTimerCircle } from './TurnTimerCircle';

export function PlayerInfoPill({
  player,
  cardCount = 0,
  avatar = '👤',
  isTeammate = false,
  isLocal = false,
  isHost = false,
  isActiveTurn = false,
  isSkipped = false,
  isChoosingColor = false,
  isContinuousDrawing = false,
  drawingStepCount = 1,
  showTimer = false,
  turnStartTime = null,
  turnDuration = 15,
  timerPosition = 'right', // 'left' | 'right'
  onKickPlayer
}) {
  if (!player) return null;

  return (
    <div className="flex items-center gap-2">
      {showTimer && timerPosition === 'left' && (
        <TurnTimerCircle
          turnStartTime={turnStartTime}
          duration={turnDuration}
          isLocal={isLocal}
        />
      )}

      <div
        className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-xl backdrop-blur-md transition-all duration-200 ${
          isSkipped
            ? 'skip-shake ring-4 ring-red-500 bg-red-950/90 border-red-400'
            : isActiveTurn || isChoosingColor
            ? 'active-turn-ring scale-105'
            : 'bg-[#0a1c12]/95 border-white/20'
        }`}
      >
        <div className="w-7 h-7 rounded-full bg-[#1e3a2b] border border-white/20 flex items-center justify-center text-sm shrink-0">
          {avatar}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1 max-w-[95px] truncate">
            {player.name}
            {isTeammate && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/40 shrink-0">
                隊友
              </span>
            )}
          </span>
          <span className="text-[10px] text-emerald-300 font-bold">
            {cardCount} 張牌
          </span>
        </div>

        {isSkipped && (
          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] shadow animate-bounce border border-yellow-300">
            {isLocal ? '你的回合被跳過！' : '跳過！'}
          </span>
        )}

        {player.calledUno && (
          <span className="px-2 py-0.5 rounded-full bg-red-600 text-yellow-300 font-black text-[10px] shadow animate-pulse">
            UNO!
          </span>
        )}

        {isChoosingColor ? (
          <span className="text-[10px] font-bold text-purple-300 animate-pulse">
            選色中
          </span>
        ) : isContinuousDrawing ? (
          <span className="text-[10px] font-bold text-sky-300 animate-pulse flex items-center gap-1">
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            抽牌中 ({drawingStepCount || 1})
          </span>
        ) : !isLocal && isActiveTurn && !isSkipped ? (
          <span className="text-[10px] font-bold text-yellow-300 animate-pulse">
            思考中
          </span>
        ) : null}

        {player.timeoutCount > 0 && !(isLocal && isHost) && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40"
            title="超時累積次數 (達 2 次將由 AI 接管)"
          >
            ⏰ {player.timeoutCount}/2
          </span>
        )}

        {isHost && !isLocal && !player.isHost && !player.isAi && onKickPlayer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`確定要將【${player.name}】移出牌局並轉由 AI 接管嗎？`)) {
                onKickPlayer(player.id);
              }
            }}
            title="踢除此玩家並轉由 AI 接管"
            className="p-1 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition shadow ml-1 cursor-pointer"
          >
            <UserMinus className="w-3 h-3" />
          </button>
        )}
      </div>

      {showTimer && timerPosition === 'right' && (
        <TurnTimerCircle
          turnStartTime={turnStartTime}
          duration={turnDuration}
          isLocal={isLocal}
        />
      )}
    </div>
  );
}

```

## src/components/table/WildColorModal.jsx

```javascript
// 檔案位置：src/components/table/WildColorModal.jsx
import React from 'react';
import { TurnTimerCircle } from './TurnTimerCircle';

export function WildColorModal({
  isOpen = false,
  turnStartTime = null,
  turnDuration = 6,
  myColorCounts = { red: 0, yellow: 0, green: 0, blue: 0 },
  onSelectColor
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-5 rounded-3xl bg-[#0a1c12]/95 border-2 border-amber-400 shadow-2xl backdrop-blur-md flex flex-col items-center gap-3">
      <div className="text-sm font-black text-white flex items-center justify-between w-full">
        <span>請指定變色牌顏色 (限時 6 秒)</span>
        <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || 6} isLocal />
      </div>

      <div className="text-[11px] text-amber-200/90 text-center px-2">
        超時未選將自動以你手中最多顏色的牌出發！
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-64">
        <button
          type="button"
          onClick={() => onSelectColor('red')}
          className="py-2.5 px-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-red-300/40 cursor-pointer"
        >
          <span>紅色 RED</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.red} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('yellow')}
          className="py-2.5 px-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-yellow-300/40 cursor-pointer"
        >
          <span>黃色 YELLOW</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.yellow} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('green')}
          className="py-2.5 px-3 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-green-300/40 cursor-pointer"
        >
          <span>綠色 GREEN</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.green} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('blue')}
          className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-blue-300/40 cursor-pointer"
        >
          <span>藍色 BLUE</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.blue} 張</span>
        </button>
      </div>
    </div>
  );
}

```

## src/components/table/Wild4ChallengeOverlay.jsx

```javascript
// 檔案位置：src/components/table/Wild4ChallengeOverlay.jsx
// Clean Steam UNO-Style +4 Challenge Hand Inspection:
// - Challenger: Sees opponent's hand transported to center with culprit card lifted + Check/X above.
// - Challenged (Me): Sees Check/X above own bottom hand (no transport).
// - Third-Party / Spectator: Returns null here (handled in-place at the challenged player's seat in GameTableView).
import React from 'react';
import { Check, X } from 'lucide-react';
import { CardView } from '../CardView';

export function Wild4ChallengeOverlay({
  wild4ChallengeAnim,
  myIndex,
  isSpectator = false,
  seatDirection = 'top', // 'top' | 'left' | 'right' | 'me'
  deckTheme = 'classic'
}) {
  if (!wild4ChallengeAnim) return null;

  const {
    challengerId,
    challengedId,
    isSuccess,
    handCards = [],
    matchingCardIds = []
  } = wild4ChallengeAnim;

  const isMeChallenged = !isSpectator && (challengedId === myIndex || seatDirection === 'me');
  const isMeChallenger = !isSpectator && challengerId === myIndex;

  // 第三方旁觀玩家或觀戰者：不顯示中央輸送動畫（直接由 GameTableView 在被質疑者的座位手牌上搖晃並打勾/打叉）
  if (!isMeChallenged && !isMeChallenger) {
    return null;
  }

  // 當本人被質疑時：不播放輸送動畫，僅在自己手牌的正上方彈出綠色勾勾或紅色叉叉
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

  const transportClass =
    seatDirection === 'left'
      ? 'challenge-transport-left'
      : seatDirection === 'right'
      ? 'challenge-transport-right'
      : 'challenge-transport-top';

  // 當「本人是發起質疑者」時：將對手手牌輸送至中央公開驗牌，勾勾/叉叉顯示在卡牌正上方
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className={`relative flex flex-col items-center justify-center ${transportClass}`}>
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

```

## src/components/CardView.jsx

```javascript
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

```

## src/components/VictoryModal.jsx

```javascript
// VictoryModal.jsx - Victory Celebration Modal with Multi-round Match Scoring & Lobby Return
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Crown, ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';

export function VictoryModal({
  winner,
  isHost,
  players = [],
  targetScore = 500,
  isMatchOver = false,
  matchWinner = null,
  lastRoundPoints = 0,
  onNextRound,
  onReturnToLobby,
  onRestart,
  onLeave
}) {
  useEffect(() => {
    try {
      const duration = 2.8 * 1000;
      const animationEnd = Date.now() + duration;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        confetti({
          startVelocity: 35,
          spread: 360,
          ticks: 70,
          origin: { x: Math.random(), y: Math.random() - 0.2 }
        });
      }, 250);
      return () => clearInterval(interval);
    } catch {
      // Confetti fallback
    }
  }, [isMatchOver]);

  const is2v2Win = !!winner?.teamName;
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#0e2a1b] border-2 border-amber-400 rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Trophy Avatar */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_30px_rgba(244,196,48,0.4)]">
          {isMatchOver ? (
            <Crown className="w-9 h-9 sm:w-11 sm:h-11 text-amber-300 animate-bounce" />
          ) : (
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-300 animate-bounce" />
          )}
        </div>

        {/* Title Header */}
        <div className="text-xs uppercase tracking-widest text-amber-300 font-extrabold mb-1">
          {isMatchOver
            ? '🏆 賽事總冠軍誕生 (MATCH CHAMPION)'
            : is2v2Win
            ? '2V2 雙人隊伍本局獲勝'
            : '本局對戰結束 (ROUND COMPLETE)'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {isMatchOver
            ? `🎉 【${matchWinner?.teamName || matchWinner?.name}】奪得總冠軍！`
            : is2v2Win
            ? `🎉 【${winner.teamName}】本局獲勝！`
            : winner
            ? `🎉 【${winner.name}】本局獲勝！`
            : '遊戲結束！'}
        </h2>

        <p className="text-xs sm:text-sm text-emerald-300/80 mb-5">
          {isMatchOver
            ? `累計積分達到 ${matchWinner?.score} 分（賽事目標 ${targetScore} 分），登頂總冠軍榮耀！`
            : `率先出清手牌，本局斬獲 +${lastRoundPoints || 0} 結算積分！`}
        </p>

        {/* Match Leaderboard & Score Progress */}
        <div className="bg-[#081a10] border border-emerald-500/20 rounded-2xl p-3.5 mb-6 text-left">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400/90 mb-2 px-1">
            <span>賽事累計積分榜 (LEADERBOARD)</span>
            {targetScore > 0 && <span>目標：{targetScore} 分</span>}
          </div>

          <div className="divide-y divide-emerald-500/10">
            {sortedPlayers.map((p, idx) => {
              const isRoundWinner = is2v2Win ? p.teamId === winner?.teamId : winner && p.id === winner.id;
              const isGrandChampion = isMatchOver && (p.id === matchWinner?.id || (matchWinner?.teamId && p.teamId === matchWinner.teamId));
              const progressPct = targetScore > 0 ? Math.min(100, Math.round(((p.score || 0) / targetScore) * 100)) : 0;

              return (
                <div key={p.id} className="py-2.5 px-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-emerald-400/60 font-bold">#{idx + 1}</span>
                      <span className={`font-bold flex items-center gap-1.5 ${isGrandChampion ? 'text-amber-300' : isRoundWinner ? 'text-emerald-200' : 'text-gray-300'}`}>
                        <span>{p.name}</span>
                        {p.teamName && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-gray-300">
                            {p.teamName.slice(0, 2)}
                          </span>
                        )}
                        {isGrandChampion ? '👑' : isRoundWinner ? '✨' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400">
                        剩 {p.cardCount} 張牌
                      </span>
                      <span className="font-mono text-amber-400 font-extrabold text-sm">
                        {p.score || 0} 分
                      </span>
                    </div>
                  </div>

                  {/* Score Progress Bar (Only when targetScore > 0) */}
                  {targetScore > 0 && (
                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-emerald-500/20">
                      <div
                        className={`h-full transition-all duration-700 rounded-full ${
                          isGrandChampion
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isHost ? (
            <>
              {isMatchOver ? (
                <>
                  <button
                    type="button"
                    onClick={onReturnToLobby}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    結算回傳大廳
                  </button>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="py-3 px-4 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-300" />
                    新賽事重開
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onNextRound}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    進行下一局 (Next Round)
                  </button>
                  <button
                    type="button"
                    onClick={onReturnToLobby}
                    className="py-3 px-4 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    回大廳結算
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 py-3 px-4 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
              等待房主開啟下一局或返回大廳...
            </div>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="py-3 px-4 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}

```
