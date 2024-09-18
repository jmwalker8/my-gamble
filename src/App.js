import React from 'react';
import './App.css';
import Dashboard from './dashboard'; // Corrected import statement

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Stats Club</h1>
      </header>
      <main>
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
