const fs = require('fs');
const { firefox } = require('playwright');
const { execSync } = require('child_process');

const targetUrl = 'https://m.betking.com/virtual/league/kings-league/results';
const apiUrlPart = '/api/virtuals/l/feeds/online/v1/categories/2/results/';
const apiLogFile = 'API.txt';
const outputFile = 'historical.json';
const intervalMs = 3 * 60 * 1000; // 3 minutes

// Load last known API URL
function loadLastApiUrl() {
  if (fs.existsSync(apiLogFile)) {
    return fs.readFileSync(apiLogFile, 'utf8').trim();
  }
  return null;
}

// Save the latest detected API URL
function saveLastApiUrl(url) {
  fs.writeFileSync(apiLogFile, url.trim());
}

// Load existing historical match data
function loadHistoricalData() {
  if (fs.existsSync(outputFile)) {
    return JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  }
  return {};
}

// Append matches into historical file without deduplication
function updateHistoricalData(results) {
  let historical = loadHistoricalData();

  results.forEach(result => {
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

// Git commit and push changes
function gitCommitAndPush() {
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git add historical.json API.txt');
    execSync('git commit -m "Update historical data and API tracking [skip ci]"');
    execSync('git push');
    console.log('Changes pushed to remote repository.');
  } catch (error) {
    if (error.message.includes('nothing to commit')) {
      console.log('No changes to commit.');
    } else {
      console.error('Git push failed:', error.message);
    }
  }
}

// Main polling function
async function pollAndCapture() {
  console.log(`[${new Date().toISOString()}] Starting capture session...`);

  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let capturedUrl = null;

  // Listen for targeted API response
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

        // Commit and push after saving files
        gitCommitAndPush();

      } catch (err) {
        console.error('Error parsing or saving API response:', err.message);
      }
    }
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000); // Wait for requests to complete

  await browser.close();
  console.log('Capture session complete.\n');
}

// Run immediately, then repeat every 3 minutes
(async () => {
  await pollAndCapture();
  setInterval(pollAndCapture, intervalMs);
})();
