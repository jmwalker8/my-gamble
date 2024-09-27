import React, { useState, useEffect } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
  return SUITS.flatMap(suit => VALUES.map(value => ({ suit, value })));
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
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
};

const BlackjackGame = ({ onClose, onBet }) => {
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameState, setGameState] = useState('betting'); // betting, playing, dealerTurn, gameOver
  const [betAmount, setBetAmount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDeck(shuffleDeck(createDeck()));
  }, []);

  const dealInitialCards = () => {
    const newPlayerHand = [deck.pop(), deck.pop()];
    const newDealerHand = [deck.pop(), deck.pop()];
    setPlayerHand(newPlayerHand);
    setDealerHand(newDealerHand);
    setDeck([...deck]);
    setGameState('playing');
  };

  const hit = () => {
    const newPlayerHand = [...playerHand, deck.pop()];
    setPlayerHand(newPlayerHand);
    setDeck([...deck]);
    if (calculateHandValue(newPlayerHand) > 21) {
      setGameState('gameOver');
      setMessage('Bust! You lose.');
      onBet(-betAmount);
    }
  };

  const stand = () => {
    setGameState('dealerTurn');
    dealerPlay();
  };

  const dealerPlay = () => {
    let newDealerHand = [...dealerHand];
    while (calculateHandValue(newDealerHand) < 17) {
      newDealerHand.push(deck.pop());
    }
    setDealerHand(newDealerHand);
    setDeck([...deck]);
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(newDealerHand);
    
    if (dealerValue > 21 || playerValue > dealerValue) {
      setMessage('You win!');
      onBet(betAmount);
    } else if (dealerValue > playerValue) {
      setMessage('Dealer wins. You lose.');
      onBet(-betAmount);
    } else {
      setMessage('It\'s a tie!');
    }
    setGameState('gameOver');
  };

  const playAgain = () => {
    setDeck(shuffleDeck(createDeck()));
    setPlayerHand([]);
    setDealerHand([]);
    setGameState('betting');
    setMessage('');
    setBetAmount(0);
  };

  return (
    <div className="blackjack-game">
      <h2>Blackjack</h2>
      {gameState === 'betting' && (
        <div>
          <input 
            type="number" 
            value={betAmount} 
            onChange={(e) => setBetAmount(parseInt(e.target.value))} 
            min="1"
          />
          <button onClick={dealInitialCards}>Place Bet</button>
        </div>
      )}
      {gameState !== 'betting' && (
        <div>
          <div className="hands">
            <div className="player-hand">
              <h3>Your Hand ({calculateHandValue(playerHand)})</h3>
              {playerHand.map((card, index) => (
                <div key={index} className="card">{card.value}{card.suit}</div>
              ))}
            </div>
            <div className="dealer-hand">
              <h3>Dealer's Hand ({gameState === 'playing' ? '?' : calculateHandValue(dealerHand)})</h3>
              {dealerHand.map((card, index) => (
                <div key={index} className="card">
                  {gameState === 'playing' && index === 0 ? '?' : `${card.value}${card.suit}`}
                </div>
              ))}
            </div>
          </div>
          {gameState === 'playing' && (
            <div className="actions">
              <button onClick={hit}>Hit</button>
              <button onClick={stand}>Stand</button>
            </div>
          )}
          {gameState === 'gameOver' && (
            <div>
              <p>{message}</p>
              <button onClick={playAgain}>Play Again</button>
            </div>
          )}
        </div>
      )}
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default BlackjackGame;

