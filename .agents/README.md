# Local Agent Index

Denne mappen inneholder prosjektspesifikke Codex-skills.

- Subagent: `../.codex/agents/scraper.toml`
- Skill: `skills/create-slack-notification/SKILL.md`
- Skill: `skills/create-email-alert/SKILL.md`

Codex oppdager disse skillene automatisk fra `.agents/skills/` når du jobber i dette repoet.

Startpunkt for globale prosjektinstrukser: `AGENTS.md` i rotmappen.

Relaterte byggesteiner og komplette eksempler:
- Scraper-subagent: `../.codex/agents/scraper.toml` → `../examples/scraper-html/` og `../examples/scraper-js/helsenorge-fastlege-scraper/`
- Slack-skill: `skills/create-slack-notification/SKILL.md` → `../examples/slack-notification/` (komplett eksempel: `../examples/askoy-fastlege-monitor/`)
- Email-skill: `skills/create-email-alert/SKILL.md` → `../examples/email-notification/`
