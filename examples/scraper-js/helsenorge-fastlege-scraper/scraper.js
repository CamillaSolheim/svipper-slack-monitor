#!/usr/bin/env node

/**
 * Helsenorge Fastlege Scraper
 *
 * Scraper for å hente fastlege-informasjon fra helsenorge.no
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
const TIMEOUT = 30000; // 30 sekunder
const WAIT_AFTER_LOAD = 3000; // 3 sekunder ekstra ventetid for lazy loading
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
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
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
 * Vent på at elementer lastes og håndter loading states
 */
async function waitForContent(page) {
  try {
    // Vent på at siden er ferdig lastet
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Prøv å vente på hovedinnhold - flere mulige selektorer
    const possibleSelectors = [
      '[data-testid*="doctor"]',
      '[class*="doctor"]',
      '[class*="fastlege"]',
      '[class*="gp"]',
      'article',
      '[role="article"]',
      'ul li',
      '[class*="list"] > div',
      '[class*="card"]'
    ];

    let contentFound = false;
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`Innhold funnet med selector: ${selector}`);
        contentFound = true;
        break;
      } catch (e) {
        // Prøv neste selector
        continue;
      }
    }

    if (!contentFound) {
      console.log('Advarsel: Ingen kjente selektorer funnet, fortsetter likevel...');
    }

    // Ekstra ventetid for lazy loading
    await page.waitForTimeout(WAIT_AFTER_LOAD);

    // Scroll for å trigge eventuell lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(1000);

    return true;

  } catch (error) {
    console.error('Feil ved venting på innhold:', error.message);
    return false;
  }
}

/**
 * Ekstraher tekst fra element, håndter null
 */
function extractText(element, selector) {
  if (!element) return null;

  try {
    const el = typeof selector === 'string'
      ? element.querySelector(selector)
      : element;

    return el?.textContent?.trim() || null;
  } catch (e) {
    return null;
  }
}

/**
 * Ekstraher attributt fra element
 */
