// p2p.js - WebRTC Host-Authoritative P2P Networking with 2v2 Team Mode & Slot Management
import Peer from 'peerjs';
import { UnoEngine } from '../game/unoEngine';
import { UnoAI } from '../game/unoAi';
import { soundManager } from './sound';

export class P2PNetwork {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this.playerName = '玩家';
    this.hostConn = null; // Client's connection to Host
    this.guestConns = new Map(); // Host's map of peerId -> { conn, name, slotIndex }
    
    // Game engine & AI instances (Host only)
    this.engine = null;
    this.ai = null;
    this.aiTimer = null;

    // Callbacks for React state
    this.onLobbyUpdate = null;
    this.onStateUpdate = null;
    this.onConnectionStatus = null;
    this.onError = null;

    // Lobby player list (Host & Client)
    this.lobbyPlayers = [];
    this.allowStacking = true;
    this.allowChallengeWildDraw4 = true;
    this.gameMode = 'ffa'; // 'ffa' | '2v2'
    this.targetScore = 500; // 0 = casual/no score limit
    this.drawRule = 'draw_one'; // 'draw_one' | 'draw_until_playable'
    this.gameStarted = false;
    this.onReturnToLobby = null;

    // Continuous drawing timer & flag
    this.isContinuousDrawing = false;
    this.continuousDrawTimer = null;
    this.dealTimer = null;
  }

  static generateRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `UNO-${num}`;
  }

  formatPeerId(code) {
    const clean = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `uno-p2p-${clean}`;
  }

  // ==========================================
  // HOST ROOM CREATION
  // ==========================================
  createRoom(roomCode, hostName = '房主', allowStacking = true, gameMode = 'ffa') {
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = hostName.trim() || '房主';
    this.allowStacking = allowStacking;
    this.allowChallengeWildDraw4 = true;
    this.gameMode = gameMode;
    this.gameStarted = false;
    this.guestConns.clear();
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
    this.engine = null;
    this.ai = null;

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
    const count = this.gameMode === '2v2' ? 4 : (this.lobbyPlayers.length >= 2 ? this.lobbyPlayers.length : 4);
    const slots = [];
    for (let i = 0; i < count; i++) {
      const isHost = i === 0;
      const teamId = this.gameMode === '2v2' ? (i % 2 === 0 ? 'team_a' : 'team_b') : null;
      const teamName = this.gameMode === '2v2' ? (i % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null;
      const partnerIdx = this.gameMode === '2v2' ? (i + 2) % 4 : null;

      slots.push({
        id: i,
        name: isHost ? this.playerName : `電腦 ${i}`,
        isHost,
        isAi: !isHost,
        isReady: true,
        peerId: isHost ? 'host' : null,
        teamId,
        teamName,
        partnerIdx
      });
    }
    this.lobbyPlayers = slots;
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

    const slotIndex = guestInfo.slotIndex;
    this.guestConns.delete(peerId);

    if (!this.gameStarted) {
      if (this.lobbyPlayers[slotIndex]) {
        this.lobbyPlayers[slotIndex].name = `電腦 ${slotIndex}`;
        this.lobbyPlayers[slotIndex].isAi = true;
        this.lobbyPlayers[slotIndex].peerId = null;
        this.broadcastLobbyUpdate();
      }
    } else {
      if (this.engine && this.engine.players[slotIndex]) {
        this.engine.players[slotIndex].isAi = true;
        this.engine.players[slotIndex].name = `${this.engine.players[slotIndex].name} (AI 託管)`;
        this.engine.addLog(`⚠️ 玩家 ${guestInfo.name} 斷線，已自動切換為 AI 電腦託管！`);
        this.broadcastGameState();
        this.checkAiTurn();
      }
    }
  }

  handleHostData(conn, packet) {
    if (!packet || !packet.type) return;

    switch (packet.type) {
      case 'JOIN': {
        const guestName = (packet.name || '訪客').trim();
        
        // Find empty slot (either open "待加入..." or AI bot)
        let targetSlotIdx = this.lobbyPlayers.findIndex((p, idx) => idx > 0 && !p.isAi && !p.peerId);
        if (targetSlotIdx === -1) {
          targetSlotIdx = this.lobbyPlayers.findIndex((p, idx) => idx > 0 && p.isAi);
        }

        if (targetSlotIdx === -1) {
          conn.send({ type: 'JOIN_REJECTED', reason: '房間已滿！' });
          conn.close();
          return;
        }

        this.lobbyPlayers[targetSlotIdx].name = guestName;
        this.lobbyPlayers[targetSlotIdx].isAi = false;
        this.lobbyPlayers[targetSlotIdx].isReady = true;
        this.lobbyPlayers[targetSlotIdx].peerId = conn.peer;

        this.guestConns.set(conn.peer, {
          conn,
          name: guestName,
          slotIndex: targetSlotIdx
        });

        conn.send({
          type: 'JOIN_ACCEPTED',
          slotIndex: targetSlotIdx,
          roomCode: this.roomCode,
          gameMode: this.gameMode,
          allowStacking: this.allowStacking,
          allowChallengeWildDraw4: this.allowChallengeWildDraw4,
          targetScore: this.targetScore,
          drawRule: this.drawRule
        });

        this.broadcastLobbyUpdate();

        if (this.gameStarted && this.engine) {
          conn.send({
            type: 'SYNC_STATE',
            state: this.engine.getClientState(targetSlotIdx)
          });
        }
        break;
      }

      case 'ACTION_PLAY': {
        if (!this.gameStarted || !this.engine || this.engine.isDealing) return;
        if (this.isContinuousDrawing) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        if (packet.calledUno) {
          this.engine.callUno(guest.slotIndex);
        }

        const res = this.engine.playCard(guest.slotIndex, packet.cardId, packet.chosenColor);
        if (res.success) {
          if (res.isChoosingColor) {
            soundManager.playCard();
            this.broadcastSoundEvent('card');
            this.broadcastGameState();
            this.resetTurnTimer();
            break;
          }

          if (res.card.color === 'wild') soundManager.playWild();
          else if (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value)) soundManager.playAction();
          else soundManager.playCard();

          if (res.gameOver) soundManager.playVictory();

          this.broadcastSoundEvent(res.card.color === 'wild' ? 'wild' : (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value) ? 'action' : 'card'));
          this.broadcastGameState();
          this.checkAiTurn();
        } else {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_CHOOSE_COLOR': {
        if (!this.gameStarted || !this.engine) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        const res = this.engine.confirmWildColor(guest.slotIndex, packet.chosenColor);
        if (res.success) {
          soundManager.playWild();
          this.broadcastSoundEvent('wild');
          this.broadcastGameState();
          this.checkAiTurn();
        }
        break;
      }

      case 'ACTION_DRAW': {
        if (!this.gameStarted || !this.engine || this.engine.isDealing) return;
        if (this.isContinuousDrawing) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        if (this.engine.currentTurn !== guest.slotIndex) {
          conn.send({ type: 'ACTION_FAILED', reason: '不是你的回合！' });
          return;
        }

        // Draw starts: cancel turn timeout timer!
        if (this.turnTimeoutTimer) {
          clearTimeout(this.turnTimeoutTimer);
          this.turnTimeoutTimer = null;
        }

        // Active penalty pool: draw penalty cards one by one
        if (this.engine.stackedDrawCount > 0) {
          this.executePenaltyDraw(guest.slotIndex);
          break;
        }

        // Voluntary draw can only be done ONCE per turn
        if (this.engine.hasDrawnThisTurn) {
          conn.send({ type: 'ACTION_FAILED', reason: '本回合已經主動抽過牌了！' });
          break;
        }

        // If continuous drawing rule is active:
        if (this.drawRule === 'draw_until_playable') {
          this.executeContinuousDraw(guest.slotIndex);
          break;
        }

        const res = this.engine.playerDrawCard(guest.slotIndex);
        if (res.success) {
          soundManager.playDraw();
          this.broadcastSoundEvent('draw');
          this.broadcastGameState();

          if (!res.canPlay) {
            // Cannot play: wait 750ms (300ms flight + 450ms natural pause) before advancing turn!
            this.isContinuousDrawing = true;
            setTimeout(() => {
              this.isContinuousDrawing = false;
              if (!this.engine || this.engine.gameStatus === 'game_over') return;
              this.engine.finishAutoPass(guest.slotIndex, res.card);
              this.broadcastGameState();
              this.checkAiTurn();
            }, 750);
          } else {
            // Playable card drawn: wait 380ms for flight to land before starting 15s timer!
            this.isContinuousDrawing = true;
            setTimeout(() => {
              this.isContinuousDrawing = false;
              if (!this.engine || this.engine.gameStatus === 'game_over') return;
              this.engine.turnStartTime = Date.now();
              this.engine.turnDuration = 15;
              this.resetTurnTimer();
              this.broadcastGameState();
            }, 380);
          }
        } else {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_PASS': {
        if (!this.gameStarted || !this.engine) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        const res = this.engine.passTurn(guest.slotIndex);
        if (res.success) {
          this.broadcastGameState();
          this.checkAiTurn();
        } else {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_UNO': {
        if (!this.gameStarted || !this.engine) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        const res = this.engine.callUno(guest.slotIndex);
        if (res.success) {
          soundManager.playUno();
          this.broadcastSoundEvent('uno');
          this.broadcastGameState();
        }
        break;
      }

      case 'ACTION_CHALLENGE': {
        if (!this.gameStarted || !this.engine) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        const res = this.engine.challengeUno(guest.slotIndex, packet.targetIndex);
        if (res.success && res.caught) {
          soundManager.playPenalty();
          this.broadcastSoundEvent('penalty');
          this.broadcastGameState();
        }
        break;
      }

      case 'ACTION_CHALLENGE_WILD_DRAW4': {
        if (!this.gameStarted || !this.engine) return;
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;

        const res = this.engine.challengeWildDraw4(guest.slotIndex);
        if (res.success) {
          soundManager.playPenalty();
          this.broadcastSoundEvent('penalty');
          this.broadcastGameState();
          this.checkAiTurn();
        } else {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      default:
        break;
    }
  }

  // Toggle Game Mode between 'ffa' and '2v2' (Host only)
  setGameMode(mode) {
    if (!this.isHost || this.gameStarted) return;
    this.gameMode = mode;
    this.initLobbySlots();
    this.broadcastLobbyUpdate();
  }

  // Set Player Count in FFA Mode: 2, 3, or 4 (Host only)
  setFfaPlayerCount(count) {
    if (!this.isHost || this.gameStarted || this.gameMode === '2v2') return;
    const targetCount = Math.max(2, Math.min(4, count));
    if (targetCount === this.lobbyPlayers.length) return;

    if (targetCount > this.lobbyPlayers.length) {
      for (let i = this.lobbyPlayers.length; i < targetCount; i++) {
        this.lobbyPlayers.push({
          id: i,
          name: `電腦 ${i}`,
          isHost: false,
          isAi: true,
          isReady: true,
          peerId: null
        });
      }
    } else {
      // Shrinking: kick guests in removed slots
      for (let i = targetCount; i < this.lobbyPlayers.length; i++) {
        const p = this.lobbyPlayers[i];
        if (p.peerId) {
          const guest = this.guestConns.get(p.peerId);
          if (guest && guest.conn) {
            guest.conn.send({ type: 'KICKED', reason: '房主縮減人數' });
            guest.conn.close();
          }
          this.guestConns.delete(p.peerId);
        }
      }
      this.lobbyPlayers = this.lobbyPlayers.slice(0, targetCount);
    }

    this.broadcastLobbyUpdate();
  }

  // Swap two slots (Host only, crucial for 2v2 teammate configuration!)
  swapSlots(idxA, idxB) {
    if (!this.isHost || this.gameStarted) return;
    if (idxA === idxB || !this.lobbyPlayers[idxA] || !this.lobbyPlayers[idxB]) return;

    const pA = { ...this.lobbyPlayers[idxA] };
    const pB = { ...this.lobbyPlayers[idxB] };

    // Swap slots, keeping their respective slot id and team attributes
    this.lobbyPlayers[idxA] = {
      ...pB,
      id: idxA,
      isHost: idxA === 0,
      teamId: this.gameMode === '2v2' ? (idxA % 2 === 0 ? 'team_a' : 'team_b') : null,
      teamName: this.gameMode === '2v2' ? (idxA % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null,
      partnerIdx: this.gameMode === '2v2' ? (idxA + 2) % 4 : null
    };

    this.lobbyPlayers[idxB] = {
      ...pA,
      id: idxB,
      isHost: idxB === 0,
      teamId: this.gameMode === '2v2' ? (idxB % 2 === 0 ? 'team_a' : 'team_b') : null,
      teamName: this.gameMode === '2v2' ? (idxB % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null,
      partnerIdx: this.gameMode === '2v2' ? (idxB + 2) % 4 : null
    };

    // Update guestConns mappings
    if (pA.peerId && this.guestConns.has(pA.peerId)) {
      this.guestConns.get(pA.peerId).slotIndex = idxB;
    }
    if (pB.peerId && this.guestConns.has(pB.peerId)) {
      this.guestConns.get(pB.peerId).slotIndex = idxA;
    }

    this.broadcastLobbyUpdate();
  }

  // Toggle Slot between Computer Bot (AI) and Open for Human
  toggleSlotAi(slotIndex) {
    if (!this.isHost || slotIndex === 0 || this.gameStarted) return;
    const p = this.lobbyPlayers[slotIndex];
    if (!p) return;

    if (!p.isAi && p.peerId) {
      // Kick human guest and turn into Bot
      const guest = this.guestConns.get(p.peerId);
      if (guest && guest.conn) {
        guest.conn.send({ type: 'KICKED', reason: '已被房主移除！' });
        guest.conn.close();
      }
      this.guestConns.delete(p.peerId);
      p.isAi = true;
      p.name = `電腦 ${slotIndex}`;
      p.peerId = null;
    } else if (p.isAi) {
      // Switch from Bot to Open for Human
      p.isAi = false;
      p.name = `開放玩家加入...`;
      p.peerId = null;
    } else {
      // Switch from Open back to Bot
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

  // Start Multiplayer Game (Host only)
  startGame() {
    if (!this.isHost || this.gameStarted) return;

    // Fill any remaining open slots with AI Bots
    this.lobbyPlayers.forEach((p, idx) => {
      if (!p.peerId && !p.isHost && !p.isAi) {
        p.isAi = true;
        p.name = `電腦 ${idx}`;
      }
    });

    this.gameStarted = true;

    // Create authoritative engine with 2v2 support & custom rules
    this.engine = new UnoEngine(
      this.lobbyPlayers.length,
      this.lobbyPlayers,
      this.allowStacking,
      this.gameMode,
      {
        targetScore: this.targetScore,
        drawRule: this.drawRule,
        allowChallengeWildDraw4: this.allowChallengeWildDraw4
      }
    );
    this.ai = new UnoAI(this.engine);

    // Initial game state has isDealing = true
    this.broadcastGameState();

    // Wait 2200ms for opening deal animation to fully complete before starting first turn!
    if (this.dealTimer) {
      clearTimeout(this.dealTimer);
      this.dealTimer = null;
    }
    this.dealTimer = setTimeout(() => {
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.finishDealing();
      this.broadcastGameState();

      const hostIdx = this.getHostIndex();
      if (this.engine.currentTurn === hostIdx) {
        soundManager.playTurn();
      } else {
        this.checkAiTurn();
      }
    }, 2200);
  }

  startNextRound(resetMatch = false) {
    if (!this.isHost || !this.engine) return;

    if (resetMatch) {
      this.lobbyPlayers.forEach(p => { p.score = 0; });
      if (this.engine.players) this.engine.players.forEach(p => { p.score = 0; });
      this.engine.isMatchOver = false;
      this.engine.matchWinner = null;
    } else {
      // Sync latest scores from engine to lobbyPlayers
      if (this.engine.players) {
        this.engine.players.forEach(ep => {
          const lp = this.lobbyPlayers.find(p => p.id === ep.id);
          if (lp) lp.score = ep.score;
        });
      }
    }

    this.engine.reset();
    this.broadcastGameState();

    // Wait 2200ms for opening deal animation to fully complete before starting round
    if (this.dealTimer) {
      clearTimeout(this.dealTimer);
      this.dealTimer = null;
    }
    this.dealTimer = setTimeout(() => {
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.finishDealing();
      this.broadcastGameState();

      const hostIdx = this.getHostIndex();
      if (this.engine.currentTurn === hostIdx) {
        soundManager.playTurn();
      } else {
        this.checkAiTurn();
      }
    }, 2200);
  }

  restartGame() {
    this.startNextRound(false);
  }

  returnToLobby() {
    if (!this.isHost) return;
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
    this.gameStarted = false;
    if (this.engine && this.engine.players) {
      this.engine.players.forEach(ep => {
        const lp = this.lobbyPlayers.find(p => p.id === ep.id);
        if (lp) lp.score = ep.score;
      });
    }
    this.broadcastReturnToLobby();
  }

  broadcastReturnToLobby() {
    const data = {
      type: 'RETURN_TO_LOBBY',
      players: this.lobbyPlayers,
      gameMode: this.gameMode,
      allowStacking: this.allowStacking,
      allowChallengeWildDraw4: this.allowChallengeWildDraw4,
      targetScore: this.targetScore,
      drawRule: this.drawRule,
      roomCode: this.roomCode
    };

    if (this.onReturnToLobby) this.onReturnToLobby(data);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        guest.conn.send(data);
      }
    }
  }

  resetTurnTimer() {
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    if (!this.isHost || !this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) {
      return;
    }

    // Color Selection Phase: 6 seconds timeout!
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

    // AI operates on quick aiTimer (800-1200ms)
    if (!curPlayer.isAi) {
      this.turnTimeoutTimer = setTimeout(() => {
        this.handleTurnTimeout(curIdx);
      }, 15000);
    }
  }

  handleColorTimeout(playerIndex) {
    if (!this.isHost || !this.engine || !this.engine.isChoosingColor) return;
    if (this.engine.colorChoosingPlayerIndex !== playerIndex) return;

    const player = this.engine.players[playerIndex];
    const autoColor = this.engine.getBestColorForPlayer(playerIndex);
    this.engine.addLog(`⏰ 【${player?.name || '玩家'}】選色超時 (6 秒)，系統自動為其指定【${this.engine.colorNames[autoColor]}】！`);

    const res = this.engine.confirmWildColor(playerIndex, autoColor);
    if (res.success) {
      soundManager.playWild();
      this.broadcastSoundEvent('wild');
      this.broadcastGameState();
      this.checkAiTurn();
    }
  }

  handleTurnTimeout(playerIndex) {
    if (!this.isHost || !this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing) return;
    if (this.engine.currentTurn !== playerIndex) return;

    const player = this.engine.players[playerIndex];
    if (!player) return;

    // 1. If player was facing stacked penalty, execute penalty draw
    if (this.engine.stackedDrawCount > 0) {
      this.executePenaltyDraw(playerIndex);
      return;
    }

    // 2. If player has already drawn this turn, auto-pass
    if (this.engine.hasDrawnThisTurn) {
      this.engine.addLog(`⏰ 【${player.name}】思考超時 (15 秒)，系統自動過牌！`);
      const passRes = this.engine.passTurn(playerIndex);
      if (passRes.success) {
        this.broadcastGameState();
        this.checkAiTurn();
      }
      return;
    }

    // 3. Player hasn't drawn: auto draw 1 card and pass!
    const card = this.engine.drawCardRaw();
    player.hand.push(card);
    if (player.hand.length > 1) {
      player.calledUno = false;
      player.unoVulnerable = false;
      player.pendingUnoCall = false;
    }

    this.engine.addLog(`⏰ 【${player.name}】思考超時 (15 秒)，系統自動抽一張牌並過牌！`);
    soundManager.playDraw();
    this.broadcastSoundEvent('draw');

    this.engine.advanceTurn(1);
    this.broadcastGameState();
    this.checkAiTurn();
  }

  checkAiTurn() {
    if (!this.isHost || !this.engine || this.engine.gameStatus === 'game_over' || this.engine.isDealing) return;

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

    const delay = 800 + Math.random() * 400;
    this.aiTimer = setTimeout(() => {
      this.executeAiTurn(curIdx);
    }, delay);
  }

  executeAiTurn(aiIndex) {
    if (!this.isHost || !this.engine || this.engine.currentTurn !== aiIndex || this.engine.gameStatus === 'game_over' || this.engine.isDealing) return;

    const move = this.ai.decideMove(aiIndex);
    if (!move) return;

    if (move.action === 'challenge') {
      const res = this.engine.challengeUno(aiIndex, move.targetIndex);
      if (res.success && res.caught) {
        soundManager.playPenalty();
        this.broadcastSoundEvent('penalty');
        this.broadcastGameState();
      }
      this.checkAiTurn();
      return;
    }

    if (move.action === 'challenge_wild_draw4') {
      const res = this.engine.challengeWildDraw4(aiIndex);
      if (res.success) {
        soundManager.playPenalty();
        this.broadcastSoundEvent('penalty');
        this.broadcastGameState();
      }
      this.checkAiTurn();
      return;
    }

    if (move.callUno) {
      this.engine.callUno(aiIndex);
      soundManager.playUno();
      this.broadcastSoundEvent('uno');
    }

    if (move.action === 'play') {
      const res = this.engine.playCard(aiIndex, move.card.id, move.chosenColor);
      if (res.success) {
        if (res.card.color === 'wild') soundManager.playWild();
        else if (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value)) soundManager.playAction();
        else soundManager.playCard();

        if (res.gameOver) soundManager.playVictory();

        this.broadcastSoundEvent(res.card.color === 'wild' ? 'wild' : (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value) ? 'action' : 'card'));
        this.broadcastGameState();
        this.checkAiTurn();
      }
    } else if (move.action === 'draw') {
      if (this.engine.stackedDrawCount > 0) {
        this.executePenaltyDraw(aiIndex);
        return;
      }

      if (this.drawRule === 'draw_until_playable') {
        this.executeContinuousDraw(aiIndex, (res) => {
          if (res && res.canPlay && res.card) {
            setTimeout(() => {
              if (this.engine && this.engine.currentTurn === aiIndex) {
                const card = res.card;
                let chosenColor = null;
                if (card.color === 'wild') chosenColor = this.ai.getBestColorForHand(this.engine.players[aiIndex].hand);
                const playRes = this.engine.playCard(aiIndex, card.id, chosenColor);
                if (playRes.success) {
                  if (card.color === 'wild') soundManager.playWild();
                  else soundManager.playCard();
                  this.broadcastSoundEvent(card.color === 'wild' ? 'wild' : 'card');
                  this.broadcastGameState();
                  this.checkAiTurn();
                }
              }
            }, 600);
          } else {
            this.checkAiTurn();
          }
        });
        return;
      }

      const res = this.engine.playerDrawCard(aiIndex);
      if (res.success) {
        soundManager.playDraw();
        this.broadcastSoundEvent('draw');
        this.broadcastGameState();

        if (res.canPlay) {
          setTimeout(() => {
            if (this.engine && this.engine.currentTurn === aiIndex) {
              const card = res.card;
              let chosenColor = null;
              if (card.color === 'wild') chosenColor = this.ai.getBestColorForHand(this.engine.players[aiIndex].hand);
              const playRes = this.engine.playCard(aiIndex, card.id, chosenColor);
              if (playRes.success) {
                if (card.color === 'wild') soundManager.playWild();
                else soundManager.playCard();
                this.broadcastSoundEvent(card.color === 'wild' ? 'wild' : 'card');
                this.broadcastGameState();
                this.checkAiTurn();
              }
            }
          }, 600);
        } else {
          setTimeout(() => {
            if (!this.engine || this.engine.gameStatus === 'game_over') return;
            this.engine.finishAutoPass(aiIndex, res.card);
            this.broadcastGameState();
            this.checkAiTurn();
          }, 750);
        }
      }
    }
  }

  // Continuous one-by-one drawing sequence
  executeContinuousDraw(playerIndex, onComplete) {
    if (!this.isHost || !this.engine) return;
    if (this.engine.currentTurn !== playerIndex) return;
    if (this.isContinuousDrawing) return;
    if (this.engine.hasDrawnThisTurn) return;

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.engine.drawingPlayerIndex = playerIndex;
    this.engine.drawingStepCount = 0;

    const drawnCards = [];
    const maxLimit = 25;

    const drawStep = () => {
      if (!this.engine || this.engine.currentTurn !== playerIndex || this.engine.gameStatus === 'game_over') {
        this.finishDrawingCleanup();
        if (onComplete) onComplete({ success: false });
        return;
      }

      const res = this.engine.drawSingleCardStep(playerIndex);
      if (!res.success) {
        this.finishDrawingCleanup();
        if (onComplete) onComplete(res);
        return;
      }

      drawnCards.push(res.card);
      this.engine.drawingStepCount = drawnCards.length;

      // Broadcast single card arrival so everyone sees this card fly & hand increment
      this.broadcastSoundEvent('draw');
      soundManager.playDraw();
      this.broadcastGameState();

      // Check if the newly drawn card is playable
      if (res.canPlay || drawnCards.length >= maxLimit || (this.engine.drawPile.length === 0 && this.engine.discardPile.length <= 1)) {
        setTimeout(() => {
          if (!this.engine) return;
          const finalRes = this.engine.finishContinuousDraw(playerIndex, drawnCards, res.canPlay);
          this.finishDrawingCleanup();
          this.broadcastGameState();

          if (onComplete) onComplete(finalRes);
        }, 380);
      } else {
        // Draw next card with delay so each card flies rhythmically one by one
        this.continuousDrawTimer = setTimeout(() => {
          drawStep();
        }, 420);
      }
    };

    drawStep();
  }

  // Penalty draw sequence: deals each penalty card one by one with visible flight
  executePenaltyDraw(playerIndex, onComplete) {
    if (!this.isHost || !this.engine) return;
    if (this.isContinuousDrawing) return;

    const countToDraw = this.engine.stackedDrawCount;
    if (countToDraw <= 0) return;

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.engine.drawingPlayerIndex = playerIndex;
    this.engine.drawingStepCount = 0;

    let drawn = 0;

    const step = () => {
      if (!this.engine || this.engine.gameStatus === 'game_over') {
        this.finishDrawingCleanup();
        if (onComplete) onComplete({ success: false });
        return;
      }

      const res = this.engine.drawSingleCardStep(playerIndex);
      if (!res.success) {
        this.finishDrawingCleanup();
        if (onComplete) onComplete(res);
        return;
      }

      drawn++;
      this.engine.drawingStepCount = drawn;

      this.broadcastSoundEvent('draw');
      soundManager.playDraw();
      this.broadcastGameState();

      if (drawn >= countToDraw) {
        // Wait 700ms so the last card lands cleanly and spectators see the full penalty
        setTimeout(() => {
          if (!this.engine) return;
          this.engine.finishPenaltyDraw(playerIndex, countToDraw);
          this.finishDrawingCleanup();
          soundManager.playPenalty();
          this.broadcastSoundEvent('penalty');
          this.broadcastGameState();
          this.checkAiTurn();
          if (onComplete) onComplete({ success: true, count: countToDraw });
        }, 700);
      } else {
        // Next penalty card with 300ms spacing
        this.continuousDrawTimer = setTimeout(() => {
          step();
        }, 300);
      }
    };

    step();
  }

  finishDrawingCleanup() {
    this.isContinuousDrawing = false;
    if (this.continuousDrawTimer) {
      clearTimeout(this.continuousDrawTimer);
      this.continuousDrawTimer = null;
    }
    if (this.engine) {
      this.engine.isContinuousDrawing = false;
      this.engine.drawingPlayerIndex = null;
      this.engine.drawingStepCount = 0;
    }
  }

  getHostIndex() {
    const idx = this.lobbyPlayers.findIndex(p => p.isHost);
    return idx !== -1 ? idx : 0;
  }

  // Host local player actions
  hostPlayCard(cardId, chosenColor, calledUno) {
    if (!this.isHost || !this.engine || this.engine.isDealing) return { success: false, reason: '開局發牌中，尚未能出牌' };
    if (this.isContinuousDrawing) return { success: false, reason: '正在抽牌中' };
    const hostIdx = this.getHostIndex();
    if (calledUno) this.engine.callUno(hostIdx);

    const res = this.engine.playCard(hostIdx, cardId, chosenColor);
    if (res.success) {
      if (res.isChoosingColor) {
        soundManager.playCard();
        this.broadcastSoundEvent('card');
        this.broadcastGameState();
        this.resetTurnTimer();
        return res;
      }

      if (res.card.color === 'wild') soundManager.playWild();
      else if (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value)) soundManager.playAction();
      else soundManager.playCard();

      if (res.gameOver) soundManager.playVictory();

      this.broadcastSoundEvent(res.card.color === 'wild' ? 'wild' : (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value) ? 'action' : 'card'));
      this.broadcastGameState();
      this.checkAiTurn();
    }
    return res;
  }

  hostChooseColor(chosenColor) {
    if (!this.isHost || !this.engine) return { success: false };
    const hostIdx = this.getHostIndex();
    const res = this.engine.confirmWildColor(hostIdx, chosenColor);
    if (res.success) {
      soundManager.playWild();
      this.broadcastSoundEvent('wild');
      this.broadcastGameState();
      this.checkAiTurn();
    }
    return res;
  }

  hostDrawCard() {
    if (!this.isHost || !this.engine || this.engine.isDealing) return { success: false, reason: '開局發牌中，尚未能抽牌' };
    if (this.isContinuousDrawing) return { success: false, reason: '正在抽牌中' };
    const hostIdx = this.getHostIndex();
    if (this.engine.currentTurn !== hostIdx) return { success: false, reason: '不是你的回合！' };

    // Drawing starts: CANNOT be idle time!
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    // Active penalty pool: draw penalty cards one by one
    if (this.engine.stackedDrawCount > 0) {
      this.executePenaltyDraw(hostIdx);
      return { success: true, penalty: true };
    }

    // Voluntary draw can only be done ONCE per turn
    if (this.engine.hasDrawnThisTurn) {
      return { success: false, reason: '本回合已經主動抽過牌了！' };
    }

    // If continuous drawing rule is active:
    if (this.drawRule === 'draw_until_playable') {
      this.executeContinuousDraw(hostIdx);
      return { success: true, continuous: true };
    }

    const res = this.engine.playerDrawCard(hostIdx);
    if (res.success) {
      soundManager.playDraw();
      this.broadcastSoundEvent('draw');
      this.broadcastGameState();

      if (!res.canPlay) {
        // Cannot play: wait 750ms before advancing turn to next player!
        this.isContinuousDrawing = true;
        setTimeout(() => {
          this.isContinuousDrawing = false;
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.finishAutoPass(hostIdx, res.card);
          this.broadcastGameState();
          this.checkAiTurn();
        }, 750);
      } else {
        // Playable card drawn: wait 380ms for card flight to reach hand before starting 15s timer!
        this.isContinuousDrawing = true;
        setTimeout(() => {
          this.isContinuousDrawing = false;
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.turnStartTime = Date.now();
          this.engine.turnDuration = 15;
          this.resetTurnTimer();
          this.broadcastGameState();
        }, 380);
      }
    }
    return res;
  }

  hostPassTurn() {
    if (!this.isHost || !this.engine) return { success: false, reason: '未在遊戲中' };
    const hostIdx = this.getHostIndex();
    const res = this.engine.passTurn(hostIdx);
    if (res.success) {
      this.broadcastGameState();
      this.checkAiTurn();
    }
    return res;
  }

  hostCallUno() {
    if (!this.isHost || !this.engine) return { success: false };
    const hostIdx = this.getHostIndex();
    const res = this.engine.callUno(hostIdx);
    if (res.success) {
      soundManager.playUno();
      this.broadcastSoundEvent('uno');
      this.broadcastGameState();
    }
    return res;
  }

  hostChallengeUno(targetIndex) {
    if (!this.isHost || !this.engine) return { success: false };
    const hostIdx = this.getHostIndex();
    const res = this.engine.challengeUno(hostIdx, targetIndex);
    if (res.success && res.caught) {
      soundManager.playPenalty();
      this.broadcastSoundEvent('penalty');
      this.broadcastGameState();
    }
    return res;
  }

  hostChallengeWildDraw4() {
    if (!this.isHost || !this.engine) return { success: false };
    const hostIdx = this.getHostIndex();
    const res = this.engine.challengeWildDraw4(hostIdx);
    if (res.success) {
      soundManager.playPenalty();
      this.broadcastSoundEvent('penalty');
      this.broadcastGameState();
      this.checkAiTurn();
    }
    return res;
  }

  // Broadcasts
  broadcastLobbyUpdate() {
    const data = {
      type: 'LOBBY_UPDATE',
      players: this.lobbyPlayers,
      gameMode: this.gameMode,
      allowStacking: this.allowStacking,
      allowChallengeWildDraw4: this.allowChallengeWildDraw4,
      targetScore: this.targetScore,
      drawRule: this.drawRule,
      roomCode: this.roomCode
    };

    if (this.onLobbyUpdate) this.onLobbyUpdate(data);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        guest.conn.send(data);
      }
    }
  }

  broadcastGameState() {
    if (!this.engine) return;

    const hostIdx = this.getHostIndex();
    const hostState = this.engine.getClientState(hostIdx);
    if (this.onStateUpdate) this.onStateUpdate(hostState);

    for (const guest of this.guestConns.values()) {
      if (guest.conn && guest.conn.open) {
        const guestState = this.engine.getClientState(guest.slotIndex);
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
  // GUEST / CLIENT JOIN ROOM FLOW
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

      this.hostConn = this.peer.connect(hostPeerId, {
        reliable: true
      });

      this.hostConn.on('open', () => {
        if (this.onConnectionStatus) this.onConnectionStatus({ status: 'connected', peerId: id, isHost: false });
        this.hostConn.send({
          type: 'JOIN',
          name: this.playerName
        });
      });

      this.hostConn.on('data', (packet) => {
        this.handleClientData(packet);
      });

      this.hostConn.on('close', () => {
        if (this.onError) this.onError('與房主之連線已中斷！');
        if (this.onConnectionStatus) this.onConnectionStatus({ status: 'disconnected', isHost: false });
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
      case 'JOIN_ACCEPTED':
        this.mySlotIndex = packet.slotIndex;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        break;

      case 'JOIN_REJECTED':
      case 'KICKED':
        if (this.onError) this.onError(packet.reason || '連線被拒絕');
        this.disconnect();
        break;

      case 'LOBBY_UPDATE':
        this.lobbyPlayers = packet.players;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        if (this.onLobbyUpdate) this.onLobbyUpdate(packet);
        break;

      case 'RETURN_TO_LOBBY':
        this.gameStarted = false;
        this.lobbyPlayers = packet.players || this.lobbyPlayers;
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        if (this.onReturnToLobby) this.onReturnToLobby(packet);
        break;

      case 'SYNC_STATE':
        this.gameStarted = true;
        if (this.onStateUpdate) this.onStateUpdate(packet.state);
        if (packet.state && packet.state.currentTurn === packet.state.myIndex) {
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

  // Guest actions sent to Host
  clientPlayCard(cardId, chosenColor, calledUno) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({
      type: 'ACTION_PLAY',
      cardId,
      chosenColor,
      calledUno
    });
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
    this.hostConn.send({
      type: 'ACTION_CHALLENGE',
      targetIndex
    });
  }

  clientChallengeWildDraw4() {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({
      type: 'ACTION_CHALLENGE_WILD_DRAW4'
    });
  }

  clientChooseColor(chosenColor) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({
      type: 'ACTION_CHOOSE_COLOR',
      chosenColor
    });
  }

  disconnect() {
    this.finishDrawingCleanup();
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.dealTimer) {
      clearTimeout(this.dealTimer);
      this.dealTimer = null;
    }
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    for (const g of this.guestConns.values()) {
      if (g.conn) g.conn.close();
    }
    this.guestConns.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.engine = null;
    this.ai = null;
    this.gameStarted = false;
  }
}

export const p2pNetwork = new P2PNetwork();
