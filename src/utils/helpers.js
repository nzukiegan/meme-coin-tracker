export const isBuyTransaction = (tx, mintAddress) => {
  try {
    if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) return false;
    const receivedToken = tx.tokenTransfers.find(t =>
      t.mint === mintAddress &&
      Number(t.tokenAmount?.amount) > 0 &&
      t.toUserAccount
    );

    const sentToken = tx.tokenTransfers.find(t =>
      t.mint === mintAddress &&
      Number(t.tokenAmount?.amount) > 0 &&
      t.fromUserAccount
    );

    if (receivedToken) return true;
    if (sentToken) return false;

    return false;
  } catch (e) {
    console.warn("Error analyzing transaction:", e);
    return false;
  }
};

export const getTransactionAmount = (tx, mintAddress) => {
  try {
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      const transfer = tx.tokenTransfers.find(t => t.mint === mintAddress);
      if (transfer && transfer.tokenAmount) {
        const decimals = transfer.tokenAmount.decimals || 9;
        return transfer.tokenAmount.amount / Math.pow(10, decimals);
      }
    }
    return 0;
  } catch (e) {
    console.warn('Error getting transaction amount:', e);
    return 0;
  }
};

export const processData = (coinsData, momentumThreshold, velocityThreshold) => {
  return coinsData.map(coin => {
    const avgVolume5m = coin.transactions5m / 5;
    const momentum = avgVolume5m > 0 ? 
      ((coin.transactions1m - avgVolume5m) / avgVolume5m) * 100 : 0;
    
    const velocity = coin.transactions1m;
    
    const avgTransactions5m = coin.transactions5m / 5;
    
    // Calculate buy/sell ratio as a ratio (a:b) instead of percentage
    const buySellRatio = coin.buys5m > 0 || coin.sells5m > 0 ? 
      `${coin.buys5m}:${coin.sells5m}` : '0:0';
    
    let signal = 'yellow';
    if (momentum > momentumThreshold && 
        velocity > (avgTransactions5m * velocityThreshold)) {
      signal = 'green';
    } else if (momentum < -momentumThreshold && 
              velocity > (avgTransactions5m * velocityThreshold)) {
      signal = 'red';
    }

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