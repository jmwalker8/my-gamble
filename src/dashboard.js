import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { auth } from './firebase.js';
import SignUp from './sign_up.js';
import './dashboard.css';

// INITIAL DATA

const STARTING_BALANCE = 100;
const LOTTERY_DRAW_TIME = new Date().setHours(20, 0, 0, 0); // 8:00 PM today
const TICKET_FORMAT = 'LLNNNN'; // L: Letter, N: Number
const CURRENCY_NAME = 'GambleCoins';

// Parse initial members from environment variable
const initialMembers = JSON.parse(process.env.REACT_APP_INITIAL_MEMBERS || '[]').map(member => ({
  ...member,
  currency: STARTING_BALANCE,
  transactions: [],
  achievements: [],
  lastPlayedGames: {}
}));

const adminCredentials = JSON.parse(process.env.REACT_APP_ADMIN_CREDENTIALS || '{}');

const achievements = [
  { id: 1, name: 'High Roller', description: 'Reach 2000 currency', threshold: 2000 },
  { id: 2, name: 'Lucky Streak', description: 'Win 5 games in a row', threshold: 5 },
];

const games = [
  { id: 'coinflip', name: 'Coin Flip', cooldown: 5 * 60 * 1000, minBet: 10, maxBet: 100 },
  { id: 'dice', name: 'Dice Roll', cooldown: 10 * 60 * 1000, minBet: 20, maxBet: 200 },
  { id: 'slot', name: 'Slot Machine', cooldown: 15 * 60 * 1000, minBet: 50, maxBet: 500 },
];

