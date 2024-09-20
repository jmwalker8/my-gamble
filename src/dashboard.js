import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
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
import { getFirestore } from 'firebase/firestore';;

// INITIAL DATA

const STARTING_POINTS = 100;
const QUIZ_TIME = new Date().setHours(20, 0, 0, 0); // 8:00 PM today
const BADGE_FORMAT = 'LLNNNN'; // L: Letter, N: Number
const CURRENCY_NAME = 'Points';
const firestore = getFirestore();

// Parse initial members from environment variable
const initialMembers = JSON.parse(process.env.REACT_APP_INITIAL_MEMBERS || '[]').map(member => ({
  ...member,
  points: STARTING_POINTS,
  activities: [],
  achievements: [],
  lastPlayedGames: {}
}));

const adminCredentials = JSON.parse(process.env.REACT_APP_ADMIN_CREDENTIALS || '{}');

const achievements = [
  { id: 1, name: 'High Achiever', description: 'Reach 2000 points', threshold: 2000 },
  { id: 2, name: 'Consistent Learner', description: 'Complete 5 activities in a row', threshold: 5 },
];

const games = [
  { id: 'mathquiz', name: 'Poker', cooldown: 5 * 60 * 1000, minPoints: 10, maxPoints: 100 },
  { id: 'spellingbee', name: 'Sports Betting', cooldown: 10 * 60 * 1000, minPoints: 20, maxPoints: 200 },
  { id: 'sciencetrivia', name: 'Card Games', cooldown: 15 * 60 * 1000, minPoints: 50, maxPoints: 500 },
];

