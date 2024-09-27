import React, { useState } from 'react';

const RouletteGame = ({ onClose, onBet, placeBet }) => {
  const [betAmount, setBetAmount] = useState('');
  const [betType, setBetType] = useState('');

  const handleBet = () => {
    if (placeBet(parseInt(betAmount))) {
      // Implement roulette game logic here
      const result = Math.random() > 0.5 ? betAmount : -betAmount;
      onBet(result);
    }
  };

  return (
    <div className="roulette-game">
      <h2>Roulette</h2>
      <div className="roulette-wheel">
        <div className="wheel">
          {[
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
            10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3,
            26,
          ].map((number, index) => (
            <div
              key={index}
              className={`number ${
                number === 0 ? 'green' : index % 2 === 0 ? 'black' : 'red'
              }`}
            >
              {number}
            </div>
          ))}
        </div>
      </div>
      <div className="betting-options">
        <button onClick={() => setBetType('red')}>Red</button>
        <button onClick={() => setBetType('black')}>Black</button>
        <button onClick={() => setBetType('odd')}>Odd</button>
        <button onClick={() => setBetType('even')}>Even</button>
        <button onClick={() => setBetType('1-18')}>1-18</button>
        <button onClick={() => setBetType('19-36')}>19-36</button>
      </div>
      <div className="betting-area">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          placeholder="Enter bet amount"
        />
        <button onClick={handleBet}>Place Bet</button>
      </div>
      <button onClick={onClose} className="close-button">
        Close
      </button>
    </div>
  );
};

export default RouletteGame;
