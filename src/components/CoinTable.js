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

  if (coinsData.length === 0) {
    return (
      <table id="coins-table">
        <tbody>
          <tr>
            <td colSpan="12" className="loading">No coins match your criteria</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table id="coins-table">
      <thead>
        <tr>
          <th onClick={() => handleSort('name')} data-sort="name">
            Coin {getSortIndicator('name')}
          </th>
          <th onClick={() => handleSort('marketCap')} data-sort="marketCap">
            Market Cap (SOL) {getSortIndicator('marketCap')}
          </th>
          <th onClick={() => handleSort('liquidity')} data-sort="liquidity">
            Liquidity (SOL) {getSortIndicator('liquidity')}
          </th>
          <th onClick={() => handleSort('price')} data-sort="price">
            Price {getSortIndicator('price')}
          </th>
          
          <th onClick={() => handleSort('volume15s')} data-sort="volume15s">
            Volume (15s) {getSortIndicator('volume15s')}
          </th>
          <th onClick={() => handleSort('volume30s')} data-sort="volume30s">
            Volume (30s) {getSortIndicator('volume30s')}
          </th>
          
          <th onClick={() => handleSort('volume1m')} data-sort="volume1m">
            Volume (1m) {getSortIndicator('volume1m')}
          </th>
          <th onClick={() => handleSort('volume5m')} data-sort="volume5m">
            Volume (5m) {getSortIndicator('volume5m')}
          </th>
          
          <th onClick={() => handleSort('momentum')} data-sort="momentum">
            Momentum % {getSortIndicator('momentum')}
          </th>
          <th onClick={() => handleSort('velocity')} data-sort="velocity">
            Velocity {getSortIndicator('velocity')}
          </th>
          <th onClick={() => handleSort('buySellRatio')} data-sort="buySellRatio">
            Buy/Sell Ratio {getSortIndicator('buySellRatio')}
          </th>
          <th onClick={() => handleSort('signal')} data-sort="signal">
            Signal {getSortIndicator('signal')}
          </th>
        </tr>
      </thead>
      <tbody id="coins-data">
        {coinsData.map((coin, index) => {
          const signalClass = `signal-${coin.signal}`;
          const momentumClass = coin.momentum >= 0 ? 'positive' : 'negative';
          const [buys, sells] = coin.buySellRatio.split(':').map(Number);
          const ratioClass = buys >= sells ? 'positive' : 'negative';
          
          return (
            <tr key={index} className={signalClass}>
              <td>{coin.name} ({coin.symbol})</td>
              <td>{coin.marketCap}</td>
              <td>{coin.liquidity}</td>
              <td>
                {coin.price !== null && coin.price !== undefined
                  ? Number(coin.price).toFixed(10)
                  : '0.00000000'}
              </td>
              
              <td>${coin.transactions15s || 0}</td>
              <td>${coin.transactions30s || 0}</td>
              
              <td>${coin.transactions1m || 0}</td>
              <td>${coin.transactions5m || 0}</td>
              
              <td className={momentumClass}>{coin.momentum.toFixed(2)}%</td>
              <td>{coin.velocity}/min</td>
              <td className={ratioClass}>{coin.buySellRatio}</td>
              <td>
                <span className={`signal-indicator ${coin.signal}`}></span> 
                {coin.signal.toUpperCase()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default CoinTable;