// 檔案位置：src/services/p2p.js
// Decoupled WebRTC P2P Networking & Lobby Manager (Delegates Game Loop to HostGameController)
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
    this.guestConns = new Map();

    // Callbacks for React state
    this.onLobbyUpdate = null;
    this.onStateUpdate = null;
    this.onConnectionStatus = null;
    this.onError = null;
    this.onRoomDisbanded = null;
    this.onReturnToLobby = null;

    // Lobby configuration state
    this.lobbyPlayers = [];
    this.allowStacking = true;
    this.allowChallengeWildDraw4 = true;
    this.gameMode = 'ffa';
    this.targetScore = 500;
    this.drawRule = 'draw_one';
    this.deckTheme = 'classic';
    this.gameStarted = false;
    this.lobbyIdleTimer = null;

    // Decoupled Host Game Controller
    this.controller = new HostGameController({
      onBroadcastState: () => this.broadcastGameState(),
      onBroadcastSound: (soundName) => this.broadcastSoundEvent(soundName),
      onAutoKickPlayer: (slotIndex, reason) => this.kickPlayer(slotIndex, reason),
      getHostIndex: () => this.getHostIndex()
    });
  }

  // Backward-compatible getter so any external check for p2pNetwork.engine still works
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

  kickPlayer(slotIndex, reason = '你已被房主移出房間！', convertToOpenInLobby = true) {
    if (!this.isHost) return { success: false };
    const hostIdx = this.getHostIndex();
    if (slotIndex === hostIdx) return { success: false, reason: '不能踢除房主自己！' };

    const lobbySlot = this.lobbyPlayers[slotIndex];
    const enginePlayer = this.engine && this.engine.players ? this.engine.players[slotIndex] : null;

    let targetPeerId = lobbySlot?.peerId || enginePlayer?.peerId || null;
    if (!targetPeerId || targetPeerId === 'host') {
      for (const [pId, gInfo] of this.guestConns.entries()) {
        if (gInfo.slotIndex === slotIndex) {
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
        let targetSlotIdx = this.lobbyPlayers.findIndex((p) => !p.isHost && !p.isAi && !p.peerId);
        if (targetSlotIdx === -1) {
          targetSlotIdx = this.lobbyPlayers.findIndex((p) => !p.isHost && p.isAi);
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
          drawRule: this.drawRule,
          deckTheme: this.deckTheme || 'classic'
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
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        const res = this.controller.playCard(guest.slotIndex, packet.cardId, packet.chosenColor, packet.calledUno);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_CHOOSE_COLOR': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        this.controller.chooseColor(guest.slotIndex, packet.chosenColor);
        break;
      }

      case 'ACTION_DRAW': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        const res = this.controller.drawCard(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_PASS': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        const res = this.controller.passTurn(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_UNO': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        this.controller.callUno(guest.slotIndex);
        break;
      }

      case 'ACTION_CHALLENGE': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
        this.controller.challengeUno(guest.slotIndex, packet.targetIndex);
        break;
      }

      case 'ACTION_CHALLENGE_WILD_DRAW4': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest) return;
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
  // LOBBY SETTINGS & SLOT MUTATIONS
  // ==========================================
  setGameMode(mode) {
    if (!this.isHost || this.gameStarted) return;
    this.gameMode = mode;
    this.initLobbySlots();
    this.broadcastLobbyUpdate();
  }

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
      for (let i = targetCount; i < this.lobbyPlayers.length; i++) {
        const p = this.lobbyPlayers[i];
        if (p.peerId && p.peerId !== 'host') {
          this.kickPlayer(i, '房主縮減了房間人數！');
        }
      }
      this.lobbyPlayers = this.lobbyPlayers.slice(0, targetCount);
    }

    this.broadcastLobbyUpdate();
  }

  swapSlots(idxA, idxB) {
    if (!this.isHost || this.gameStarted) return;
    if (idxA === idxB || !this.lobbyPlayers[idxA] || !this.lobbyPlayers[idxB]) return;

    const pA = { ...this.lobbyPlayers[idxA] };
    const pB = { ...this.lobbyPlayers[idxB] };

    this.lobbyPlayers[idxA] = {
      ...pB,
      id: idxA,
      isHost: !!pB.isHost,
      teamId: this.gameMode === '2v2' ? (idxA % 2 === 0 ? 'team_a' : 'team_b') : null,
      teamName: this.gameMode === '2v2' ? (idxA % 2 === 0 ? '金隊 (隊伍 A)' : '藍隊 (隊伍 B)') : null,
      partnerIdx: this.gameMode === '2v2' ? (idxA + 2) % 4 : null
    };

    this.lobbyPlayers[idxB] = {
      ...pA,
      id: idxB,
      isHost: !!pA.isHost,
      teamId: this.gameMode === '2v2' ? (idxB % 2 === 0 ? 'team_a' : 'team_b') : null,
      teamName: this.gameMode === '2v2' ? (idxB % 2 === 0 ? '金隊 (隊伍 B)' : '藍隊 (隊伍 A)') : null,
      partnerIdx: this.gameMode === '2v2' ? (idxB + 2) % 4 : null
    };

    if (pA.peerId && this.guestConns.has(pA.peerId)) {
      this.guestConns.get(pA.peerId).slotIndex = idxB;
    }
    if (pB.peerId && this.guestConns.has(pB.peerId)) {
      this.guestConns.get(pB.peerId).slotIndex = idxA;
    }

    this.broadcastLobbyUpdate();
  }

  toggleSlotAi(slotIndex) {
    if (!this.isHost || slotIndex === this.getHostIndex() || this.gameStarted) return;
    const p = this.lobbyPlayers[slotIndex];
    if (!p) return;

    if (!p.isAi && p.peerId) {
      this.kickPlayer(slotIndex, '房主已將該座位切換為電腦 AI！', false);
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
        guest.conn.send(data);
      }
    }
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
      deckTheme: this.deckTheme || 'classic',
      roomCode: this.roomCode
    };

    if (this.onReturnToLobby) this.onReturnToLobby(data);

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
        this.gameMode = packet.gameMode || 'ffa';
        this.allowStacking = packet.allowStacking;
        if (packet.allowChallengeWildDraw4 !== undefined) this.allowChallengeWildDraw4 = packet.allowChallengeWildDraw4;
        this.targetScore = packet.targetScore !== undefined ? packet.targetScore : 500;
        this.drawRule = packet.drawRule || 'draw_one';
        this.deckTheme = packet.deckTheme || 'classic';
        break;

      case 'LOBBY_UPDATE':
        this.lobbyPlayers = packet.players;
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
        if (packet.state && packet.state.currentTurn === packet.state.myIndex && !packet.state.isContinuousDrawing && !packet.state.isDealing) {
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
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.gameStarted = false;
  }
}

export const p2pNetwork = new P2PNetwork();