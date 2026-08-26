import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 Launching Google Chrome browser...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('request', req => {
    if (req.url().includes('/auth/login')) {
      console.log('➡️ OUTGOING REQUEST:', req.method(), req.url());
    }
  });
  page.on('response', res => {
    if (res.url().includes('/auth/login')) {
      console.log('⬅️ RESPONSE:', res.status(), res.url());
    }
  });
  page.on('requestfailed', req => {
    if (req.url().includes('/auth/login')) {
      console.log('❌ REQUEST FAILED:', req.method(), req.url(), req.failure()?.errorText);
    }
  });

  console.log('🌐 Navigating to https://restrovico.vercel.app/ ...');
  await page.goto('https://restrovico.vercel.app/', { waitUntil: 'networkidle0' });

  console.log('📄 Page Title:', await page.title());

  console.log('⌨️ Typing credentials...');
  await page.waitForSelector('input[type="text"], input[type="email"]');
  await page.type('input[type="text"], input[type="email"]', 'karnveer@scriza.in');
  await page.type('input[type="password"]', 'Karnveer@2026');

  console.log('🔘 Clicking Sign In...');
  const button = await page.waitForSelector('button[type="submit"]');
  await button.click();

  await new Promise(r => setTimeout(r, 4000));

  const content = await page.content();
  const isLoggedIn = content.includes('Dashboard') || content.includes('RestroVico Flagship') || content.includes('Karnveer') || content.includes('Welcome back');

  console.log('RESULTS:');
  console.log('- Text contents matched:', content.substring(0, 300));

  await page.screenshot({ path: '/Users/karnveersingh/.gemini/antigravity/scratch/login-test.png' });
  console.log('📸 Screenshot saved to scratch/login-test.png');

  await browser.close();
})();
