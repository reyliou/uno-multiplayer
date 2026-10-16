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
