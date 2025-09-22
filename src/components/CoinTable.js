import React from 'react';
import { Copy, Pin, PinOff} from "lucide-react";

const CoinTable = ({ 
  coinsData, 
  sortField, 
  sortDirection, 
  onSort, 
  onCopyAddress, 
  onTogglePin 
}) => {
  const handleSort = (field) => {
    onSort(field);
  };

  const getSortIndicator = (field) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? ' ▴' : ' ▾';
    }
    return '';
  };

  const renderVolumeBars = (momentum) => {
    const ratio = momentum;
    const barCount = Math.min(5, Math.max(0, Math.floor(ratio)));

    let barColor = '#4caf50';
    if (ratio >= 10) barColor = '#f44336';
    else if (ratio >= 5) barColor = '#ff9800';
    else if (ratio >= 2) barColor = '#ffeb3b';

    return (
      <div className="volume-bars">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`volume-bar ${i < barCount ? 'active' : ''}`}
            style={{
              width: `${(i + 1) * 15}px`,
              backgroundColor: i < barCount ? barColor : '#eee'
            }}
          />
        ))}
        <span className="volume-ratio" style={{color: barColor}}>
          ({ratio.toFixed(2)}x)
        </span>
      </div>
    );
  };

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

  const renderStatus = (coin) => {
    const signal = coin.signal || "HOLD"; 

    let icon = '⏸';
    let className = 'hold';

    if (signal === "BUY") {
      icon = '🟢';
      className = 'buy';
    } else if (signal === "SELL") {
      icon = '🔴';
      className = 'sell';
    }

    return (
      <div className={`status ${className}`}>
        <span className="status-icon">{icon}</span>
        <span className="status-text">{signal}</span>
      </div>
    );
  };

  if (coinsData.length === 0) {
    return (
      <div>
        <table id="coins-table">
          <tbody>
            <tr>
              <td colSpan="9" className="loading">
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
            <th onClick={() => handleSort('name')}>Token {getSortIndicator('name')}</th>
            <th>Actions</th>
            <th onClick={() => handleSort('volume15s')}>Volume {getSortIndicator('volume15s')}</th>
            <th onClick={() => handleSort('momentum')}>Momentum {getSortIndicator('momentum')}</th>
            <th onClick={() => handleSort('buySellRatio')}>Buy/Sell {getSortIndicator('buySellRatio')}</th>
            <th onClick={() => handleSort('liquidity')}>Liquidity {getSortIndicator('liquidity')}</th>
            <th onClick={() => handleSort('liquidityChange')}>Change {getSortIndicator('liquidityChange')}</th>
            <th onClick={() => handleSort('signal')}>Status {getSortIndicator('signal')}</th>
          </tr>
        </thead>
        <tbody>
          {coinsData
              .sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return 0; // keep original order otherwise
              }).map(coin => (
            <tr key={coin.mint} className={coin.signal.toLowerCase()}>
              <td>
                {coin.name} ({coin.symbol}) 
                {coin.isPinned && <span className="pinned-label">📌 Pinned</span>}
                {coin.isTracked && <span className="tracked-label">🔍 Tracked</span>}
              </td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    onClick={() => onCopyAddress(coin.mint)}
                    title="Copy Address"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <Copy size={16} />
                  </button>

                  <button onClick={() => onTogglePin(coin.mint)} title={coin.isPinned ? "Unpin" : "Pin"}>
                    {coin.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                </div>
              </td>
              <td>{renderVolumeBars(coin.momentum)}</td>
              <td>{(coin.momentum ?? 0).toFixed(2)}x</td>
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