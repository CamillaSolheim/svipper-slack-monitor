#!/usr/bin/env node

/**
 * Helsenorge Fastlege Scraper - Advanced Version
 *
 * Forbedret scraper som klikker på hver lege for å hente detaljert informasjon
 * Bruker Playwright for å håndtere JavaScript-rendret innhold
 *
 * URL: https://tjenester.helsenorge.no/bytte-fastlege
 * Generert: 2026-03-21
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Konfigurasjon
const BASE_URL = 'https://tjenester.helsenorge.no/bytte-fastlege';
const DEFAULT_PARAMS = {
  fylke: '46',
  kommuner: '4627'
};
const OUTPUT_DIR = path.join(__dirname, 'output');
const HEADLESS = process.env.HEADLESS !== 'false'; // Default true
const TIMEOUT = 30000;
const WAIT_AFTER_LOAD = 2000;
const WAIT_BETWEEN_CLICKS = 1000; // Delay mellom klikk på leger
const USER_AGENT = process.env.USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Sett opp Playwright browser
 */
async function setupBrowser() {
  console.log('Starter browser...');

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'nb-NO'
  });

  return { browser, context };
}

/**
 * Bygg URL med query parameters
 */
function buildUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

/**
 * Vent på at siden lastes
 */
async function waitForContent(page) {
  try {
    // Vent på at liste-elementene lastes
    await page.waitForSelector('.fastlege', { timeout: 15000 });
    await page.waitForTimeout(WAIT_AFTER_LOAD);
    return true;
  } catch (error) {
    console.error('Feil ved venting på innhold:', error.message);
    return false;
  }
}

/**
 * Ekstraher grunnleggende info fra liste-elementet
 */
async function extractBasicInfo(element) {
  return await element.evaluate(el => {
    const nameEl = el.querySelector('.legenavn');
    const name = nameEl ? nameEl.textContent.trim() : null;

    const allText = el.textContent.trim();

    // Ekstraher alder og kjønn
    const ageGenderMatch = allText.match(/(\d+)\s+år,\s+(mann|kvinne)/i);
    const age = ageGenderMatch ? parseInt(ageGenderMatch[1]) : null;
    const gender = ageGenderMatch ? ageGenderMatch[2] : null;

    // Sjekk for vikar-info
    const hasSubstitute = allText.toLowerCase().includes('vikar');
    const substituteInfo = hasSubstitute
      ? allText.match(/Har vikar.*?(?:\d{2}\.\d{2}\.\d{4})?/i)?.[0]
      : null;

    return {
      name,
      age,
      gender,
      has_substitute: hasSubstitute,
      substitute_info: substituteInfo
    };
  });
}

/**
 * Ekstraher detaljert info fra ekspandert panel
 */
