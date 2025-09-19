import React from 'react';

const Stats = ({ trackedCoins, greenSignals, redSignals, lastSignal }) => {
  return (
    <div className="stats">
      <div className="stat-card">
        <h3>Tracked Coins</h3>
        <div id="tracked-coins" className="stat-value">{trackedCoins}</div>
      </div>
      
      <div className="stat-card">
        <h3>Green Signals</h3>
        <div id="green-signals" className="stat-value">{greenSignals}</div>
      </div>
      
      <div className="stat-card">
        <h3>Red Signals</h3>
        <div id="red-signals" className="stat-value">{redSignals}</div>
      </div>
      
      <div className="stat-card">
        <h3>Last Signal</h3>
        <div id="last-signal" className="stat-value">{lastSignal}</div>
      </div>
    </div>
  );
};

export default Stats;