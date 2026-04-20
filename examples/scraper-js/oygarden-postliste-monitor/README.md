# Øygarden postliste-monitor (søk: båtvrak)

Dette oppsettet overvåker nye saker i Øygarden kommune sin postliste for søket **"båtvrak"**:

- Kilde: `https://www.oygarden.kommune.no/tjenester/innsyn-og-naring/innsyn/postliste/#/?searchTerm=b%C3%A5tvrak`
- Teknologi: **Node.js + Playwright** (passer for JS-renderet innhold)
- Duplikatbeskyttelse: lokal state-fil (`seen-cases.json`)
- Varsling: Slack Bot Token + kanal (anbefalt), webhook som fallback

> Merk: Siden er SPA, så scraping må vente på at klient-side rendering er ferdig.

## 1) Etisk/teknisk sjekk før scraping

1. Sjekk `robots.txt` manuelt:
   - `https://www.oygarden.kommune.no/robots.txt`
2. Kjør monitor med moderat frekvens (f.eks. hver 1.–3. time)
3. Scriptet har innebygd rate limiting (minst 1 sekund pause mellom handlinger)

## 2) Lokal kjøring

```bash
cd examples/scraper-js/oygarden-postliste-monitor
npm install
npx playwright install chromium
cp .env.example .env
npm run monitor
```

### Miljøvariabler

Se `.env.example`:

- `SEARCH_TERM` (default: `båtvrak`)
- `STATE_FILE` (default: `./data/seen-cases.json`)
- `MAX_LOAD_MORE_CLICKS` (default: `40`)
- `SLACK_BOT_TOKEN` + `SLACK_CHANNEL` (anbefalt)
- `SLACK_WEBHOOK_URL` (valgfri fallback)

## 3) Hva skriptet gjør

1. Åpner postliste-URL med søketerm
2. Håndterer cookie-banner (hvis vist)
3. Klikker "Hent flere" i loop til alt er lastet (eller `MAX_LOAD_MORE_CLICKS` nås)
4. Ekstraherer saker (saksnr, dato, tittel, lenke)
5. Sammenligner mot tidligere kjente `uid`
6. Logger nye saker og sender valgfri Slack-melding
7. Oppdaterer state-fil

## 4) Output-format

`npm run scrape` skriver JSON som:

```json
{
  "url": "https://www.oygarden.kommune.no/...",
  "searchTerm": "båtvrak",
  "fetchedAt": "2026-04-11T10:00:00.000Z",
  "count": 12,
  "items": [
    {
      "uid": "2026/1234",
      "caseNumber": "2026/1234",
      "publishedDate": "10.04.2026",
      "title": "Melding om båtvrak i ...",
      "link": "https://...",
      "raw": "..."
    }
  ]
}
```

## 5) GitHub Actions (schedule + manuell)

Workflow ligger i `.github/workflows/oygarden-postliste-monitor.yml`.

- Kjører hver 3. time
- Kan trigges manuelt via `workflow_dispatch`
- Bruk GitHub Secrets for `SLACK_BOT_TOKEN` og `SLACK_CHANNEL` (anbefalt).
- `SLACK_WEBHOOK_URL` kan brukes som fallback hvis Bot API ikke er ønsket.

## 6) Feilhåndtering / begrensninger

- Scriptet feiler med tydelig melding ved timeout eller manglende last av side.
- Hvis selektorer endres på nettsiden, må selektorene i `scraper.js` oppdateres.
- Hvis nettstedet blokkerer scraping fra din IP, kjør sjeldnere og verifiser tilgang manuelt.