async function extractDetailedInfo(page) {
  try {
    // Vent på at detalj-panelet åpnes
    await page.waitForTimeout(500);

    const details = await page.evaluate(() => {
      const data = {};

      // Finn alle tekst-elementer i det ekspanderte panelet
      // Prøv ulike selektorer for detaljpanelet
      const panelSelectors = [
        '[class*="expanded"]',
        '[class*="detail"]',
        '[class*="panel"]',
        '[aria-expanded="true"]',
        '[role="region"]'
      ];

      let panel = null;
      for (const selector of panelSelectors) {
        panel = document.querySelector(selector);
        if (panel) break;
      }

      if (!panel) {
        // Fallback: bruk hele siden
        panel = document.body;
      }

      const allText = panel.textContent;

      // Ekstraher adresse (postnummer + sted)
      const addressMatch = allText.match(/(\d{4})\s+([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+)/);
      if (addressMatch) {
        data.postal_code = addressMatch[1];
        data.city = addressMatch[2].trim();
      }

      // Ekstraher gateadresse
      const streetMatch = allText.match(/([A-ZÆØÅ][a-zæøå\s]+(?:vei|gate|veg|gata|gaten|allé|plass|vn|gt)\.?\s*\d+[a-zA-Z]?)/i);
      if (streetMatch) {
        data.street_address = streetMatch[0].trim();
      }

      // Ekstraher pasient-info
      const patientMatches = allText.matchAll(/(\d+)\s+(?:av\s+)?(\d+)\s+(?:pasienter|personer)/gi);
      for (const match of patientMatches) {
        data.current_patients = parseInt(match[1]);
        data.patient_capacity = parseInt(match[2]);
      }

      // Ekstraher ledig/stengt status
      const statusKeywords = {
        open: ['ledige plasser', 'tar imot', 'åpen liste', 'kan bytte'],
        closed: ['stengt liste', 'full liste', 'tar ikke imot', 'ingen ledige'],
        waiting: ['venteliste']
      };

      const lowerText = allText.toLowerCase();
      if (statusKeywords.open.some(kw => lowerText.includes(kw))) {
        data.list_status = 'open';
      } else if (statusKeywords.closed.some(kw => lowerText.includes(kw))) {
        data.list_status = 'closed';
      } else if (statusKeywords.waiting.some(kw => lowerText.includes(kw))) {
        data.list_status = 'waiting_list';
      }

      // Ekstraher telefon
      const phoneMatch = allText.match(/(?:Telefon|Tlf\.?)[:\s]*(\+?47\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})/i);
      if (phoneMatch) {
        data.phone = phoneMatch[2].replace(/\s/g, '');
      }

      // Ekstraher e-post
      const emailMatch = allText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        data.email = emailMatch[1];
      }

      // Finn legekontor-navn
      const officeMatch = allText.match(/Legekontor[:\s]+(.+?)(?:\n|Adresse|Telefon|$)/i);
      if (officeMatch) {
        data.office_name = officeMatch[1].trim();
      }

      // Finn alle lenker i panelet
      const links = Array.from(panel.querySelectorAll('a[href]')).map(link => ({
        text: link.textContent.trim(),
        href: link.href
      })).filter(link => link.text && link.href);

      if (links.length > 0) {
        data.links = links;
      }

      // Finn knapper
      const buttons = Array.from(panel.querySelectorAll('button')).map(btn =>
        btn.textContent.trim()
      ).filter(text => text);

      if (buttons.length > 0) {
        data.action_buttons = buttons;
      }

      return data;
    });

    return details;

  } catch (error) {
    console.error('Feil ved ekstraksjon av detaljer:', error.message);
    return {};
  }
}

/**
 * Scrape alle leger med detaljert informasjon
 */
