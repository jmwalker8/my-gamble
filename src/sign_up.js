import React, { useState } from 'react';
// Remove unused imports
// import { createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
// import { auth } from './firebase.js';

const SignUp = ({ onSignUp, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (name && email && password) {
      try {
        const result = await onSignUp({ name, email, password });
        if (result.success) {
          // Sign-up was successful, no need to do anything here
          // as the Dashboard component will handle the redirect
        } else {
          setError(result.error || 'An error occurred during sign up.');
        }
      } catch (error) {
        setError(error.message || 'An error occurred during sign up.');
      }
    } else {
      setError('Please fill in all fields');
    }
    setIsLoading(false);
  };

  return (
    <div className="signup-container">
      <h2>Create an Account</h2>
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
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing Up...' : 'Sign Up'}
        </button>
        <button type="button" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default SignUp;