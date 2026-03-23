import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import portfolioRoutes from './routes/portfolio';
import adminRoutes from './routes/admin';
import { sequelize } from './models';
import { ensureTradableAssetsSeeded } from './services/ensureTradableAssets';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/admin', adminRoutes);

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    // Adds new columns (e.g. isVerified) when models change; set DB_SYNC_ALTER=false to skip
    await sequelize.sync({ alter: process.env.DB_SYNC_ALTER !== 'false' });
    console.log('Database models synced');

    await ensureTradableAssetsSeeded();
    console.log('Tradable assets catalog ensured (BTC, ETH, …)');
    app.listen(port, '0.0.0.0', () => {
      console.log(`API listening on port ${port} (reachable at http://localhost:${port} on this machine)`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();

