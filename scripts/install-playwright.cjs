// Script de instalação do Chromium para Railway (CommonJS para evitar problemas com ESM)
// Roda durante o postinstall: PLAYWRIGHT_BROWSERS_PATH é definido aqui, igual ao runtime.
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

const browsersPath = path.join(process.cwd(), '.playwright-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

console.log('[install-playwright] Instalando Chromium em:', browsersPath);

const playwrightBin = path.join(process.cwd(), 'node_modules', '.bin', 'playwright');

if (!fs.existsSync(playwrightBin)) {
    console.warn('[install-playwright] playwright CLI não encontrado:', playwrightBin);
    process.exit(0);
}

try {
    execFileSync(playwrightBin, ['install', 'chromium'], {
        stdio: 'inherit',
        env: process.env,
    });
    console.log('[install-playwright] Chromium instalado com sucesso em:', browsersPath);
} catch (e) {
    console.warn('[install-playwright] Aviso:', e.message);
}
