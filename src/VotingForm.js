import React, { useState, useEffect } from 'react';

const VotingForm = ({ currentMember, onVote, pollOptions, userVote }) => {
  const [selectedOption, setSelectedOption] = useState(userVote || '');

  useEffect(() => {
    setSelectedOption(userVote || '');
  }, [userVote]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onVote(selectedOption);
  };

  return (
    <div className="voting-form">
      <h3>Vote for Next Week's Game</h3>
      <form onSubmit={handleSubmit}>
        {pollOptions.map((option) => (
          <div key={option}>
            <input
              type="radio"
              id={option}
              name="gameVote"
              value={option}
              checked={selectedOption === option}
              onChange={(e) => setSelectedOption(e.target.value)}
            />
            <label htmlFor={option}>{option}</label>
          </div>
        ))}
        <button type="submit">Submit Vote</button>
      </form>
    </div>
  );
};

export default VotingForm;