function extractAttribute(element, selector, attribute) {
  if (!element) return null;

  try {
    const el = typeof selector === 'string'
      ? element.querySelector(selector)
      : element;

    return el?.getAttribute(attribute) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Parse og rens tekst-data
 */
function cleanText(text) {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Ekstraher tall fra tekst (f.eks. "250 pasienter" -> 250)
 */
function extractNumber(text) {
  if (!text) return null;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Scrape fastlege-informasjon fra siden
 */
async function scrapeDoctors(page) {
  console.log('Analyserer side-struktur og ekstraherer data...');

  const doctors = await page.evaluate(() => {
    const results = [];

    // Prøv forskjellige mulige strukturer for doktor-elementer
    const possibleContainerSelectors = [
      '[data-testid*="doctor"]',
      '[class*="doctor-card"]',
      '[class*="gp-card"]',
      '[class*="fastlege"]',
      'article',
      '[role="article"]',
      'ul > li',
      '[class*="list-item"]',
      '[class*="card"]'
    ];

    let elements = [];
    for (const selector of possibleContainerSelectors) {
      elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Fant ${elements.length} elementer med selector: ${selector}`);
        break;
      }
    }

    // Hvis ingen spesifikke containere funnet, analyser hele siden
    if (elements.length === 0) {
      console.log('Ingen standard containere funnet, analyserer hele siden...');

      // Søk etter mønstre i tekst som indikerer doktor-informasjon
      const bodyText = document.body.innerText;

      // Returner metadata om siden for debugging
      return [{
        _debug: true,
        _message: 'Ingen doktor-elementer funnet med standard selektorer',
        _pageTitle: document.title,
        _url: window.location.href,
        _bodyLength: bodyText.length,
        _sampleText: bodyText.substring(0, 500)
      }];
    }

    // Ekstraher data fra hvert element
    elements.forEach((element, index) => {
      try {
        const doctor = {
          id: index + 1,
          raw_html: element.outerHTML.substring(0, 500), // For debugging
        };

        // Prøv å finne navn (heading-elementer eller fet tekst)
        const nameSelectors = [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          '[class*="name"]', '[class*="title"]',
          'strong', 'b',
          '[data-testid*="name"]'
        ];

        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            doctor.name = nameEl.textContent.trim();
            break;
          }
        }

        // Hvis ikke funnet, bruk første synlige tekst
        if (!doctor.name) {
          const firstText = element.textContent.split('\n')[0].trim();
          if (firstText && firstText.length < 100) {
            doctor.name = firstText;
          }
        }

        // Ekstraher all tekst fra elementet
        const allText = element.textContent.replace(/\s+/g, ' ').trim();
        doctor.full_text = allText;

        // Søk etter adresse (typisk inneholder postnummer)
        const addressMatch = allText.match(/\d{4}\s+[A-ZÆØÅ][a-zæøå]+/);
        if (addressMatch) {
          doctor.address = addressMatch[0];

          // Prøv å få hele adressen
          const addressContext = allText.substring(
            Math.max(0, allText.indexOf(addressMatch[0]) - 50),
            allText.indexOf(addressMatch[0]) + addressMatch[0].length
          );
          doctor.full_address = addressContext.trim();
        }

        // Søk etter pasient-informasjon
        const patientMatch = allText.match(/(\d+)\s*(pasienter|personer)/i);
        if (patientMatch) {
          doctor.patient_count = parseInt(patientMatch[1], 10);
        }

        // Sjekk status (ledig/ikke ledig)
        const statusKeywords = {
          available: ['ledig', 'tar imot', 'åpen', 'kapasitet'],
          full: ['full', 'stengt', 'tar ikke imot', 'ingen ledige']
        };

        const lowerText = allText.toLowerCase();
        if (statusKeywords.available.some(kw => lowerText.includes(kw))) {
          doctor.status = 'available';
          doctor.accepting_patients = true;
        } else if (statusKeywords.full.some(kw => lowerText.includes(kw))) {
          doctor.status = 'full';
          doctor.accepting_patients = false;
        } else {
          doctor.status = 'unknown';
          doctor.accepting_patients = null;
        }

        // Søk etter telefonnummer
        const phoneMatch = allText.match(/(\+47\s?)?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/);
        if (phoneMatch) {
          doctor.phone = phoneMatch[0].replace(/\s/g, '');
        }

        // Søk etter e-post
        const emailMatch = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          doctor.email = emailMatch[0];
        }

        // Finn lenker
        const links = element.querySelectorAll('a[href]');
        if (links.length > 0) {
          doctor.links = Array.from(links).map(link => ({
            text: link.textContent.trim(),
            href: link.href
          }));
        }

        // Finn knapper
        const buttons = element.querySelectorAll('button');
        if (buttons.length > 0) {
          doctor.buttons = Array.from(buttons).map(btn => btn.textContent.trim());
        }

        // Metadata
        doctor.scraped_at = new Date().toISOString();

        results.push(doctor);

      } catch (error) {
        console.error(`Feil ved parsing av element ${index}:`, error.message);
      }
    });

    return results;
  });

  console.log(`Ekstraherte data for ${doctors.length} leger/elementer`);
  return doctors;
}

/**
 * Ta skjermbilde for debugging
 */
async function takeScreenshot(page, filename) {
  try {
    const screenshotPath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`Skjermbilde lagret: ${screenshotPath}`);
  } catch (error) {
    console.error('Kunne ikke ta skjermbilde:', error.message);
  }
}

/**
 * Lagre resultater til JSON-fil
 */
async function saveResults(data, metadata = {}) {
  try {
    // Opprett output-mappe hvis den ikke finnes
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fastleger_${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const output = {
      metadata: {
        scraped_at: new Date().toISOString(),
        source_url: metadata.url || BASE_URL,
        total_count: data.length,
        scraper_version: '1.0.0',
        ...metadata
      },
      doctors: data
    };

    await fs.writeFile(
      filepath,
      JSON.stringify(output, null, 2),
      'utf-8'
    );

    console.log(`\n✓ Lagret ${data.length} leger til: ${filename}`);
    return filepath;

  } catch (error) {
    console.error('Feil ved lagring av resultater:', error.message);
    throw error;
  }
}

/**
 * Hovedfunksjon for scraping
 */
async function scrapeHelsenorge(params = DEFAULT_PARAMS, options = {}) {
  let browser, context, page;

  try {
    // Sett opp browser
    ({ browser, context } = await setupBrowser());
    page = await context.newPage();

    // Bygg URL
    const targetUrl = buildUrl(BASE_URL, params);
    console.log(`\nÅpner: ${targetUrl}\n`);

    // Naviger til siden
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });

    console.log('Side lastet, venter på JavaScript-innhold...');

    // Vent på at innhold lastes
    await waitForContent(page);

    // Ta skjermbilde for debugging (valgfritt)
    if (options.screenshot) {
      await takeScreenshot(page, 'helsenorge_page.png');
    }

    // Scrape data
    const doctors = await scrapeDoctors(page);

    // Sjekk om vi fikk data
    if (doctors.length === 0 || (doctors[0] && doctors[0]._debug)) {
      console.log('\nAdvarsel: Ingen doktor-data funnet!');

      if (doctors[0] && doctors[0]._debug) {
        console.log('Debug-info:');
        console.log(doctors[0]);
      }

      // Ta skjermbilde for debugging
      await takeScreenshot(page, 'helsenorge_error.png');

      // Lagre HTML for manuell inspeksjon
      const html = await page.content();
      const htmlPath = path.join(OUTPUT_DIR, 'page_source.html');
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.writeFile(htmlPath, html, 'utf-8');
      console.log(`HTML-kilde lagret til: ${htmlPath}`);
    }

    // Lagre resultater
    const filepath = await saveResults(doctors, {
      url: targetUrl,
      params: params
    });

    // Print eksempel
    if (doctors.length > 0 && !doctors[0]._debug) {
      console.log('\nEksempel på første lege:');
      console.log(JSON.stringify(doctors[0], null, 2));
    }

    return {
      success: true,
      count: doctors.length,
      data: doctors,
      filepath: filepath
    };

  } catch (error) {
    console.error('\nFeil under scraping:', error.message);

    // Prøv å ta skjermbilde ved feil
    if (page) {
      try {
        await takeScreenshot(page, 'helsenorge_error.png');
      } catch (e) {
        // Ignorer feil ved skjermbilde
      }
    }

    throw error;

  } finally {
    // Rydd opp
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
  console.log('Helsenorge Fastlege Scraper');
  console.log('═══════════════════════════════════════════════════\n');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const params = { ...DEFAULT_PARAMS };
  const options = {};

  // Enkel argument-parsing
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
      console.log('Bruk: node scraper.js [options]\n');
      console.log('Options:');
      console.log('  --fylke <nummer>     Fylkesnummer (default: 46)');
      console.log('  --kommune <nummer>   Kommunenummer (default: 4627)');
      console.log('  --screenshot         Ta skjermbilde av siden');
      console.log('  --help, -h           Vis denne hjelpeteksten\n');
      console.log('Eksempel:');
      console.log('  node scraper.js --fylke 46 --kommune 4627 --screenshot\n');
      process.exit(0);
    }
  }

  try {
    const result = await scrapeHelsenorge(params, options);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('FERDIG!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total leger funnet: ${result.count}`);
    console.log(`Resultater lagret i: ${result.filepath}`);
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Scraping feilet:', error.message);
    console.error('\nFor debugging:');
    console.error('1. Sjekk output/helsenorge_error.png');
    console.error('2. Sjekk output/page_source.html');
    console.error('3. Prøv med --screenshot for å se hva som vises\n');

    process.exit(1);
  }
}

// Kjør hvis dette er main module
if (require.main === module) {
  main();
}

// Export for bruk som module
module.exports = {
  scrapeHelsenorge,
  setupBrowser,
  scrapeDoctors,
  saveResults
};
