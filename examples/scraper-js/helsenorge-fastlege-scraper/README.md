# Helsenorge Fastlege Scraper

En robust Node.js web scraper for å hente fastlege-informasjon fra helsenorge.no. Scraperen bruker Playwright for å håndtere JavaScript-rendret innhold.

## To Versjoner

Dette prosjektet inneholder to versjoner av scraperen:

### 1. Standard Versjon (`scraper.js`) - ANBEFALT
- Rask og enkel
- Henter grunnleggende info fra liste-visningen
- Fungerer pålitelig uten å måtte klikke på elementer
- **Anbefales for de fleste bruksområder**

### 2. Advanced Versjon (`scraper_advanced.js`)
- Forsøker å klikke på hver lege for mer detaljer
- Kan hente mer informasjon (adresse, telefon, etc.)
- Mindre pålitelig pga. UI-interaksjoner
- Bruk hvis du trenger ekstra detaljert informasjon

## Data som hentes

**Standard versjon:**
- Navn
- Alder og kjønn
- Vikar-informasjon (hvis relevant)
- Metadata (timestamp)

**Advanced versjon (når det fungerer):**
- Alt fra standard versjon, PLUSS:
- Adresse (gateadresse, postnummer, sted)
- Pasient-kapasitet (antall pasienter / maks kapasitet)
- Liste-status (åpen/stengt/venteliste)
- Telefonnummer
- E-postadresse
- Legekontor-navn
- Handlingsknapper og lenker

## Installasjon

### Forutsetninger

- Node.js versjon 16 eller nyere
- npm (følger med Node.js)

### Steg 1: Installer dependencies

```bash
cd helsenorge-fastlege-scraper
npm install
```

### Steg 2: Installer Playwright browsers

Playwright trenger å laste ned Chromium første gang:

```bash
npm run install-browsers
```

Eller manuelt:

```bash
npx playwright install chromium
```

## Bruk

### Standard versjon (anbefalt)

Kjør med default-parametere (fylke 46, kommune 4627):

```bash
npm start
# eller
node scraper.js
```

Med custom parametere:

```bash
node scraper.js --fylke 03 --kommune 0301
```

Med skjermbilde for debugging:

```bash
npm run scrape:screenshot
# eller
node scraper.js --screenshot
```

### Advanced versjon

Kjør advanced versjon for mer detaljert info:

```bash
npm run scrape:advanced
# eller
node scraper_advanced.js
```

Med custom parametere:

```bash
node scraper_advanced.js --fylke 03 --kommune 0301 --screenshot
```

### Vis hjelpetekst

```bash
node scraper.js --help
# eller
node scraper_advanced.js --help
```

## Kommandolinje-parametere

| Parameter | Beskrivelse | Default | Eksempel |
|-----------|-------------|---------|----------|
| `--fylke` | Fylkesnummer | 46 | `--fylke 03` |
| `--kommune` | Kommunenummer | 4627 | `--kommune 0301` |
| `--screenshot` | Ta skjermbilde av siden | false | `--screenshot` |
| `--help`, `-h` | Vis hjelpetekst | - | `--help` |

## Output

Resultater lagres i `output/`-mappen med tidsstempel:

```
output/
├── fastleger_2026-03-21T10-30-00-000Z.json
├── helsenorge_page.png (hvis --screenshot)
└── page_source.html (ved feil)
```

### JSON-struktur

**Standard versjon:**

```json
{
  "metadata": {
    "scraped_at": "2026-03-21T15:48:25.455Z",
    "source_url": "https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627",
    "total_count": 14,
    "scraper_version": "1.0.0",
    "params": {
      "fylke": "46",
      "kommuner": "4627"
    }
  },
  "doctors": [
    {
      "id": 2,
      "name": "Ahmad, Seif",
      "age": 30,
      "gender": "mann",
      "full_text": "Ahmad, Seif30 år, mann",
      "status": "unknown",
      "accepting_patients": null,
      "scraped_at": "2026-03-21T15:48:25.450Z"
    },
    {
      "id": 4,
      "name": "Blom, Dewi",
      "age": 32,
      "gender": "mann",
      "full_text": "Blom, Dewi32 år, mann Har vikar i 100 % til og med 13.05.2026",
      "has_substitute": true,
      "substitute_info": "Har vikar i 100 % til og med 13.05.2026",
      "status": "unknown",
      "accepting_patients": null,
      "scraped_at": "2026-03-21T15:48:25.450Z"
    }
  ]
}
```

