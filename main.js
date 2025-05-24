const fs = require('fs');
const { firefox } = require('playwright');
const { execSync } = require('child_process');

const targetUrl = 'https://m.betking.com/virtual/league/kingselahue/results';
const apiUrlPart = '/api/virtuals/l/feeds/online/v1/categories/2/results/';
const apiLogFile = 'API.txt';
const outputFile = 'historical.json';
const intervalMs = 3 * 60 * 1000; // 3 minutes

// Load last known API URL
function loadLastApiUrl() {
  return fs.existsSync(apiLogFile) ? fs.readFileSync(apiLogFile, 'utf8').trim() : null;
}

// Save the latest detected API URL
function saveLastApiUrl(url) {
  fs.writeFileSync(apiLogFile, url.trim());
}

// Load existing historical match data
function loadHistoricalData() {
  try {
    return fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile, 'utf8')) : {};
  } catch (err) {
    console.error('Error parsing historical.json, starting fresh:', err.message);
    return {};
  }
}

// Append matches into historical file without deduplication
function updateHistoricalData(results) {
  const historical = loadHistoricalData();

  results.forEach(result => {
    if (!result.TournamentID || !result.MatchID || !result.HomeTeam || !result.AwayTeam) {
      console.error('Invalid result data, skipping:', result);
      return;
    }

    const {
      TournamentID,
      TournamentLeagueNo,
      TournamentName,
      MatchID,
      MatchName,
      HomeTeam,
      AwayTeam
    } = result;

    const matchDetails = {
      MatchID,
      MatchName,
      score: `${HomeTeam.TeamScore} - ${AwayTeam.TeamScore}`
    };

    if (!historical[TournamentName]) {
      historical[TournamentName] = {
        TournamentID,
        TournamentLeagueNo,
        TournamentName,
        matches: []
      };
    }

    historical[TournamentName].matches.push(matchDetails);
  });

  fs.writeFileSync(outputFile, JSON.stringify(historical, null, 2));
  console.log(`Saved ${results.length} match(es) to ${outputFile}`);
}

// Commit and push changes to the repository
function commitAndPush() {
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add API.txt historical.json || true');

    // Commit only if there are staged changes
    try {
      execSync('git diff --cached --quiet');
      console.log('No changes to commit');
    } catch {
      const timestamp = new Date().toISOString();
      execSync(`git commit -m "Update data at ${timestamp} [auto]"`);
      execSync('git push');
      console.log('Committed and pushed changes to repository');
    }
  } catch (err) {
    console.error('Error during commit and push:', err.message);
  }
}

// Main polling function
async function pollAndCapture() {
  console.log(`[${new Date().toISOString()}] Starting capture session`);

  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let capturedUrl = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes(apiUrlPart) && response.status() === 200 && !capturedUrl) {
      capturedUrl = url;
      const lastUrl = loadLastApiUrl();

      if (lastUrl === capturedUrl) {
        console.log('Duplicate API response detected â skipping save.');
        return;
      }

      try {
        const data = await response.json();
        updateHistoricalData(data?.Results || []);
        saveLastApiUrl(capturedUrl);
        console.log(`New API response saved from: ${capturedUrl}`);
        commitAndPush();
      } catch (err) {
        console.error('Error parsing or saving API response:', err.message);
      }
    }
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000); // Wait for requests
  await browser.close();
  console.log('Capture session complete\n');
}

// Run immediately, then every 3 minutes
(async () => {
  try {
    await pollAndCapture();
  } catch (err) {
    console.error('Initial polling error:', err.message);
  }

  setInterval(async () => {
    try {
      await pollAndCapture();
    } catch (err) {
      console.error('Scheduled polling error:', err.message);
    }
  }, intervalMs);
})();
