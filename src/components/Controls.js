import React, { useState } from 'react';

const Controls = ({ 
  minMarketCap, 
  maxMarketCap, 
  minLiquidity, 
  momentumThreshold, 
  velocityThreshold, 
  refreshInterval,
  onApplySettings 
}) => {
  const [settings, setSettings] = useState({
    minMarketCap: minMarketCap || 0,
    maxMarketCap: maxMarketCap || 100000,
    minLiquidity: minLiquidity || 1,
    momentumThreshold: momentumThreshold || 50,
    velocityThreshold: velocityThreshold || 2,
    refreshInterval: refreshInterval || 30
  });

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

  return (
    <div className="controls">
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
        <label htmlFor="momentum-threshold">Momentum % Threshold</label>
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
        <label htmlFor="refresh-interval">Refresh (sec)</label>
        <input 
          type="number" 
          id="refreshInterval" 
          value={settings.refreshInterval} 
          min="5"
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