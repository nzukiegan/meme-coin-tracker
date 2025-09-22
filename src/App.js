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
    momentumThreshold: 2,
    velocityThreshold: 2,
    refreshInterval: 3000,
    heliusAPI: '',
    maxCoinsToTrack: 20
  });

  const [coinsData, setCoinsData] = useState([]);
  const [trackedCoins, setTrackedCoins] = useState({});
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [alerts, setAlerts] = useState([]);
  const [heliusAPIKey, setHeliusAPIKey] = useState('');
  const [lastUpdated, setLastUpdated] = useState('-');
  const [isAPIKeyLoaded, setIsAPIKeyLoaded] = useState(false);
  const trackedCoinsRef = useRef({});
  const lastAlertRef = useRef({});
  const lastBalancesRef = useRef({});
  const [stats, setStats] = useState({
    trackedCoins: 0,
    greenSignals: 0,
    redSignals: 0,
    lastSignal: '-'
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const preMigrationTokens = useRef({});
  const pumpWs = useRef(null);
  const heliusWs = useRef(null);
  const refreshIntervalId = useRef(null);
  const reconnectBackoff = useRef(1000);

  useEffect(() => {
    const savedKey = process.env.REACT_APP_HELIUS_API_KEY;
    if (savedKey) {
      setHeliusAPIKey(savedKey);
      setIsAPIKeyLoaded(true);
    }

    return () => {
      if (refreshIntervalId.current) clearInterval(refreshIntervalId.current);
      if (pumpWs.current && pumpWs.current.readyState === WebSocket.OPEN) pumpWs.current.close();
      if (heliusWs.current && heliusWs.current.readyState === WebSocket.OPEN) heliusWs.current.close();
    };
  }, []);

useEffect(() => {
  coinsData.forEach(coin => {
    if (coin.signal === 'BUY' || coin.signal === 'SELL') {
      const now = Date.now();
      const lastForMint = lastAlertRef.current[coin.mint] || {};
      const lastTime = lastForMint[coin.signal] || 0;

      if (now - lastTime < 60000) return;

      const newAlert = {
        id: Date.now() + Math.random(),
        type: coin.signal,
        message: coin.signal === 'BUY'
          ? `BUY signal for ${coin.name} - Hold time: ${calculateHoldTime(
              coin.momentum,
              coin.sells5m > 0 ? coin.buys5m / coin.sells5m : coin.buys5m,
              coin.liquidityChange || 0
            )}`
          : `SELL signal for ${coin.name} - Exit immediately`,
        mint: coin.mint
      };

      lastAlertRef.current[coin.mint] = {
        ...lastForMint,
        [coin.signal]: now
      };

      setAlerts(prev => [...prev, newAlert]);
      setTimeout(
        () => setAlerts(prev => prev.filter(a => a.id !== newAlert.id)),
        10000
      );
    }
  });
}, [coinsData]);

  const calculateHoldTime = (momentumScore, buySellRatio, liquidityChange) => {
    if (momentumScore >= 4 && buySellRatio >= 4 && liquidityChange >= 20) {
      return '15-30 minutes';
    } else if (momentumScore >= 3 && buySellRatio >= 3 && liquidityChange >= 10) {
      return '5-15 minutes';
    } else if (momentumScore <= 0.7 && buySellRatio <= 0.8 && liquidityChange < -10) {
      return 'Exit immediately';
    } else if (momentumScore <= 1 && buySellRatio <= 1 && liquidityChange < -5) {
      return 'Within 1 minute';
    } else {
      return 'Monitor closely';
    }
  };

const handleCopyAddress = (mint) => {
  navigator.clipboard.writeText(mint)
    .then(() => console.log("Copied:", mint))
    .catch(err => console.error("Copy failed", err));
};

const handleTogglePin = (mint) => {
  setTrackedCoins(prev => {
    const newTracked = { ...prev };
    if (newTracked[mint]) {
      newTracked[mint] = {
        ...newTracked[mint],
        isPinned: !newTracked[mint].isPinned
      };
    } else {
      return prev;
    }
    trackedCoinsRef.current = newTracked;
    try {
      const processed = processData(
        Object.values(newTracked),
        config.momentumThreshold,
        config.velocityThreshold
      );
      const sorted = sortCoins(processed, sortField, sortDirection);
      setCoinsData(sorted);
      updateStats(sorted);
    } catch (err) {
      console.error("Failed to refresh coinsData after pin toggle", err);
    }

    return newTracked;
  });
};


const handleTrackToken = (mint) => {
  setTrackedCoins(prev => {
    const newTracked = { ...prev };
    if (!newTracked[mint]) {
      newTracked[mint] = {
        mint,
        name: "Tracked Token",
        symbol: "",
        isTracked: true,
        isPinned: true,
        addedAt: Date.now(),
        history: []
      };
    } else {
      newTracked[mint].isTracked = true;
      newTracked[mint].isPinned = true;
    }
    return newTracked;
  });
};

  const AlertContainer = ({ alerts }) => (
    <div className="alert-container">
      {alerts.map(alert => (
        <div key={alert.id} className={`alert ${alert.type.toLowerCase()}`}>
          {alert.message}
        </div>
      ))}
    </div>
  );

  useEffect(() => {
    if (isAPIKeyLoaded) {
      initPumpPortalWS();
      initHeliusWS();
    }
  }, [isAPIKeyLoaded, config.maxCoinsToTrack]);

  const initPumpPortalWS = () => {
    if (pumpWs.current && pumpWs.current.readyState === WebSocket.OPEN) return;

    pumpWs.current = new WebSocket('wss://pumpportal.fun/api/data');

    pumpWs.current.onopen = () => {
      console.log('Connected to PumpPortal WebSocket');
      setTimeout(() => {
        try {
          pumpWs.current.send(JSON.stringify({ method: 'subscribeNewToken' }));
          pumpWs.current.send(JSON.stringify({ method: 'subscribeMigration' }));
        } catch (e) {
          console.warn('PumpPortal send error', e);
        }
      }, 3000);
    };

    pumpWs.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.txType === 'create') {
  if (msg.name && msg.symbol && msg.mint) {
    const price = msg.vSolInBondingCurve && msg.vTokensInBondingCurve
      ? msg.vSolInBondingCurve / msg.vTokensInBondingCurve
      : 0;

    const tokenData = {
      name: msg.name,
      symbol: msg.symbol,
      mint: msg.mint,
      is_pre_migration: true,
      marketCap: msg.marketCapSol || 0,
      liquidity: msg.vSolInBondingCurve || 0,
      price,
      processed: false,
      firstSeen: Date.now(),
    };

    preMigrationTokens.current[msg.mint] = tokenData;

    setTrackedCoins(prev => {
      let newTracked = { ...prev };
      const prevToken = newTracked[msg.mint] || {};

      if (Object.keys(newTracked).length >= config.maxCoinsToTrack) {
        const removable = Object.entries(newTracked)
          .filter(([_, data]) => !data.isPinned)
          .sort((a, b) => (a[1].addedAt || 0) - (b[1].addedAt || 0));

        if (removable.length > 0) {
          const oldestMint = removable[0][0];
          delete newTracked[oldestMint];
        }
      }

      newTracked[msg.mint] = {
        ...tokenData,
        isPinned: prevToken.isPinned || false,
        isTracked: prevToken.isTracked || false,
        addedAt: prevToken.addedAt || Date.now(),
        lastUpdated: Date.now(),
        history: prevToken.history || [],
      };

      return newTracked;
    });
  }
}
 else if (msg.txType === 'migrate') {
          if (preMigrationTokens.current[msg.mint]) {
            preMigrationTokens.current[msg.mint].is_pre_migration = false;
          }
        }
      } catch (e) {
        console.warn('Error parsing pump portal message', e);
      }
    };

    pumpWs.current.onerror = (err) => console.error('PumpPortal WebSocket error:', err);
    pumpWs.current.onclose = () => console.log('PumpPortal WebSocket closed');
  };

  const initHeliusWS = () => {
    if (!heliusAPIKey) {
      setErrorMessage("Please enter your Helius API key");
      return;
    }

    if (heliusWs.current && heliusWs.current.readyState === WebSocket.OPEN) return;

    const endpoint = `wss://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(
      heliusAPIKey
    )}`;
    heliusWs.current = new WebSocket(endpoint);

    heliusWs.current.onopen = () => {
      console.log("Connected to Helius WebSocket");
      reconnectBackoff.current = 1000;

      const subscribeMsg = {
        jsonrpc: "2.0",
        id: 1,
        method: "programSubscribe",
        params: [
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          { commitment: "confirmed", encoding: "jsonParsed" },
        ],
      };

      try {
        heliusWs.current.send(JSON.stringify(subscribeMsg));
      } catch (e) {
        console.warn("Helius subscribe error", e);
      }

      // keepalive pings
      heliusWs.current._pingInterval = setInterval(() => {
        try {
          if (heliusWs.current.readyState === WebSocket.OPEN) {
            heliusWs.current.send(
              JSON.stringify({ jsonrpc: "2.0", method: "ping", id: Date.now() })
            );
          }
        } catch (e) {
          /* noop */
        }
      }, 45 * 1000);
    };

    heliusWs.current.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method !== "programNotification") return;

        const result = msg.params?.result?.value;
        const info = result?.account?.data?.parsed?.info;
        const pubkey = result?.pubkey;
        if (!info || !pubkey) return;

        const mint = info.mint;
        const rawAmount =
          info.tokenAmount?.uiAmountString ?? info.tokenAmount?.uiAmount ?? 0;
        const tokenAmount = Number(rawAmount) || 0;

        const knownTracked =
          trackedCoinsRef.current[mint] || preMigrationTokens.current[mint];
        if (!knownTracked) return;

        const prevBalance = lastBalancesRef.current[pubkey] ?? tokenAmount;
        const diff = tokenAmount - prevBalance;

        lastBalancesRef.current[pubkey] = tokenAmount;
        if (diff === 0) return;

        const amount = Math.abs(diff);
        const isBuy = diff > 0;
        const isSell = diff < 0;
        const now = Date.now();

        setTrackedCoins(prev => {
          let newTracked = { ...prev };
          const prevMint =
            newTracked[mint] ||
            trackedCoinsRef.current[mint] ||
            knownTracked ||
            {};

          const history = prevMint.history || [];
          history.push({ ts: now, amount, isBuy, isSell });

          if (newTracked[mint]) {
            newTracked[mint] = {
              ...newTracked[mint],
              history,
              lastUpdated: Date.now(),
            };
          } else {
            if (Object.keys(newTracked).length >= config.maxCoinsToTrack) {
              const removable = Object.entries(newTracked)
                .filter(([_, data]) => !data.isPinned)
                .sort((a, b) => (a[1].addedAt || 0) - (b[1].addedAt || 0));

              if (removable.length > 0) {
                const oldestMint = removable[0][0];
                delete newTracked[oldestMint];
              } else {
                return prev;
              }
            }

            newTracked[mint] = {
              ...prevMint,
              history,
              name: prevMint.name || knownTracked.name || "Unknown",
              symbol: prevMint.symbol || knownTracked.symbol || "",
              isPinned: prevMint.isPinned || false,
              addedAt: Date.now(),
              lastUpdated: Date.now(),
            };
          }

          trackedCoinsRef.current = newTracked;
          return newTracked;
        });

        console.debug("Helius WS event:", {
          mint,
          pubkey,
          prevBalance,
          newBalance: tokenAmount,
          diff,
        });
      } catch (err) {
        console.error("Failed to handle Helius message:", err);
      }
    };

    heliusWs.current.onerror = (err) => {
      console.error("Helius WS error", err);
    };

    heliusWs.current.onclose = () => {
      console.log(
        "Helius WebSocket closed, reconnecting in",
        reconnectBackoff.current
      );
      if (heliusWs.current && heliusWs.current._pingInterval) {
        clearInterval(heliusWs.current._pingInterval);
      }
      setTimeout(() => {
        reconnectBackoff.current = Math.min(30000, reconnectBackoff.current * 2);
        initHeliusWS();
      }, reconnectBackoff.current);
    };
  };

  // inside your App component or the WS init
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();

    setTrackedCoins(prev => {
      const newTracked = { ...prev };

      Object.keys(newTracked).forEach(mint => {
        const prevMint = newTracked[mint];
        if (!prevMint.history) return;

        // prune to last 5m
        const cutoff = now - 5 * 60 * 1000;
        const filtered = prevMint.history.filter(e => e.ts >= cutoff);

        const within = (ms) => filtered.filter(e => now - e.ts <= ms);

        newTracked[mint] = {
          ...prevMint,
          history: filtered,

          volume15s: within(15 * 1000).reduce((a, e) => a + e.amount, 0),
          volume30s: within(30 * 1000).reduce((a, e) => a + e.amount, 0),
          volume1m:  within(60 * 1000).reduce((a, e) => a + e.amount, 0),
          volume5m:  within(300 * 1000).reduce((a, e) => a + e.amount, 0),

          transactions15s: within(15 * 1000).length,
          transactions30s: within(30 * 1000).length,
          transactions1m:  within(60 * 1000).length,
          transactions5m:  within(300 * 1000).length,

          buys15s: within(15 * 1000).filter(e => e.isBuy).length,
          buys30s: within(30 * 1000).filter(e => e.isBuy).length,
          buys1m:  within(60 * 1000).filter(e => e.isBuy).length,
          buys5m:  within(300 * 1000).filter(e => e.isBuy).length,

          sells15s: within(15 * 1000).filter(e => e.isSell).length,
          sells30s: within(30 * 1000).filter(e => e.isSell).length,
          sells1m:  within(60 * 1000).filter(e => e.isSell).length,
          sells5m:  within(300 * 1000).filter(e => e.isSell).length,

          lastUpdated: new Date()
        };
      });

      // recompute processed UI data
      try {
        const processed = processData(
          Object.values(newTracked),
          config.momentumThreshold,
          config.velocityThreshold
        );
        const sorted = sortCoins(processed, sortField, sortDirection);
        setCoinsData(sorted);
        updateStats(sorted);
        setLastUpdated(new Date().toLocaleTimeString());
        setIsLoading(false);
      } catch (err) {
        console.error("Error during timer refresh:", err);
      }

      return newTracked;
    });
  }, 1000); // run every second

  return () => clearInterval(interval);
}, [config, sortField, sortDirection]);


  // Apply settings handler
  const handleApplySettings = (settings) => {
    const newConfig = {
      ...config,
      minMarketCap: parseInt(settings.minMarketCap) || 0,
      maxMarketCap: parseInt(settings.maxMarketCap) || 100000,
      minLiquidity: parseInt(settings.minLiquidity) || 1000,
      momentumThreshold: parseInt(settings.momentumThreshold) || 2,
      velocityThreshold: parseFloat(settings.velocityThreshold) || 2,
      refreshInterval: (parseInt(settings.refreshInterval) || 3) * 1000,
      maxCoinsToTrack: parseInt(settings.maxCoinsToTrack) || 20
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

  const sortCoins = (coins, field, direction = "asc") => {
    return [...coins].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      let valA = a[field];
      let valB = b[field];
      if (valA == null) valA = 0;
      if (valB == null) valB = 0;

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });
  };


  const updateStats = (coins) => {
    const filteredCoins = coins.filter(coin =>
      coin.marketCap >= config.minMarketCap &&
      coin.marketCap <= config.maxMarketCap &&
      coin.liquidity >= config.minLiquidity
    );

    const buySignals = filteredCoins.filter(c => c.signal === 'BUY').length;
    const sellSignals = filteredCoins.filter(c => c.signal === 'SELL').length;

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
      greenSignals: buySignals,
      redSignals: sellSignals,
      lastSignal
    });
  };

  return (
    <div className="container">
      <Header lastUpdated={lastUpdated} />

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
        maxCoinsToTrack={config.maxCoinsToTrack}
        onApplySettings={handleApplySettings}
        onTrackToken={handleTrackToken}
      />

      {errorMessage && <div id="error-message" className="error">{errorMessage}</div>}

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
        onCopyAddress={handleCopyAddress}
        onTogglePin={handleTogglePin}
      />

      <AlertContainer alerts={alerts} />
    </div>
  );
}

export default App;
