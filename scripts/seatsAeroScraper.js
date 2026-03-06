import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';

// Adiciona o plugin "stealth" ao Playwright para mascarar bot (evitar detecção Cloudflare)
chromium.use(stealth());

/**
 * Função responsável por raspar dados do Seats.aero logado na conta Pro.
 * @param {string} origem - Código do Aeroporto de Origem (ex: GRU)
 * @param {string} destino - Código do Aeroporto de Destino (ex: MIA)
 * @param {string} dataVoo - Data do voo no padrão YYYY-MM-DD (ex: 2026-03-15)
 * @returns {Promise<Array>} Array de objetos JSON estruturado com voos disponíveis.
 */
export async function buscarVoosSeatsAero(origem, destino, dataVoo) {
    // Constrói a URL de busca dinâmica baseada na origem, destino e data.
    const baseURL = "https://seats.aero/search";
    const searchUrl = `${baseURL}?origins=${origem}&destinations=${destino}&date=${dataVoo}`;

    let browser;
    try {
        console.log(`[SeatsAeroScraper] Iniciando a busca: ${origem} -> ${destino} para o dia ${dataVoo}`);

        // Inicia a instância do Chromium via Playwright
        browser = await chromium.launch({
            headless: true, // Modo silencioso para não abrir janelas no Mac
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-position=0,0']
        });

        // Cria um novo contexto injetando User-Agent realístico
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        // Requisito: Injetar sessão autenticada lendo arquivo 'cookies.json'
        try {
            const cookiesFile = path.resolve(process.cwd(), 'cookies.json');
            const cookiesData = await fs.readFile(cookiesFile, 'utf-8');
            const cookiesArray = JSON.parse(cookiesData);

            await context.addCookies(cookiesArray);
            console.log('[SeatsAeroScraper] ✅ Sessão recuperada: Cookies da conta Pro injetados com sucesso.');
        } catch (err) {
            console.warn('[SeatsAeroScraper] ⚠️ Arquivo "cookies.json" não encontrado ou vazio. Acessando sem sessão Pro.');
        }

        const page = await context.newPage();

        // Acessa a página (não travamos no networkidle pois firewalls injetam scripts infinitos)
        console.log(`[SeatsAeroScraper] Acessando a página de busca... (${searchUrl})`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('[SeatsAeroScraper] Verificando integridade da página e sessão Pro...');

        // Verifica se caiu no desafio do Cloudflare
        const isCloudflare = await page.locator('text="Verify you are human", text="Checking your browser", text="security verification"').isVisible().catch(() => false);
        if (isCloudflare) {
            console.log('[SeatsAeroScraper] 🛡️ Cloudflare detectado. Aguardando até 30s pela verificação automática...');
            try {
                // Tenta esperar o sumiço do desafio
                await page.waitForFunction(() => !document.body.innerText.includes("security verification") && !document.body.innerText.includes("Verify you are human"), { timeout: 30000 });
                console.log('[SeatsAeroScraper] ✅ Cloudflare resolvido ou página redirecionada.');
            } catch (e) {
                console.warn('[SeatsAeroScraper] ⚠️ O desafio do Cloudflare ainda parece estar presente. Tentando prosseguir mesmo assim...');
            }
        }

        // Verifica existência de paywalls avisando "Upgrade to Pro" ou limites diários
        const isPaywalled = await page.locator('.pro-paywall, text="Upgrade to Pro", text="Upgrade to PRO", text="Basic search is limited"').isVisible().catch(() => false);

        if (isPaywalled) {
            console.error("❌ ERRO FATAL: O Scraper não está autenticado como PRO ou a conta expirou. Encontrou Paywall.");
            return { error: "NOT_PRO_ACCOUNT" };
        }

        // Verifica se a tabela ou mensagem de erro de busca existe (pelo menos para saber se estamos no site real)
        const isSiteLoaded = await page.locator('.table, .navbar, .footer, text="No results found"').isVisible().catch(() => false);
        if (!isSiteLoaded) {
            console.warn('[SeatsAeroScraper] ⚠️ Página do Seats.aero não parece ter carregado completamente (apenas cabeçalhos?).');
        } else {
            console.log("✅ Integridade PRO/Site verificada! Acesso liberado.");
        }

        // Seletores mais flexíveis para a tabela do Seats.aero
        const tableSelector = 'table.table, .dataTables_wrapper table';
        const rowSelector = 'table.table tbody tr, .dataTables_wrapper tbody tr';

        try {
            console.log('[SeatsAeroScraper] Aguardando renderização dos dados (Vue/DataTables)...');
            // Espera a tabela existir
            await page.waitForSelector(tableSelector, { timeout: 15000 });
            // Espera as linhas serem populadas (ignora se demorar, tentamos extrair o que houver)
            await page.waitForSelector(rowSelector, { timeout: 10000 }).catch(() => { });
            // Pequena pausa para garantir que o JS interno do site terminou de processar as células
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log('[SeatsAeroScraper] ℹ️ Aviso: Tempo de espera esgotado, tentando extração direta.');
        }

        console.log('[SeatsAeroScraper] Analisando elementos visíveis no navegador...');
        const voos = await page.evaluate(() => {
            const resultados = [];
            // Tenta encontrar qualquer tabela no corpo da página
            const tables = Array.from(document.querySelectorAll('table'));
            const mainTable = tables.find(t => t.innerText.includes('Program') || t.innerText.includes('Economy')) || tables[0];

            if (!mainTable) return [];

            const trs = mainTable.querySelectorAll('tbody tr');

            trs.forEach((row) => {
                const tds = Array.from(row.querySelectorAll('td'));
                if (tds.length < 5) return; // Linha inválida ou carregando

                // Função auxiliar para limpeza de texto.
                const _getText = (el) => el ? el.innerText.trim().replace(/\s+/g, ' ') : '';

                // Mapeamento dinâmico baseado no cabeçalho (fallback para índices se falhar)
                // Geralmente: 0:Date, 1:LastSeen, 2:Program, 3:Departs, 4:Arrives, 5:Route, 6+:Classes

                // Procuramos colunas de milhas. Elas costumam ter números + "k" (ex: 30k)
                const fares = [];
                tds.forEach((td, idx) => {
                    const text = _getText(td);
                    if (text && (text.includes('k') || /^\d+$/.test(text) || text.includes(',')) && !text.includes(':')) {
                        fares.push({ text, idx });
                    }
                });

                if (fares.length === 0) return;

                // Pegamos a primeira tarifa disponível
                const bestFare = fares[0];

                const baseObj = {
                    companhiaAerea: _getText(tds[2]) || "Route Info",
                    rota: `${_getText(tds[3])} → ${_getText(tds[4])}`,
                    dataVoo: _getText(tds[0]) || "N/A",
                    precoMilhas: bestFare.text,
                    cabineEncontrada: "Disponível", // Simplificado pois os índices variam
                    taxas: "0"
                };

                if (baseObj.precoMilhas && baseObj.precoMilhas !== "0") {
                    resultados.push(baseObj);
                }
            });

            return resultados;
        });

        console.log(`[SeatsAeroScraper] 🎉 Operação completada. Total de Voos Raspados: ${voos.length}`);
        return voos;

    } catch (error) {
        console.error(`[SeatsAeroScraper] ❌ Erro técnico generalizado durante raspagem Playwright: ${error.message}`);
        // Retorna vazio para a stack do app não quebrar caso a automação do scraper falhe por firewall/Cloudfare.
        return [];
    } finally {
        // Bloco robusto `finally` para fechar o browser independentemente de sucesso ou falhas (Try/Catch)
        if (browser) {
            console.log('[SeatsAeroScraper] 🧹 Fechando e limpando ambiente Chromium/Browser.');
            await browser.close();
        }
    }
}

// Handler de teste direto pelo Node (Executando avulso no Terminal)
import url from 'url';
const isMainModule = import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    (async () => {
        const defaultOrigem = process.argv[2] || "GRU";
        const defaultDestino = process.argv[3] || "MIA";
        const defaultData = process.argv[4] || "2026-03-15"; // Padrão pro user testing

        const dados = await buscarVoosSeatsAero(defaultOrigem, defaultDestino, defaultData);
        console.log(`\n================== RESULTADO FINAL EM JSON ==================\n`);
        console.log(JSON.stringify(dados, null, 2));
        console.log(`\n=============================================================\n`);
    })();
}
