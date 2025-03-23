const { chromium } = require('playwright');
const http = require('http');
const process = require('process');
require('dotenv').config();


// Create HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const browser = await chromium.launch({ 
      headless: true,
      slowMo: 100 // Verlangsamt die Ausführung für bessere Beobachtung
    });
    const page = await browser.newPage();

    // Login
    // der clientsecret ist nicht geheim, da er im Quellcode des Portals steht
    await page.goto(`https://login.sma.energy/auth/realms/SMA/protocol/openid-connect/auth?response_type=code&client_id=SunnyPortalClassic&client_secret=baa6d5fe-f905-4fb2-bc8e-8f218acc2835&redirect_uri=https%3a%2f%2fwww.sunnyportal.com%2fTemplates%2fStart.aspx&ui_locales=de`);
    await page.waitForSelector('.login-card__body');
    await page.fill('#username', process.env.SP_USERNAME);
    await page.fill('#password', process.env.SP_PASSWORD);
    await page.click('button[name="login"]');
    
    // Wait for login to complete and navigate to target page
    console.log('Waiting for login to complete...');
    await page.waitForTimeout(1000);
    await page.click('#ctl00_ContentPlaceHolder1_Logincontrol1_SmaIdLoginButton');
    await page.goto('https://www.sunnyportal.com/FixedPages/HoManLive.aspx', { waitUntil: 'networkidle' });

    // Extract data
    const data = {
      pvPower: await extractNumber(page, '#pvpower'),
      feedIn: await extractNumber(page, '#feedin'),
      selfConsumption: await extractNumber(page, '#selfcsmp'),
      gridConsumption: await extractNumber(page, '#gridcsmp'),
      totalConsumption: await extractNumber(page, '#csmp'),
      selfConsumptionRate: await extractNumber(page, '#selfcsmpQuote'),
      batteryPower: await extractNumber(page, '#ctl00_ContentPlaceHolder1_SelfConsumption_Status1_BatteryPower'),
      batteryChargeStatus: await extractNumber(page, '#ctl00_ContentPlaceHolder1_SelfConsumption_Status1_BatteryChargeStatus')
    };

    await browser.close();

    // Generate HTML table
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

  const tableRows = rows
    .map(row => {
      const id = row.label.toLowerCase().replace(/ /g, '-');
      return `<tr>
        <td id="${id}-label">${row.label}</td>
        <td id="${id}-value">${!isNaN(row.value) ? row.value : ''}</td>
      </tr>`;
    })
    .join('');

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
