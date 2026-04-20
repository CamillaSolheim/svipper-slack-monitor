#!/usr/bin/env node

/**
 * Eksempel på hvordan man bruker helsenorge-scraperen programmatisk
 */

const { scrapeHelsenorge } = require('./scraper.js');

// Eksempel 1: Scrape én kommune
async function example1() {
  console.log('=== Eksempel 1: Scrape Oslo ===\n');

  const result = await scrapeHelsenorge(
    { fylke: '03', kommuner: '0301' },
    { screenshot: false }
  );

  console.log(`Fant ${result.count} leger i Oslo\n`);

  // Print de 5 første legene
  result.data.slice(0, 5).forEach(doctor => {
    console.log(`- ${doctor.name} (${doctor.age} år, ${doctor.gender})`);
    if (doctor.has_substitute) {
      console.log(`  └─ ${doctor.substitute_info}`);
    }
  });

  console.log(`\nResultater lagret i: ${result.filepath}\n`);
}

// Eksempel 2: Scrape flere kommuner etter hverandre
async function example2() {
  console.log('=== Eksempel 2: Scrape flere kommuner ===\n');

  const kommuner = [
    { fylke: '03', kommuner: '0301', navn: 'Oslo' },
    { fylke: '46', kommuner: '4601', navn: 'Bergen' },
    { fylke: '50', kommuner: '5001', navn: 'Trondheim' }
  ];

  const allResults = [];

  for (const kommune of kommuner) {
    console.log(`Scraper ${kommune.navn}...`);

    const result = await scrapeHelsenorge(
      { fylke: kommune.fylke, kommuner: kommune.kommuner },
      { screenshot: false }
    );

    console.log(`  → Fant ${result.count} leger\n`);

    allResults.push({
      kommune: kommune.navn,
      count: result.count,
      doctors: result.data
    });

    // Vent litt mellom hver request for å være høflig
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Print sammendrag
  console.log('=== Sammendrag ===');
  allResults.forEach(({ kommune, count }) => {
    console.log(`${kommune}: ${count} leger`);
  });
  console.log();
}

// Eksempel 3: Filtrer leger basert på kriterier
async function example3() {
  console.log('=== Eksempel 3: Filtrer leger ===\n');

  const result = await scrapeHelsenorge(
    { fylke: '46', kommuner: '4627' },
    { screenshot: false }
  );

  // Finn leger under 35 år
  const youngDoctors = result.data.filter(d => d.age && d.age < 35);

  console.log(`Leger under 35 år (${youngDoctors.length}):`);
  youngDoctors.forEach(doctor => {
    console.log(`- ${doctor.name}, ${doctor.age} år`);
  });

  // Finn leger med vikarer
  const withSubstitute = result.data.filter(d => d.has_substitute);

  console.log(`\nLeger med vikar (${withSubstitute.length}):`);
  withSubstitute.forEach(doctor => {
    console.log(`- ${doctor.name}`);
    console.log(`  └─ ${doctor.substitute_info}`);
  });

  console.log();
}

// Eksempel 4: Eksporter til CSV
async function example4() {
  console.log('=== Eksempel 4: Eksporter til CSV ===\n');

  const result = await scrapeHelsenorge(
    { fylke: '46', kommuner: '4627' },
    { screenshot: false }
  );

  // Lag CSV-innhold
  const csvLines = [
    'ID,Navn,Alder,Kjønn,Vikar,Scraped',
    ...result.data.map(d =>
      `${d.id},"${d.name}",${d.age},${d.gender},${d.has_substitute ? 'Ja' : 'Nei'},${d.scraped_at}`
    )
  ];

  const csv = csvLines.join('\n');

  // Lagre til fil
  const fs = require('fs').promises;
  const path = require('path');

  const csvPath = path.join(__dirname, 'output', 'fastleger.csv');
  await fs.writeFile(csvPath, csv, 'utf-8');

  console.log(`CSV lagret til: ${csvPath}`);
  console.log(`Antall rader: ${result.data.length}\n`);
}

// Eksempel 5: Finn spesifikk lege
async function example5() {
  console.log('=== Eksempel 5: Søk etter lege ===\n');

  const result = await scrapeHelsenorge(
    { fylke: '46', kommuner: '4627' },
    { screenshot: false }
  );

  const searchName = 'Ahmad';

  const found = result.data.filter(d =>
    d.name.toLowerCase().includes(searchName.toLowerCase())
  );

  if (found.length > 0) {
    console.log(`Fant ${found.length} leger som matcher "${searchName}":\n`);
    found.forEach(doctor => {
      console.log(`- ${doctor.name} (${doctor.age} år, ${doctor.gender})`);
    });
  } else {
    console.log(`Ingen leger funnet som matcher "${searchName}"`);
  }

  console.log();
}

// Kjør eksemplene
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Helsenorge Scraper - Eksempler på bruk');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Kommenter ut de du ikke vil kjøre
    await example1();
    // await example2(); // OBS: Tar litt tid (scraper 3 kommuner)
    // await example3();
    // await example4();
    // await example5();

    console.log('Ferdig! ✓');

  } catch (error) {
    console.error('Feil:', error.message);
  }
}

// Kjør hvis dette er main module
if (require.main === module) {
  main();
}

module.exports = {
  example1,
  example2,
  example3,
  example4,
  example5
};
