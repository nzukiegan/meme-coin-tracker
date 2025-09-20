import React from 'react';

const CoinTable = ({ coinsData, sortField, sortDirection, onSort }) => {
  const handleSort = (field) => {
    onSort(field);
  };

  const getSortIndicator = (field) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? ' ▴' : ' ▾';
    }
    return '';
  };

  // Function to render volume momentum bars with different colors
const renderVolumeBars = (volume15s, volume5m) => {
  const avgVolume5m = volume5m / 300; // Convert 5m volume to per second
  const ratio = avgVolume5m > 0 ? volume15s / avgVolume5m : 0;
  const barCount = Math.min(5, Math.max(1, Math.floor(ratio)));
  
  let barColor = '#4caf50';
  if (ratio >= 5) barColor = '#f44336';
  else if (ratio >= 3) barColor = '#ff9800';
  else if (ratio >= 2) barColor = '#ffeb3b';
  
  return (
    <div className="volume-bars">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className={`volume-bar ${i < barCount ? 'active' : ''}`}
          style={{
            width: `${(i+1)*15}px`,
            backgroundColor: i < barCount ? barColor : '#eee'
          }}
        ></div>
      ))}
      <span className="volume-ratio" style={{color: barColor}}>
        ({ratio.toFixed(1)}x)
      </span>
    </div>
  );
};


  // Function to render buy/sell ratio bars
  const renderBuySellBars = (buys, sells) => {
    const total = buys + sells;
    const buyPercentage = total > 0 ? (buys / total) * 100 : 0;
    
    return (
      <div className="buy-sell-bars">
        <div className="buy-bar" style={{width: `${buyPercentage}%`}}></div>
        <div className="sell-bar" style={{width: `${100 - buyPercentage}%`}}></div>
        <span className="ratio-text">{buys}:{sells}</span>
      </div>
    );
  };

  // Function to render liquidity change indicator
  const renderLiquidityChange = (change) => {
    const isPositive = change >= 0;
    const barWidth = Math.min(100, Math.abs(change));
    
    return (
      <div className="liquidity-change">
        <div 
          className={`liquidity-bar ${isPositive ? 'positive' : 'negative'}`}
          style={{width: `${barWidth}%`}}
        ></div>
        <span className="change-text">{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
      </div>
    );
  };

  // Function to determine status with icon
  const renderStatus = (coin) => {
    const momentum = (coin.volume15s * 4) / (coin.volume5m / 60); // Normalized momentum
    const buySellRatio = coin.sells5m > 0 ? coin.buys5m / coin.sells5m : coin.buys5m;
    
    let status = 'HOLD';
    let icon = '⏸';
    let className = 'hold';
    
    // BUY Conditions
    if (momentum >= 3 && buySellRatio >= 3 && coin.liquidityChange >= 0) {
      status = 'BUY';
      icon = '🟢';
      className = 'buy';
    }

    // SELL Conditions
    else if (momentum <= 1 && buySellRatio <= 0.8 && coin.liquidityChange < 0) {
      status = 'SELL';
      icon = '🔴';
      className = 'sell';
    }
    
    return (
      <div className={`status ${className}`}>
        <span className="status-icon">{icon}</span>
        <span className="status-text">{status}</span>
      </div>
    );
  };

  if (coinsData.length === 0) {
    return (
      <div>
        <table id="coins-table">
          <tbody>
            <tr>
              <td colSpan="7" className="loading">
                <div className="spinner-container" role="status" aria-live="polite" aria-label="Loading coins">
                  <div className="spinner" />
                  <div className="loading-text">Loading coins…</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <table id="coins-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')}>
              Token Name {getSortIndicator('name')}
            </th>
            <th onClick={() => handleSort('volume15s')}>
              Volume {getSortIndicator('volume15s')}
            </th>
            <th onClick={() => handleSort('momentum')}>
              Momentum {getSortIndicator('momentum')}
            </th>
            <th onClick={() => handleSort('buySellRatio')}>
              Buy/Sell Ratio {getSortIndicator('buySellRatio')}
            </th>
            <th onClick={() => handleSort('liquidity')}>
              Liquidity {getSortIndicator('liquidity')}
            </th>
            <th onClick={() => handleSort('liquidityChange')}>
              Change {getSortIndicator('liquidityChange')}
            </th>
            <th onClick={() => handleSort('signal')}>
              Status {getSortIndicator('signal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {coinsData.map(coin => (
            <tr key={coin.mint} className={coin.signal.toLowerCase()}>
              <td>{coin.name} ({coin.symbol})</td>
              <td>{renderVolumeBars(coin.volume15s, coin.volume5m)}</td>
              <td>{(coin.volume15s * 4 / (coin.volume5m / 60)).toFixed(1)}x</td>
              <td>{renderBuySellBars(coin.buys5m, coin.sells5m)}</td>
              <td>{coin.liquidity.toFixed(2)} SOL</td>
              <td>{renderLiquidityChange(coin.liquidityChange || 0)}</td>
              <td>{renderStatus(coin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CoinTable;