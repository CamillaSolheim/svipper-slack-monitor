# Codex Agent Setup: Web Scraping and Notifications

Dette prosjektet er optimalisert for Codex-agenter som bygger scrapers og varsling (Slack eller e-post).

## Mål

Lever komplette, testbare løsninger raskt:
1. Hent data fra nettsider (statisk HTML eller JavaScript-renderet innhold)
2. Oppdag endringer eller kriterier
3. Send varsler til Slack eller e-post

## Standard arbeidsflyt

1. Avklar datakilde:
- Finnes offisielt API? Bruk API før scraping.
- Hvis ikke API: velg scraping-teknologi.

2. Velg teknologi for scraping:
- `Python + requests + BeautifulSoup`: når data er synlig i HTML-kilden.
- `Node.js + Playwright`: når siden renderer data med JavaScript, krever interaksjon, eller har "Hent flere"/infinite scroll.

3. Bygg monitor/alert-lag:
- Definer hva som skal trigge varsel.
- Legg inn duplikatsperre (database anbefalt).
- Send varsel til Slack eller e-post.

4. Klargjør drift:
- Lokal test først.
- GitHub Actions workflow for schedule/manual run.
- Secrets dokumentert tydelig.

## Agent og skills i dette repoet

- `scraper` agent: `.codex/agents/scraper.toml`
- `create-slack-notification` skill: `.agents/skills/create-slack-notification/SKILL.md`
- `create-email-alert` skill: `.agents/skills/create-email-alert/SKILL.md`

## Automatisk skill-oppdagelse

Codex oppdager repo-skills automatisk fra `.agents/skills/` når du jobber i repoet.

Det betyr at ekstra bootstrap-script ikke er nødvendig for normal lokal bruk i dette prosjektet.

## Trigger-regler

Bruk `scraper` agent når bruker:
- Oppgir URL og ber om scraping/ekstrahering.
- Ber om monitorering av nettsideinnhold.

Bruk `create-slack-notification` når bruker:
- Ber om varsling til Slack.
- Har eksisterende scraper/API og vil varsles ved endring.

Bruk `create-email-alert` når bruker:
- Ber om e-postvarsling (Gmail SMTP).
- Ikke ønsker Slack.

For kombinerte oppgaver:
1. Kjør `scraper`
2. Kjør relevant varslings-skill

## Kvalitetskrav (obligatorisk)

For scraping:
- Sjekk `robots.txt` før scraping.
- Implementer rate limiting (minst 1 sekund mellom requests).
- Bruk robuste selektorer (unngå skjøre klassekjeder).
- Håndter cookie-banner, paging og tomme resultater.

For varsling:
- Feilhåndtering og tydelig logging.
- Duplikatbeskyttelse (PostgreSQL anbefalt).
- Secrets kun i miljøvariabler/GitHub Secrets.

For levering:
- Kjørbar kode + dependencies + README.
- Vis forventet output-format (JSON/CSV/tekst).
- Bekreft lokal kjøring eller forklar hva som ikke kunne testes.

## Struktur som forventes

- `AGENTS.md` = prosjektinstruksjoner
- `.codex/agents/*.toml` = subagenter
- `.agents/skills/<name>/SKILL.md` = skills

Byggesteiner:
- `examples/scraper-html/` + `examples/scraper-js/helsenorge-fastlege-scraper/` (scraper-subagent)
- `examples/slack-notification/` (Slack-skill)
- `examples/email-notification/` (email-skill)

Komplette ende-til-ende monitorer:
- `examples/askoy-fastlege-monitor/`
- `examples/oygarden-fastlege-monitor/`

## Produksjonslærdom som skal brukes

Fra fastlege-monitorer i mars 2026:
- Verifiser URL-parametre manuelt (f.eks. kommunekode)
- Inspiser faktisk HTML før selektorvalg
- Håndter cookie-dialog tidlig
- Klikk "Hent flere" i loop til alle data er lastet
- Auto-detect SSL for PostgreSQL (localhost vs managed DB)

## Kort sjekkliste før ferdiglevering

1. Er riktig teknologi valgt (API/BS4/Playwright)?
2. Er scraper testet mot reell side og gir data?
3. Er varslingskriterier implementert og testet?
4. Er workflow + secrets dokumentert?
5. Er README konkret nok for ny bruker?
