# ODEPA Price Scraper 🇨🇱

Bot automático que descarga diariamente los precios de frutas desde ODEPA.

## ¿Qué hace?

1. 🌐 Navega a https://reportes.odepa.gob.cl
2. 🍎 Selecciona **Frutas**
3. ✅ Selecciona todos los mercados y productos
4. ✅ Marca detalle: Origen
5. 📊 Genera el informe
6. 📥 Descarga el Excel

## Ejecución automática

El workflow de GitHub Actions corre automáticamente:
- **Horario:** Lunes a Viernes a las 08:30 Chile
- **Manual:** Desde Actions → "Run workflow"

## Ejecución local

```bash
npm install
npx playwright install chromium
npm run scrape