const Dashboard = () => {
  const [members, setMembers] = useState(() => {
    const savedMembers = localStorage.getItem('statsClubMembers');
    if (savedMembers) {
      return JSON.parse(savedMembers);
    }
    return initialMembers;
  });
  
  const [quizPool, setQuizPool] = useState(() => {
    const savedPool = localStorage.getItem('statsClubQuizPool');
    return savedPool ? Number(savedPool) : 1000;
  });

  const [quizBadges, setQuizBadges] = useState(() => {
    const savedBadges = localStorage.getItem('statsClubQuizBadges');
    return savedBadges ? JSON.parse(savedBadges) : [];
  });

  const [nextQuiz, setNextQuiz] = useState(() => {
    const savedQuizTime = localStorage.getItem('statsClubNextQuiz');
    return savedQuizTime ? Number(savedQuizTime) : QUIZ_TIME;
  });

  const [votes, setVotes] = useState(() => {
    const savedVotes = localStorage.getItem('statsClubVotes');
    return savedVotes ? JSON.parse(savedVotes) : {};
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [pointsChange, setPointsChange] = useState('');
  const [gameOutcome, setGameOutcome] = useState('');
  const [currentMember, setCurrentMember] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [pointsAtStake, setPointsAtStake] = useState('');
  const [pollOptions, setPollOptions] = useState(['Math Quiz', 'Spelling Bee', 'Science Trivia']);
  const [userVote, setUserVote] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [firstPlacePrize, setFirstPlacePrize] = useState(1000);
  const [nextPollReset, setNextPollReset] = useState(() => {
    const savedResetTime = localStorage.getItem('statsClubNextPollReset');
    return savedResetTime ? Number(savedResetTime) : new Date().setHours(24, 0, 0, 0); // Midnight tonight
  });

  useEffect(() => {
    if (db && members.length === 0) {
      syncUsersWithFirebase();
    }
  }, [db, members]);

  useEffect(() => {
    // Check for existing session on component mount
    const sessionData = sessionStorage.getItem('statsClubSession');
    if (sessionData) {
      const { isAdmin, currentMember } = JSON.parse(sessionData);
      setIsAdmin(isAdmin);
      setCurrentMember(currentMember);
      setIsLoggedIn(true);
    }

    const quizTimer = setInterval(() => {
      if (Date.now() >= nextQuiz) {
        conductQuiz();
      }
    }, 60000); // Check every minute

    const pollResetTimer = setInterval(() => {
      if (Date.now() >= nextPollReset) {
        resetPoll();
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(quizTimer);
      clearInterval(pollResetTimer);
    };
  }, [nextQuiz, nextPollReset]);

  useEffect(() => {
    syncUsersWithFirebase();
  }, []);

  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in
        if (user.email === 'jmicaw318@gmail.com') {
          setIsAdmin(true);
          setIsLoggedIn(true);
          setCurrentMember(null);
        } else {
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentMember({id: user.uid, ...userData});
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
        setCurrentMember(null);
      }
    });
  
    return () => unsubscribe();
  }, [votes]);

  useEffect(() => {
    localStorage.setItem('statsClubMembers', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('statsClubQuizPool', quizPool.toString());
  }, [quizPool]);

  useEffect(() => {
    localStorage.setItem('statsClubQuizBadges', JSON.stringify(quizBadges));
  }, [quizBadges]);

  useEffect(() => {
    localStorage.setItem('statsClubNextQuiz', nextQuiz.toString());
  }, [nextQuiz]);

  useEffect(() => {
    localStorage.setItem('statsClubVotes', JSON.stringify(votes));
  }, [votes]);

  useEffect(() => {
    localStorage.setItem('statsClubNextPollReset', nextPollReset.toString());
  }, [nextPollReset]);

  const syncUsersWithFirebase = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const userSnapshot = await getDocs(usersCollection);
      const firebaseUsers = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      setMembers(firebaseUsers);
  
      if (auth.currentUser) {
        const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (currentUserDoc.exists()) {
          setCurrentMember({id: auth.currentUser.uid, ...currentUserDoc.data()});
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Error syncing users with Firebase:', error);
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
        setCurrentMember(null); // Admin is not a regular member
        return; // Exit the function early for admin
      }
      
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentMember({id: user.uid, ...userData});
        setIsLoggedIn(true);
        setUserVote(votes[user.uid] || '');
        setVoteSubmitted(!!votes[user.uid]);
      } else {
        // If user auth exists but no Firestore document, create one
        const newMember = {
          id: user.uid,
          name: user.displayName || 'New Member',
          email: user.email,
          points: STARTING_POINTS,
          activities: [],
          achievements: [],
          lastPlayedGames: {}
        };
        await setDoc(doc(firestore, 'users', user.uid), newMember);
        setCurrentMember(newMember);
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

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setPointsChange('');
  };

  const handlePointsChange = () => {
    if (selectedMember && pointsChange) {
      updateMemberPoints(selectedMember.id, parseInt(pointsChange), "Admin adjustment");
      setSelectedMember(null);
      setPointsChange('');
    }
  };

  const generateBadge = () => {
    let badge = '';
    for (let char of BADGE_FORMAT) {
      if (char === 'L') {
        badge += String.fromCharCode(65 + Math.floor(Math.random() * 26));
      } else {
        badge += Math.floor(Math.random() * 10);
      }
    }
    return badge;
  };

  const updateMemberPoints = (memberId, amount, reason) => {
    setMembers(prevMembers => prevMembers.map(member => 
      member.id === memberId 
        ? { 
            ...member, 
            points: Math.max(0, Number(member.points) + Number(amount)),
            activities: [...member.activities, { 
              points: Number(amount), 
              date: new Date().toISOString(),
              reason: reason
            }]
          }
        : member
    ));
    if (currentMember && memberId === currentMember.id) {
      setCurrentMember(prevMember => ({
        ...prevMember,
        points: Math.max(0, Number(prevMember.points) + Number(amount)),
        activities: [...prevMember.activities, { 
          points: Number(amount), 
          date: new Date().toISOString(),
          reason: reason
        }]
      }));
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
  
    if (currentMember.points < game.minPoints) {
      setGameOutcome(`You don't have enough ${CURRENCY_NAME} to play. Minimum points required: ${game.minPoints}.`);
      return;
    }
  
    if (currentMember.points < parseInt(pointsAtStake) || parseInt(pointsAtStake) < game.minPoints || parseInt(pointsAtStake) > game.maxPoints) {
      setGameOutcome(`Invalid points amount. Min: ${game.minPoints}, Max: ${game.maxPoints}`);
      return;
    }

    let pointsEarned = 0;
    switch (gameId) {
      case 'mathquiz':
        pointsEarned = Math.random() > 0.5 ? parseInt(pointsAtStake) : Math.floor(parseInt(pointsAtStake) / 2);
        break;
      case 'spellingbee':
        pointsEarned = Math.random() > 0.33 ? parseInt(pointsAtStake) : Math.floor(parseInt(pointsAtStake) / 3);
        break;
      case 'sciencetrivia':
        pointsEarned = Math.random() > 0.2 ? parseInt(pointsAtStake) * 2 : Math.floor(parseInt(pointsAtStake) / 4);
        break;
      default:
        break;
    }

    updateMemberPoints(currentMember.id, pointsEarned, `${games.find(g => g.id === gameId).name} game`);
    setGameOutcome(`You earned ${pointsEarned} ${CURRENCY_NAME}!`);
    
    setCurrentMember(prevMember => ({
      ...prevMember,
      lastPlayedGames: {
        ...prevMember.lastPlayedGames,
        [gameId]: Date.now()
      }
    }));

    setShowGameModal(false);
  };

  const earnQuizBadge = () => {
    if (currentMember.points >= 100) {
      updateMemberPoints(currentMember.id, -100, "Quiz badge earned");
      const newBadge = { memberId: currentMember.id, number: generateBadge() };
      setQuizBadges(prevBadges => [...prevBadges, newBadge]);
      setQuizPool(prevPool => prevPool + 50); // 50% of badge cost goes to pool
    } else {
      setGameOutcome(`Not enough ${CURRENCY_NAME} to earn a quiz badge.`);
    }
  };

  const conductQuiz = () => {
    const winningNumber = generateBadge();
    const winningBadge = quizBadges.find(badge => badge.number === winningNumber);

    if (winningBadge) {
      const winner = members.find(member => member.id === winningBadge.memberId);
      updateMemberPoints(winner.id, quizPool, "Quiz win");
      setGameOutcome(`${winner.name} won the quiz prize of ${quizPool} ${CURRENCY_NAME}!`);
      setQuizPool(1000); // Reset pool
    } else {
      setQuizPool(prevPool => prevPool * 1.5); // Increase pool if no winner
      setGameOutcome("No winner this time. Quiz prize pool increased!");
    }

    setQuizBadges([]);
    // Set next quiz time to 8:00 PM tomorrow
    setNextQuiz(new Date(new Date().setHours(20, 0, 0, 0) + 24 * 60 * 60 * 1000).getTime());
  };

  const checkAchievements = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      achievements.forEach(achievement => {
        if (!member.achievements.includes(achievement.id)) {
          if (achievement.id === 1 && member.points >= achievement.threshold) {
            addAchievement(memberId, achievement.id);
          } else if (achievement.id === 2 && member.activities.slice(-5).every(t => t.points > 0)) {
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
        points: STARTING_POINTS,
        activities: [],
        achievements: [],
        lastPlayedGames: {}
      };
  
      await setDoc(doc(db, 'users', user.uid), newMember);
  
      setCurrentMember(newMember);
      setIsLoggedIn(true);
      setShowSignUp(false);
  
      alert('Account created successfully! Welcome to the Stats Club!');
  
      return { success: true };
    } catch (error) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message };
    }
  };
  
  

  // Admin functions
  const resetMemberPoints = (memberId) => {
    const member = members.find(m => m.id === memberId);
    updateMemberPoints(memberId, STARTING_POINTS - member.points, "Admin reset");
  };

  const deleteMember = async (memberId) => {
    try {
      await deleteDoc(doc(firestore, 'users', memberId));
  
      setMembers(prevMembers => prevMembers.filter(member => member.id !== memberId));
  
      if (currentMember && currentMember.id === memberId) {
        handleLogout();
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete member. Please try again.');
    }
  };

  const adjustQuizPool = (amount) => {
    setQuizPool(prevPool => Math.max(1000, prevPool + amount));
  };

  const addMorePoints = (memberId, amount = STARTING_POINTS) => {
    updateMemberPoints(memberId, amount, "Admin bonus");
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
    const sortedMembers = [...members].sort((a, b) => b.points - a.points);
    return sortedMembers.findIndex(member => member.id === memberId) + 1;
  };

  const awardFirstPlacePrize = () => {
    const sortedMembers = [...members].sort((a, b) => b.points - a.points);
    if (sortedMembers.length > 0) {
      updateMemberPoints(sortedMembers[0].id, firstPlacePrize, "First place prize");
    }
  };

  if (showSignUp) {
    return <SignUp onSignUp={handleSignUp} onCancel={() => setShowSignUp(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h2>Login to Stats Club</h2>
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
      <h1 className="dashboard-title">Stats Club Dashboard</h1>
      <button onClick={handleLogout} className="logout-button">Logout</button>

      {isAdmin ? (
        <div className="admin-view">
          <h2>Admin Controls</h2>
          <table className="member-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.points} {CURRENCY_NAME}</td>
                  <td>
                    <button onClick={() => handleSelectMember(member)}>Select</button>
                    <button onClick={() => resetMemberPoints(member.id)}>Reset Points</button>
                    <button onClick={() => deleteMember(member.id)}>Delete</button>
                    <button onClick={() => addMorePoints(member.id)}>Add {STARTING_POINTS} {CURRENCY_NAME}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedMember && (
            <div className="points-update">
              <input
                type="number"
                value={pointsChange}
                onChange={(e) => setPointsChange(e.target.value)}
                placeholder="Enter amount"
              />
              <button onClick={handlePointsChange}>Update Points</button>
            </div>
          )}
          <div className="quiz-control">
            <h3>Quiz Control</h3>
            <p>Current Pool: {quizPool} {CURRENCY_NAME}</p>
            <button onClick={() => adjustQuizPool(1000)}>Increase Pool</button>
            <button onClick={() => adjustQuizPool(-1000)}>Decrease Pool</button>
            <button onClick={conductQuiz}>Force Quiz Now</button>
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
            <p>Current Balance: {currentMember.points} {CURRENCY_NAME}</p>
            <p>Your Rank: {getMemberRank(currentMember.id)} / {members.length}</p>
            <div className="action-buttons">
              <button onClick={() => setShowGameModal(true)} className="game-button">Play Games</button>
              <button onClick={earnQuizBadge} className="quiz-button">Purchase Lottery Ticket (100 {CURRENCY_NAME})</button>
            </div>
            {gameOutcome && <p>{gameOutcome}</p>}
          </div>

          {showGameModal && (
            <div className="game-modal">
              <h3>Select a Learning Game</h3>
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
                    value={pointsAtStake}
                    onChange={(e) => setPointsAtStake(e.target.value)}
                    placeholder={`Points at stake (${selectedGame.minPoints}-${selectedGame.maxPoints})`}
                  />
                  <button onClick={() => playGame(selectedGame.id)}>Play {selectedGame.name}</button>
                </div>
              )}
              <button onClick={() => setShowGameModal(false)}>Close</button>
            </div>
          )}

          <div className="activities">
            <h2>Activity History</h2>
            <ul>
              {currentMember.activities.slice(-10).reverse().map((activity, index) => (
                <li key={index}>
                  {activity.points > 0 ? `+${activity.points}` : activity.points} {CURRENCY_NAME} 
                  {activity.reason ? ` (${activity.reason})` : ''} 
                  on {new Date(activity.date).toLocaleString()}
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

          <div className="quiz-info">
            <h2>Weekly Lottery</h2>
            <p>Current Prize Pool: {quizPool} {CURRENCY_NAME}</p>
            <p>Next Draw: {new Date(nextQuiz).toLocaleString()}</p>
            <p>Your Badges: {quizBadges.filter(badge => badge.memberId === currentMember.id).length}</p>
            {quizBadges.filter(badge => badge.memberId === currentMember.id).length > 0 && (
              <button onClick={() => setShowBadgesModal(true)}>View Badges</button>
            )}
          </div>

          {showBadgesModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Your Quiz Badges</h3>
                <ul>
                  {quizBadges
                    .filter(badge => badge.memberId === currentMember.id)
                    .map((badge, index) => (
                      <li key={index}>{badge.number}</li>
                    ))}
                </ul>
                <button onClick={() => setShowBadgesModal(false)}>Close</button>
              </div>
            </div>
          )}

          <div className="voting-form">
            <h3>Vote for Next Week's Learning Game</h3>
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
              <BarChart data={members.sort((a, b) => b.points - a.points)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="points" fill="#8884d8" name={CURRENCY_NAME} />
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