import React, { useState } from 'react';

const Controls = ({ 
  minMarketCap, 
  maxMarketCap, 
  minLiquidity, 
  momentumThreshold, 
  velocityThreshold, 
  refreshInterval,
  maxCoinsToTrack,
  onApplySettings,
  onTrackToken
}) => {
  const [settings, setSettings] = useState({
    minMarketCap: minMarketCap || 0,
    maxMarketCap: maxMarketCap || 100000,
    minLiquidity: minLiquidity || 1,
    momentumThreshold: momentumThreshold || 50,
    velocityThreshold: velocityThreshold || 2,
    refreshInterval: refreshInterval || 3,
    maxCoinsToTrack: maxCoinsToTrack || 50
  });

  const [trackInput, setTrackInput] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleApply = () => {
    onApplySettings(settings);
  };

  const handleTrack = () => {
    if (trackInput.trim()) {
      onTrackToken(trackInput.trim());
      setTrackInput('');
    }
  };

  return (
    <div className="controls">
      {/* Settings */}
      <div className="control-group">
        <label htmlFor="min-market-cap">Min Market Cap ($)</label>
        <input 
          type="number" 
          id="minMarketCap" 
          value={settings.minMarketCap} 
          min="0"
          onChange={handleChange}
        />
      </div>
      <div className="control-group">
        <label htmlFor="max-market-cap">Max Market Cap ($)</label>
        <input 
          type="number" 
          id="maxMarketCap" 
          value={settings.maxMarketCap} 
          min="0"
          onChange={handleChange}
        />
      </div>
      <div className="control-group">
        <label htmlFor="min-liquidity">Min Liquidity ($)</label>
        <input 
          type="number" 
          id="minLiquidity" 
          value={settings.minLiquidity} 
          min="0"
          onChange={handleChange}
        />
      </div>
      <div className="control-group">
        <label htmlFor="momentum-threshold">Momentum Threshold</label>
        <input 
          type="number" 
          id="momentumThreshold" 
          value={settings.momentumThreshold} 
          min="0"
          onChange={handleChange}
        />
      </div>
      <div className="control-group">
        <label htmlFor="velocity-threshold">Velocity Spike Factor</label>
        <input 
          type="number" 
          id="velocityThreshold" 
          value={settings.velocityThreshold} 
          min="1" 
          step="0.1"
          onChange={handleChange}
        />
      </div>
      <div className="control-group">
        <label htmlFor="max-coins-to-track">Max Coins to Track</label>
        <input 
          type="number" 
          id="maxCoinsToTrack" 
          value={settings.maxCoinsToTrack} 
          min="1"
          onChange={handleChange}
        />
      </div>
      <div className="control-group" style={{justifyContent: 'flex-end'}}>
        <button onClick={handleApply}>Apply Settings</button>
      </div>
    </div>
  );
};

export default Controls;