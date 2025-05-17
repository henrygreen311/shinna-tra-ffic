const fs = require('fs');
const axios = require('axios');
const { firefox } = require('playwright');
const { HttpsProxyAgent } = require('https-proxy-agent');

function getRandomUserAgent(filePath) {
  const userAgents = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(ua => ua.trim())
    .filter(ua => ua.length > 0);
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function spoofDetection(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => randomBetween(2, 8) });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => randomBetween(4, 16) });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'PDF Viewer' }
      ]
    });

    window.chrome = { runtime: {}, app: {} };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      const context = originalGetContext.apply(this, arguments);
      if (type === '2d') {
        const originalGetImageData = context.getImageData;
        context.getImageData = function (x, y, width, height) {
          const imageData = originalGetImageData.apply(this, arguments);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] += Math.floor(Math.random() * 3) - 1;
            data[i + 1] += Math.floor(Math.random() * 3) - 1;
            data[i + 2] += Math.floor(Math.random() * 3) - 1;
          }
          return imageData;
        };
      }
      return context;
    };

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37446) return 'Intel Inc.';
      if (parameter === 37447) return 'Intel Iris OpenGL Engine';
      return getParameter.apply(this, arguments);
    };
  });
}

async function humanScroll(page) {
  const maxScroll = await page.evaluate(() => document.body.scrollHeight);
  let currentY = 0;
  const viewportHeight = randomBetween(600, 900);

  while (currentY < maxScroll) {
    const step = randomBetween(50, 200);
    currentY = Math.min(currentY + step, maxScroll);
    await page.evaluate(_y => window.scrollTo(0, _y), currentY);
    await delay(randomBetween(100, 300));
    if (Math.random() < 0.2) await delay(randomBetween(500, 1500));
  }

  currentY = Math.max(currentY - randomBetween(viewportHeight / 2, viewportHeight), 0);
  await page.evaluate(_y => window.scrollTo(0, _y), currentY);
  await delay(randomBetween(200, 600));

  await delay(randomBetween(500, 2000));
}

async function randomClick(page) {
  const elements = await page.$$('a, button, [role="button"], [onclick]');
  if (elements.length > 0 && Math.random() < 0.7) {
    const randomElement = elements[randomBetween(0, elements.length - 1)];
    const boundingBox = await randomElement.boundingBox();
    if (boundingBox) {
      const x = boundingBox.x + boundingBox.width / 2 + randomBetween(-10, 10);
      const y = boundingBox.y + boundingBox.height / 2 + randomBetween(-10, 10);
      await page.mouse.move(x, y, { steps: randomBetween(5, 10) });
      await delay(randomBetween(50, 200));
      await page.mouse.click(x, y);
      console.log(`Clicked interactive element at (${x}, ${y})`);
    }
  } else {
    const x = randomBetween(50, 1200);
    const y = randomBetween(100, 700);
    await page.mouse.move(x, y, { steps: randomBetween(5, 10) });
    await delay(randomBetween(50, 200));
    await page.mouse.click(x, y);
    console.log(`Clicked at (${x}, ${y})`);
  }
  await delay(randomBetween(200, 500));
}

async function humanInteraction(page) {
  const hoverableElements = await page.$$('a, button, div, img');
  if (hoverableElements.length > 0 && Math.random() < 0.8) {
    const randomElement = hoverableElements[randomBetween(0, hoverableElements.length - 1)];
    try {
      await randomElement.hover({ timeout: 5000 }); // Reduced timeout to avoid long waits
      console.log('Hovered over an element');
      await delay(randomBetween(200, 600));
    } catch (e) {
      console.log(`Hover failed: ${e.message}`);
    }
  }

  const input = await page.$('input[type="text"], input[type="search"]');
  if (input && Math.random() < 0.5) {
    const searchTerms = ['test query', 'example', 'search term', 'hello world'];
    const term = searchTerms[randomBetween(0, searchTerms.length - 1)];
    await input.type(term, { delay: randomBetween(80, 150) });
    console.log(`Typed "${term}" in input field`);
    await delay(randomBetween(500, 1500));
  }

  if (Math.random() < 0.3) {
    await randomClick(page);
  }
}

