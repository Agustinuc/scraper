/**
 * ODEPA Daily Price Scraper - FRUTAS
 * 
 * Descarga automáticamente el Excel de precios diarios de FRUTAS
 * desde https://reportes.odepa.gob.cl
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const xlsx = require("xlsx");

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
        console.log('📍 Navegando a ODEPA Mayoristas...');
        await page.goto(ODEPA_LANDING_URL, { waitUntil: 'networkidle', timeout: 60000 });
        await sleep(3000);

        console.log('🔍 Buscando "Acceder a la consulta"...');
        const [newPage] = await Promise.all([
            context.waitForEvent('page'),
            page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const accessLink = links.find(a =>
                    a.textContent.includes('Acceder a la consulta') &&
                    a.href.includes('reportes.odepa.gob.cl')
                );
                if (accessLink) {
                    accessLink.click();
                    return true;
                }
                return false;
            })
        ]);

        console.log('✅ Nueva pestaña abierta con el formulario');

        const formPage = newPage;
        await formPage.waitForLoadState('networkidle');
        await sleep(5000);

        await formPage.waitForSelector('text=Parámetros de consulta', { timeout: 30000 });
        console.log('✅ Formulario de parámetros cargado');

        console.log('🍎 Seleccionando Frutas...');
        await formPage.click('mat-radio-button:has-text("Frutas")');
        await sleep(1500);

        console.log('📍 Seleccionando Mercados: Todos...');
        const mercadosTodos = formPage.locator('mat-checkbox:has-text("Todos")').first();
        await mercadosTodos.click();
        await sleep(1000);

        console.log('📍 Seleccionando Productos: Todos...');
        const productosTodos = formPage.locator('mat-checkbox:has-text("Todos")').nth(1);
        await productosTodos.click();
        await sleep(1000);

        console.log('📍 Seleccionando Origen en detalles...');
        await formPage.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('mat-checkbox'));
            const origenCb = checkboxes.find(c => c.innerText.includes('Origen'));
            if (origenCb && !origenCb.classList.contains('mat-checkbox-checked')) {
                origenCb.querySelector('label').click();
            }
        });

        console.log('  ✅ Origen seleccionado');
        await sleep(1000);

        console.log('📍 Generando informe...');
        await formPage.click('button:has-text("Ver Informe")');

        console.log('⏳ Esperando generación del informe...');
        await formPage.waitForSelector('button:has-text("Descargar Excel")', { timeout: 120000 });
        await sleep(3000);

        console.log('✅ Informe generado');

        console.log('📥 Descargando Excel...');
        const [download] = await Promise.all([
            formPage.waitForEvent('download'),
            formPage.click('button:has-text("Descargar Excel")')
        ]);

        const today = new Date().toISOString().split('T')[0];
        const filename = `odepa_frutas_${today}.xlsx`;
        const filepath = path.join(DOWNLOAD_DIR, filename);

        await download.saveAs(filepath);
        console.log(`✅ Archivo guardado: ${filepath}`);

        const stats = fs.statSync(filepath);
        console.log(`📊 Tamaño del archivo: ${(stats.size / 1024).toFixed(2)} KB`);

        // Crear carpeta data si no existe
        const dataDir = path.join(__dirname, "data");
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Leer Excel descargado
        const workbook = xlsx.readFile(filepath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        // Guardar JSON
        const jsonPath = path.join(dataDir, "precios.json");
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        
        console.log("✅ JSON generado correctamente");
        
    
        
        console.log("JSON generado correctamente")

        return { success: true, filename, filepath, size: stats.size, date: today };

    } catch (error) {
        console.error('❌ Error durante el scraping:', error.message);
        const pages = context.pages();
        for (let i = 0; i < pages.length; i++) {
            const screenshotPath = path.join(DOWNLOAD_DIR, `error_page${i}_${Date.now()}.png`);
            await pages[i].screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot de error guardado: ${screenshotPath}`);
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
            console.log('\n✅ Scraping completado exitosamente');
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Scraping falló');
            process.exit(1);
        });
}

module.exports = { scrapeODEPA };