**Advanced versjon (eksempel med mer data):**

```json
{
  "metadata": {
    "scraped_at": "2026-03-21T10:30:00.000Z",
    "source_url": "https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627",
    "total_count": 14,
    "scraper_version": "2.0.0-advanced"
  },
  "doctors": [
    {
      "id": 1,
      "name": "Ahmad, Seif",
      "age": 30,
      "gender": "mann",
      "has_substitute": false,
      "substitute_info": null,
      "street_address": "Storgata 1",
      "postal_code": "4627",
      "city": "Kristiansand",
      "current_patients": 1200,
      "patient_capacity": 1500,
      "list_status": "open",
      "phone": "38123456",
      "email": "kontakt@legekontor.no",
      "office_name": "Kristiansand Legesenter",
      "links": [
        {
          "text": "Bytt til denne legen",
          "href": "https://..."
        }
      ],
      "action_buttons": ["Bytt fastlege"],
      "scraped_at": "2026-03-21T10:30:00.000Z"
    }
  ]
}
```

## Konfigurasjon

### Miljøvariabler

Scraperen støtter følgende miljøvariabler:

**USER_AGENT** (valgfri): Tilpass User-Agent string for HTTP requests

```bash
# Standard (default): Modern Chrome browser
node scraper.js

# Egendefinert: Identifiserbar bot
export USER_AGENT="HelsenorgeScraper/1.0 (+https://example.com/bot)"
node scraper.js
```

**HEADLESS** (valgfri): Kjør browser i headless mode

```bash
# Kjør med synlig browser (nyttig for debugging)
export HEADLESS=false
node scraper.js
```

**Anbefalt for produksjon:**
```bash
export USER_AGENT="YourCompany-HelsenorgeBot/1.0 (+https://yourcompany.com/scraper-info)"
export HEADLESS=true
node scraper.js
```

Du kan også opprette en `.env` fil basert på `.env.example`:

```bash
cp .env.example .env
# Rediger .env med dine verdier
```

### Kode-konfigurasjon

Du kan også tilpasse oppførselen ved å redigere konstanter i `scraper.js`:

```javascript
const BASE_URL = 'https://tjenester.helsenorge.no/bytte-fastlege';
const DEFAULT_PARAMS = {
  fylke: '46',
  kommuner: '4627'
};
const HEADLESS = process.env.HEADLESS !== 'false';  // Default true
const TIMEOUT = 30000;              // 30 sekunder timeout
const WAIT_AFTER_LOAD = 3000;       // Ekstra ventetid (ms)
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0...'
```

## Bruk som Node.js module

Scraperen kan også brukes som et importerbart module:

```javascript
const { scrapeHelsenorge } = require('./scraper.js');

async function example() {
  const result = await scrapeHelsenorge(
    { fylke: '03', kommuner: '0301' },
    { screenshot: true }
  );

  console.log(`Fant ${result.count} leger`);
  console.log(result.data);
}

example();
```

### API

#### `scrapeHelsenorge(params, options)`

**Parameters:**
- `params` (Object)
  - `fylke` (string) - Fylkesnummer
  - `kommuner` (string) - Kommunenummer
- `options` (Object)
  - `screenshot` (boolean) - Om skjermbilde skal tas

**Returns:** Promise<Object>
```javascript
{
  success: true,
  count: 15,
  data: [...],
  filepath: '/path/to/output.json'
}
```

## Feilsøking

### Problem: "Ingen doktor-data funnet"

Dette kan skje hvis:
1. HTML-strukturen på siden har endret seg
2. JavaScript ikke lastet ordentlig
3. Feil fylke/kommune-kombinasjon

