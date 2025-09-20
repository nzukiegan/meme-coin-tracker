import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Controls from './components/Controls';
import Stats from './components/Stats';
import CoinTable from './components/CoinTable';
import { isBuyTransaction, getTransactionAmount, processData } from './utils/helpers';
import './App.css';

function App() {
  const [config, setConfig] = useState({
    minMarketCap: 0,
    maxMarketCap: 100000,
    minLiquidity: 1,
    momentumThreshold: 50,
    velocityThreshold: 2,
    refreshInterval: 3000, // Changed from 30 to 3 seconds
    heliusAPI: 'https://api.helius.xyz/v0/',
    maxCoinsToTrack: 20 // Added max coins to track
  });
  
  const [coinsData, setCoinsData] = useState([]);
  const [trackedCoins, setTrackedCoins] = useState({});
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [alerts, setAlerts] = useState([])
  const [heliusAPIKey, setHeliusAPIKey] = useState('');
  const [lastUpdated, setLastUpdated] = useState('-');
  const [isAPIKeyLoaded, setIsAPIKeyLoaded] = useState(false);
  const [stats, setStats] = useState({
    trackedCoins: 0,
    greenSignals: 0,
    redSignals: 0,
    lastSignal: '-'
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const preMigrationTokens = useRef({});
  const ws = useRef(null);
  const refreshIntervalId = useRef(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    const savedKey = process.env.REACT_APP_HELIUS_API_KEY
    if (savedKey) {
      setHeliusAPIKey(savedKey);
      setIsAPIKeyLoaded(true);
    }
    
    return () => {
      if (refreshIntervalId.current) {
        clearInterval(refreshIntervalId.current);
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    coinsData.forEach(coin => {
      if (coin.signal === 'BUY') {
        // Check if we already alerted for this coin recently
        const alertExists = alerts.find(a => a.mint === coin.mint && a.type === 'BUY');
        if (!alertExists) {
          const newAlert = {
            id: Date.now(),
            type: 'BUY',
            message: `BUY signal for ${coin.name} - Hold time: ${calculateHoldTime(
              coin.momentum,
              coin.sells5m > 0 ? coin.buys5m / coin.sells5m : coin.buys5m,
              coin.liquidityChange || 0
            )}`,
            mint: coin.mint
          };
          setAlerts(prev => [...prev, newAlert]);
          
          // Auto remove alert after 10 seconds
          setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
          }, 10000);
        }
      } else if (coin.signal === 'SELL') {
        const alertExists = alerts.find(a => a.mint === coin.mint && a.type === 'SELL');
        if (!alertExists) {
          const newAlert = {
            id: Date.now(),
            type: 'SELL',
            message: `SELL signal for ${coin.name} - Exit immediately`,
            mint: coin.mint
          };
          setAlerts(prev => [...prev, newAlert]);
          
          setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
          }, 10000);
        }
      }
    });
  }, [coinsData]);

  // Add this function to calculate hold time
  const calculateHoldTime = (momentumScore, buySellRatio, liquidityChange) => {
    if (momentumScore >= 4 && buySellRatio >= 4 && liquidityChange >= 20) {
      return "15-30 minutes";
    } else if (momentumScore >= 3 && buySellRatio >= 3 && liquidityChange >= 10) {
      return "5-15 minutes";
    } else if (momentumScore <= 0.7 && buySellRatio <= 0.8 && liquidityChange < -10) {
      return "Exit immediately";
    } else if (momentumScore <= 1 && buySellRatio <= 1 && liquidityChange < -5) {
      return "Within 1 minute";
    } else {
      return "Monitor closely";
    }
  };

  // Add this component to render alerts
  const AlertContainer = ({ alerts }) => {
    return (
      <div className="alert-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert ${alert.type.toLowerCase()}`}>
            {alert.message}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (isAPIKeyLoaded) {
      initPumpPortalWS();
      startPeriodicUpdate();
    }
  }, [isAPIKeyLoaded])

  const initPumpPortalWS = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket('wss://pumpportal.fun/api/data');

    ws.current.onopen = () => {
      console.log('Connected to PumpPortal WebSocket');
      // wait 3 seconds before sending
      setTimeout(() => {
        ws.current.send(JSON.stringify({ method: 'subscribeNewToken' }));
        ws.current.send(JSON.stringify({ method: 'subscribeMigration' }));
      }, 3000);
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.txType === 'create') {
        if (msg.name && msg.symbol && msg.mint) {
          const price = msg.vSolInBondingCurve / msg.vTokensInBondingCurve;

          preMigrationTokens.current[msg.mint] = {
            name: msg.name,
            symbol: msg.symbol,
            mint: msg.mint,
            is_pre_migration: true,
            marketCap: msg.marketCapSol,
            liquidity: msg.vSolInBondingCurve,
            price,
            processed: false
          };
        }
      }

      if (msg.txType === 'migrate') {
        if (preMigrationTokens.current[msg.mint]) {
          preMigrationTokens.current[msg.mint].is_pre_migration = false;
          // Remove from tracked coins if it was being tracked
          setTrackedCoins(prev => {
            const newTracked = {...prev};
            delete newTracked[msg.mint];
            return newTracked;
          });
        }
      }
    };

    ws.current.onerror = (err) => console.error('WebSocket error:', err);
    ws.current.onclose = () => console.log('PumpPortal WebSocket closed');
  };

  const handleApplySettings = (settings) => {
    const newConfig = {
      ...config,
      minMarketCap: parseInt(settings.minMarketCap) || 0,
      maxMarketCap: parseInt(settings.maxMarketCap) || 100000,
      minLiquidity: parseInt(settings.minLiquidity) || 1000,
      momentumThreshold: parseInt(settings.momentumThreshold) || 50,
      velocityThreshold: parseFloat(settings.velocityThreshold) || 2,
      refreshInterval: (parseInt(settings.refreshInterval) || 3) * 1000, // Changed to 3 seconds
      maxCoinsToTrack: parseInt(settings.maxCoinsToTrack) || 20 // Added max coins
    };
    setConfig(newConfig);
    
    if (refreshIntervalId.current) {
      clearInterval(refreshIntervalId.current);
    }
    startPeriodicUpdate();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startPeriodicUpdate = () => {
    if (refreshIntervalId.current) {
      clearInterval(refreshIntervalId.current);
    }
    
    updateCoinsData();
    
    refreshIntervalId.current = setInterval(() => {
      updateCoinsData();
    }, config.refreshInterval);
  };

  const updateCoinsData = async () => {
    console.log(config)
  try {
    if (!initialLoadRef.current) setIsLoading(true);
    // 1. Clone current tracked coins
    let updatedTrackedCoins = { ...trackedCoins };

    // 2. Ensure pre-migration tokens are included
    const newCoins = Object.values(preMigrationTokens.current)
      .filter(t => t.is_pre_migration);

    newCoins.forEach(coin => {
      if (!updatedTrackedCoins[coin.mint]) {
        updatedTrackedCoins[coin.mint] = {
          ...coin,
          volume15s: 0, volume30s: 0, volume1m: 0, volume5m: 0,
          transactions15s: 0, transactions30s: 0, transactions1m: 0, transactions5m: 0,
          buys15s: 0, buys30s: 0, buys1m: 0, buys5m: 0,
          sells15s: 0, sells30s: 0, sells1m: 0, sells5m: 0,
          lastUpdated: new Date()
        };
      }
    });

    // 3. Fetch trading data
    const fetchedCoins = await fetchTradingData(Object.values(updatedTrackedCoins));

    // 4. Merge fetched data back in
    fetchedCoins.forEach(coin => {
      if (updatedTrackedCoins[coin.mint]) {
        updatedTrackedCoins[coin.mint] = {
          ...updatedTrackedCoins[coin.mint],
          ...coin,
          lastUpdated: new Date()
        };
      }
    });

    // 4b. Compute liquidity change (% diff since last update)
    Object.keys(updatedTrackedCoins).forEach(mint => {
      const coin = updatedTrackedCoins[mint];
      if (coin.prevLiquidity !== undefined && coin.liquidity !== undefined) {
        const diff = coin.liquidity - coin.prevLiquidity;
        coin.liquidityChange = (diff / coin.prevLiquidity) * 100;
      } else {
        coin.liquidityChange = 0;
      }
      coin.prevLiquidity = coin.liquidity;
    });

    let trackedCoinsArray = Object.values(updatedTrackedCoins);

    if (trackedCoinsArray.length > config.maxCoinsToTrack) {

      const keepMints = new Set(Object.keys(trackedCoins).slice(0, config.maxCoinsToTrack));

      Object.keys(updatedTrackedCoins).forEach(mint => {
        if (!keepMints.has(mint)) {
          delete updatedTrackedCoins[mint];
        }
      });
    }

    // 6. Process & sort
    const processedData = processData(
      Object.values(updatedTrackedCoins),
      config.momentumThreshold,
      config.velocityThreshold
    );
    const sortedData = sortCoins(processedData, sortField, sortDirection);

    // 7. Push updates once
    setTrackedCoins(updatedTrackedCoins);
    setCoinsData(sortedData);
    updateStats(sortedData);
    setLastUpdated(new Date().toLocaleTimeString());
    setErrorMessage('');
  } catch (error) {
    console.error('Error updating coins data:', error);
    setErrorMessage(
      'Failed to update coins data. Please check your API key and try again.'
    );
  } finally {
    if (!initialLoadRef.current) {
      setIsLoading(false);
      initialLoadRef.current = true;
    }
  }
};

const fetchTradingData = async (coins) => {
  console.log("helius key", heliusAPIKey)
  if (!heliusAPIKey) {
    setErrorMessage('Please enter your Helius API key');
    return coins;
  }

  const coinsWithDetails = [];
  console.log("coins", coins)
  for (const coin of coins) {
    const address = coin.mint;
    try {
      const url = `${config.heliusAPI}addresses/${address}/transactions?api-key=${heliusAPIKey}&limit=100`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Helius response not OK for ${address}:`, response.status, response.statusText);
        // push coin unchanged so UI still shows it
        coinsWithDetails.push(coin);
        continue;
      }

      const transactions = await response.json();
      console.log("Transactions ", transactions)
      // DEBUG: inspect shape (first time only)
      // console.debug('raw tx response', transactions);

      // Normalize txList to be an array of full transaction objects that include a blockTime
      let txList = [];
      if (Array.isArray(transactions)) {
        // Some endpoints return an array of full tx objects
        txList = transactions;
      } else if (transactions.value && Array.isArray(transactions.value)) {
        // Helius sometimes returns { value: [...] } where each element may already be a full tx obj
        txList = transactions.value;
      } else if (transactions.results && Array.isArray(transactions.results)) {
        txList = transactions.results;
      } else {
        // Last-resort: if the response looks like a list of signatures, keep them but we won't be able to get amounts
        console.warn('Unexpected tx response shape for', address);
        txList = transactions;
      }

      // If txList elements are signatures only (string or object with signature), we can't compute amounts.
      // So try to keep the whole parsed tx object. If only signatures are present, we should fetch parsed txs individually
      // (that's expensive) — for now log and continue.
      const now = Date.now();
      const oneMinAgo = now - 60 * 1000;
      const fiveMinAgo = now - 5 * 60 * 1000;
      const thirtySecAgo = now - 30 * 1000;
      const fifteenSecAgo = now - 15 * 1000;

      let volume15s = 0, volume30s = 0, volume1m = 0, volume5m = 0;
      let tx15s = 0, tx30s = 0, tx1m = 0, tx5m = 0;
      let buys15s = 0, buys30s = 0, buys1m = 0, buys5m = 0;
      let sells15s = 0, sells30s = 0, sells1m = 0, sells5m = 0;

      // If txList elements are minimal (only signature), try to detect and bail gracefully:
      const sample = txList[0];
      const hasFullTxData = sample && (sample.transaction || sample.meta || sample.blockTime || sample.parsed || sample.timestamp);

      if (!hasFullTxData) {
        // We don't have full tx body — attempt to fetch parsed transactions individually would be here.
        // For now, compute counts by timestamp if available, but amounts will be zero.
        console.warn(`Tx list for ${address} doesn't include parsed data. Volumes will be zero.`);
      }

      for (const tx of txList) {
        // blockTime vs timestamp vs unix seconds — normalize:
        let txTimestampSec = null;
        if (tx.blockTime) txTimestampSec = tx.blockTime;
        else if (tx.timestamp) txTimestampSec = tx.timestamp;
        else if (tx.block && tx.block.time) txTimestampSec = tx.block.time;
        // If txTimestampSec is still null, skip (can't time-window it)
        if (!txTimestampSec) continue;

        const txTime = new Date(txTimestampSec * 1000).getTime();

        // isBuyTransaction and getTransactionAmount must accept the shape Helius returns
        // If your helper expects a raw parsed tx, pass tx. If it expects different shape, adapt accordingly.
        const isBuy = isBuyTransaction(tx, coin.mint);
        let amount = getTransactionAmount(tx, coin.mint);

        // fallback: sometimes helper returns undefined — attempt to parse lamports from logs or set 0
        if (typeof amount !== 'number') {
          amount = 0;
        }

        if (txTime >= fiveMinAgo) {
          volume5m += amount; tx5m++; if (isBuy) buys5m++; else sells5m++;
        }
        if (txTime >= oneMinAgo) {
          volume1m += amount; tx1m++; if (isBuy) buys1m++; else sells1m++;
        }
        if (txTime >= thirtySecAgo) {
          volume30s += amount; tx30s++; if (isBuy) buys30s++; else sells30s++;
        }
        if (txTime >= fifteenSecAgo) {
          volume15s += amount; tx15s++; if (isBuy) buys15s++; else sells15s++;
        }
      }

      coinsWithDetails.push({
        ...coin,
        volume15s, transactions15s: tx15s, buys15s, sells15s,
        volume30s, transactions30s: tx30s, buys30s, sells30s,
        volume1m, transactions1m: tx1m, buys1m, sells1m,
        volume5m, transactions5m: tx5m, buys5m, sells5m,
        lastUpdated: new Date()
      });

      console.log("Coins with details ", coinsWithDetails.slice(-1));
    } catch (error) {
      console.log(`Error processing data for ${coin.symbol}:`, error);
      coinsWithDetails.push(coin);
    }
  }

  return coinsWithDetails;
};


  const sortCoins = (coins, field, direction) => {
    return [...coins].sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];
      
      // Handle special case for buySellRatio which is now a string "a:b"
      if (field === 'buySellRatio') {
        const [buysA, sellsA] = a.buySellRatio.split(':').map(Number);
        const [buysB, sellsB] = b.buySellRatio.split(':').map(Number);
        const ratioA = sellsA > 0 ? buysA / sellsA : buysA;
        const ratioB = sellsB > 0 ? buysB / sellsB : buysB;
        
        return direction === 'asc' ? ratioA - ratioB : ratioB - ratioA;
      }
      
      if (typeof valueA === 'string') {
        return direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    });
  };

  const updateStats = (coins) => {
  const filteredCoins = coins.filter(coin => 
    coin.marketCap >= config.minMarketCap && 
    coin.marketCap <= config.maxMarketCap && 
    coin.liquidity >= config.minLiquidity
  );

  const buySignals = filteredCoins.filter(coin => coin.signal === 'BUY').length;
  const sellSignals = filteredCoins.filter(coin => coin.signal === 'SELL').length;

  let lastSignal = '-';
  if (filteredCoins.length > 0) {
    const latestCoin = filteredCoins.reduce((latest, coin) => {
      const latestTime = new Date(latest.lastUpdated).getTime();
      const coinTime = new Date(coin.lastUpdated).getTime();
      return coinTime > latestTime ? coin : latest;
    }, filteredCoins[0]);
    lastSignal = `${latestCoin.name} (${latestCoin.signal})`;
  }

  setStats({
    trackedCoins: filteredCoins.length,
    greenSignals: buySignals,   // <-- now matches Stats props
    redSignals: sellSignals,    // <-- now matches Stats props
    lastSignal
  });
};



  useEffect(() => {
    if (coinsData.length > 0) {
      const sortedData = sortCoins(coinsData, sortField, sortDirection);
      console.log("Coins data ", coinsData)
      setCoinsData(sortedData);
    }
  }, [sortField, sortDirection]);

    return (
    <div className="container">
      <Header lastUpdated={lastUpdated} />
      
      {/* Add progress bar */}
      {isLoading && (
        <div className="progress-bar">
          <div className="progress-bar-inner"></div>
        </div>
      )}
      
      <Controls 
        minMarketCap={config.minMarketCap}
        maxMarketCap={config.maxMarketCap}
        minLiquidity={config.minLiquidity}
        momentumThreshold={config.momentumThreshold}
        velocityThreshold={config.velocityThreshold}
        refreshInterval={config.refreshInterval / 1000}
        maxCoinsToTrack={config.maxCoinsToTrack} // Added max coins
        onApplySettings={handleApplySettings}
      />
      
      {errorMessage && (
        <div id="error-message" className="error">
          {errorMessage}
        </div>
      )}
      
      <Stats 
        trackedCoins={stats.trackedCoins}
        greenSignals={stats.greenSignals}
        redSignals={stats.redSignals}
        lastSignal={stats.lastSignal}
      />
      
      <CoinTable 
        coinsData={coinsData}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      <AlertContainer alerts={alerts} />
    </div>
  );
}

export default App;