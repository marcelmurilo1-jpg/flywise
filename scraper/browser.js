import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// chromiumExtra é injetado pelo server.js após configurar PLAYWRIGHT_BROWSERS_PATH
let _chromiumExtra = null;
export function initBrowser(chromiumExtra) { _chromiumExtra = chromiumExtra; }

let _browser = null;
let _chromiumReady = false;
let _chromiumInstalling = false;

export function isChromiumReady() { return _chromiumReady; }
export function setChromiumReady(v) { _chromiumReady = v; }
export function getBrowserRef() { return _browser; }
export function clearBrowserRef() { _browser = null; }

export const UA_POOL = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

export const TIMEZONE_POOL = [
    'America/Sao_Paulo', 'America/Sao_Paulo', 'America/Sao_Paulo',
    'America/Recife', 'America/Manaus', 'America/Belem',
    'America/New_York', 'America/Chicago', 'America/Los_Angeles',
    'Europe/Lisbon', 'Europe/Madrid', 'Europe/London',
];

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function getChromeVersion(ua) {
    return ua.match(/Chrome\/(\d+)/)?.[1] ?? '124';
}

export function getPlatform(ua) {
    if (/Macintosh/i.test(ua)) return 'macOS';
    if (/X11|Linux/i.test(ua)) return 'Linux';
    return 'Windows';
}

export function chromiumBinaryExists() {
    if (!_chromiumExtra) return false;
    try {
        const p = _chromiumExtra.executablePath();
        return p && fs.existsSync(p);
    } catch {
        return false;
    }
}

export function resolveChromiumPath() {
    try {
        const p = _chromiumExtra.executablePath();
        if (p && fs.existsSync(p)) return p;
    } catch (_) {}
    for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
        if (fs.existsSync(p)) { console.log('[GFlights] Usando chromium do sistema:', p); return p; }
    }
    throw new Error('Chromium não encontrado. Verifique o build do Railway.');
}

export async function ensureChromium() {
    if (chromiumBinaryExists()) { _chromiumReady = true; return; }
    _chromiumReady = false;

    if (_chromiumInstalling) {
        while (_chromiumInstalling) await new Promise(r => setTimeout(r, 500));
        return;
    }
    _chromiumInstalling = true;
    try {
        console.log('[Playwright] Instalando Chromium (pode levar ~90s)...');
        const playwrightBin = path.join(__dirname, '..', 'node_modules', '.bin', 'playwright');
        await new Promise((resolve, reject) => {
            const child = spawn(playwrightBin, ['install', 'chromium'], {
                stdio: 'inherit',
                env: { ...process.env },
            });
            child.on('close', code => code === 0 ? resolve() : reject(new Error(`playwright install saiu com código ${code}`)));
            child.on('error', reject);
        });
        _chromiumReady = true;
        console.log('[Playwright] Chromium instalado com sucesso.');
    } catch (e) {
        console.warn('[Playwright] Falha ao instalar Chromium:', e.message);
    } finally {
        _chromiumInstalling = false;
    }
}

export async function getBrowser() {
    if (_browser && _browser.isConnected()) return _browser;
    if (_browser) {
        try { await _browser.close(); } catch (_) {}
        _browser = null;
    }
    await ensureChromium();
    const opts = {
        headless: true,
        executablePath: resolveChromiumPath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--renderer-process-limit=1',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate',
            '--disable-default-apps',
            '--hide-scrollbars',
            '--mute-audio',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
        ],
    };
    if (process.env.PROXY_URL) opts.proxy = { server: process.env.PROXY_URL };
    _browser = await _chromiumExtra.launch(opts);
    _browser.on('disconnected', () => {
        console.log('[GFlights] Navegador desconectado — será reiniciado na próxima requisição.');
        _browser = null;
    });
    console.log('[GFlights] Navegador iniciado (stealth ativo).');
    return _browser;
}

export async function closeBrowserIfIdle() {
    if (_browser && _browser.isConnected()) {
        try {
            await _browser.close();
            _browser = null;
            console.log('[GFlights] Browser fechado pelo cleanup periódico (memória liberada).');
        } catch (e) {
            console.warn('[GFlights] Erro no cleanup periódico:', e.message);
            _browser = null;
        }
    }
}

process.on('SIGTERM', async () => { if (_browser) await _browser.close(); process.exit(0); });
process.on('SIGINT',  async () => { if (_browser) await _browser.close(); process.exit(0); });
