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
    this.roundId = 0;

    this.dealTimer = null;
    this.aiTimer = null;
    this.turnTimeoutTimer = null;
    this.continuousDrawTimer = null;
    this.drawLandingTimer = null;
    this.challengeTimer = null;
    this.effectTimer = null;
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
    this.roundId++;
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
    this.roundId++;
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
    const activeRoundId = this.roundId;
    this.dealTimer = setTimeout(() => {
      if (this.roundId !== activeRoundId) return;
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.finishDealing();
      this.onBroadcastState();
      // 統一呼叫 checkAiTurn()，確保無論第 1 位出牌者是房主、客端或 AI，都會正確啟動 15 秒計時器！
      this.checkAiTurn();
    }, 2200);
  }

  // ==========================================================
  // UNIFIED PLAYER ACTIONS (Used by Host, Guests, and AI!)
  // ==========================================================
  playCard(playerIndex, cardId, chosenColor = null, calledUno = false) {
    if (!this.engine || this.engine.isDealing) {
      return { success: false, reason: '開局發牌中，尚未能出牌' };
    }

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
      this.onBroadcastState();
      return res;
    }

    // 出牌成功後立即清除當前回合的思考超時計時器，避免在過場動畫或結算視窗期間誤觸超時！
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
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
      this.onBroadcastState();
      return res;
    }

    this.onBroadcastState();

    const activeRoundId = this.roundId;
    if (res.isVanishing) {
      this.handleSpecialVanishAndEffects(playerIndex, res.card);
    } else if (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(res.card.value)) {
      this.isContinuousDrawing = true;
      this.engine.isContinuousDrawing = true;
      this.onBroadcastState();
      this.effectTimer = setTimeout(() => {
        if (this.roundId !== activeRoundId) return;
        this.finishDrawingCleanup();
        if (this.engine && this.engine.gameStatus === 'playing') {
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
      this.executeContinuousDraw(playerIndex, onDrawComplete, false);
      return { success: true, continuous: true };
    }

    const activeRoundId = this.roundId;
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
          if (this.roundId !== activeRoundId) return;
          this.drawLandingTimer = null;
          this.finishDrawingCleanup();
          if (!this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.finishAutoPass(playerIndex, res.card);
          this.onBroadcastState();
          this.checkAiTurn();
          if (onDrawComplete) onDrawComplete(res);
        }, flightAndBufferMs);
      } else {
        this.engine.turnStartTime = Date.now();
        this.engine.turnDuration = this.engine.getActiveTurnDuration();
        this.resetTurnTimer();
        this.onBroadcastState();
        if (onDrawComplete) {
          this.drawLandingTimer = setTimeout(() => {
            if (this.roundId !== activeRoundId) return;
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
    const activeRoundId = this.roundId;
    const res = this.engine.challengeUno(challengerIndex, targetIndex);
    if (res.success && res.caught) {
      this.emitSound('penalty');
      this.onBroadcastState();
      setTimeout(() => {
        if (this.roundId !== activeRoundId) return;
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
    const activeRoundId = this.roundId;
    const res = this.engine.challengeWildDraw4(challengerIndex);
    if (res.success) {
      if (this.turnTimeoutTimer) {
        clearTimeout(this.turnTimeoutTimer);
        this.turnTimeoutTimer = null;
      }
      this.isContinuousDrawing = true;
      this.emitSound('action');
      this.onBroadcastState();

      this.challengeTimer = setTimeout(() => {
        if (this.roundId !== activeRoundId) return;
        if (!this.engine || this.engine.gameStatus === 'game_over') {
          this.finishDrawingCleanup();
          return;
        }

        const penaltyRes = this.engine.resolveWildDraw4ChallengePenalty();
        this.emitSound('penalty');
        this.onBroadcastState();

        const drawnCount = penaltyRes.drawnCount || 4;
        const flightWait = drawnCount * 220 + 750;

        this.challengeTimer = setTimeout(() => {
          if (this.roundId !== activeRoundId) return;
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
  executeContinuousDraw(playerIndex, onComplete, forceAutoPass = false) {
    if (!this.engine || this.engine.currentTurn !== playerIndex) return;
    if (this.isContinuousDrawing || this.engine.hasDrawnThisTurn || this.engine.isChoosingColor) return;

    const activeRoundId = this.roundId;
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
        if (this.roundId !== activeRoundId) return;
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
      if (this.roundId !== activeRoundId) return;
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
          if (this.roundId !== activeRoundId) return;
          if (!this.engine) return;
          this.finishDrawingCleanup();
          const finalRes = this.engine.finishContinuousDraw(playerIndex, drawnCards, res.canPlay, forceAutoPass);
          this.onBroadcastState();

          if (finalRes.canPlay && !forceAutoPass) {
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

    const activeRoundId = this.roundId;
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
      if (this.roundId !== activeRoundId) return;
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
          if (this.roundId !== activeRoundId) return;
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

    const activeRoundId = this.roundId;
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
      this.effectTimer = setTimeout(() => {
        if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
        this.engine.executeCominThroughWave(casterIndex, 1);
        this.emitSound('draw');
        this.onBroadcastState();

        this.effectTimer = setTimeout(() => {
          if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.executeCominThroughWave(casterIndex, 2);
          this.emitSound('draw');
          this.onBroadcastState();

          this.effectTimer = setTimeout(() => {
            if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
            this.engine.vanishTopSpecialCard(card.id);
            this.finishDrawingCleanup();
            this.onBroadcastState();
            this.checkAiTurn();
          }, 1350);
        }, 1250);
      }, 700);
    } else if (card.value === 'rabbids_wild_shield' && card.deflectedCount > 0) {
      this.effectTimer = setTimeout(() => {
        if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
        const victimIdx = card.deflectedVictimIdx;
        const count = card.deflectedCount;

        this.engine.executeShieldDeflectDraw(victimIdx, count);
        this.emitSound('penalty');
        this.onBroadcastState();

        const actualCount = this.engine.activePenaltyBanner?.count || count;
        const totalFlightWaitMs = actualCount * 220 + 850;
        this.effectTimer = setTimeout(() => {
          if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
          this.engine.vanishTopSpecialCard(card.id);
          this.finishDrawingCleanup();
          this.onBroadcastState();
          this.checkAiTurn();
        }, totalFlightWaitMs);
      }, 750);
    } else {
      this.effectTimer = setTimeout(() => {
        if (this.roundId !== activeRoundId || !this.engine || this.engine.gameStatus === 'game_over') return;
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

    const activeRoundId = this.roundId;

    if (this.engine.isChoosingColor) {
      const choosingIdx = this.engine.colorChoosingPlayerIndex;
      const choosingPlayer = this.engine.players[choosingIdx];
      if (choosingPlayer && !choosingPlayer.isAi) {
        this.turnTimeoutTimer = setTimeout(() => {
          if (this.roundId !== activeRoundId) return;
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
        if (this.roundId !== activeRoundId) return;
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
        this.onAutoKickPlayer(playerIndex, '本局思考/選色超時累計達 2 次，本局暫由 AI 自動託管（出牌或進入下一局即恢復手動）！');
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

    const activeRoundId = this.roundId;
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
          this.onAutoKickPlayer(playerIndex, '本局思考超時累計達 2 次，本局暫由 AI 自動託管（出牌或進入下一局即恢復手動）！');
        }
      });
      return;
    }

    if (this.engine.hasDrawnThisTurn) {
      this.engine.addLog(`⏰ 【${player.name}】思考超時 (${limitSec} 秒)，系統自動過牌！${strikeTag}`);
      const passRes = this.engine.passTurn(playerIndex);
      if (passRes.success) {
        if (shouldKick) {
          this.onAutoKickPlayer(playerIndex, '本局思考超時累計達 2 次，本局暫由 AI 自動託管（出牌或進入下一局即恢復手動）！');
          return;
        }
        this.onBroadcastState();
        this.checkAiTurn();
      }
      return;
    }

    // 關鍵修正：若房間設定為「抽到能出 (draw_until_playable)」，超時（包含瘋狂快抽 3 秒超時）必須觸發連續抽到能出為止！
    if (this.engine.drawRule === 'draw_until_playable') {
      this.engine.addLog(`⏰ 【${player.name}】思考超時 (${limitSec} 秒)，系統自動執行「抽到能出」並結束回合！${strikeTag}`);
      this.executeContinuousDraw(playerIndex, () => {
        if (shouldKick) {
          this.onAutoKickPlayer(playerIndex, '本局思考超時累計達 2 次，本局暫由 AI 自動託管（出牌或進入下一局即恢復手動）！');
        }
      }, true /* forceAutoPass */);
      return;
    }

    const extraBombCards = this.engine.checkAndTriggerExplosive(playerIndex);
    const card = this.engine.drawCardRaw();
    player.hand.push(card);
    if (extraBombCards > 0) {
      this.engine.activePenaltyBanner = { playerId: playerIndex, count: 1 + extraBombCards };
    }
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

    this.effectTimer = setTimeout(() => {
      if (this.roundId !== activeRoundId) return;
      this.finishDrawingCleanup();
      if (!this.engine || this.engine.gameStatus === 'game_over') return;
      this.engine.advanceTurn(1);

      if (shouldKick) {
        this.onAutoKickPlayer(playerIndex, '本局思考超時累計達 2 次，本局暫由 AI 自動託管（出牌或進入下一局即恢復手動）！');
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

    const activeRoundId = this.roundId;
    const delay = 850 + Math.random() * 400;
    this.aiTimer = setTimeout(() => {
      if (this.roundId !== activeRoundId) return;
      this.executeAiTurn(curIdx);
    }, delay);
  }

  executeAiTurn(aiIndex) {
    if (!this.engine || this.engine.currentTurn !== aiIndex || this.engine.gameStatus === 'game_over' || this.engine.isDealing || this.isContinuousDrawing) return;

    const activeRoundId = this.roundId;
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
          this.aiTimer = setTimeout(() => {
            if (this.roundId !== activeRoundId) return;
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
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
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
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
    }
  }

  destroy() {
    this.roundId++;
    this.cleanupTimers();
    this.engine = null;
    this.ai = null;
  }
}
