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

// Enhanced anti-detection with canvas spoofing and realistic browser properties
async function spoofDetection(page) {
  await page.addInitScript(() => {
    // Spoof webdriver and other bot detection properties
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => randomBetween(2, 8) });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => randomBetween(4, 16) });

    // Realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'PDF Viewer' }
      ]
    });

    window.chrome = { runtime: {}, app: {} };

    // Spoof canvas fingerprint
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      const context = originalGetContext.apply(this, arguments);
      if (type === '2d') {
        const originalGetImageData = context.getImageData;
        context.getImageData = function (x, y, width, height) {
          const imageData = originalGetImageData.apply(this, arguments);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] += Math.floor(Math.random() * 3) - 1; // Slight RGB noise
            data[i + 1] += Math.floor(Math.random() * 3) - 1;
            data[i + 2] += Math.floor(Math.random() * 3) - 1;
          }
          return imageData;
        };
      }
      return context;
    };

    // Spoof WebGL
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37446) return 'Intel Inc.'; // VENDOR
      if (parameter === 37447) return 'Intel Iris OpenGL Engine'; // RENDERER
      return getParameter.apply(this, arguments);
    };
  });
}

// Enhanced human-like scrolling with pauses and varied patterns
async function humanScroll(page) {
  const maxScroll = await page.evaluate(() => document.body.scrollHeight);
  let currentY = 0;
  const viewportHeight = randomBetween(600, 900);

  // Scroll down with pauses
  while (currentY < maxScroll) {
    const step = randomBetween(50, 200);
    currentY = Math.min(currentY + step, maxScroll);
    await page.evaluate(_y => window.scrollTo(0, _y), currentY);
    await delay(randomBetween(100, 300));
    if (Math.random() < 0.2) await delay(randomBetween(500, 1500)); // Random pause
  }

  // Scroll up partially
  currentY = Math.max(currentY - randomBetween(viewportHeight / 2, viewportHeight), 0);
  await page.evaluate(_y => window.scrollTo(0, _y), currentY);
  await delay(randomBetween(200, 600));

  await delay(randomBetween(500, 2000)); // Final pause
}

// Enhanced random click targeting interactive elements
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
    // Fallback to random click if no interactive elements or to vary behavior
    const x = randomBetween(50, 1200);
    const y = randomBetween(100, 700);
    await page.mouse.move(x, y, { steps: randomBetween(5, 10) });
    await delay(randomBetween(50, 200));
    await page.mouse.click(x, y);
    console.log(`Clicked at (${x}, ${y})`);
  }
  await delay(randomBetween(200, 500));
}

// New function for additional human-like interactions
async function humanInteraction(page) {
  // Hover over a random element
  const hoverableElements = await page.$$('a, button, div, img');
  if (hoverableElements.length > 0 && Math.random() < 0.8) {
    const randomElement = hoverableElements[randomBetween(0, hoverableElements.length - 1)];
    await randomElement.hover();
    console.log('Hovered over an element');
    await delay(randomBetween(200, 600));
  }

  // Type in an input field if available
  const input = await page.$('input[type="text"], input[type="search"]');
  if (input && Math.random() < 0.5) {
    const searchTerms = ['test query', 'example', 'search term', 'hello world'];
    const term = searchTerms[randomBetween(0, searchTerms.length - 1)];
    await input.type(term, { delay: randomBetween(80, 150) });
    console.log(`Typed "${term}" in input field`);
    await delay(randomBetween(500, 1500));
  }

  // Click another interactive element
  if (Math.random() < 0.3) {
    await randomClick(page);
  }
}

async function interactWithUrl(proxy, userAgent, url) {
  // Randomize viewport size for varied fingerprints
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
      await humanScroll(page);
      await randomClick(page);
      await humanInteraction(page); // Added human-like interactions
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
