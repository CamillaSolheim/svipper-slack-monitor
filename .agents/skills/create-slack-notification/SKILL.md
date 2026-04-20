---
name: create-slack-notification
description: Build a Slack notification workflow for scraper/API changes, including duplicate protection and GitHub Actions scheduling.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# Create Slack Notification

Bruk denne skillen når bruker vil varsles i Slack ved nye funn eller endringer.

## Informasjon som må avklares

1. Navn på monitor/varsel
2. Hva overvåkes (1-2 setninger)
3. Datakilde (eksisterende scraper, API, eller ny polling)
4. Triggerkriterier for varsel
5. Trengs duplikatsperre/database
6. Ønsket frekvens (f.eks. hver time, daglig)

Hvis noe mangler: gjør rimelige antakelser og dokumenter dem tydelig.

## Leveranse

Opprett løsning under en egen mappe i `examples/slack-notification/` med:
- `main.py` (monitor + Slack-sending)
- `requirements.txt`
- `.env.example`
- `.github/workflows/slack-alert.yml`
- `README.md`

## Implementasjonskrav

- Miljøvariabler:
- `SLACK_BOT_TOKEN` eller `SLACK_WEBHOOK_URL`
- `SLACK_CHANNEL` (ved Bot API)
- `DATABASE_URL` (hvis duplikatsperre brukes)
- Feilhåndtering rundt nettverk/API-kall
- Tydelig logging av:
- antall items hentet
- antall nye/endringer
- om varsel ble sendt eller ikke

## Duplikatbeskyttelse

Anbefalt standard:
- PostgreSQL-tabell med unik nøkkel per funn (f.eks. ekstern ID/hash)
- Send kun varsler for nye eller endrede objekter
- Rydd gamle records periodisk

## GitHub Actions

Workflow skal støtte:
- `schedule`
- `workflow_dispatch`

Workflow skal:
1. checkout
2. sette opp Python
3. installere dependencies
4. kjøre `python main.py`

## README minimumsinnhold

1. Hva løsningen overvåker
2. Lokal oppstart
3. Secrets som må settes
4. Hvordan triggerkriteriet fungerer
5. Hvordan teste manuelt i GitHub Actions

## Kvalitetskrav

Før ferdiglevering:
1. Kode kjører lokalt uten syntaksfeil
2. Triggerlogikk er eksplisitt i kode
3. Varselmelding inneholder nyttig kontekst (hva endret seg)
4. Ingen secrets i klartekst i repo


## Relevante eksempler i repoet

- Byggestein: `examples/slack-notification/`
- Komplett ende-til-ende: `examples/askoy-fastlege-monitor/`
