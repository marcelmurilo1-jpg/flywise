import { chromium } from 'playwright-extra';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Preencher busca simulada GRU -> MIA em 15/03/2026
  await page.fill('input[placeholder*="Origem"]', 'GRU');
  await page.fill('input[placeholder*="Destino"]', 'MIA');
  // Ajuste o seletor da data se for diferente no front
  const dateInput = await page.$('input[type="date"]');
  if(dateInput) await dateInput.fill('2026-03-15');

  await page.click('button:has-text("Buscar Voos")');
  console.log("Busca clicada, aguardando resultados carregarem...");
  
  // Aguarda os resultados do axios (pode demorar os 20s do scraper)
  await page.waitForTimeout(20000);
  
  // Clica na aba Seats.Aero se existir
  const seatsTab = await page.$('button:has-text("Seats.aero")');
  if(seatsTab) await seatsTab.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'frontend-test.png', fullPage: true });
  console.log("Screenshot do Frontend salvo em frontend-test.png");
  await browser.close();
})();
