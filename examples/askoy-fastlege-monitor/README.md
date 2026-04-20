# Askøy Fastlege Monitor

Automatisk overvåking av fastleger i Askøy kommune med Slack-varsler ved endringer.

## Hva gjør dette?

Dette systemet:
1. **Scraper** fastlege-data fra Helsenorge for Askøy kommune (4627) én gang per dag
2. **Sammenligner** med tidligere data i PostgreSQL database
3. **Detekterer** følgende endringer:
   - ✨ Nye leger som dukker opp
   - ❌ Leger som forsvinner
   - 🔄 Endringer i status (f.eks. "Ledig" → "Full")
   - 📈 Endringer i kapasitet
4. **Sender varsel** til Slack når endringer oppdages

## Forutsetninger

- **Node.js 20+**
- **PostgreSQL database** (lokal eller managed)
- **Slack workspace** med bot-token
- **GitHub repository** (for automatisk kjøring via GitHub Actions)

## Lokal setup

### 1. Installer dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Konfigurer miljøvariabler

Opprett `.env` fil basert på `.env.example`:

```bash
cp .env.example .env
```

Rediger `.env`:

```env
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#fastlege-varsler
DATABASE_URL=postgresql://user:password@localhost:5432/askoy_fastlege
```

### 3. Sett opp lokal PostgreSQL (valgfritt)

Med Docker:

```bash
docker run --name askoy-postgres \
  -e POSTGRES_USER=askoy \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=askoy_fastlege \
  -p 5432:5432 \
  -d postgres:16
```

Database-tabeller opprettes automatisk ved første kjøring.

### 4. Test scraperen

Test at scraperen fungerer:

```bash
npm run scrape
```

Du skal se output med fastlege-data i JSON-format.

### 5. Kjør full monitoring

```bash
npm start
```

Første gang vil den:
- Opprette database-tabeller
- Scrape og lagre alle fastleger
- Ingen varsler sendes (siden det er første kjøring)

Andre gang vil den:
- Sammenligne med lagrede data
- Sende Slack-varsler hvis endringer oppdages

## Deployment til GitHub Actions

### 1. Push kode til GitHub

```bash
git init
git add .
git commit -m "Initial commit: Askøy fastlege monitor"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### 2. Konfigurer GitHub Secrets

Gå til repository → **Settings** → **Secrets and variables** → **Actions**

Legg til følgende secrets:

| Secret Name | Beskrivelse | Eksempel |
|------------|-------------|----------|
| `ASKOY_DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SLACK_BOT_TOKEN` | Slack bot token | `xoxb-...` |
| `ASKOY_SLACK_CHANNEL` | Slack kanal for varsler | `#fastlege-varsler` |

### 3. Sett opp managed PostgreSQL

**Alternativer:**

- **Neon** (gratis tier): https://neon.tech
- **Supabase** (gratis tier): https://supabase.com
- **Railway** (gratis trial): https://railway.app
- **Render** (gratis tier): https://render.com

Kopier connection string til `ASKOY_DATABASE_URL` secret.

**SSL-støtte:** Systemet håndterer automatisk SSL-tilkoblinger for managed PostgreSQL-tjenester. SSL aktiveres automatisk for alle connections som ikke er til localhost.

### 4. Opprett Slack Bot

1. Gå til https://api.slack.com/apps
2. Klikk **Create New App** → **From scratch**
3. Gi navn: "Askøy Fastlege Bot"
4. Velg workspace
5. Gå til **OAuth & Permissions**
6. Legg til **Bot Token Scopes**:
   - `chat:write` - Send meldinger
   - `chat:write.public` - Send til offentlige kanaler
7. Klikk **Install to Workspace**
8. Kopier **Bot User OAuth Token** (starter med `xoxb-`)
9. Inviter bot til kanalen: `/invite @Askøy Fastlege Bot`

### 5. Tilpass schedule

Rediger `.github/workflows/fastlege-monitor.yml`:

```yaml
on:
  schedule:
    # Kjør en gang per dag kl. 09:00 UTC
    - cron: '0 9 * * *'

    # Eller kjør hver 12. time:
    # - cron: '0 */12 * * *'

    # Eller kjør hver mandag kl. 08:00:
    # - cron: '0 8 * * 1'
```

