import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initBrowser, ensureChromium, closeBrowserIfIdle, chromiumBinaryExists } from './scraper/browser.js';
import seatsRouter from './routes/seats.js';
import watchlistRouter from './routes/watchlist.js';
import amadeusRouter from './routes/amadeus.js';
import paymentsRouter, { webhookHandler as paymentsWebhookHandler, webhookRawMiddleware as paymentsWebhookRaw } from './routes/payments.js';
import awardPricesRouter from './routes/awardPrices.js';
import transferPromosRouter, { refreshPromotionsCache } from './routes/transferPromos.js';
import adminRouter, { syncTransferData } from './routes/admin.js';
import { supabase } from './lib/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PLAYWRIGHT_BROWSERS_PATH must be set BEFORE playwright dynamic import.
// Static imports above (browser.js, routes) do NOT import playwright-extra,
// so this env var is ready in time for the dynamic import below.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const railwayPath = '/app/.playwright-browsers';
    if (fs.existsSync(railwayPath)) process.env.PLAYWRIGHT_BROWSERS_PATH = railwayPath;
}
console.log('[Playwright] PLAYWRIGHT_BROWSERS_PATH:', process.env.PLAYWRIGHT_BROWSERS_PATH ?? '(default)');

dotenv.config({ path: '.env.local' });
dotenv.config();

const { chromium: chromiumExtra } = await import('playwright-extra');
const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
chromiumExtra.use(StealthPlugin());
initBrowser(chromiumExtra);

process.on('uncaughtException', err => console.error('[FATAL] uncaughtException — servidor continua:', err));
process.on('unhandledRejection', reason => console.error('[FATAL] unhandledRejection — servidor continua:', reason));

const app = express();
app.use(cors());

// Webhook do gateway de pagamento precisa do raw body para validar assinatura HMAC —
// registrado ANTES de express.json(). Quando a próxima gateway for integrada, esse
// endpoint passa a receber os eventos dela.
app.post('/api/payments/webhook', paymentsWebhookRaw, paymentsWebhookHandler);

app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/', seatsRouter);
app.use('/', watchlistRouter);
app.use('/', amadeusRouter);
app.use('/', paymentsRouter);
app.use('/', awardPricesRouter);
app.use('/', transferPromosRouter);
app.use('/', adminRouter);

if (process.env.VERCEL !== '1') {
    // Sync diário de promoções de transferência — 14h UTC
    cron.schedule('0 14 * * *', () => {
        console.log('[TransferSync] Cron diário disparado (14h UTC)');
        syncTransferData().catch(err => console.error('[TransferSync] Cron error:', err.message));
    }, { timezone: 'UTC' });

    // Fecha browser Playwright ocioso a cada 5min para liberar memória
    setInterval(() => closeBrowserIfIdle(), 5 * 60 * 1000);

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`Servidor FlyWise Backend rodando na porta ${PORT}`);
        console.log(`POST http://localhost:${PORT}/api/search-flights   (Seats.aero)`);
        console.log(`GET  http://localhost:${PORT}/api/amadeus/flights   (Google Flights scraper)`);
        console.log(`======================================================\n`);

        if (!chromiumBinaryExists()) ensureChromium();
        refreshPromotionsCache().catch(console.error);

        if (supabase) {
            supabase.from('transfer_sync_log')
                .select('synced_at').order('synced_at', { ascending: false }).limit(1)
                .then(({ data }) => {
                    const lastAt = data?.[0]?.synced_at;
                    const hoursAgo = lastAt ? (Date.now() - new Date(lastAt).getTime()) / 3600000 : Infinity;
                    if (hoursAgo > 23) {
                        console.log(`[TransferSync] Último sync há ${Math.round(hoursAgo)}h — agendando em 5min...`);
                        setTimeout(() => syncTransferData().catch(err => console.error('[TransferSync] Startup sync error:', err.message)), 5 * 60 * 1000);
                    } else {
                        console.log(`[TransferSync] Último sync há ${Math.round(hoursAgo)}h — OK`);
                    }
                })
                .catch(() => {});
        }
    });
}

export default app;
