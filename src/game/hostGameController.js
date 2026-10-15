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
    if (this.isContinuousDrawing) {
      return { success: false, reason: '場上效果結算中，請稍候' };
    }

    if (calledUno) {
      this.engine.callUno(playerIndex);
    }

    const res = this.engine.playCard(playerIndex, cardId, chosenColor);
    if (!res.success) return res;

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

      this.isContinuousDrawing = true;
      this.engine.isContinuousDrawing = true;
      this.onBroadcastState();

      if (!res.canPlay) {
        setTimeout(() => {
          this.finishDrawingCleanup();
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.finishAutoPass(playerIndex, res.card);
          this.onBroadcastState();
          this.checkAiTurn();
          if (onDrawComplete) onDrawComplete(res);
        }, flightAndBufferMs);
      } else {
        setTimeout(() => {
          this.finishDrawingCleanup();
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.turnStartTime = Date.now();
          this.engine.turnDuration = this.engine.getActiveTurnDuration();
          this.resetTurnTimer();
          this.onBroadcastState();
          if (onDrawComplete) onDrawComplete(res);
        }, 450);
      }
    }
    return res;
  }

  passTurn(playerIndex) {
    if (!this.engine) return { success: false, reason: '未在遊戲中' };
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
    }
    return res;
  }

  challengeWildDraw4(challengerIndex) {
    if (!this.engine || this.isContinuousDrawing) return { success: false };
    const res = this.engine.challengeWildDraw4(challengerIndex);
    if (res.success) {
      this.emitSound('penalty');
      const drawnCount = res.penalty || Math.max(4, res.priorCount || 4);
      const animWait = drawnCount * 220 + 800;
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
      }, animWait);
    }
    return res;
  }

  // ==========================================================
  // MULTI-STEP SEQUENCES (Continuous Draw, Penalty, Rabbids)
  // ==========================================================
  executeContinuousDraw(playerIndex, onComplete) {
    if (!this.engine || this.engine.currentTurn !== playerIndex) return;
    if (this.isContinuousDrawing || this.engine.hasDrawnThisTurn) return;

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.engine.drawingPlayerIndex = playerIndex;
    this.engine.drawingStepCount = 0;

    if (this.engine.explosiveActive) {
      const extraBomb = this.engine.checkAndTriggerExplosive(playerIndex);
      const stepRes = this.engine.drawSingleCardStep(playerIndex);
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
    if (!this.engine || this.isContinuousDrawing) return;

    if (this.engine.explosiveActive) {
      this.engine.explosiveActive = false;
      this.engine.stackedDrawCount += 4;
      const victimName = this.engine.players[playerIndex]?.name || '玩家';
      this.engine.addLog(`💥 轟！！！瘋狂定時炸彈在【${victimName}】承受罰抽時引爆！罰抽瞬間暴增 +4 張 (共 ${this.engine.stackedDrawCount} 張)！`);
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

    this.isContinuousDrawing = true;
    this.engine.isContinuousDrawing = true;
    this.onBroadcastState();

    if (card.value === 'rabbids_comin_through') {
      // 瘋狂借過：第一波 -> 第二波 -> 牌面淡出 -> 換下一家
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
      // 兔兔盾牌反彈：
      // 階段 1：先讓盾牌在牌桌中央展示 750ms
      setTimeout(() => {
        if (!this.engine || this.engine.gameStatus === 'game_over') return;
        const victimIdx = card.deflectedVictimIdx;
        const count = card.deflectedCount;

        // 階段 2：觸發下家承受反彈抽牌（前端會以每張 180ms 依序飛牌）
        this.engine.executeShieldDeflectDraw(victimIdx, count);
        this.emitSound('penalty');
        this.onBroadcastState();

        // 階段 3：動態計算所有反彈牌飛入下家手牌並落地的完整時間（每張 220ms + 基礎落地緩衝 850ms）
        // 在這段時間內 isContinuousDrawing 保持為 true，電腦絕對無法提前偷出牌！
        const totalFlightWaitMs = count * 220 + 850;
        setTimeout(() => {
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          // 飛牌全部落地後，移除棄牌堆上的盾牌並正式把出牌權交給這位剛被加完牌的下家！
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
    const shouldKick = this.recordPlayerTimeoutStrike(playerIndex);
    const strikeTag = (!player.isHost && playerIndex !== this.getHostIndex())
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

    const shouldKick = this.recordPlayerTimeoutStrike(playerIndex);
    const strikeTag = (!player.isHost && playerIndex !== this.getHostIndex())
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
        // If AI drew a playable card (either via single draw or draw_until_playable), play it after a brief pause
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
    if (this.engine) {
      this.engine.isContinuousDrawing = false;
      this.engine.drawingPlayerIndex = null;
      this.engine.drawingStepCount = 0;
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
  }

  destroy() {
    this.cleanupTimers();
    this.engine = null;
    this.ai = null;
  }
}