Bruk [crontab.guru](https://crontab.guru/) for å lage custom schedules.

### 6. Test workflow manuelt

- Gå til **Actions**-tab i GitHub
- Velg "Askøy Fastlege Monitor"
- Klikk **Run workflow** → **Run workflow**
- Sjekk logs for feil

## Hvordan det fungerer

### Database-struktur

**Tabell: `fastleger`**
```sql
id              VARCHAR(200)  -- Unik ID basert på navn + adresse
name            VARCHAR(200)  -- Navn på lege/legekontor
address         TEXT          -- Adresse
status          VARCHAR(100)  -- Status (f.eks. "Ledig", "Full")
capacity        VARCHAR(50)   -- Antall ledige plasser
phone           VARCHAR(50)   -- Telefonnummer
first_seen      TIMESTAMP     -- Første gang sett
last_seen       TIMESTAMP     -- Sist sett
last_status     VARCHAR(100)  -- Forrige status (for endring-tracking)
last_capacity   VARCHAR(50)   -- Forrige kapasitet
```

**Tabell: `change_log`**
```sql
id              SERIAL        -- Auto-increment ID
fastlege_id     VARCHAR(200)  -- Referanse til fastlege
change_type     VARCHAR(50)   -- Type: new, removed, status_change, capacity_change
old_value       TEXT          -- Gammel verdi
new_value       TEXT          -- Ny verdi
detected_at     TIMESTAMP     -- Når endring ble oppdaget
notified        BOOLEAN       -- Om Slack-varsel er sendt
```

### Endringsdeteksjon

1. **Nye leger**: Fastlege-ID finnes ikke i database
2. **Forsvunnet leger**: Fastlege-ID finnes i database men ikke i ny scraping
3. **Status-endring**: `status` felt har endret seg
4. **Kapasitet-endring**: `capacity` felt har endret seg

### Slack-meldingsformat

```
🏥 Askøy Fastlege Oppdatering

Følgende endringer er oppdaget:

✨ Nye leger (2):
• Dr. Hansen Legekontor
  📍 Askøyvegen 10, 5300 Kleppestø
  📊 Status: Ledig

❌ Leger som har forsvunnet (1):
• Gammel Lege AS
  📍 Gamle gata 5, 5300 Kleppestø

🔄 Status-endringer (1):
• Dr. Olsen Legesenter
  Fra: "Full" → Til: "Ledig"

🔗 Se alle fastleger på Helsenorge
📅 21. mars 2026, 10:30:15
```

## Testing

### Manuell test av scraper

```bash
npm run scrape
```

Forventet output:
```json
[
  {
    "id": "dr._hansen_legekontor_askøyvegen_10_5300_kleppestø",
    "name": "Dr. Hansen Legekontor",
    "address": "Askøyvegen 10, 5300 Kleppestø",
    "status": "Ledig",
    "capacity": "5 ledige plasser",
    "phone": "55 12 34 56",
    "scrapedAt": "2026-03-21T09:30:00.000Z"
  }
]
```

### Test med lokal database

```bash
# Første kjøring - populer database
npm start

# Endre noe manuelt i databasen for testing
psql $DATABASE_URL
> UPDATE fastleger SET status = 'Full' WHERE id = '...';

# Kjør igjen - skal detektere endring
npm start
```

## Feilsøking

### "ECONNREFUSED" - Database connection failed

- Sjekk at PostgreSQL kjører
- Verifiser `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Test tilkobling: `psql $DATABASE_URL`

### Scraper finner ingen data

- Helsenorge kan ha endret HTML-struktur
- Sjekk at URL er korrekt: https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627
- Sjekk at "Hent flere"-knappen klikkes for å laste alle leger
- Kjør scraper med headless=false for debugging:
  - Endre i `scraper.js`: `headless: false`

### Slack-melding sendes ikke

- Verifiser `SLACK_BOT_TOKEN` starter med `xoxb-`
- Sjekk at bot er invitert til kanalen: `/invite @Bot-navn`
- Verifiser bot har `chat:write` scope
- Sjekk GitHub Actions logs for feil

### GitHub Actions feiler på Playwright install

Sjekk at workflow har:
```yaml
- run: npx playwright install chromium
- run: npx playwright install-deps chromium
```

## Vedlikehold

### Database cleanup

Change log vokser over tid. Legg til cleanup:

```javascript
// I monitor.js
async function cleanupOldChanges(days = 30) {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    await client.query(`
        DELETE FROM change_log
        WHERE detected_at < NOW() - INTERVAL '${days} days'
    `);

    await client.end();
}
```

### Endre schedule

Rediger `.github/workflows/fastlege-monitor.yml`:

```yaml
# Hver dag kl. 08:00 og 20:00
- cron: '0 8,20 * * *'

# Kun hverdager kl. 09:00
- cron: '0 9 * * 1-5'

# Første dag i måneden kl. 12:00
- cron: '0 12 1 * *'
```

### Overvåke flere kommuner

Utvid scraperen til å håndtere flere kommuner:

```javascript
const KOMMUNER = [
    { navn: 'Askøy', fylke: 46, kommune: 4601 },
    { navn: 'Bergen', fylke: 46, kommune: 4601 },
    // etc...
];
```

## Arkitektur

```
┌─────────────────────────────────────────────┐
│         GitHub Actions Workflow             │
│  (Kjører daglig kl. 09:00 UTC)             │
└─────────────────┬───────────────────────────┘
                  │
                  v
         ┌────────────────┐
         │  monitor.js    │
         │  (Hovedlogikk) │
         └────────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
         v                 v
    ┌──────────┐    ┌────────────┐
    │scraper.js│    │ PostgreSQL │
    │(Playwright)   │  Database  │
    └─────┬────┘    └─────┬──────┘
          │               │
          v               v
    ┌─────────────┐ ┌─────────────┐
    │ Helsenorge  │ │ change_log  │
    │   HTML      │ │ fastleger   │
    └─────────────┘ └──────┬──────┘
                           │
                           v
                    ┌──────────────┐
                    │ Slack Bot API│
                    │  (Varsler)   │
                    └──────────────┘
```

## Sikkerhet

- ✅ Secrets lagres i GitHub Secrets, ikke i kode
- ✅ Database credentials aldri committet til git
- ✅ Slack bot token aldri logget
- ✅ `.env` fil ekskludert fra git via `.gitignore`

## Kostnader

**Helt gratis med:**
- GitHub Actions (2000 minutter/måned gratis)
- Neon PostgreSQL (gratis tier: 0.5GB storage)
- Slack (gratis workspace)

**Estimert bruk:**
- 1 kjøring/dag × 2 minutter = 60 minutter/måned (godt innenfor gratis tier)

## Lisens

Dette er et eksempel-prosjekt. Bruk og tilpass fritt.

## Support

Ved problemer:
1. Sjekk feilsøkingsseksjonen ovenfor
2. Se GitHub Actions logs for detaljerte feilmeldinger
3. Verifiser at alle secrets er korrekt konfigurert
