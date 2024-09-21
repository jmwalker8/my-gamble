import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc
} from 'firebase/firestore';
import SignUp from './sign_up.js';
import './dashboard.css';

// INITIAL DATA
const STARTING_CHIPS = 1000;
const LOTTERY_TIME = new Date().setHours(20, 0, 0, 0); // 8:00 PM today
const TICKET_FORMAT = 'LLNNNN'; // L: Letter, N: Number
const CURRENCY_NAME = 'Chips';

// Parse initial players from environment variable
const initialPlayers = JSON.parse(process.env.REACT_APP_INITIAL_PLAYERS || '[]').map(player => ({
  ...player,
  chips: STARTING_CHIPS,
  bets: [],
  achievements: [],
  lastPlayedGames: {}
}));

const achievements = [
  { id: 1, name: 'High Roller', description: 'Reach 20000 chips', threshold: 20000 },
  { id: 2, name: 'Lucky Streak', description: 'Win 5 bets in a row', threshold: 5 },
];

const games = [
  { id: 'poker', name: 'Poker', cooldown: 5 * 60 * 1000, minBet: 100, maxBet: 1000 },
  { id: 'blackjack', name: 'Blackjack', cooldown: 10 * 60 * 1000, minBet: 200, maxBet: 2000 },
  { id: 'roulette', name: 'Roulette', cooldown: 15 * 60 * 1000, minBet: 500, maxBet: 5000 },
];

