# Eksempeloversikt (Codex)

Denne mappen følger Codex-strukturen i repoet og er delt i to typer eksempler.

## 1) Byggesteiner (enkeltkomponenter)

- `scraper-html/` – Python + BeautifulSoup scraper for statisk HTML.
- `scraper-js/helsenorge-fastlege-scraper/` – Playwright scraper for JS-renderet innhold.
- `slack-notification/` – Slack-varsling som egen byggestein (inkl. `vg-morning-monitor/`).
- `email-notification/` – E-postvarsling som egen byggestein.

## 2) Komplette monitor-oppsett (ende-til-ende)

- `askoy-fastlege-monitor/` – komplett monitor med scraping + endringsdeteksjon + varsling.
- `oygarden-fastlege-monitor/` – komplett monitor-oppsett for Øygarden-case.

## Kobling til Codex-komponenter

- Subagent: `../.codex/agents/scraper.toml` → bygger på scraper-eksemplene over.
- Skill: `../.agents/skills/create-slack-notification/SKILL.md` → bygger på `slack-notification/` (og `askoy-fastlege-monitor/` som komplett eksempel).
- Skill: `../.agents/skills/create-email-alert/SKILL.md` → bygger på `email-notification/`.
