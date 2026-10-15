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
    this.hurryUpTurns = 0;
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
    if (cardId) {
      const idx = this.discardPile.findIndex(c => c.id === cardId);
      if (idx !== -1 && this.discardPile.length > 1) {
        this.discardPile.splice(idx, 1);
      }
    } else if (this.vanishingCardId) {
      const idx = this.discardPile.findIndex(c => c.id === this.vanishingCardId);
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
    this.currentTurn = this.getNextTurnIndex(step);
    this.turnStartTime = Date.now();
    this.turnDuration = this.consumeTurnDuration();
  }

  // 當兔兔盾牌反彈罰抽時，將牌發給下一位玩家（下家），但保留下家的出牌回合！
  executeShieldDeflectDraw(victimIndex, count) {
    if (count <= 0 || !this.players[victimIndex]) return [];
    const drawn = this.drawCardsForPlayer(victimIndex, count);
    this.addLog(`🛡️ 兔兔盾牌反彈生效！【${this.players[victimIndex].name}】承受了 +${count} 張反彈抽牌，現在輪到 ${this.players[victimIndex].name} 出牌！`);
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

  getActiveTurnDuration() {
    return this.hurryUpTurns > 0 ? 3 : 15;
  }

  consumeTurnDuration() {
    if (this.hurryUpTurns > 0) {
      this.hurryUpTurns--;
      return 3;
    }
    return 15;
  }

  checkAndTriggerExplosive(playerIndex) {
    if (!this.explosiveActive) return 0;
    this.explosiveActive = false;
    const player = this.players[playerIndex];
    this.drawCardsForPlayer(playerIndex, 4);
    if (player) {
      this.addLog(`💥 轟！！！瘋狂定時炸彈在【${player.name}】抽牌時引爆！額外炸飛多抽 +4 張牌！`);
    }
    return 4;
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
      this.hurryUpTurns = this.playerCount;
      effectMsg += ` ⚡ 瘋狂快抽觸發 (保留當前${this.colorNames[this.currentColor] || '底牌'})！接下來 ${this.playerCount} 個回合每位玩家只有 3 秒思考時間！`;
    } else if (card.value === 'rabbids_explosive') {
      this.explosiveActive = true;
      effectMsg += ` 💣 炸彈已安裝在抽牌堆 (保留當前${this.colorNames[this.currentColor] || '底牌'})！下一位抽牌或罰抽的玩家將引爆炸彈 (額外 +4 張)！`;
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

    this.currentTurn = this.getNextTurnIndex(nextStep);
    this.turnStartTime = Date.now();
    this.turnDuration = this.consumeTurnDuration();

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

    this.hasDrawnThisTurn = false;
    this.currentTurn = this.getNextTurnIndex(nextStep);
    this.turnStartTime = Date.now();
    this.turnDuration = this.consumeTurnDuration();

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
    this.hasDrawnThisTurn = false;
    this.currentTurn = this.getNextTurnIndex(step);
    this.turnStartTime = Date.now();
    this.turnDuration = this.consumeTurnDuration();
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
    const target = this.players[targetIndex];
    if (target && target.hand.length === 1 && target.unoVulnerable) {
      this.drawCardsForPlayer(targetIndex, 2);
      target.calledUno = false;
      target.unoVulnerable = false;
      target.pendingUnoCall = false;
      this.addLog(`⚖️ 【${this.players[challengerIndex].name}】眼明手快抓到了【${target.name}】沒喊 UNO！${target.name} 被罰抽 2 張牌！`);
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

    if (info.hasMatchingCard) {
      this.drawCardsForPlayer(info.playerIndex, 4);
      const priorCount = info.priorStackedCount || 0;
      
      let msg = `⚖️ 【${challenger.name}】質疑成功！【${challengedPlayer.name}】手牌中明明有【${info.targetColorName}】的牌 (${info.matchingCardNames.join('、')})，違規出 +4！${challengedPlayer.name} 被罰抽 4 張！`;

      this.lastWildDraw4Info = null;
      this.stackedDrawCount = 0;
      this.stackedDrawType = null;
      this.hasDrawnThisTurn = false;

      if (priorCount > 0) {
        this.drawCardsForPlayer(challengerIndex, priorCount);
        msg += ` 但先前累積的罰抽 (+${priorCount} 張) 仍由 ${challenger.name} 承受，回合結束！`;
        this.addLog(msg);
        this.advanceTurn(1);
        return {
          success: true,
          challengedWon: false,
          priorCount,
          msg
        };
      } else {
        msg += ` ${challenger.name} 免受罰抽，回合繼續，請出牌或抽牌！`;
        this.addLog(msg);
        this.turnStartTime = Date.now();
        this.turnDuration = this.getActiveTurnDuration();
        return {
          success: true,
          challengedWon: false,
          priorCount: 0,
          msg
        };
      }
    } else {
      const totalPenalty = (this.stackedDrawCount || 4) + 2;
      this.drawCardsForPlayer(challengerIndex, totalPenalty);

      const msg = `⚖️ 【${challenger.name}】質疑失敗！【${challengedPlayer.name}】當時確實無【${info.targetColorName}】的手牌！${challenger.name} 承受所有罰抽加罰 2 張 (共抽 ${totalPenalty} 張) 並跳過回合！`;
      this.addLog(msg);

      this.lastWildDraw4Info = null;
      this.stackedDrawCount = 0;
      this.stackedDrawType = null;
      this.hasDrawnThisTurn = false;
      this.advanceTurn(1);

      return {
        success: true,
        challengedWon: true,
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
    if (card.value === 'rabbids_explosive') return `瘋狂定時炸彈 Explosive (+4 Extra)`;
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

  getClientState(playerIndex) {
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

    const teammateIndex = this.gameMode === '2v2' ? (playerIndex + 2) % 4 : null;
    const teammatePlayer = teammateIndex !== null ? this.players[teammateIndex] : null;

    const sanitizeHandCard = (c) => {
      if (c && c.color === 'wild') {
        const { chosenColor, ...rest } = c;
        return { ...rest, displayAssetKey: c.assetKey };
      }
      return c;
    };

    return {
      deckTheme: this.deckTheme || 'classic',
      hurryUpTurns: this.hurryUpTurns || 0,
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
      myIndex: playerIndex,
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
      myHand: this.players[playerIndex] ? this.players[playerIndex].hand.map(sanitizeHandCard) : [],
      validCards: this.getValidCardsForPlayer(playerIndex).map(c => c.id),
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
      canChallengeWildDraw4: !!this.allowChallengeWildDraw4 &&
        !!this.lastWildDraw4Info &&
        this.currentTurn === playerIndex &&
        this.stackedDrawType === 'wild_draw4' &&
        !this.isDealing &&
        !this.isChoosingColor &&
        !this.isContinuousDrawing &&
        this.gameStatus === 'playing',
      lastWildDraw4PlayerName: this.lastWildDraw4Info ? this.lastWildDraw4Info.playerName : null,
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