const Dashboard = () => {
  const [members, setMembers] = useState(() => {
    const savedMembers = localStorage.getItem('gamblingClubMembers');
    if (savedMembers) {
      return JSON.parse(savedMembers).map(member => ({
        ...member,
        currency: Number(member.currency)
      }));
    }
    return initialMembers;
  });
  const [lotteryPool, setLotteryPool] = useState(() => {
    const savedPool = localStorage.getItem('gamblingClubLotteryPool');
    return savedPool ? Number(savedPool) : 1000;
  });
  const [lotteryTickets, setLotteryTickets] = useState(() => {
    const savedTickets = localStorage.getItem('gamblingClubLotteryTickets');
    return savedTickets ? JSON.parse(savedTickets) : [];
  });
  const [nextLotteryDraw, setNextLotteryDraw] = useState(() => {
    const savedDrawTime = localStorage.getItem('gamblingClubNextLotteryDraw');
    return savedDrawTime ? Number(savedDrawTime) : LOTTERY_DRAW_TIME;
  });
  const [votes, setVotes] = useState(() => {
    const savedVotes = localStorage.getItem('gamblingClubVotes');
    return savedVotes ? JSON.parse(savedVotes) : {};
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [currencyChange, setCurrencyChange] = useState('');
  const [gameOutcome, setGameOutcome] = useState('');
  const [currentMember, setCurrentMember] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [pollOptions, setPollOptions] = useState(['Coin Flip', 'Dice Roll', 'Slot Machine']);
  const [userVote, setUserVote] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [firstPlacePrize, setFirstPlacePrize] = useState(1000);
  const [nextPollReset, setNextPollReset] = useState(() => {
    const savedResetTime = localStorage.getItem('gamblingClubNextPollReset');
    return savedResetTime ? Number(savedResetTime) : new Date().setHours(24, 0, 0, 0); // Midnight tonight
  });

  useEffect(() => {
    // Check for existing session on component mount
    const sessionData = sessionStorage.getItem('gamblingClubSession');
    if (sessionData) {
      const { isAdmin, currentMember } = JSON.parse(sessionData);
      setIsAdmin(isAdmin);
      setCurrentMember(currentMember);
      setIsLoggedIn(true);
    }

    const lotteryTimer = setInterval(() => {
      if (Date.now() >= nextLotteryDraw) {
        drawLottery();
      }
    }, 60000); // Check every minute

    const pollResetTimer = setInterval(() => {
      if (Date.now() >= nextPollReset) {
        resetPoll();
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(lotteryTimer);
      clearInterval(pollResetTimer);
    };
  }, [nextLotteryDraw, nextPollReset]);

  const [db, setDb] = useState(null);

  useEffect(() => {
    const firestore = getFirestore();
    setDb(firestore);
  }, []);

  useEffect(() => {
    if (db) {
      syncUsersWithFirebase();
    }
  }, [db]);

  const syncUsersWithFirebase = async () => {
    if (!db) return;

    try {
      const usersCollection = collection(db, 'users');
      const userSnapshot = await getDocs(usersCollection);
      const firebaseUsers = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update local state to match Firebase users
      setMembers(prevMembers => {
        const updatedMembers = prevMembers.filter(member => 
          firebaseUsers.some(fbUser => fbUser.email === member.email)
        );

        firebaseUsers.forEach(fbUser => {
          if (!updatedMembers.some(member => member.email === fbUser.email)) {
            updatedMembers.push({
              id: fbUser.id,
              name: fbUser.displayName || 'New Member',
              email: fbUser.email,
              currency: STARTING_BALANCE,
              transactions: [],
              achievements: [],
              lastPlayedGames: {}
            });
          }
        });

        return updatedMembers;
      });
    } catch (error) {
      console.error('Error syncing users with Firebase:', error);
    }
  };


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in
        const member = members.find(m => m.email === user.email);
        if (member) {
          setCurrentMember(member);
          setIsLoggedIn(true);
          setUserVote(votes[member.id] || '');
          setVoteSubmitted(!!votes[member.id]);
        }
        // Check if the logged-in user is the admin
        if (user.email === 'jmicaw318@gmail.com') {
          setIsAdmin(true);
          setIsLoggedIn(true);
        }
      } else {
        // User is signed out
        setIsLoggedIn(false);
        setIsAdmin(false);
        setCurrentMember(null);
      }
    });
  
    return () => unsubscribe();
  }, [members, votes, db]);

  useEffect(() => {
    localStorage.setItem('gamblingClubMembers', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('gamblingClubLotteryPool', lotteryPool.toString());
  }, [lotteryPool]);

  useEffect(() => {
    localStorage.setItem('gamblingClubLotteryTickets', JSON.stringify(lotteryTickets));
  }, [lotteryTickets]);

  useEffect(() => {
    localStorage.setItem('gamblingClubNextLotteryDraw', nextLotteryDraw.toString());
  }, [nextLotteryDraw]);

  useEffect(() => {
    localStorage.setItem('gamblingClubVotes', JSON.stringify(votes));
  }, [votes]);

  useEffect(() => {
    localStorage.setItem('gamblingClubNextPollReset', nextPollReset.toString());
  }, [nextPollReset]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      
      const loggedInMember = members.find(m => m.email === user.email);
      
      if (loggedInMember) {
        setCurrentMember(loggedInMember);
        setIsLoggedIn(true);
        setUserVote(votes[loggedInMember.id] || '');
        setVoteSubmitted(!!votes[loggedInMember.id]);
      } else if (user.email === 'jmicaw318@gmail.com') {
        setIsAdmin(true);
        setIsLoggedIn(true);
      } else {
        // ... handle new user
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLoginEmail('');
      setLoginPassword('');
      setUserVote('');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setCurrencyChange('');
  };

  const handleCurrencyChange = () => {
    if (selectedMember && currencyChange) {
      updateMemberCurrency(selectedMember.id, parseInt(currencyChange), "Admin adjustment");
      setSelectedMember(null);
      setCurrencyChange('');
    }
  };

  const generateTicket = () => {
    let ticket = '';
    for (let char of TICKET_FORMAT) {
      if (char === 'L') {
        ticket += String.fromCharCode(65 + Math.floor(Math.random() * 26));
      } else {
        ticket += Math.floor(Math.random() * 10);
      }
    }
    return ticket;
  };

  const updateMemberCurrency = (memberId, amount, reason) => {
    setMembers(prevMembers => prevMembers.map(member => 
      member.id === memberId 
        ? { 
            ...member, 
            currency: Math.max(0, Number(member.currency) + Number(amount)),
            transactions: [...member.transactions, { 
              amount: Number(amount), 
              date: new Date().toISOString(),
              reason: reason
            }]
          }
        : member
    ));
    if (currentMember && memberId === currentMember.id) {
      setMembers(prevMembers => {
        const updatedMembers = [...prevMembers, newMember];
        const loggedInMember = updatedMembers.find(m => m.email === newMember.email);
        if (loggedInMember) {
          setIsLoggedIn(true);
          setUserVote(votes[loggedInMember.id] || '');
          setVoteSubmitted(!!votes[loggedInMember.id]);
        }
        return updatedMembers;
      });
    }
    checkAchievements(memberId);
  };
  
  const playGame = (gameId) => {
    const game = games.find(g => g.id === gameId);
    const lastPlayed = currentMember.lastPlayedGames[gameId] || 0;
    
    if (Date.now() - lastPlayed < game.cooldown) {
      setGameOutcome(`You need to wait ${Math.ceil((game.cooldown - (Date.now() - lastPlayed)) / 1000)} seconds to play ${game.name} again.`);
      return;
    }
  
    if (currentMember.currency < game.minBet) {
      setGameOutcome(`You don't have enough ${CURRENCY_NAME} to play. Minimum bet is ${game.minBet}.`);
      return;
    }
  
    if (currentMember.currency < parseInt(betAmount) || parseInt(betAmount) < game.minBet || parseInt(betAmount) > game.maxBet) {
      setGameOutcome(`Invalid bet amount. Min: ${game.minBet}, Max: ${game.maxBet}`);
      return;
    }

    let winAmount = 0;
    switch (gameId) {
      case 'coinflip':
        winAmount = Math.random() > 0.5 ? parseInt(betAmount) : -parseInt(betAmount);
        break;
      case 'dice':
        winAmount = Math.random() > 0.33 ? parseInt(betAmount) : -parseInt(betAmount);
        break;
      case 'slot':
        winAmount = Math.random() > 0.2 ? parseInt(betAmount) * 2 : -parseInt(betAmount);
        break;
      default:
        break;
    }

    // Prevent going into debt
    if (currentMember.currency + winAmount < 0) {
      winAmount = -currentMember.currency;
    }

    updateMemberCurrency(currentMember.id, winAmount, `${games.find(g => g.id === gameId).name} game`);
    setGameOutcome(winAmount > 0 ? `You won ${winAmount} ${CURRENCY_NAME}!` : `You lost ${-winAmount} ${CURRENCY_NAME}.`);
    
    setCurrentMember(prevMember => ({
      ...prevMember,
      lastPlayedGames: {
        ...prevMember.lastPlayedGames,
        [gameId]: Date.now()
      }
    }));

    setShowGameModal(false);
  };

  const buyLotteryTicket = () => {
    if (currentMember.currency >= 100) {
      updateMemberCurrency(currentMember.id, -100, "Lottery ticket purchase");
      const newTicket = { memberId: currentMember.id, number: generateTicket() };
      setLotteryTickets(prevTickets => [...prevTickets, newTicket]);
      setLotteryPool(prevPool => prevPool + 50); // 50% of ticket price goes to pool
    } else {
      setGameOutcome(`Not enough ${CURRENCY_NAME} to buy a lottery ticket.`);
    }
  };

  const drawLottery = () => {
    const winningNumber = generateTicket();
    const winningTicket = lotteryTickets.find(ticket => ticket.number === winningNumber);

    if (winningTicket) {
      const winner = members.find(member => member.id === winningTicket.memberId);
      updateMemberCurrency(winner.id, lotteryPool, "Lottery win");
      setGameOutcome(`${winner.name} won the lottery jackpot of ${lotteryPool} ${CURRENCY_NAME}!`);
      setLotteryPool(1000); // Reset pool
    } else {
      setLotteryPool(prevPool => prevPool * 1.5); // Increase pool if no winner
      setGameOutcome("No winner this time. Lottery pool increased!");
    }

    setLotteryTickets([]);
    // Set next draw time to 8:00 PM tomorrow
    setNextLotteryDraw(new Date(new Date().setHours(20, 0, 0, 0) + 24 * 60 * 60 * 1000).getTime());
  };

  const checkAchievements = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      achievements.forEach(achievement => {
        if (!member.achievements.includes(achievement.id)) {
          if (achievement.id === 1 && member.currency >= achievement.threshold) {
            addAchievement(memberId, achievement.id);
          } else if (achievement.id === 2 && member.transactions.slice(-5).every(t => t.amount > 0)) {
            addAchievement(memberId, achievement.id);
          }
        }
      });
    }
  };

  const addAchievement = (memberId, achievementId) => {
    setMembers(prevMembers => prevMembers.map(member =>
      member.id === memberId
        ? { ...member, achievements: [...member.achievements, achievementId] }
        : member
    ));
    if (currentMember && memberId === currentMember.id) {
      setCurrentMember(prevMember => ({
        ...prevMember,
        achievements: [...prevMember.achievements, achievementId]
      }));
    }
  };

  const handleSignUp = async (newUser) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
      const user = userCredential.user;
  
      await updateProfile(user, { displayName: newUser.name });
  
      const newMember = {
        id: user.uid,
        name: newUser.name,
        email: newUser.email,
        currency: STARTING_BALANCE,
        transactions: [],
        achievements: [],
        lastPlayedGames: {}
      };
  
      // Add user to Firestore
      await setDoc(doc(db, 'users', user.uid), newMember);
  
      setMembers(prevMembers => {
        const updatedMembers = [...prevMembers, newMember];
        setCurrentMember(newMember);
        setIsLoggedIn(true);
        setUserVote(votes[newMember.id] || '');
        setVoteSubmitted(!!votes[newMember.id]);
        return updatedMembers;
      });
  
      setShowSignUp(false);
  
      alert('Account created successfully! Welcome to the Stats in Gambling Club!');
  
      return { success: true };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message };
    }
  };
  

  // Admin functions
  const resetMemberCurrency = (memberId) => {
    const member = members.find(m => m.id === memberId);
    updateMemberCurrency(memberId, STARTING_BALANCE - member.currency, "Admin reset");
  };

  const deleteMember = async (memberId) => {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', memberId));

      // Delete from local state
      setMembers(prevMembers => prevMembers.filter(member => member.id !== memberId));

      // If the deleted member is the current user, log them out
      if (currentMember && currentMember.id === memberId) {
        handleLogout();
      }
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  const adjustLotteryPool = (amount) => {
    setLotteryPool(prevPool => Math.max(1000, prevPool + amount));
  };

  const addMoreCurrency = (memberId, amount = STARTING_BALANCE) => {
    updateMemberCurrency(memberId, amount, "Admin bonus");
  };

  const handleVote = (option) => {
    if (currentMember) {
      setVotes(prevVotes => ({
        ...prevVotes,
        [currentMember.id]: option
      }));
      setUserVote(option);
      setVoteSubmitted(true);
    }
  };

  const updatePollOptions = (newOptions) => {
    setPollOptions(newOptions);
    setVotes({});  // Reset votes when options change
    setNextPollReset(new Date(new Date().setHours(24, 0, 0, 0) + 24 * 60 * 60 * 1000).getTime()); // Set next reset to midnight tomorrow
  };

  const resetPoll = () => {
    setVotes({});
    setVoteSubmitted(false);
    setUserVote('');
    setNextPollReset(new Date(new Date().setHours(24, 0, 0, 0) + 24 * 60 * 60 * 1000).getTime()); // Set next reset to midnight tomorrow
  };

  const updateFirstPlacePrize = (amount) => {
    setFirstPlacePrize(amount);
  };

  const getMemberRank = (memberId) => {
    const sortedMembers = [...members].sort((a, b) => b.currency - a.currency);
    return sortedMembers.findIndex(member => member.id === memberId) + 1;
  };

  const awardFirstPlacePrize = () => {
    const sortedMembers = [...members].sort((a, b) => b.currency - a.currency);
    if (sortedMembers.length > 0) {
      updateMemberCurrency(sortedMembers[0].id, firstPlacePrize, "First place prize");
    }
  };

  if (showSignUp) {
    return <SignUp onSignUp={handleSignUp} onCancel={() => setShowSignUp(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h2>Login to Stats in Gambling Club</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
        <button onClick={() => setShowSignUp(true)} className="signup-button">Create Account</button>
        {loginError && <p className="error">{loginError}</p>}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Stats in Gambling Club Dashboard</h1>
      <button onClick={handleLogout} className="logout-button">Logout</button>

      {isAdmin ? (
        <div className="admin-view">
          <h2>Admin Controls</h2>
          <table className="member-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Currency</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.currency} {CURRENCY_NAME}</td>
                  <td>
                    <button onClick={() => handleSelectMember(member)}>Select</button>
                    <button onClick={() => resetMemberCurrency(member.id)}>Reset Currency</button>
                    <button onClick={() => deleteMember(member.id)}>Delete</button>
                    <button onClick={() => addMoreCurrency(member.id)}>Add {STARTING_BALANCE} {CURRENCY_NAME}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedMember && (
            <div className="currency-update">
              <input
                type="number"
                value={currencyChange}
                onChange={(e) => setCurrencyChange(e.target.value)}
                placeholder="Enter amount"
              />
              <button onClick={handleCurrencyChange}>Update Currency</button>
            </div>
          )}
          <div className="lottery-control">
            <h3>Lottery Control</h3>
            <p>Current Pool: {lotteryPool} {CURRENCY_NAME}</p>
            <button onClick={() => adjustLotteryPool(1000)}>Increase Pool</button>
            <button onClick={() => adjustLotteryPool(-1000)}>Decrease Pool</button>
            <button onClick={drawLottery}>Force Lottery Draw</button>
          </div>
          <div className="poll-control">
            <h3>Update Poll Options</h3>
            <input
              type="text"
              placeholder="Enter options, separated by commas"
              onChange={(e) => updatePollOptions(e.target.value.split(',').map(o => o.trim()))}
            />
          </div>
          <div className="poll-results">
            <h3>Current Poll Results</h3>
            {pollOptions.map(option => (
              <div key={option}>
                {option}: {Object.values(votes).filter(v => v === option).length}
              </div>
            ))}
          </div>
          <div className="first-place-prize-control">
            <h3>First Place Prize Control</h3>
            <p>Current Prize: {firstPlacePrize} {CURRENCY_NAME}</p>
            <input
              type="number"
              value={firstPlacePrize}
              onChange={(e) => updateFirstPlacePrize(Number(e.target.value))}
              placeholder="Enter new prize amount"
            />
            <button onClick={awardFirstPlacePrize}>Award First Place Prize</button>
          </div>
        </div>
      ) : currentMember ? (
        <div className="member-view">
          <div className="member-stats">
            <h2>Your Stats</h2>
            <p>Current Balance: {currentMember.currency} {CURRENCY_NAME}</p>
            <p>Your Rank: {getMemberRank(currentMember.id)} / {members.length}</p>
            <div className="action-buttons">
              <button onClick={() => setShowGameModal(true)} className="game-button">Play Games</button>
              <button onClick={buyLotteryTicket} className="lottery-button">Buy Lottery Ticket (100 {CURRENCY_NAME})</button>
            </div>
            {gameOutcome && <p>{gameOutcome}</p>}
          </div>

          {showGameModal && (
            <div className="game-modal">
              <h3>Select a Game</h3>
              {games.map(game => (
                <div key={game.id}>
                  <button 
                    onClick={() => setSelectedGame(game)}
                    disabled={Date.now() - (currentMember.lastPlayedGames[game.id] || 0) < game.cooldown}
                  >
                    {game.name}
                  </button>
                  {Date.now() - (currentMember.lastPlayedGames[game.id] || 0) < game.cooldown && 
                    <span>Cooldown: {Math.ceil((game.cooldown - (Date.now() - (currentMember.lastPlayedGames[game.id] || 0))) / 1000)}s</span>
                  }
                </div>
              ))}
              {selectedGame && (
                <div>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder={`Bet amount (${selectedGame.minBet}-${selectedGame.maxBet})`}
                  />
                  <button onClick={() => playGame(selectedGame.id)}>Play {selectedGame.name}</button>
                </div>
              )}
              <button onClick={() => setShowGameModal(false)}>Close</button>
            </div>
          )}

          <div className="transactions">
            <h2>Transaction History</h2>
            <ul>
              {currentMember.transactions.slice(-10).reverse().map((transaction, index) => (
                <li key={index}>
                  {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount} {CURRENCY_NAME} 
                  {transaction.reason ? ` (${transaction.reason})` : ''} 
                  on {new Date(transaction.date).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>

          <div className="achievements">
            <h2>Achievements</h2>
            <ul>
              {achievements.map(achievement => (
                <li key={achievement.id} className={currentMember.achievements.includes(achievement.id) ? 'achieved' : ''}>
                  {achievement.name}: {achievement.description}
                </li>
              ))}
            </ul>
          </div>

          <div className="lottery-info">
            <h2>Lottery</h2>
            <p>Current Pool: {lotteryPool} {CURRENCY_NAME}</p>
            <p>Next Draw: {new Date(nextLotteryDraw).toLocaleString()}</p>
            <p>Your Tickets: {lotteryTickets.filter(ticket => ticket.memberId === currentMember.id).length}</p>
            {lotteryTickets.filter(ticket => ticket.memberId === currentMember.id).length > 0 && (
              <button onClick={() => setShowTicketsModal(true)}>View Tickets</button>
            )}
          </div>

          {showTicketsModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Your Lottery Tickets</h3>
                <ul>
                  {lotteryTickets
                    .filter(ticket => ticket.memberId === currentMember.id)
                    .map((ticket, index) => (
                      <li key={index}>{ticket.number}</li>
                    ))}
                </ul>
                <button onClick={() => setShowTicketsModal(false)}>Close</button>
              </div>
            </div>
          )}

          <div className="voting-form">
            <h3>Vote for Next Week's Game</h3>
            {!voteSubmitted ? (
              <form onSubmit={(e) => { e.preventDefault(); handleVote(userVote); }}>
                {pollOptions.map((option) => (
                  <div key={option} className="vote-option">
                    <input
                      type="radio"
                      id={option}
                      name="gameVote"
                      value={option}
                      checked={userVote === option}
                      onChange={(e) => setUserVote(e.target.value)}
                    />
                    <label htmlFor={option}>{option}</label>
                  </div>
                ))}
                <button type="submit">Submit Vote</button>
              </form>
            ) : (
              <p>Vote Submitted: {userVote}</p>
            )}
          </div>

          <div className="leaderboard">
            <h2>Club Leaderboard</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={members.sort((a, b) => b.currency - a.currency)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="currency" fill="#8884d8" name={CURRENCY_NAME} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div>Error: No member data available</div>
      )}
    </div>
  );
};

export default Dashboard;