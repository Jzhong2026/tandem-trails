import { createServer } from 'node:http';
import { createGameServer } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const game = createGameServer();
const server = createServer(game.app);
game.io.attach(server);

server.listen(port, host, () => {
  console.log(`知识侦探社运行在 http://localhost:${port}`);
});
