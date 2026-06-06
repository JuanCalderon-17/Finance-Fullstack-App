// Quick screenshot script for landing page iteration
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:4200/';
  const out = process.argv[3] || 'landing-screenshot.png';
  const viewport = process.argv[4] || 'desktop';
  const lang = process.argv[5] || null; // optional: 'es', 'en', 'pt'

  const sizes = {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 }
  };

  const size = sizes[viewport] || sizes.desktop;

  console.log(`Capturing ${url} at ${size.width}x${size.height} → ${out}${lang ? ` (lang=${lang})` : ''}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-cache']
  });

  const page = await browser.newPage();
  await page.setViewport(size);

  // Disable HTTP cache so we always fetch fresh assets (i18n JSON, etc.)
  await page.setCacheEnabled(false);

  // Pre-set language via localStorage before navigation
  if (lang) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate((l) => localStorage.setItem('app-language', l), lang);
  }

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1800));
  await page.screenshot({ path: out, fullPage: true });

  await browser.close();
  console.log(`✓ Saved ${out}`);
})().catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
