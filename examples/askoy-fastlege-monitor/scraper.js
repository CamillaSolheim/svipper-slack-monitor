/**
 * Askøy Fastlege Scraper
 *
 * Scraper fastlege-data fra Helsenorge for Askøy kommune (4627)
 * Vestland fylke (46)
 *
 * URL: https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627
 */

const { chromium } = require('playwright');

const HELSENORGE_URL = 'https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627';

async function scrapeFastleger() {
    console.log('🚀 Starter scraping av Askøy fastleger...');
    console.log(`URL: ${HELSENORGE_URL}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Gå til siden
        console.log('📡 Laster side...');
        await page.goto(HELSENORGE_URL, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        // Håndter cookie-dialog
        console.log('🍪 Håndterer cookies...');
        await page.waitForTimeout(2000);
        try {
            const rejectButton = page.locator('button:has-text("Avvis")').first();
            if (await rejectButton.count() > 0) {
                await rejectButton.click();
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('⚠️  Kunne ikke finne cookie-dialog (kan være OK)');
        }

        // Vent på at tabellen lastes
        console.log('⏳ Venter på at tabell lastes...');
        await page.waitForSelector('table tbody tr', {
            timeout: 30000
        });

        // Klikk på "Hent flere" til alle leger er lastet
        console.log('📥 Laster alle leger...');
        let clickedLoadMore = false;
        while (true) {
            try {
                const loadMoreButton = page.locator('button:has-text("Hent flere")').first();
                if (await loadMoreButton.count() > 0 && await loadMoreButton.isVisible()) {
                    await loadMoreButton.click();
                    clickedLoadMore = true;
                    console.log('   ➕ Klikket "Hent flere"...');
                    await page.waitForTimeout(2000); // Vent på at nye rader lastes
                } else {
                    break; // Ingen flere "Hent flere"-knapper
                }
            } catch (e) {
                break; // Knapp ikke funnet eller feil
            }
        }
        if (clickedLoadMore) {
            console.log('✅ Alle leger lastet');
        }

        // Ekstraher fastlege-data fra tabell
        console.log('📋 Ekstraherer data fra tabell...');
        const fastleger = await page.$$eval('table tbody tr', (rows) => {
            return rows.map((row) => {
                const cells = Array.from(row.querySelectorAll('td'));

                // Skip rows that don't have enough cells (expandable rows, etc.)
                if (cells.length < 4) return null;

                // Cell 1: Lege-navn (f.eks. "Ahmad, Seif30 år, mann")
                const doctorText = cells[1]?.textContent?.trim() || '';
                const doctorMatch = doctorText.match(/^([^0-9]+)/);
                const name = doctorMatch ? doctorMatch[1].trim() : doctorText;

                // Cell 2: Legekontor og adresse (f.eks. "Strand legesenter - EnergigårdenFlorvågvn. 6, 5300 KLEPPESTØ")
                const officeText = cells[2]?.textContent?.trim() || '';
                // Split on address pattern (street number + comma)
                const addressMatch = officeText.match(/^(.+?)([A-ZÆØÅ][a-zæøå]+.*?\d+,\s*\d{4}\s+[A-ZÆØÅ]+.*?)$/);
                const office = addressMatch ? addressMatch[1].trim() : officeText.split(/\d+,/)[0]?.trim() || '';
                const address = addressMatch ? addressMatch[2].trim() : officeText.match(/[A-ZÆØÅ][a-zæøå]+.*?\d+,\s*\d{4}\s+[A-ZÆØÅ]+.*$/)?.[0] || '';

                // Cell 3: Kapasitet (f.eks. "0 av 1100Ledige plasser: 0 av 1100")
                const capacityText = cells[3]?.textContent?.trim() || '';
                const capacityMatch = capacityText.match(/(\d+)\s*av\s*(\d+)/);
                const available = capacityMatch ? parseInt(capacityMatch[1]) : 0;
                const total = capacityMatch ? parseInt(capacityMatch[2]) : 0;
                const status = available > 0 ? 'Ledig' : 'Full';
                const capacity = `${available} av ${total}`;

                // Cell 4: Venteliste
                const waitlist = cells[4]?.textContent?.trim() || '0';

                // Generer unik ID
                const id = `${name}_${address}`.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_æøå]/g, '');

                return {
                    id,
                    name,
                    office,
                    address,
                    status,
                    capacity,
                    available,
                    total,
                    waitlist,
                    scrapedAt: new Date().toISOString()
                };
            }).filter(Boolean); // Remove null entries
        });

        console.log(`✅ Hentet ${fastleger.length} fastleger`);

        await browser.close();
        return fastleger;

    } catch (error) {
        console.error('❌ Feil under scraping:', error.message);
        await browser.close();
        throw error;
    }
}

// Hvis kjøres direkte (ikke importert som modul)
if (require.main === module) {
    scrapeFastleger()
        .then(data => {
            console.log('\n📊 Resultat:');
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error('Kritisk feil:', error);
            process.exit(1);
        });
}

module.exports = { scrapeFastleger };