const Dashboard = () => {
  const [players, setPlayers] = useState(() => {
    const savedPlayers = localStorage.getItem('casinoClubPlayers');
    return savedPlayers ? JSON.parse(savedPlayers) : initialPlayers;
  });
  
  const [lotteryPool, setLotteryPool] = useState(() => {
    const savedPool = localStorage.getItem('casinoClubLotteryPool');
    return savedPool ? Number(savedPool) : 1000;
  });

  const [lotteryTickets, setLotteryTickets] = useState(() => {
    const savedTickets = localStorage.getItem('casinoClubLotteryTickets');
    return savedTickets ? JSON.parse(savedTickets) : [];
  });

  const [nextLottery, setNextLottery] = useState(() => {
    const savedLotteryTime = localStorage.getItem('casinoClubNextLottery');
    return savedLotteryTime ? Number(savedLotteryTime) : LOTTERY_TIME;
  });

  const [votes, setVotes] = useState(() => {
    const savedVotes = localStorage.getItem('casinoClubVotes');
    return savedVotes ? JSON.parse(savedVotes) : {};
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [chipsChange, setChipsChange] = useState('');
  const [gameOutcome, setGameOutcome] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [chipsAtStake, setChipsAtStake] = useState('');
  const [pollOptions, setPollOptions] = useState(['Poker', 'Blackjack', 'Roulette']);
  const [userVote, setUserVote] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [jackpot, setJackpot] = useState(1000);
  const [nextPollReset, setNextPollReset] = useState(() => {
    const savedResetTime = localStorage.getItem('casinoClubNextPollReset');
    return savedResetTime ? Number(savedResetTime) : new Date().setHours(24, 0, 0, 0); // Midnight tonight
  });

  useEffect(() => {
    if (players.length === 0) {
      syncPlayersWithFirebase();
    }
  }, [players]);

  useEffect(() => {
    // Check for existing session on component mount
    const sessionData = sessionStorage.getItem('casinoClubSession');
    if (sessionData) {
      const { isAdmin, currentPlayer } = JSON.parse(sessionData);
      setIsAdmin(isAdmin);
      setCurrentPlayer(currentPlayer);
      setIsLoggedIn(true);
    }

    const lotteryTimer = setInterval(() => {
      if (Date.now() >= nextLottery) {
        conductLottery();
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
  }, [nextLottery, nextPollReset]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in
        if (user.email === 'jmicaw318@gmail.com') {
          setIsAdmin(true);
          setIsLoggedIn(true);
          setCurrentPlayer(null);
        } else {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentPlayer({id: user.uid, ...userData});
            setIsLoggedIn(true);
            setUserVote(votes[user.uid] || '');
            setVoteSubmitted(!!votes[user.uid]);
          } else {
            // Handle case where user exists in Auth but not in Firestore
            console.error('User exists in Auth but not in Firestore');
            handleLogout(); // or create a new user document
          }
          setIsAdmin(false);
        }
      } else {
        // User is signed out
        setIsLoggedIn(false);
        setIsAdmin(false);
        setCurrentPlayer(null);
      }
    });
  
    return () => unsubscribe();
  }, [votes]);

  useEffect(() => {
    localStorage.setItem('casinoClubPlayers', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('casinoClubLotteryPool', lotteryPool.toString());
  }, [lotteryPool]);

  useEffect(() => {
    localStorage.setItem('casinoClubLotteryTickets', JSON.stringify(lotteryTickets));
  }, [lotteryTickets]);

  useEffect(() => {
    localStorage.setItem('casinoClubNextLottery', nextLottery.toString());
  }, [nextLottery]);

  useEffect(() => {
    localStorage.setItem('casinoClubVotes', JSON.stringify(votes));
  }, [votes]);

  useEffect(() => {
    localStorage.setItem('casinoClubNextPollReset', nextPollReset.toString());
  }, [nextPollReset]);

  const syncPlayersWithFirebase = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const userSnapshot = await getDocs(usersCollection);
      const firebasePlayers = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      setPlayers(firebasePlayers);
  
      if (auth.currentUser) {
        const currentPlayerDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (currentPlayerDoc.exists()) {
          setCurrentPlayer({id: auth.currentUser.uid, ...currentPlayerDoc.data()});
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Error syncing players with Firebase:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      
      // Check if the user is an admin
      if (user.email === 'jmicaw318@gmail.com') {
        setIsAdmin(true);
        setIsLoggedIn(true);
        setCurrentPlayer(null); // Admin is not a regular player
        return; // Exit the function early for admin
      }
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentPlayer({id: user.uid, ...userData});
        setIsLoggedIn(true);
        setUserVote(votes[user.uid] || '');
        setVoteSubmitted(!!votes[user.uid]);
      } else {
        // If user auth exists but no Firestore document, create one
        const newPlayer = {
          id: user.uid,
          name: user.displayName || 'New Player',
          email: user.email,
          chips: STARTING_CHIPS,
          bets: [],
          achievements: [],
          lastPlayedGames: {}
        };
        await setDoc(doc(db, 'users', user.uid), newPlayer);
        setCurrentPlayer(newPlayer);
        setIsLoggedIn(true);
      }
      setIsAdmin(false); // Ensure non-admin users have admin status set to false
    } catch (error) {
      console.error('Error logging in:', error);
      if (error.code === 'auth/user-not-found') {
        setLoginError('No user found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Incorrect password');
      } else {
        setLoginError('Invalid email or password');
      }
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

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    setChipsChange('');
  };

  const handleChipsChange = () => {
    if (selectedPlayer && chipsChange) {
      updatePlayerChips(selectedPlayer.id, parseInt(chipsChange), "Admin adjustment");
      setSelectedPlayer(null);
      setChipsChange('');
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

  const updatePlayerChips = (playerId, amount, reason) => {
    setPlayers(prevPlayers => prevPlayers.map(player => 
      player.id === playerId 
        ? { 
            ...player, 
            chips: Math.max(0, Number(player.chips) + Number(amount)),
            bets: [...player.bets, { 
              chips: Number(amount), 
              date: new Date().toISOString(),
              reason: reason
            }]
          }
        : player
    ));
    if (currentPlayer && playerId === currentPlayer.id) {
      setCurrentPlayer(prevPlayer => ({
        ...prevPlayer,
        chips: Math.max(0, Number(prevPlayer.chips) + Number(amount)),
        bets: [...prevPlayer.bets, { 
          chips: Number(amount), 
          date: new Date().toISOString(),
          reason: reason
        }]
      }));
    }
    checkAchievements(playerId);
  };
  
  const placeBet = (gameId) => {
    const game = games.find(g => g.id === gameId);
    const lastPlayed = currentPlayer.lastPlayedGames[gameId] || 0;
    
    if (Date.now() - lastPlayed < game.cooldown) {
      setGameOutcome(`You need to wait ${Math.ceil((game.cooldown - (Date.now() - lastPlayed)) / 1000)} seconds to play ${game.name} again.`);
      return;
    }
  
    if (currentPlayer.chips < game.minBet) {
      setGameOutcome(`You don't have enough ${CURRENCY_NAME} to play. Minimum bet required: ${game.minBet}.`);
      return;
    }
  
    if (currentPlayer.chips < parseInt(chipsAtStake) || parseInt(chipsAtStake) < game.minBet || parseInt(chipsAtStake) > game.maxBet) {
      setGameOutcome(`Invalid bet amount. Min: ${game.minBet}, Max: ${game.maxBet}`);
      return;
    }

    let chipsWon = 0;
    switch (gameId) {
      case 'poker':
        chipsWon = Math.random() > 0.5 ? parseInt(chipsAtStake) : -Math.floor(parseInt(chipsAtStake));
        break;
      case 'blackjack':
        chipsWon = Math.random() > 0.48 ? parseInt(chipsAtStake) : -Math.floor(parseInt(chipsAtStake));
        break;
      case 'roulette':
        chipsWon = Math.random() > 0.45 ? parseInt(chipsAtStake) * 2 : -Math.floor(parseInt(chipsAtStake));
        break;
      default:
        break;
    }

    updatePlayerChips(currentPlayer.id, chipsWon, `${games.find(g => g.id === gameId).name} game`);
    setGameOutcome(chipsWon >= 0 ? `You won ${chipsWon} ${CURRENCY_NAME}!` : `You lost ${-chipsWon} ${CURRENCY_NAME}.`);
    
    setCurrentPlayer(prevPlayer => ({
      ...prevPlayer,
      lastPlayedGames: {
        ...prevPlayer.lastPlayedGames,
        [gameId]: Date.now()
      }
    }));

    setShowGameModal(false);
  };

  const buyLotteryTicket = () => {
    if (currentPlayer.chips >= 100) {
      updatePlayerChips(currentPlayer.id, -100, "Lottery ticket purchased");
      const newTicket = { playerId: currentPlayer.id, number: generateTicket() };
      setLotteryTickets(prevTickets => [...prevTickets, newTicket]);
      setLotteryPool(prevPool => prevPool + 50); // 50% of ticket cost goes to pool
    } else {
      setGameOutcome(`Not enough ${CURRENCY_NAME} to buy a lottery ticket.`);
    }
  };

  const conductLottery = useCallback(() => {
    const winningNumber = generateTicket();
    const winningTicket = lotteryTickets.find(ticket => ticket.number === winningNumber);

    if (winningTicket) {
      const winner = players.find(player => player.id === winningTicket.playerId);
      updatePlayerChips(winner.id, lotteryPool, "Lottery win");
      setGameOutcome(`${winner.name} won the lottery prize of ${lotteryPool} ${CURRENCY_NAME}!`);
      setLotteryPool(1000); // Reset pool
    } else {
      setLotteryPool(prevPool => prevPool * 1.5); // Increase pool if no winner
      setGameOutcome("No winner this time. Lottery prize pool increased!");
    }

    setLotteryTickets([]);
    // Set next lottery time to 8:00 PM tomorrow
    setNextLottery(new Date(new Date().setHours(20, 0, 0, 0) + 24 * 60 * 60 * 1000).getTime());
  }, [lotteryTickets, players, lotteryPool]);

  const checkAchievements = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      achievements.forEach(achievement => {
        if (!player.achievements.includes(achievement.id)) {
          if (achievement.id === 1 && player.chips >= achievement.threshold) {
            addAchievement(playerId, achievement.id);
          } else if (achievement.id === 2 && player.bets.slice(-5).every(b => b.chips > 0)) {
            addAchievement(playerId, achievement.id);
          }
        }
      });
    }
  };

  const addAchievement = (playerId, achievementId) => {
    setPlayers(prevPlayers => prevPlayers.map(player =>
      player.id === playerId
        ? { ...player, achievements: [...player.achievements, achievementId] }
        : player
    ));
    if (currentPlayer && playerId === currentPlayer.id) {
      setCurrentPlayer(prevPlayer => ({
        ...prevPlayer,
        achievements: [...prevPlayer.achievements, achievementId]
      }));
    }
  };

  const handleSignUp = async (newUser) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
      const user = userCredential.user;
  
      await updateProfile(user, { displayName: newUser.name });
  
      const newPlayer = {
        id: user.uid,
        name: newUser.name,
        email: newUser.email,
        chips: STARTING_CHIPS,
        bets: [],
        achievements: [],
        lastPlayedGames: {}
      };
  
      await setDoc(doc(db, 'users', user.uid), newPlayer);
  
      setCurrentPlayer(newPlayer);
      setIsLoggedIn(true);
      setShowSignUp(false);
  
      alert('Account created successfully! Welcome to the Casino!');
  
      return { success: true };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message };
    }
  };

  // Admin functions
  const resetPlayerChips = (playerId) => {
    const player = players.find(p => p.id === playerId);
    updatePlayerChips(playerId, STARTING_CHIPS - player.chips, "Admin reset");
  };

  const deletePlayer = async (playerId) => {
    try {
      await deleteDoc(doc(db, 'users', playerId));
  
      setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== playerId));
  
      if (currentPlayer && currentPlayer.id === playerId) {
        handleLogout();
      }
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to delete player. Please try again.');
    }
  };

  const adjustLotteryPool = (amount) => {
    setLotteryPool(prevPool => Math.max(1000, prevPool + amount));
  };

  const addMoreChips = (playerId, amount = STARTING_CHIPS) => {
    updatePlayerChips(playerId, amount, "Admin bonus");
  };

  const handleVote = (option) => {
    if (currentPlayer) {
      setVotes(prevVotes => ({
        ...prevVotes,
        [currentPlayer.id]: option
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

  const updateJackpot = (amount) => {
    setJackpot(amount);
  };

  const getPlayerRank = (playerId) => {
    const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);
    return sortedPlayers.findIndex(player => player.id === playerId) + 1;
  };

  const awardJackpot = () => {
    const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);
    if (sortedPlayers.length > 0) {
      updatePlayerChips(sortedPlayers[0].id, jackpot, "Jackpot win");
    }
  };

  if (showSignUp) {
    return <SignUp onSignUp={handleSignUp} onCancel={() => setShowSignUp(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h2>Login to Casino</h2>
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
      <h1 className="dashboard-title">Casino Dashboard</h1>
      <button onClick={handleLogout} className="logout-button">Logout</button>

      {isAdmin ? (
        <div className="admin-view">
          <h2>Admin Controls</h2>
          <table className="player-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Chips</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.email}</td>
                  <td>{player.chips} {CURRENCY_NAME}</td>
                  <td>
                    <button onClick={() => handleSelectPlayer(player)}>Select</button>
                    <button onClick={() => resetPlayerChips(player.id)}>Reset Chips</button>
                    <button onClick={() => deletePlayer(player.id)}>Delete</button>
                    <button onClick={() => addMoreChips(player.id)}>Add {STARTING_CHIPS} {CURRENCY_NAME}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedPlayer && (
            <div className="chips-update">
              <input
                type="number"
                value={chipsChange}
                onChange={(e) => setChipsChange(e.target.value)}
                placeholder="Enter amount"
              />
              <button onClick={handleChipsChange}>Update Chips</button>
            </div>
          )}
          <div className="lottery-control">
            <h3>Lottery Control</h3>
            <p>Current Jackpot: {lotteryPool} {CURRENCY_NAME}</p>
            <button onClick={() => adjustLotteryPool(1000)}>Increase Jackpot</button>
            <button onClick={() => adjustLotteryPool(-1000)}>Decrease Jackpot</button>
            <button onClick={conductLottery}>Force Lottery Draw Now</button>
          </div>
          <div className="poll-control">
            <h3>Update Game Options</h3>
            <input
              type="text"
              placeholder="Enter options, separated by commas"
              onChange={(e) => updatePollOptions(e.target.value.split(',').map(o => o.trim()))}
            />
          </div>
          <div className="poll-results">
            <h3>Current Game Popularity</h3>
            {pollOptions.map(option => (
              <div key={option}>
                {option}: {Object.values(votes).filter(v => v === option).length}
              </div>
            ))}
          </div>
          <div className="jackpot-control">
            <h3>Jackpot Control</h3>
            <p>Current Jackpot: {jackpot} {CURRENCY_NAME}</p>
            <input
              type="number"
              value={jackpot}
              onChange={(e) => updateJackpot(Number(e.target.value))}
              placeholder="Enter new jackpot amount"
            />
            <button onClick={awardJackpot}>Award Jackpot</button>
          </div>
        </div>
      ) : currentPlayer ? (
        <div className="player-view">
          <div className="player-stats">
            <h2>Your Stats</h2>
            <p>Current Balance: {currentPlayer.chips} {CURRENCY_NAME}</p>
            <p>Your Rank: {getPlayerRank(currentPlayer.id)} / {players.length}</p>
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
                    disabled={Date.now() - (currentPlayer.lastPlayedGames[game.id] || 0) < game.cooldown}
                  >
                    {game.name}
                  </button>
                  {Date.now() - (currentPlayer.lastPlayedGames[game.id] || 0) < game.cooldown && 
                    <span>Cooldown: {Math.ceil((game.cooldown - (Date.now() - (currentPlayer.lastPlayedGames[game.id] || 0))) / 1000)}s</span>
                  }
                </div>
              ))}
              {selectedGame && (
                <div>
                  <input
                    type="number"
                    value={chipsAtStake}
                    onChange={(e) => setChipsAtStake(e.target.value)}
                    placeholder={`Chips at stake (${selectedGame.minBet}-${selectedGame.maxBet})`}
                  />
                  <button onClick={() => placeBet(selectedGame.id)}>Play {selectedGame.name}</button>
                </div>
              )}
              <button onClick={() => setShowGameModal(false)}>Close</button>
            </div>
          )}

          <div className="bets">
            <h2>Bet History</h2>
            <ul>
              {currentPlayer.bets.slice(-10).reverse().map((bet, index) => (
                <li key={index}>
                  {bet.chips > 0 ? `+${bet.chips}` : bet.chips} {CURRENCY_NAME} 
                  {bet.reason ? ` (${bet.reason})` : ''} 
                  on {new Date(bet.date).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>

          <div className="achievements">
            <h2>Achievements</h2>
            <ul>
              {achievements.map(achievement => (
                <li key={achievement.id} className={currentPlayer.achievements.includes(achievement.id) ? 'achieved' : ''}>
                  {achievement.name}: {achievement.description}
                </li>
              ))}
            </ul>
          </div>

          <div className="lottery-info">
            <h2>Lottery</h2>
            <p>Current Jackpot: {lotteryPool} {CURRENCY_NAME}</p>
            <p>Next Draw: {new Date(nextLottery).toLocaleString()}</p>
            <p>Your Tickets: {lotteryTickets.filter(ticket => ticket.playerId === currentPlayer.id).length}</p>
            {lotteryTickets.filter(ticket => ticket.playerId === currentPlayer.id).length > 0 && (
              <button onClick={() => setShowTicketsModal(true)}>View Tickets</button>
            )}
          </div>

          {showTicketsModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Your Lottery Tickets</h3>
                <ul>
                  {lotteryTickets
                    .filter(ticket => ticket.playerId === currentPlayer.id)
                    .map((ticket, index) => (
                      <li key={index}>{ticket.number}</li>
                    ))}
                </ul>
                <button onClick={() => setShowTicketsModal(false)}>Close</button>
              </div>
            </div>
          )}

          <div className="voting-form">
            <h3>Vote for Next Week's Featured Game</h3>
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
            <h2>Casino Leaderboard</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={players.sort((a, b) => b.chips - a.chips).slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="chips" fill="#8884d8" name={CURRENCY_NAME} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div>Error: No player data available</div>
      )}
    </div>
  );
};

export default Dashboard;