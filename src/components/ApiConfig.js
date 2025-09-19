import React, { useState } from 'react';

const ApiConfig = ({ onSaveApiKey }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (apiKey.trim()) {
      onSaveApiKey(apiKey);
      alert('API key saved successfully!');
    } else {
      alert('Please enter a valid API key');
    }
  };

  return (
    <div className="api-key-section">
      <h3>API Configuration</h3>
      <p>You need a Helius API key to use this dashboard. Get one at <a href="https://dev.helius.xyz" target="_blank" rel="noopener noreferrer">dev.helius.xyz</a></p>
      <div className="control-group">
        <label htmlFor="helius-api-key">Helius API Key</label>
        <input 
          type="text" 
          id="helius-api-key" 
          placeholder="Enter your Helius API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>
      <button onClick={handleSave}>Save API Key</button>
    </div>
  );
};

export default ApiConfig;