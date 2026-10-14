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
