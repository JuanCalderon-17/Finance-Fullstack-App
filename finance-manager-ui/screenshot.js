// Quick screenshot script for landing page iteration
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:4200/';
  const out = process.argv[3] || 'landing-screenshot.png';
  const viewport = process.argv[4] || 'desktop';

  const sizes = {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 }
  };

  const size = sizes[viewport] || sizes.desktop;

  console.log(`Capturing ${url} at ${size.width}x${size.height} → ${out}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(size);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Give animations a moment to settle
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: out, fullPage: true });

  await browser.close();
  console.log(`✓ Saved ${out}`);
})().catch(err => {
  console.error('Screenshot failed:', err.message);
  process.exit(1);
});
