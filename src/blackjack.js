import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, Typography, Box } from '@/components/ui';

const CARD_VALUES = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

const SUITS = ['♠', '♥', '♦', '♣'];

const createDeck = () => {
  return SUITS.flatMap((suit) =>
    Object.keys(CARD_VALUES).map((value) => ({ suit, value }))
  );
};

const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const calculateHandValue = (hand) => {
  let value = 0;
  let aces = 0;
  for (let card of hand) {
    if (card.value === 'A') {
      aces += 1;
      value += 11;
    } else {
      value += CARD_VALUES[card.value];
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
};

const BlackjackGame = ({ onClose, onBet, placeBet }) => {
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameState, setGameState] = useState('betting');
  const [betAmount, setBetAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [playerChips, setPlayerChips] = useState(1000); // Assuming starting chips

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    setDeck(shuffleDeck(createDeck()));
    setPlayerHand([]);
    setDealerHand([]);
    setGameState('betting');
    setMessage('');
    setBetAmount(0);
  };

  const dealInitialCards = () => {
    if (placeBet(betAmount)) {
      const newDeck = [...deck];
      const newPlayerHand = [newDeck.pop(), newDeck.pop()];
      const newDealerHand = [newDeck.pop(), newDeck.pop()];
      setPlayerHand(newPlayerHand);
      setDealerHand(newDealerHand);
      setDeck(newDeck);
      setGameState('playing');
      setPlayerChips(playerChips - betAmount);

      if (calculateHandValue(newPlayerHand) === 21) {
        endRound('blackjack');
      }
    } else {
      setMessage('Invalid bet amount.');
    }
  };

  const hit = () => {
    const newPlayerHand = [...playerHand, deck.pop()];
    setPlayerHand(newPlayerHand);
    setDeck([...deck]);

    if (calculateHandValue(newPlayerHand) > 21) {
      endRound('bust');
    }
  };

  const stand = () => {
    let newDealerHand = [...dealerHand];
    let newDeck = [...deck];

    while (calculateHandValue(newDealerHand) < 17) {
      newDealerHand.push(newDeck.pop());
    }

    setDealerHand(newDealerHand);
    setDeck(newDeck);

    endRound('stand');
  };

  const endRound = (result) => {
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);
    let winAmount = 0;

    switch (result) {
      case 'blackjack':
        winAmount = betAmount * 2.5;
        setMessage(`Blackjack! You win ${winAmount} chips!`);
        break;
      case 'bust':
        setMessage('Bust! You lose.');
        break;
      case 'stand':
        if (dealerValue > 21 || playerValue > dealerValue) {
          winAmount = betAmount * 2;
          setMessage(`You win ${winAmount} chips!`);
        } else if (dealerValue > playerValue) {
          setMessage('Dealer wins. You lose.');
        } else {
          winAmount = betAmount;
          setMessage("It's a tie! Your bet is returned.");
        }
        break;
    }

    setPlayerChips(playerChips + winAmount);
    onBet(winAmount - betAmount);
    setGameState('gameOver');
  };

  const renderCard = (card, hidden = false) => (
    <Card className="w-16 h-24 m-1 flex items-center justify-center">
      <CardContent>
        {hidden ? (
          <Typography className="text-xl font-bold">?</Typography>
        ) : (
          <Typography
            className={`text-xl font-bold ${
              ['♥', '♦'].includes(card.suit) ? 'text-red-500' : 'text-black'
            }`}
          >
            {card.value}
            {card.suit}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box className="p-4 bg-green-800 text-white rounded-lg">
      <Typography variant="h4" className="mb-4">
        Blackjack
      </Typography>

      {gameState === 'betting' && (
        <Box className="mb-4">
          <Typography>Your chips: {playerChips}</Typography>
          <input
            type="number"
            value={betAmount}
            onChange={(e) =>
              setBetAmount(Math.max(0, parseInt(e.target.value)))
            }
            className="mr-2 p-2 text-black"
          />
          <Button
            onClick={dealInitialCards}
            className="bg-yellow-500 text-black"
          >
            Place Bet
          </Button>
        </Box>
      )}

      {gameState !== 'betting' && (
        <>
          <Box className="mb-4">
            <Typography variant="h6">
              Dealer's Hand (
              {gameState === 'gameOver' ? calculateHandValue(dealerHand) : '?'})
            </Typography>
            <Box className="flex">
              {dealerHand.map((card, index) =>
                renderCard(card, index === 0 && gameState !== 'gameOver')
              )}
            </Box>
          </Box>

          <Box className="mb-4">
            <Typography variant="h6">
              Your Hand ({calculateHandValue(playerHand)})
            </Typography>
            <Box className="flex">
              {playerHand.map((card) => renderCard(card))}
            </Box>
          </Box>

          {gameState === 'playing' && (
            <Box className="mb-4">
              <Button onClick={hit} className="mr-2 bg-blue-500">
                Hit
              </Button>
              <Button onClick={stand} className="bg-red-500">
                Stand
              </Button>
            </Box>
          )}

          {message && <Typography className="mb-4">{message}</Typography>}

          {gameState === 'gameOver' && (
            <Button onClick={resetGame} className="bg-purple-500">
              Play Again
            </Button>
          )}
        </>
      )}

      <Button onClick={onClose} className="mt-4 bg-gray-500">
        Close
      </Button>
    </Box>
  );
};

export default BlackjackGame;
