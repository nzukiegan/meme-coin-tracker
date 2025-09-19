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
    refreshInterval: 30000, // 30 seconds
    heliusAPI: 'https://api.helius.xyz/v0/'
  });
  
  const [coinsData, setCoinsData] = useState([]);
  const [trackedCoins, setTrackedCoins] = useState({});
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
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
  
  const preMigrationTokens = useRef({});
  const ws = useRef(null);
  const refreshIntervalId = useRef(null);

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
      refreshInterval: (parseInt(settings.refreshInterval) || 30) * 1000
    };
    setConfig(newConfig);
    
    if (refreshIntervalId.current) {
      clearInterval(refreshIntervalId.current);
    }
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
  try {
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

    console.log("updated tracked coins", updatedTrackedCoins)

    // 3. Fetch trading data for ALL tracked coins
    const fetchedCoins = await fetchTradingData(Object.values(updatedTrackedCoins));

    // 4. Merge fetched data back into trackedCoins
    fetchedCoins.forEach(coin => {
      if (updatedTrackedCoins[coin.mint]) {
        updatedTrackedCoins[coin.mint] = {
          ...updatedTrackedCoins[coin.mint],
          ...coin,
          lastUpdated: new Date()
        };
      }
    });

    // 5. Process & sort
    const processedData = processData(
      Object.values(updatedTrackedCoins),
      config.momentumThreshold,
      config.velocityThreshold
    );
    const sortedData = sortCoins(processedData, sortField, sortDirection);

    // 6. Push final state updates ONCE
    setTrackedCoins(updatedTrackedCoins);
    setCoinsData(sortedData);
    updateStats(sortedData);
    setLastUpdated(new Date().toLocaleTimeString());
    setErrorMessage('');

  } catch (error) {
    console.error('Error updating coins data:', error);
    setErrorMessage('Failed to update coins data. Please check your API key and try again.');
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
    let address = coin.mint;
    try {
      let response = await fetch(
        `${config.heliusAPI}addresses/${address}/transactions?api-key=${heliusAPIKey}&limit=100`
      );

      const transactions = await response.json();

      console.log("Transactions", transactions)

      // Normalize transactions:
      // If Helius → already parsed JSON array
      // If Solana RPC → wrap into same format (timestamp + signature)
      let txList = [];
      if (transactions.value) {
        txList = transactions.value.map(sig => ({
          signature: sig.signature,
          timestamp: sig.blockTime || 0
        }));
      } else {
        txList = transactions;
      }

      // 🔹 Existing aggregation logic
      const now = Date.now();
      const oneMinAgo = now - 60 * 1000;
      const fiveMinAgo = now - 5 * 60 * 1000;
      const thirtySecAgo = now - 30 * 1000;
      const fifteenSecAgo = now - 15 * 1000;

      let volume15s = 0, volume30s = 0, volume1m = 0, volume5m = 0;
      let tx15s = 0, tx30s = 0, tx1m = 0, tx5m = 0;
      let buys15s = 0, buys30s = 0, buys1m = 0, buys5m = 0;
      let sells15s = 0, sells30s = 0, sells1m = 0, sells5m = 0;

      for (const tx of txList) {
        if (!tx.timestamp) continue;
        const txTime = new Date(tx.timestamp * 1000).getTime();

        const isBuy = isBuyTransaction(tx, coin.mint);
        const amount = getTransactionAmount(tx, coin.mint) || 0;

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
    
    const greenSignals = filteredCoins.filter(coin => coin.signal === 'green').length;
    const redSignals = filteredCoins.filter(coin => coin.signal === 'red').length;
    
    let lastSignal = '-';
    if (filteredCoins.length > 0) {
      const latestCoin = filteredCoins.reduce((latest, coin) => 
        coin.lastUpdated > latest.lastUpdated ? coin : latest, filteredCoins[0]);
      lastSignal = `${latestCoin.name} (${latestCoin.signal.toUpperCase()})`;
    }
    
    setStats({
      trackedCoins: filteredCoins.length,
      greenSignals,
      redSignals,
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
      
      <Controls 
        minMarketCap={config.minMarketCap}
        maxMarketCap={config.maxMarketCap}
        minLiquidity={config.minLiquidity}
        momentumThreshold={config.momentumThreshold}
        velocityThreshold={config.velocityThreshold}
        refreshInterval={config.refreshInterval / 1000}
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
    </div>
  );
}

export default App;