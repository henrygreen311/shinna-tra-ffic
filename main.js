const fs = require('fs');
const { firefox } = require('playwright');

(async () => {
  const sessionPath = './session.json';
  const profileURLs = ['https://web.facebook.com/profile.php?id=61566984302826', 'https://www.facebook.com/profile.php?id=61566984302826']; // Array of valid profile URLs
  const pageListPath = './page.txt';
  const commentPath = './comment.txt';

  // Read comments from comment.txt
  if (!fs.existsSync(commentPath)) {
    console.error('comment.txt not found.');
    return;
  }
  const commentLines = fs.readFileSync(commentPath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (commentLines.length === 0) {
    console.error('No valid comments found in comment.txt.');
    return;
  }

  // Function to get random comment
  const getRandomComment = (comments) => {
    const randomIndex = Math.floor(Math.random() * comments.length);
    return comments[randomIndex];
  };

  const browser = await firefox.launch({ headless: false });
  const context = fs.existsSync(sessionPath)
    ? await browser.newContext({ storageState: sessionPath })
    : await browser.newContext();

  const page = await context.newPage();
  await page.goto(profileURLs[0]); // Navigate to one of the profile URLs initially
  await page.waitForTimeout(10000);

  let currentURL = page.url();

  // Handle login fallback
  if (!profileURLs.some(url => currentURL.startsWith(url))) { // Check if current URL matches any profile URL
    console.warn('Login check failed. Attempting manual login...');
    try {
      await page.fill('input[name="email"]', '07076120343');
      await page.fill('input[name="pass"]', 'Henry311@');
      await page.click('button[name="login"]');
      await page.waitForTimeout(10000);
      await page.goto(profileURLs[0]); // Try navigating to the first profile URL again
      await page.waitForTimeout(5000);
      currentURL = page.url();

      if (profileURLs.some(url => currentURL.startsWith(url))) { // Verify login against both URLs
        console.log('Manual login successful. Updating session...');
        await context.storageState({ path: sessionPath });
      } else {
        console.error('Manual login failed.');
        await browser.close();
        return;
      }
    } catch (err) {
      console.error('Error during manual login:', err);
      await browser.close();
      return;
    }
  } else {
    console.log('Login verified via session.');
  }

  // Load page list
  if (!fs.existsSync(pageListPath)) {
    console.error('page.txt not found.');
    await browser.close();
    return;
  }

  const urls = fs.readFileSync(pageListPath, 'utf-8')
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  // Function to get random URL
  const getRandomUrl = (urls) => {
    const randomIndex = Math.floor(Math.random() * urls.length);
    return urls[randomIndex];
  };

  // Loop through pages forever
  while (true) {
    const url = getRandomUrl(urls);
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    let commentPosted = false;

    for (let i = 0; i < 5; i++) {
      try {
        const commentBox = await page.$('[contenteditable="true"]:has(p:has(br))');
        if (commentBox) {
          const commentText = getRandomComment(commentLines); // Select a random comment
          await commentBox.click({ force: true });
          await page.keyboard.insertText(commentText);
          await page.keyboard.press('Enter');
          console.log(`Comment posted on: ${url}: ${commentText}`);
          commentPosted = true;
          break;
        }
      } catch (err) {
        // Silently retry
      }

      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(3000);
    }

    if (!commentPosted) {
      console.warn(`No comment box found on: ${url} after 5 scroll attempts.`);
    }

    await page.waitForTimeout(600000);
  }

  // Unreachable, but safe cleanup if loop ends
  await browser.close();
})();
