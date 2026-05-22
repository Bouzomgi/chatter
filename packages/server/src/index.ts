import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT ?? 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(__dirname, '../../client/dist');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(clientDist));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
