const fs = require('fs');
const { firefox } = require('playwright');

function getRandomUserAgent(filePath) {
  const userAgents = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(ua => ua.trim())
    .filter(ua => ua.length > 0);
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function humanScroll(page, positions = [0, 320, 750]) {
  const targetY = positions[Math.floor(Math.random() * positions.length)];
  for (let y = 0; y <= targetY; y += randomBetween(10, 30)) {
    await page.evaluate(_y => window.scrollTo(0, _y), y);
    await delay(randomBetween(30, 70));
  }
  await delay(randomBetween(300, 800));
}

async function randomClicksOnly(page) {
  for (let i = 0; i < 3; i++) {
    const x = randomBetween(50, 1200);
    const y = randomBetween(100, 700);
    await page.mouse.move(x, y, { steps: randomBetween(5, 10) });
    await delay(randomBetween(100, 300));
    await page.mouse.click(x, y);
    console.log(`Clicked at (${x}, ${y}) (attempt ${i + 1})`);
    await delay(300);
  }
}

async function closePopups(page) {
  try {
    const popupSelectors = [
      'div[role="dialog"]',
      '.vfm__container',
      '.modal',
      '.popup',
      '.overlay',
      '.cookie-consent',
      '[aria-modal="true"]',
      '[data-modal]',
      '#modal',
      '.popup-overlay',
      '.cookie-banner'
    ];

    for (const selector of popupSelectors) {
      const popup = await page.$(selector);
      if (popup) {
        const closeBtn = await popup.$('button, [aria-label="close"], .close, .btn-close');
        if (closeBtn) {
          try {
            await closeBtn.click();
            console.log(`Closed popup with selector: ${selector}`);
            await delay(1000);
            return;
          } catch {
            await page.evaluate(sel => {
              const el = document.querySelector(sel);
              if (el) el.remove();
            }, selector);
            console.log(`Removed popup from DOM: ${selector}`);
            await delay(500);
            return;
          }
        } else {
          await page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (el) el.remove();
          }, selector);
          console.log(`Removed popup from DOM (no close btn): ${selector}`);
          await delay(500);
          return;
        }
      }
    }
  } catch (e) {
    console.log('Error during popup close:', e.message);
  }
}

async function spoofDetection(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });
}

async function interactWithUrl(context, url) {
  const page = await context.newPage();
  await spoofDetection(page);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`Loaded: ${url}`);
    console.log('Waiting 20s...');
    await delay(20000);

    await closePopups(page);

    await humanScroll(page);
    await humanScroll(page);

    await closePopups(page);

    await randomClicksOnly(page);

    await closePopups(page);

    await delay(10000);
  } catch (e) {
    console.error(`Error on ${url}:`, e.message);
  } finally {
    await page.close();
  }
}

(async () => {
  const userAgent = getRandomUserAgent('user_agents.txt');

  const context = await firefox.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1366, height: 768 },
    userAgent
  });

  console.log(`Using User-Agent: ${userAgent}`);

  await interactWithUrl(context, 'https://www.profitableratecpm.com/j6fq2r6q?key=66cd4352f688d2ce519b42fbaea5055a');
  await interactWithUrl(context, 'https://otieu.com/4/9334857');

  await context.close();
})();