// New function to detect and close pop-ups
async function handlePopUp(page) {
  try {
    // Common selectors for pop-ups/modals
    const popUpSelectors = [
      'div[class*="modal"]',
      'div[class*="popup"]',
      'div[class*="overlay"]',
      'div[id*="modal"]',
      'div[id*="popup"]',
      'div[role="dialog"]',
      'div[aria-modal="true"]'
    ].join(', ');

    const popUp = await page.$(popUpSelectors);
    if (popUp) {
      console.log('Pop-up detected');
      // Look for close buttons
      const closeButtonSelectors = [
        'button[class*="close"]',
        'button[aria-label*="close"]',
        'button[aria-label*="dismiss"]',
        'a[class*="close"]',
        'div[class*="close"]',
        'button[id*="close"]',
        'span[class*="close"]',
        '[onclick*="close"]',
        'button:has(svg)', // Common for icon-based close buttons
        'button:near([class*="modal"], 50)', // Close buttons near modals
        '[class*="modal"] button' // Any button inside modal
      ].join(', ');

      const closeButton = await popUp.$(closeButtonSelectors);
      if (closeButton) {
        const boundingBox = await closeButton.boundingBox();
        if (boundingBox) {
          const x = boundingBox.x + boundingBox.width / 2;
          const y = boundingBox.y + boundingBox.height / 2;
          await page.mouse.move(x, y, { steps: 5 });
          await delay(randomBetween(50, 150));
          await closeButton.click();
          console.log('Closed pop-up via close button');
          await delay(1000); // Wait for pop-up to close
          return true;
        }
      }

      // Fallback: Try pressing Escape key
      await page.keyboard.press('Escape');
      console.log('Attempted to close pop-up with Escape key');
      await delay(1000);
      return true;
    }
    console.log('No pop-up detected');
    return false;
  } catch (e) {
    console.log(`Error handling pop-up: ${e.message}`);
    return false;
  }
}

async function interactWithUrl(proxy, userAgent, url) {
  const width = randomBetween(1280, 1440);
  const height = randomBetween(720, 900);
  const context = await firefox.launchPersistentContext('', {
    headless: false,
    viewport: { width, height },
    userAgent,
    proxy: { server: `http://${proxy}` }
  });

  const page = await context.newPage();
  await spoofDetection(page);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });

    const content = await page.content();
    if (content.includes("Anonymous Proxy detected")) {
      console.log(`Rejected proxy (${proxy}): Detected as anonymous proxy.`);
    } else {
      console.log(`Loaded: ${url}`);
      await delay(15000);

      // Check and close pop-up before interactions
      await handlePopUp(page);

      await humanScroll(page);
      await randomClick(page);
      await humanInteraction(page);
    }
  } catch (e) {
    console.log(`Error with proxy ${proxy}:`, e.message);
  } finally {
    await context.close();
    console.log(`Closed browser for proxy: ${proxy}\n`);
  }
}

async function fetchProxies() {
  const res = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=all&anonymity=elite');
  return res.data.split('\n').map(p => p.trim()).filter(Boolean).slice(0, 500);
}

async function isProxyValid(proxy) {
  const agent = new HttpsProxyAgent(`http://${proxy}`);
  try {
    const test = await axios.get('https://example.com/', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 4000
    });

    if (test.status === 200) {
      const geo = await axios.get(`https://ipapi.co/${proxy.split(':')[0]}/json/`, { timeout: 4000 });
      const country = geo.data?.country;
      if (country === 'US' || country === 'CA') {
        console.log(`Excluded proxy from ${country}: ${proxy}`);
        return null;
      }
      return { proxy, country };
    }
  } catch (_) {}
  return null;
}

(async () => {
  const url = 'https://convictionfoolishbathroom.com/spgbsmce6y?key=b7b18ab0269611b5429b01935d29fe65';
  const tested = new Set();

  while (true) {
    const proxies = await fetchProxies();
    console.log(`Testing ${proxies.length} proxies...\n`);
    let foundAny = false;

    for (const batch of chunk(proxies, 10)) {
      const results = await Promise.allSettled(batch.map(async proxy => {
        if (tested.has(proxy)) return null;
        tested.add(proxy);
        return await isProxyValid(proxy);
      }));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          foundAny = true;
          const { proxy } = result.value;
          const userAgent = getRandomUserAgent('user_agents.txt');
          console.log(`Using User-Agent: ${userAgent}`);
          await interactWithUrl(proxy, userAgent, url);
        }
      }
    }

    if (!foundAny) {
      console.log('No valid proxy found in this batch. Will fetch a new list...\n');
      await delay(3000);
    }
  }
})();

function chunk(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}
