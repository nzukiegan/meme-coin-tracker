// test-helius.js
const WebSocket = require('ws');
const key = 'e110a01b-2d1f-4134-b4ca-26b6e8d455c9';
const ws = new WebSocket(`wss://mainnet.helius-rpc.com/?api-key=${key}`);

ws.on('open', () => {
  console.log('OPEN');
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'programSubscribe',
    params: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', { commitment:'confirmed', encoding:'jsonParsed' }]
  }));
});

ws.on('message', (msg) => console.log('MSG:', msg.toString()));
ws.on('close', (code, reason) => console.log('CLOSE', code, reason && reason.toString()));
ws.on('error', (err) => console.log('ERROR', err && err.toString()));
