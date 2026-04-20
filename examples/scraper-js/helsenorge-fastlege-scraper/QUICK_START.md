# Quick Start Guide

Kom i gang på 2 minutter!

## 1. Installer dependencies

```bash
cd helsenorge-fastlege-scraper
npm install
npm run install-browsers
```

## 2. Kjør scraperen

### Standard versjon (anbefalt)

```bash
npm start
```

Dette vil:
- Åpne helsenorge.no (fylke 46, kommune 4627)
- Scrape alle fastleger
- Lagre resultater til `output/fastleger_TIMESTAMP.json`

### Med egne parametere

For Oslo (fylke 03, kommune 0301):

```bash
node scraper.js --fylke 03 --kommune 0301
```

For Bergen (fylke 46, kommune 4601):

```bash
node scraper.js --fylke 46 --kommune 4601
```

### Advanced versjon (mer data, men mindre pålitelig)

```bash
npm run scrape:advanced
```

## 3. Sjekk resultater

```bash
ls -lt output/
cat output/fastleger_*.json | head -50
```

## Fylkes- og kommunenummer

Finn ditt fylke og kommune:

| Sted | Fylke | Kommune |
|------|-------|---------|
| Oslo | 03 | 0301 |
| Bergen | 46 | 4601 |
| Kristiansand | 42 | 4204 |
| Stavanger | 11 | 1103 |
| Trondheim | 50 | 5001 |

Finn flere på [kommunenummer.no](https://www.kommunenummer.no/)

## Feilsøking

### Feil: "Cannot find module 'playwright'"

```bash
npm install
```

### Feil: "browserType.launch: Executable doesn't exist"

```bash
npm run install-browsers
```

### Ingen data funnet

1. Sjekk at URL-en fungerer i vanlig browser
2. Prøv med `--screenshot` for å se hva som skjer:
   ```bash
   node scraper.js --screenshot
   ```
3. Sjekk `output/helsenorge_page.png`

## Bruk som Node.js module

```javascript
const { scrapeHelsenorge } = require('./scraper.js');

async function example() {
  const result = await scrapeHelsenorge(
    { fylke: '03', kommuner: '0301' },
    { screenshot: false }
  );

  console.log(`Fant ${result.count} leger`);
  result.data.forEach(doctor => {
    console.log(`- ${doctor.name} (${doctor.age} år)`);
  });
}

example();
```

## Neste steg

- Les [README.md](README.md) for full dokumentasjon
- Sjekk eksempel-output i `output/`-mappen
- Tilpass CSS-selektorer hvis nødvendig

## Hjelp?

Kjør med `--help`:

```bash
node scraper.js --help
```
