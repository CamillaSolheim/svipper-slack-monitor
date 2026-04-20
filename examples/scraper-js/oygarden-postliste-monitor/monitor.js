const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { scrapePostliste, withSearchTerm } = require('./scraper');
const { sendSlackNotification } = require('./notifier');

dotenv.config();

function resolveStatePath() {
  const configured = process.env.STATE_FILE || './data/seen-cases.json';
  return path.resolve(process.cwd(), configured);
}

function readState(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) {
      return { seenUids: [], lastRunAt: null };
    }
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    console.warn(`Klarte ikke lese state-fil (${stateFile}): ${error.message}`);
    return { seenUids: [], lastRunAt: null };
  }
}

function writeState(stateFile, state) {
  const dir = path.dirname(stateFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function runMonitor() {
  const searchTerm = process.env.SEARCH_TERM || 'båtvrak';
  const stateFile = resolveStatePath();
  const maxLoadMoreClicks = Number(process.env.MAX_LOAD_MORE_CLICKS || '40');

  const previousState = readState(stateFile);
  const knownUids = new Set(previousState.seenUids || []);

  const scrapeResult = await scrapePostliste({ searchTerm, maxLoadMoreClicks });
  const sourceUrl = withSearchTerm(searchTerm);

  const newCases = scrapeResult.items.filter((item) => item.uid && !knownUids.has(item.uid));

  console.log(`Tidligere kjente saker: ${knownUids.size}`);
  console.log(`Nye saker funnet nå: ${newCases.length}`);

  if (newCases.length > 0) {
    console.log('Nye saker:');
    for (const entry of newCases) {
      console.log(`- ${entry.publishedDate || 'ukjent dato'} | ${entry.caseNumber || 'ukjent saksnr'} | ${entry.title}`);
    }

    const notifyResult = await sendSlackNotification(newCases, {
      sourceUrl,
      slackBotToken: process.env.SLACK_BOT_TOKEN,
      slackChannel: process.env.SLACK_CHANNEL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
    });

    if (notifyResult.sent) {
      console.log(`Slack-varsel sendt via ${notifyResult.transport}`);
    } else {
      console.log(`Slack-varsel ikke sendt: ${notifyResult.reason}`);
    }
  }

  const nextSeen = Array.from(new Set([
    ...knownUids,
    ...scrapeResult.items.map((item) => item.uid).filter(Boolean)
  ]));

  writeState(stateFile, {
    searchTerm,
    sourceUrl: scrapeResult.url,
    lastRunAt: new Date().toISOString(),
    seenUids: nextSeen
  });

  return {
    sourceUrl: scrapeResult.url,
    searchTerm,
    totalItems: scrapeResult.count,
    newItems: newCases.length,
    stateFile
  };
}

if (require.main === module) {
  runMonitor()
    .then((result) => {
      console.log('Monitor ferdig:', JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error('Monitor feilet:', error.message);
      process.exit(1);
    });
}

module.exports = { runMonitor };
