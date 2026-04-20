const axios = require('axios');

function buildMessage(newCases, sourceUrl) {
  const header = `🆕 Nye postliste-saker (${newCases.length}) for søk «båtvrak»`;
  const lines = newCases.slice(0, 15).map((entry) => {
    const date = entry.publishedDate || 'Ukjent dato';
    const title = entry.title || 'Ukjent tittel';
    const caseId = entry.caseNumber || 'Ukjent saksnr';
    return `• ${date} — *${title}* (saksnr: ${caseId})`;
  });

  const overflow = newCases.length > 15
    ? [`… og ${newCases.length - 15} til.`]
    : [];

  return [header, ...lines, ...overflow, `\nKilde: ${sourceUrl}`].join('\n');
}

async function sendViaSlackBotToken(text, botToken, channel) {
  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel, text, mrkdwn: true },
    {
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.data?.ok) {
    throw new Error(`Slack API-feil: ${response.data?.error || 'ukjent feil'}`);
  }
}

async function sendViaSlackWebhook(text, webhookUrl) {
  await axios.post(webhookUrl, { text }, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function sendSlackNotification(newCases, options) {
  if (!newCases.length) {
    return { sent: false, reason: 'Ingen nye saker' };
  }

  const {
    sourceUrl,
    slackBotToken,
    slackChannel,
    slackWebhookUrl
  } = options;

  const text = buildMessage(newCases, sourceUrl);

  if (slackBotToken && slackChannel) {
    await sendViaSlackBotToken(text, slackBotToken, slackChannel);
    return { sent: true, transport: 'slack-bot-token' };
  }

  if (slackWebhookUrl) {
    await sendViaSlackWebhook(text, slackWebhookUrl);
    return { sent: true, transport: 'slack-webhook' };
  }

  return { sent: false, reason: 'Mangler Slack-konfigurasjon' };
}

module.exports = { sendSlackNotification, buildMessage };
