const fs = require('fs');
const { firefox } = require('playwright');

(async () => {
  const sessionPath = './session.json';
  const profileURL = 'https://web.facebook.com/profile.php';

  const browser = await firefox.launch({ headless: false });
  const context = fs.existsSync(sessionPath)
    ? await browser.newContext({ storageState: sessionPath })
    : await browser.newContext();

  const page = await context.newPage();
  await page.goto(profileURL);
  await page.waitForTimeout(10000); // Wait for session-based login

  const currentURL = page.url();

  if (!currentURL.startsWith(profileURL)) {
    console.error('Login check failed via session.');
    await page.screenshot({ path: 'failed-login.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('Login verified via session.');
  await browser.close();
})();
