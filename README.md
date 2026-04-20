# Codex Agent Template: Web Scraping og Varsling

Et Codex-optimalisert rammeverk for å bygge scrapers og varsling til Slack eller e-post.

## Codex-struktur i dette repoet

- `AGENTS.md` = prosjektinstruksjoner
- `.codex/agents/scraper.toml` = custom subagent for scraping/monitorering
- `.agents/skills/create-slack-notification/SKILL.md` = Slack-skill
- `.agents/skills/create-email-alert/SKILL.md` = E-post-skill

## Direkte koblinger mellom struktur og eksempler

### Subagent → scraper-byggesteiner
- `.codex/agents/scraper.toml`
  - `examples/scraper-html/`
  - `examples/scraper-js/helsenorge-fastlege-scraper/`

### Skills → varslings-byggesteiner
- `.agents/skills/create-slack-notification/SKILL.md`
  - `examples/slack-notification/`
- `.agents/skills/create-email-alert/SKILL.md`
  - `examples/email-notification/`

### Komplette ende-til-ende monitorer
- `examples/askoy-fastlege-monitor/`
- `examples/oygarden-fastlege-monitor/` (peker til postliste-monitoren i `examples/scraper-js/oygarden-postliste-monitor/`)

## Eksempler: byggesteiner vs komplette oppsett

**Byggesteiner**
- `examples/scraper-html/` → enkel Python-scraper (statisk HTML)
- `examples/scraper-js/helsenorge-fastlege-scraper/` → Playwright-scraper (JS-rendering)
- `examples/slack-notification/` → Slack-varsling
- `examples/email-notification/` → e-postvarsling

**Komplette monitor-oppsett**
- `examples/askoy-fastlege-monitor/` → scraping + endringsdeteksjon + Slack + database
- `examples/oygarden-fastlege-monitor/` → full postliste-monitor (Øygarden)

Se også `examples/README.md` for en kort, samlet klassifisering av alle eksempelmapper.

## Mappestruktur

```text
.
├── AGENTS.md
├── .codex/
│   └── agents/
│       └── scraper.toml
├── .agents/
│   ├── README.md
│   └── skills/
│       ├── create-slack-notification/SKILL.md
│       └── create-email-alert/SKILL.md
└── examples/
    ├── README.md
    ├── scraper-html/
    ├── scraper-js/helsenorge-fastlege-scraper/
    ├── slack-notification/
    ├── email-notification/
    ├── askoy-fastlege-monitor/
    └── oygarden-fastlege-monitor/
```
