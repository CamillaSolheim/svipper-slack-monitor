---
name: create-email-alert
description: Build an email alert workflow using Gmail SMTP for scraper/API changes, with optional duplicate protection and GitHub Actions scheduling.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# Create Email Alert

Bruk denne skillen når bruker ønsker e-postvarsler i stedet for Slack.

## Informasjon som må avklares

1. Navn på monitor/varsel
2. Hva overvåkes (1-2 setninger)
3. Datakilde (scraper/API)
4. Triggerkriterier
5. Mottakerliste (en eller flere e-poster)
6. Om database trengs for duplikatsperre
7. Kjørefrekvens (time/dag)

Hvis input mangler: bruk trygg default og dokumenter antakelser.

## Leveranse

Opprett løsning under en egen mappe i `examples/email-notification/` med:
- `main.py`
- `requirements.txt`
- `.env.example`
- `.github/workflows/email-alert.yml`
- `README.md`

## Gmail-krav

Bruk Gmail SMTP SSL:
- host: `smtp.gmail.com`
- port: `465`

Miljøvariabler:
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `EMAIL_RECIPIENTS` (kommaseparert)
- `DATABASE_URL` (valgfritt, ved deduplisering)

Aldri bruk vanlig Gmail-passord. Kun app-passord.

## Implementasjonskrav

- Send både plain text og valgfri HTML-body
- Tydelig logging av sendte varsler og feil
- Robust feilhåndtering ved SMTP/network-feil
- Triggerlogikk må være tydelig separert fra transport (send_email)

## Duplikatbeskyttelse (anbefalt)

- PostgreSQL eller tilsvarende lagring
- Unik nøkkel per funn/endring
- Send varsel kun for nye/endringer

## GitHub Actions

Workflow skal støtte:
- `schedule`
- `workflow_dispatch`

Workflow skal installere dependencies og kjøre `python main.py` med secrets.

## README minimumsinnhold

1. Hva som overvåkes
2. Lokal setup og kjøring
3. Gmail App Password guide (kort)
4. Nødvendige GitHub Secrets
5. Hvordan teste workflow manuelt

## Kvalitetskrav

Før ferdiglevering:
1. Kode kjører lokalt uten syntaksfeil
2. E-postfunksjon og triggerlogikk er testbar isolert
3. Ingen sensitive data i repo
4. Varseltekst er konkret nok til å handle på


## Relevante eksempler i repoet

- Byggestein: `examples/email-notification/`