**Løsninger:**
1. Kjør med `--screenshot` for å se hva som vises
2. Sjekk `output/page_source.html` for å se HTML-strukturen
3. Verifiser at URL-en fungerer i en vanlig browser
4. Prøv å øke `WAIT_AFTER_LOAD` i koden

### Problem: Browser starter ikke

**Løsning:**
```bash
# Reinstaller Playwright browsers
npx playwright install chromium --force
```

### Problem: Timeout errors

**Løsninger:**
1. Øk `TIMEOUT` i koden (default: 30000 ms)
2. Sjekk internettforbindelse
3. Prøv å sette `HEADLESS = false` for å se hva som skjer

### Problem: Feil data ekstrahert

HTML-strukturen kan variere. Scraperen bruker flere fallback-strategier, men hvis den ikke fungerer:

1. Kjør med `--screenshot` og `--help`
2. Åpne `output/page_source.html` i en editor
3. Finn de riktige CSS-selektorene manuelt
4. Oppdater selektorene i `scrapeDoctors()`-funksjonen

## Tekniske detaljer

### Arkitektur

Scraperen består av følgende komponenter:

1. **Browser Setup** - Starter Playwright Chromium med headless modus
2. **Content Waiting** - Venter på at JavaScript-innhold lastes
3. **Smart Extraction** - Bruker flere strategier for å finne data:
   - Standard CSS-selektorer
   - Regex-mønstre for adresser, telefon, etc.
   - Fallback til full-text analyse
4. **Data Validation** - Sjekker og renser ekstrahert data
5. **Output Handling** - Lagrer strukturert JSON med metadata

### Selektorer

Scraperen prøver disse selectorene i rekkefølge:

**Container-selektorer:**
```javascript
[data-testid*="doctor"]
[class*="doctor-card"]
[class*="gp-card"]
article
[role="article"]
ul > li
```

**Navn-selektorer:**
```javascript
h1, h2, h3, h4, h5, h6
[class*="name"]
[class*="title"]
strong, b
```

### Regex-mønstre

- **Adresse:** `/\d{4}\s+[A-ZÆØÅ][a-zæøå]+/`
- **Telefon:** `/(\+47\s?)?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/`
- **E-post:** `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`
- **Pasienter:** `/(\d+)\s*(pasienter|personer)/i`

## Etikk og juridisk

### Viktige betraktninger

1. **Respekter nettsidens bruksvilkår**
   - Les helsenorge.no sine bruksvilkår
   - Vurder om det finnes et offisielt API

2. **Rate limiting**
   - Scraperen gjør én request per kjøring
   - Implementer delay hvis du skal scrape flere kommuner

3. **Persondata (GDPR)**
   - Fastlege-informasjon er offentlig tilgjengelig
   - Vær forsiktig med lagring og deling av data
   - Slett gamle data regelmessig

4. **Ingen overbelastning**
   - Ikke kjør scraperen for ofte
   - Bruk caching av resultater
   - Vurder å kjøre på natten hvis du kjører ofte

### Anbefalt bruk

```bash
# Scrape én gang per time/dag
0 */1 * * * cd /path/to/scraper && node scraper.js
```

## Lisens

MIT License - fritt å bruke, modifisere og distribuere.

## Vedlikehold

Hvis helsenorge.no endrer sin HTML-struktur, må selektorene oppdateres i:

1. `waitForContent()` - Uppdater `possibleSelectors`
2. `scrapeDoctors()` - Uppdater `possibleContainerSelectors` og parsing-logikk

## Support

Ved problemer:
1. Sjekk at du bruker nyeste versjon av Node.js (16+)
2. Reinstaller dependencies: `rm -rf node_modules && npm install`
3. Reinstaller Playwright: `npx playwright install chromium --force`
4. Kjør med `--screenshot` for debugging

## Changelog

### v1.0.0 (2026-03-21)
- Første release
- Playwright-basert scraping
- Intelligent element detection
- JSON output med metadata
- Screenshot-support for debugging
- CLI-interface med parametere
