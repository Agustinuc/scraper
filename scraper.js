/**
 * ODEPA Daily Price Scraper - FRUTAS
 * Descarga automáticamente el Excel de precios diarios de FRUTAS
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const ODEPA_LANDING_URL = 'https://www.odepa.gob.cl/precios/mayoristas-frutas-y-hortalizas';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || './downloads';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeODEPA() {
    console.log('🚀 Iniciando scraper ODEPA - FRUTAS...');
    console.log(`📅 Fecha: ${new Date().toISOString()}`);

    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
        console.log('📍 Navegando a ODEPA...');
        await page.goto(ODEPA_LANDING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);

        console.log('🔍 Buscando link a reportes...');

        // Más estable que buscar por texto
        const accessLink = page.locator('a[href*="reportes.odepa.gob.cl"]').first();

        if (await accessLink.count() === 0) {
            throw new Error('No se encontró el link a reportes.odepa.gob.cl');
        }

        let formPage = page;

        const [newPage] = await Promise.all([
            context.waitForEvent('page').catch(() => null),
            accessLink.click()
        ]);

        if (newPage) {
            console.log('🆕 Nueva pestaña detectada');
            formPage = newPage;
        } else {
            console.log('🔄 Navegó en la misma pestaña');
        }

        await formPage.waitForLoadState('domcontentloaded');
        await sleep(5000);

        console.log('✅ Página de formulario cargada');

        await formPage.waitForSelector('text=Parámetros de consulta', { timeout: 60000 });

        console.log('🍎 Seleccionando Frutas...');
        await formPage.locator('mat-radio-button:has-text("Frutas")').click();
        await sleep(1500);

        console.log('📍 Seleccionando Mercados: Todos...');
        await formPage.locator('mat-checkbox:has-text("Todos")').first().click();
        await sleep(1000);

        console.log('📍 Seleccionando Productos: Todos...');
        await formPage.locator('mat-checkbox:has-text("Todos")').nth(1).click();
        await sleep(1000);

        console.log('📍 Seleccionando Origen...');
        await formPage.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('mat-checkbox'));
            const origen = checkboxes.find(cb => cb.innerText.includes('Origen'));
            if (origen && !origen.classList.contains('mat-checkbox-checked')) {
                origen.querySelector('label')?.click();
            }
        });

        await sleep(1000);

        console.log('📊 Generando informe...');
        await formPage.locator('button:has-text("Ver Informe")').click();

        await formPage.waitForSelector('button:has-text("Descargar Excel")', {
            timeout: 120000
        });

        console.log('📥 Descargando Excel...');

        const downloadButton = formPage
            .getByRole('button', { name: 'Descargar Excel' })
            .first(); // 👈 forzamos el primero
        
        await downloadButton.waitFor({ state: 'visible', timeout: 60000 });
        
        const [download] = await Promise.all([
            formPage.waitForEvent('download'),
            downloadButton.click()
        ]);

        console.log(`✅ Archivo guardado: ${filepath}`);

        const stats = fs.statSync(filepath);

        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const workbook = xlsx.readFile(filepath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        const jsonPath = path.join(dataDir, 'precios.json');
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

        console.log('✅ JSON generado correctamente');

        return {
            success: true,
            filename,
            filepath,
            size: stats.size,
            date: today
        };

    } catch (error) {
        console.error('❌ Error durante el scraping:', error.message);

        const pages = context.pages();
        for (let i = 0; i < pages.length; i++) {
            const screenshotPath = path.join(
                DOWNLOAD_DIR,
                `error_page${i}_${Date.now()}.png`
            );
            await pages[i].screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot guardado: ${screenshotPath}`);
        }

        throw error;

    } finally {
        await browser.close();
        console.log('🏁 Navegador cerrado');
    }
}

if (require.main === module) {
    scrapeODEPA()
        .then(result => {
            console.log('\n✅ Scraping completado');
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(() => {
            console.error('\n❌ Scraping falló');
            process.exit(1);
        });
}

module.exports = { scrapeODEPA };