async function scrapeDoctorsAdvanced(page) {
  console.log('Analyserer side og henter leger...\n');

  // Finn alle lege-elementer
  const doctorElements = await page.$$('.fastlege');
  console.log(`Fant ${doctorElements.length} leger\n`);

  const doctors = [];

  for (let i = 0; i < doctorElements.length; i++) {
    try {
      console.log(`[${i + 1}/${doctorElements.length}] Henter info...`);

      // Hent grunnleggende info fra liste-elementet
      const basicInfo = await extractBasicInfo(doctorElements[i]);

      if (!basicInfo.name) {
        console.log(`  → Hopper over (ingen navn funnet)`);
        continue;
      }

      console.log(`  → ${basicInfo.name} (${basicInfo.age} år, ${basicInfo.gender})`);

      // Prøv å klikke på elementet for å ekspandere detaljer
      try {
        await doctorElements[i].click({ timeout: 5000 });
        await page.waitForTimeout(WAIT_BETWEEN_CLICKS);

        // Hent detaljert info
        const detailedInfo = await extractDetailedInfo(page);

        // Kombiner basic og detailed info
        const doctor = {
          id: i + 1,
          ...basicInfo,
          ...detailedInfo,
          scraped_at: new Date().toISOString()
        };

        doctors.push(doctor);

        // Log funnet info
        if (detailedInfo.current_patients && detailedInfo.patient_capacity) {
          console.log(`  → Pasienter: ${detailedInfo.current_patients}/${detailedInfo.patient_capacity}`);
        }
        if (detailedInfo.list_status) {
          console.log(`  → Status: ${detailedInfo.list_status}`);
        }
        if (detailedInfo.city) {
          console.log(`  → Sted: ${detailedInfo.city}`);
        }

        // Lukk panelet (klikk igjen eller trykk escape)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

      } catch (clickError) {
        console.log(`  → Kunne ikke ekspandere detaljer: ${clickError.message}`);

        // Lagre i hvert fall grunnleggende info
        doctors.push({
          id: i + 1,
          ...basicInfo,
          scraped_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(`  → Feil ved scraping av lege ${i + 1}:`, error.message);
    }
  }

  return doctors;
}

/**
 * Lagre resultater til JSON
 */
async function saveResults(data, metadata = {}) {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fastleger_advanced_${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const output = {
      metadata: {
        scraped_at: new Date().toISOString(),
        source_url: metadata.url || BASE_URL,
        total_count: data.length,
        scraper_version: '2.0.0-advanced',
        ...metadata
      },
      doctors: data
    };

    await fs.writeFile(filepath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n✓ Lagret ${data.length} leger til: ${filename}`);
    return filepath;

  } catch (error) {
    console.error('Feil ved lagring:', error.message);
    throw error;
  }
}

/**
 * Ta skjermbilde
 */
async function takeScreenshot(page, filename) {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Skjermbilde lagret: ${screenshotPath}`);
  } catch (error) {
    console.error('Kunne ikke ta skjermbilde:', error.message);
  }
}

/**
 * Hovedfunksjon
 */
async function scrapeHelsenorgeAdvanced(params = DEFAULT_PARAMS, options = {}) {
  let browser, context, page;

  try {
    ({ browser, context } = await setupBrowser());
    page = await context.newPage();

    const targetUrl = buildUrl(BASE_URL, params);
    console.log(`\nÅpner: ${targetUrl}\n`);

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });

    console.log('Side lastet, venter på innhold...\n');

    await waitForContent(page);

    if (options.screenshot) {
      await takeScreenshot(page, 'helsenorge_advanced.png');
    }

    const doctors = await scrapeDoctorsAdvanced(page);

    if (doctors.length === 0) {
      console.log('\n⚠️  Ingen leger funnet!');
      await takeScreenshot(page, 'helsenorge_error_advanced.png');
    }

    const filepath = await saveResults(doctors, {
      url: targetUrl,
      params: params
    });

    if (doctors.length > 0) {
      console.log('\n--- Eksempel på første lege ---');
      console.log(JSON.stringify(doctors[0], null, 2));
    }

    return {
      success: true,
      count: doctors.length,
      data: doctors,
      filepath: filepath
    };

  } catch (error) {
    console.error('\n❌ Scraping feilet:', error.message);

    if (page) {
      try {
        await takeScreenshot(page, 'helsenorge_error_advanced.png');
      } catch (e) {
        // Ignorer
      }
    }

    throw error;

  } finally {
    if (browser) {
      await browser.close();
      console.log('\nBrowser lukket');
    }
  }
}

/**
 * CLI-interface
 */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Helsenorge Fastlege Scraper (Advanced)');
  console.log('═══════════════════════════════════════════════════');

  const args = process.argv.slice(2);
  const params = { ...DEFAULT_PARAMS };
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--fylke' && args[i + 1]) {
      params.fylke = args[i + 1];
      i++;
    } else if (arg === '--kommune' && args[i + 1]) {
      params.kommuner = args[i + 1];
      i++;
    } else if (arg === '--screenshot') {
      options.screenshot = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('\nBruk: node scraper_advanced.js [options]\n');
      console.log('Options:');
      console.log('  --fylke <nummer>     Fylkesnummer (default: 46)');
      console.log('  --kommune <nummer>   Kommunenummer (default: 4627)');
      console.log('  --screenshot         Ta skjermbilde');
      console.log('  --help, -h           Vis denne hjelpeteksten\n');
      console.log('Eksempel:');
      console.log('  node scraper_advanced.js --fylke 46 --kommune 4627\n');
      process.exit(0);
    }
  }

  try {
    const result = await scrapeHelsenorgeAdvanced(params, options);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('FERDIG!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total leger: ${result.count}`);
    console.log(`Fil: ${result.filepath}`);
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Feil:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  scrapeHelsenorgeAdvanced,
  setupBrowser,
  scrapeDoctorsAdvanced
};
