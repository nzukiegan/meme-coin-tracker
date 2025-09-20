export const isBuyTransaction = (tx, mint) => {
  if (!tx.tokenTransfers) return false;
  // If our tracked token is going TO the user, it's a BUY
  const incoming = tx.tokenTransfers.find(t => t.mint === mint && t.toUserAccount);
  return !!incoming;
};

export const getTransactionAmount = (tx, mint) => {
  if (!tx.tokenTransfers) return 0;
  const transfer = tx.tokenTransfers.find(t => t.mint === mint);
  if (!transfer) return 0;
  return Number(transfer.tokenAmount || 0);
};

export const processData = (coinsData, momentumThreshold, velocityThreshold) => {
  return coinsData.map(coin => {
    const avgVolume5m = coin.volume5m / 300; // Convert to per second
    const momentum = avgVolume5m > 0 ? 
      (coin.volume15s / avgVolume5m) : 0;
   
    const velocity = coin.transactions1m;
    const avgTransactions5m = coin.transactions5m / 300;
   
    // Calculate buy/sell ratio
    const buySellRatio = coin.buys5m > 0 || coin.sells5m > 0 ?
      `${coin.buys5m}:${coin.sells5m}` : '0:0';
   
    // Calculate signal based on comprehensive conditions
    const buySellRatioValue = coin.sells5m > 0 ? coin.buys5m / coin.sells5m : coin.buys5m;
    const signal = calculateSignal(momentum, buySellRatioValue, coin.liquidityChange || 0, 3);

    return {
      ...coin,
      momentum,
      velocity,
      avgTransactions: avgTransactions5m,
      buySellRatio,
      signal
    };
  });
};

export const calculateSignal = (momentumScore, buySellRatio, liquidityChange, momentumThreshold) => {
  if (momentumScore >= momentumThreshold &&
      buySellRatio >= 3 &&
      liquidityChange >= 0) {
    return 'BUY';
  }
 
  if (momentumScore <= 1 &&
      buySellRatio <= 0.8 &&
      liquidityChange < 0) {
    return 'SELL';
  }
 
  return 'HOLD';
};

// Add this function to calculate hold time suggestion
export const calculateHoldTime = (momentumScore, buySellRatio, liquidityChange) => {
  if (momentumScore >= 4 && buySellRatio >= 4 && liquidityChange >= 20) {
    return "Strong buy - Hold for 15-30 min";
  } else if (momentumScore >= 3 && buySellRatio >= 3 && liquidityChange >= 10) {
    return "Moderate buy - Hold for 5-15 min";
  } else if (momentumScore <= 0.7 && buySellRatio <= 0.8 && liquidityChange < -10) {
    return "Strong sell - Exit immediately";
  } else if (momentumScore <= 1 && buySellRatio <= 1 && liquidityChange < -5) {
    return "Moderate sell - Exit within 1 min";
  } else {
    return "Hold - Monitor closely";
  }
};