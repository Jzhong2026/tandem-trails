import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { createGameServer } from './game-server.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const server = createGameServer({ webDirectory: resolve('dist/web') });

server.http.listen(port, host, () => {
  const address = server.http.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Tandem Trails · http://${host === '0.0.0.0' ? 'localhost' : host}:${boundPort}`);
  if (host === '0.0.0.0') {
    const addresses = Object.values(networkInterfaces()).flat().filter(
      entry => entry?.family === 'IPv4' && !entry.internal,
    );
    for (const entry of addresses) console.log(`LAN · http://${entry!.address}:${boundPort}`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void server.close());
}
