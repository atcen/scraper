const { chromium } = require('playwright');
const http = require('http');
const process = require('process');
require('dotenv').config();

// Create HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const browser = await chromium.launch({ headless: true, slowMo: 300 });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();

    // Login starten
    await page.goto(`https://www.sunnyportal.com/`, { waitUntil: 'networkidle' });
    console.log('Aktuelle URL (Start):', page.url());

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#ctl00_ContentPlaceHolder1_Logincontrol1_SmaIdLoginButton')
    ]);
    console.log('Nach Klick auf Login-Button:', page.url());

    await page.fill('#username', process.env.SP_USERNAME);
    await page.fill('#password', process.env.SP_PASSWORD);

    await page.check('#rememberMe');

    // Login absenden und auf Weiterleitung warten
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[name="login"]')
    ]);
    console.log('Nach Login:', page.url());

    // Wartezeit für evtl. automatische Weiterleitung
    await page.waitForTimeout(1000);
    //await page.screenshot({ path: '3.png' });

    // Auf die gewünschte Seite navigieren
    const navItem = await page.$('#lmiHomanLive a');
    if (!navItem) {
      throw new Error('Navigationslink #lmiHomanLive a nicht gefunden – evtl. Login fehlgeschlagen');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      navItem.click()
    ]);
    console.log('Nach Navigation zu HoManLive:', page.url());

    // Daten extrahieren
    const data = {
      pvPower: await extractNumber(page, '#pvpower').catch(() => null),
      feedIn: await extractNumber(page, '#feedin'),
      selfConsumption: await extractNumber(page, '#selfcsmp'),
      gridConsumption: await extractNumber(page, '#gridcsmp'),
      totalConsumption: await extractNumber(page, '#csmp'),
      selfConsumptionRate: await extractNumber(page, '#selfcsmpQuote'),
      batteryPower: await extractNumber(page, '#ctl00_ContentPlaceHolder1_SelfConsumption_Status1_BatteryPower'),
      batteryChargeStatus: await extractNumber(page, '#ctl00_ContentPlaceHolder1_SelfConsumption_Status1_BatteryChargeStatus')
    };

    await browser.close();

    // HTML generieren
    const html = generateHtmlTable(data);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error occurred while scraping data: ${error.message}`);
  }
});

// Helper function to extract numeric values
async function extractNumber(page, selector) {
  const text = await page.$eval(selector, el => el.textContent.trim());
  return parseFloat(text.replace(/[^0-9.]/g, ''));
}

// Generate HTML table from data
function generateHtmlTable(data) {
  const rows = [
    { label: 'PV-Erzeugung in W', value: data.pvPower },
    { label: 'Netzeinspeisung in W', value: data.feedIn },
    { label: 'Eigenverbrauch in W', value: data.selfConsumption },
    { label: 'Netzbezug in W', value: data.gridConsumption },
    { label: 'Gesamtverbrauch in W', value: data.totalConsumption },
    { label: 'Eigenverbrauchsquote in %', value: data.selfConsumptionRate },
    { label: 'Batterieentladung in W', value: data.batteryPower },
    { label: 'Batterieladezustand in %', value: data.batteryChargeStatus }
  ];

  const tableRows = rows.map(row => {
    const id = row.label.toLowerCase().replace(/ /g, '-');
    return `<tr>
      <td id="${id}-label">${row.label}</td>
      <td id="${id}-value">${!isNaN(row.value) ? row.value : ''}</td>
    </tr>`;
  }).join('');

  return `
    <html>
      <head>
        <style>
          table { border-collapse: collapse; width: 100%; max-width: 800px; margin: 20px auto; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1 style="text-align: center;">Sunny Portal Data</h1>
        <table>
          <tr><th>Label</th><th>Value</th></tr>
          ${tableRows}
        </table>
      </body>
    </html>
  `;
}

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});