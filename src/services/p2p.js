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
      onAutoKickPlayer: (slotIndex, reason) => this.enableTempAiTakeover(slotIndex, reason),
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

  // 開局或換下一局前，強制將所有仍在線上的真人客端同步回 lobbyPlayers，杜絕換局後變成 AI！
  syncLobbyPlayersWithConnections() {
    for (const [peerId, guestInfo] of this.guestConns.entries()) {
      if (guestInfo.conn && guestInfo.conn.open && !guestInfo.isSpectator && guestInfo.slotIndex >= 0) {
        const slot = this.lobbyPlayers[guestInfo.slotIndex];
        if (slot && !slot.isHost) {
          slot.isAi = false;
          slot.peerId = peerId;
          slot.name = guestInfo.name;
        }
      }
    }
  }

  // 當玩家單局超時達 2 次時，僅在「當前這一局」暫由 AI 代打，不踢出房間、也不覆蓋 lobbyPlayers！
  enableTempAiTakeover(slotIndex, reason = '本局思考超時達 2 次，暫由 AI 託管（下一局或主動操作即恢復）') {
    if (!this.isHost || !this.engine) return;
    const hostIdx = this.getHostIndex();
    if (slotIndex === hostIdx) return;

    const enginePlayer = this.engine.players[slotIndex];
    if (!enginePlayer || enginePlayer.isAi) return;

    const cleanName = enginePlayer.name.replace(/ \(AI 接管\)$/g, '').replace(/ \(AI 託管\)$/g, '');
    enginePlayer.isAi = true;
    enginePlayer.name = `${cleanName} (AI 託管)`;
    this.engine.addLog(`🤖 【${cleanName}】${reason}`);

    if (this.engine.isChoosingColor && this.engine.colorChoosingPlayerIndex === slotIndex) {
      const autoColor = this.engine.getBestColorForPlayer(slotIndex);
      this.engine.confirmWildColor(slotIndex, autoColor);
    }

    this.controller.emitSound('penalty');
    this.broadcastGameState();
    this.controller.checkAiTurn();
  }

  // 若被暫時 AI 託管的玩家主動點擊了出牌/抽牌/喊UNO，立即解除 AI 託管恢復手動操作！
  restoreHumanControlIfActive(slotIndex, guestName) {
    if (!this.engine || !this.engine.players || !this.engine.players[slotIndex]) return;
    const ep = this.engine.players[slotIndex];
    if (ep.isAi) {
      ep.isAi = false;
      ep.timeoutCount = 0;
      ep.name = guestName || ep.name.replace(/ \(AI 接管\)$/g, '').replace(/ \(AI 託管\)$/g, '');
      this.engine.addLog(`✨ 【${ep.name}】已回到牌桌恢復手動操作！`);
    }
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
      // 關鍵修正：只有當連線真正關閉 (!conn.open) 時才視為斷線轉 AI，避免學校網路偶發警告誤把真人變成 AI！
      if (!conn.open) {
        this.handleGuestDisconnect(conn.peer);
      }
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
        this.restoreHumanControlIfActive(guest.slotIndex, guest.name);
        const res = this.controller.playCard(guest.slotIndex, packet.cardId, packet.chosenColor, packet.calledUno);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_CHOOSE_COLOR': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.restoreHumanControlIfActive(guest.slotIndex, guest.name);
        this.controller.chooseColor(guest.slotIndex, packet.chosenColor);
        break;
      }

      case 'ACTION_DRAW': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.restoreHumanControlIfActive(guest.slotIndex, guest.name);
        const res = this.controller.drawCard(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_PASS': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.restoreHumanControlIfActive(guest.slotIndex, guest.name);
        const res = this.controller.passTurn(guest.slotIndex);
        if (!res.success && res.reason) {
          conn.send({ type: 'ACTION_FAILED', reason: res.reason });
        }
        break;
      }

      case 'ACTION_UNO': {
        const guest = this.guestConns.get(conn.peer);
        if (!guest || guest.isSpectator) return;
        this.restoreHumanControlIfActive(guest.slotIndex, guest.name);
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

    this.syncLobbyPlayersWithConnections();

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
    // 關鍵修正：進入下一局前，強制將所有仍在線的客端玩家恢復為 isAi = false！
    this.syncLobbyPlayersWithConnections();
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
    this.syncLobbyPlayersWithConnections();

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