// Script de instalação do Chromium — roda no postinstall do npm install.
// Pula automaticamente em Vercel (frontend build) e em dev local (desnecessário,
// o servidor já instala em background na primeira execução).
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

// Não instala no Vercel (build do frontend — não roda server.js)
if (process.env.VERCEL || process.env.CI === 'true' && !process.env.RAILWAY_ENVIRONMENT) {
    console.log('[install-playwright] Pulando instalação (ambiente Vercel/CI sem Railway)');
    process.exit(0);
}

const browsersPath = path.join(process.cwd(), '.playwright-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

const playwrightBin = path.join(process.cwd(), 'node_modules', '.bin', 'playwright');

if (!fs.existsSync(playwrightBin)) {
    console.log('[install-playwright] playwright CLI não encontrado, pulando.');
    process.exit(0);
}

console.log('[install-playwright] Instalando Chromium em:', browsersPath);
try {
    execFileSync(playwrightBin, ['install', 'chromium'], {
        stdio: 'inherit',
        env: process.env,
    });
    console.log('[install-playwright] Chromium instalado com sucesso.');
} catch (e) {
    console.warn('[install-playwright] Aviso:', e.message);
}
