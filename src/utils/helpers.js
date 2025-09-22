export const isBuyTransaction = (tx, mint) => {
  if (!tx.tokenTransfers) return false;
  const incoming = tx.tokenTransfers.find(t => t.mint === mint && t.toUserAccount);
  return !!incoming;
};

export const getTransactionAmount = (tx, mint) => {
  if (!tx.tokenTransfers) return 0;
  const transfer = tx.tokenTransfers.find(t => t.mint === mint);
  if (!transfer) return 0;
  return Number(transfer.tokenAmount || 0);
};

export function calculateMomentum(buy15s, sell15s, buy5m, sell5m) {
  const vol15s = buy15s + sell15s;
  const vol5m = buy5m + sell5m;

  if (vol15s === 0 || vol5m === 0) return 0;

  const bias = (buy15s - sell15s) / vol15s;

  const ratio = (vol15s * 20) / vol5m;

  const momentum = Math.log10(1 + ratio) * 5 * bias;

  return Number(momentum.toFixed(2));
}

export const processData = (coinsData, momentumThreshold = 2, velocityThreshold = 0) => {
  return coinsData.map(coin => {
    const momentum = calculateMomentum(coin.volume15s || 0, coin.volume5m || 0);

    const velocity = coin.transactions1m || 0;
    const avgTransactions15s = (coin.transactions5m || 0) / 300;

    const buySellRatio = (coin.buys5m || 0) + ':' + (coin.sells5m || 0);
    const buySellRatioValue = (coin.sells5m && coin.sells5m > 0)
      ? (coin.buys5m || 0) / coin.sells5m
      : (coin.buys5m || 0);

    const signal = calculateSignal(momentum, buySellRatioValue, coin.liquidityChange || 0, momentumThreshold);
    console.log(signal, buySellRatioValue)
    return {
      ...coin,
      momentum,
      velocity,
      avgTransactions15s,
      buySellRatio,
      buySellRatioValue,
      signal
    };
  });
};

export const calculateSignal = (momentumScore, buySellRatio, liquidityChange, momentumThreshold = 2) => {
  if (momentumScore >= momentumThreshold &&
      buySellRatio >= 2 &&
      liquidityChange >= 0) {
    return 'BUY';
  }

  if (momentumScore <= 0.5 &&
      buySellRatio <= 0.8 &&
      liquidityChange < 0) {
    return 'SELL';
  }

  return 'HOLD';
};

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
