import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { auth } from './firebase.js';

const SignUp = ({ onSignUp, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear any previous errors
    try {
      await onSignUp({ name, email, password });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setError('Email already in use. Please use a different email or try logging in.');
      } else {
        setError('An error occurred during sign up. Please try again.');
      }
    }
  };

  return (
    <div className="signup-container">
      <h2>Create Account</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign Up</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default SignUp;