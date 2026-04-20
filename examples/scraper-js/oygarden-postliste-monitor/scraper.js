const { chromium } = require('playwright');

const BASE_URL = 'https://www.oygarden.kommune.no/tjenester/innsyn-og-naring/innsyn/postliste/#/';

function withSearchTerm(searchTerm) {
  return `${BASE_URL}?searchTerm=${encodeURIComponent(searchTerm)}`;
}

function normalizeWhitespace(input) {
  return (input || '').replace(/\s+/g, ' ').trim();
}

async function rateLimit(page, ms = 1000) {
  await page.waitForTimeout(ms);
}

async function scrapePostliste({ searchTerm = 'båtvrak', maxLoadMoreClicks = 40 } = {}) {
  const url = withSearchTerm(searchTerm);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    console.log(`Åpner ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Vent litt ekstra fordi siden er SPA og kan bruke async API-kall.
    await rateLimit(page, 1500);

    // Cookie-banner kan variere; prøv et sett med vanlige knapper.
    const cookieCandidates = [
      'button:has-text("Godta")',
      'button:has-text("Aksepter")',
      'button:has-text("Tillat alle")',
      'button:has-text("Avvis")'
    ];

    for (const selector of cookieCandidates) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        await btn.click();
        await rateLimit(page, 1000);
        break;
      }
    }

    // Forsøk å laste inn flere resultater.
    for (let i = 0; i < maxLoadMoreClicks; i += 1) {
      const loadMoreBtn = page
        .locator('button:has-text("Hent flere"), button:has-text("Vis flere"), button:has-text("Last flere")')
        .first();

      if (await loadMoreBtn.count() === 0 || !(await loadMoreBtn.isVisible())) {
        break;
      }

      await loadMoreBtn.click();
      await rateLimit(page, 1200);
    }

    // Robust uttrekk: prøv tabellrader først, fallback til kort/liste-elementer.
    let cases = await page.$$eval('table tbody tr', (rows) => {
      const normalize = (v) => (v || '').replace(/\s+/g, ' ').trim();

      return rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll('td')).map((cell) => normalize(cell.textContent));
          const fullText = normalize(row.textContent);
          const link = row.querySelector('a')?.href || null;

          if (!fullText) return null;

          const caseNumber = cells.find((c) => /\d{2,4}\/\d+/.test(c)) || fullText.match(/\d{2,4}\/\d+/)?.[0] || null;
          const publishedDate = cells.find((c) => /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(c)) || fullText.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/)?.[0] || null;
          const title = cells.find((c) => c.length > 12 && !/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(c)) || fullText;

          const uid = caseNumber || `${publishedDate || ''}|${title}`;
          return { uid, caseNumber, publishedDate, title, link, raw: fullText };
        })
        .filter(Boolean);
    });

    if (cases.length === 0) {
      cases = await page.$$eval('[role="row"], li, article', (nodes) => {
        const normalize = (v) => (v || '').replace(/\s+/g, ' ').trim();

        return nodes
          .map((node) => {
            const fullText = normalize(node.textContent);
            if (!fullText || fullText.length < 20) return null;

            const link = node.querySelector('a')?.href || null;
            const caseNumber = fullText.match(/\d{2,4}\/\d+/)?.[0] || null;
            const publishedDate = fullText.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/)?.[0] || null;
            const title = normalize(node.querySelector('h1, h2, h3, .title, .heading')?.textContent) || fullText;
            const uid = caseNumber || `${publishedDate || ''}|${title}`;

            return { uid, caseNumber, publishedDate, title, link, raw: fullText };
          })
          .filter(Boolean)
          .slice(0, 500);
      });
    }

    const uniqueMap = new Map();
    for (const entry of cases) {
      if (!entry.uid) continue;
      uniqueMap.set(entry.uid, {
        uid: entry.uid,
        caseNumber: normalizeWhitespace(entry.caseNumber),
        publishedDate: normalizeWhitespace(entry.publishedDate),
        title: normalizeWhitespace(entry.title),
        link: entry.link,
        raw: normalizeWhitespace(entry.raw)
      });
    }

    const result = Array.from(uniqueMap.values());
    console.log(`Fant ${result.length} saker.`);
    return {
      url,
      searchTerm,
      fetchedAt: new Date().toISOString(),
      count: result.length,
      items: result
    };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const searchTerm = process.env.SEARCH_TERM || 'båtvrak';
  const maxLoadMoreClicks = Number(process.env.MAX_LOAD_MORE_CLICKS || '40');

  scrapePostliste({ searchTerm, maxLoadMoreClicks })
    .then((data) => {
      console.log(JSON.stringify(data, null, 2));
    })
    .catch((error) => {
      console.error('Scraping feilet:', error.message);
      process.exit(1);
    });
}

module.exports = { scrapePostliste, withSearchTerm };
