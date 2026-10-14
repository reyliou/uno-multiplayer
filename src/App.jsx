// App.jsx - Main UNO Multiplayer Application
import React, { useState, useEffect } from 'react';
import { HomeView } from './components/HomeView';
import { LobbyView } from './components/LobbyView';
import { GameTableView } from './components/GameTableView';
import { VictoryModal } from './components/VictoryModal';
import { p2pNetwork } from './services/p2p';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); // 'home' | 'lobby' | 'game'
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [allowStacking, setAllowStacking] = useState(true);
  const [allowChallengeWildDraw4, setAllowChallengeWildDraw4] = useState(true);
  const [gameMode, setGameMode] = useState('ffa'); // 'ffa' | '2v2'
  const [targetScore, setTargetScore] = useState(500); // 0 = casual/no score limit
  const [drawRule, setDrawRule] = useState('draw_one'); // 'draw_one' | 'draw_until_playable'
  const [deckTheme, setDeckTheme] = useState('classic'); // 'classic' | 'rabbids'
  const [gameState, setGameState] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Register P2P network event listeners (only on mount)
  useEffect(() => {
    p2pNetwork.onLobbyUpdate = (data) => {
      setLobbyPlayers([...data.players]);
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
      setGameState({ ...state });
      setView((prev) => (prev !== 'game' ? 'game' : prev));
    };

    p2pNetwork.onReturnToLobby = (data) => {
      if (data && data.players) setLobbyPlayers([...data.players]);
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

  // Auto-disband room if host closes window/tab or refreshes
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

  // Host creates room
  const handleCreateRoom = (code, hostName, stacking, mode = 'ffa') => {
    setIsHost(true);
    setRoomCode(code);
    setAllowStacking(stacking);
    setGameMode(mode);
    p2pNetwork.createRoom(code, hostName, stacking, mode);
    setView('lobby');
  };

  // Guest joins room
  const handleJoinRoom = (code, guestName) => {
    setIsHost(false);
    setRoomCode(code);
    p2pNetwork.joinRoom(code, guestName);
    setView('lobby');
  };

  // Host starts game
  const handleStartGame = () => {
    p2pNetwork.startGame();
  };

  // Toggle slot AI (Host only)
  const handleToggleAi = (slotIndex) => {
    p2pNetwork.toggleSlotAi(slotIndex);
  };

  // Toggle stacking rule (Host only)
  const handleToggleStacking = () => {
    p2pNetwork.toggleStackingRule();
  };

  // Toggle challenge wild draw 4 rule (Host only)
  const handleToggleChallengeRule = () => {
    p2pNetwork.toggleChallengeRule();
  };

  // Set target score (Host only)
  const handleSetTargetScore = (score) => {
    setTargetScore(score);
    p2pNetwork.setTargetScore(score);
  };

  // Set draw rule (Host only)
  const handleSetDrawRule = (rule) => {
    setDrawRule(rule);
    p2pNetwork.setDrawRule(rule);
  };

  // Set deck theme (Host only)
  const handleSetDeckTheme = (theme) => {
    setDeckTheme(theme);
    p2pNetwork.setDeckTheme(theme);
  };

  // Start next round (Host only)
  const handleNextRound = (resetMatch = false) => {
    p2pNetwork.startNextRound(resetMatch);
  };

  // Return to lobby from game (Host only)
  const handleReturnToLobby = () => {
    p2pNetwork.returnToLobby();
    setView('lobby');
  };

  // Set game mode (Host only)
  const handleSetGameMode = (mode) => {
    setGameMode(mode);
    p2pNetwork.setGameMode(mode);
  };

  // Set FFA player count (Host only)
  const handleSetFfaCount = (count) => {
    p2pNetwork.setFfaPlayerCount(count);
  };

  // Swap slots (Host only)
  const handleSwapSlots = (idxA, idxB) => {
    p2pNetwork.swapSlots(idxA, idxB);
  };

  // Kick player (Host only)
  const handleKickPlayer = (slotIndex, reason = '房主已將你移出房間！') => {
    if (!isHost) return;
    p2pNetwork.kickPlayer(slotIndex, reason);
  };

  // Leave or disband room
  const handleLeaveRoom = () => {
    if (isHost) {
      p2pNetwork.disbandRoom('房主已解散房間！');
    } else {
      p2pNetwork.disconnect();
    }
    setGameState(null);
    setLobbyPlayers([]);
    setView('home');
    window.location.hash = '';
  };

  // Game actions
  const handlePlayCard = (cardId, chosenColor, calledUno) => {
    if (isHost) {
      p2pNetwork.hostPlayCard(cardId, chosenColor, calledUno);
    } else {
      p2pNetwork.clientPlayCard(cardId, chosenColor, calledUno);
    }
  };

  const handleDrawCard = () => {
    if (isHost) {
      p2pNetwork.hostDrawCard();
    } else {
      p2pNetwork.clientDrawCard();
    }
  };

  const handlePassTurn = () => {
    if (isHost) {
      p2pNetwork.hostPassTurn();
    } else {
      p2pNetwork.clientPassTurn();
    }
  };

  const handleCallUno = () => {
    if (isHost) {
      p2pNetwork.hostCallUno();
    } else {
      p2pNetwork.clientCallUno();
    }
  };

  const handleChallengeUno = (targetIndex) => {
    if (isHost) {
      p2pNetwork.hostChallengeUno(targetIndex);
    } else {
      p2pNetwork.clientChallengeUno(targetIndex);
    }
  };

  const handleChallengeWildDraw4 = () => {
    if (isHost) {
      p2pNetwork.hostChallengeWildDraw4();
    } else {
      p2pNetwork.clientChallengeWildDraw4();
    }
  };

  const handleChooseColor = (chosenColor) => {
    if (isHost) {
      p2pNetwork.hostChooseColor(chosenColor);
    } else {
      p2pNetwork.clientChooseColor(chosenColor);
    }
  };

  return (
    <div className="relative min-h-[100dvh]">
      {/* Global Toast Notification */}
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

      {/* Screen Router */}
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

      {/* Victory Celebration Modal */}
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
