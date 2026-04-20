# Svipper Brensholmen Cancellation Monitor

Denne monitoren sjekker `ferge.svipper.no` og sender Slack-varsel når avgangene for rute `181` fra **Brensholmen ferjekai** til **Botnhamn** er markert som kansellert.

## Hva som overvåkes

- Kilde: `https://ferge.svipper.no/`
- Samband: `181`
- Retning: `Brensholmen ferjekai -> Botnhamn`
- Trigger:
  - `cancellation`-feltet på en avgang er satt
  - eller driftsmeldinger på avgangen inneholder tydelige kanselleringsord som `innstilt`, `kansellert`, `cancelled`, `canceled` eller `avlyst`

## Antakelser

- Per 20. april 2026 er `ferge.svipper.no` server-renderet og eksponerer avgangsdata i `__NUXT_DATA__`.
- Monitoren varsler bare om avgangene som faktisk vises på Brensholmen-siden. Hvis Svipper flytter disse dataene til et nytt endepunkt eller endrer payload-formatet, må parseren oppdateres.
- Workflow-forslaget kjører hvert 10. minutt for å gi relativt raske varsler uten å være aggressiv.

## Lokal kjøring

1. Opprett og aktiver virtuelt miljø.
2. Installer avhengigheter:

```bash
pip install -r requirements.txt
```

3. Kopier miljøvariabler:

```bash
cp .env.example .env
```

4. Sett minst disse variablene:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/svipper_monitor
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

Du kan også bruke Slack Bot API i stedet for webhook:

```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL=#ferge-varsler
```

5. Test parseren uten database eller Slack:

```bash
python main.py --print-json
```

6. Kjør full monitor:

```bash
python main.py
```

## Forventet JSON-format

Eksempel fra `--print-json`:

```json
{
  "stopName": "Brensholmen ferjekai",
  "sourceUrl": "https://ferge.svipper.no/",
  "departureCount": 10,
  "cancellationCount": 0,
  "departures": [
    {
      "expectedDepartureTime": "2026-04-20T17:00:00+02:00",
      "destinationDisplay": {
        "frontText": "Botnhamn"
      },
      "cancellation": false,
      "serviceJourney": {
        "journeyPattern": {
          "line": {
            "publicCode": "181",
            "transportMode": "water"
          }
        }
      },
      "situations": []
    }
  ]
}
```

## Duplikatbeskyttelse

- PostgreSQL-tabellen `svipper_cancellation_alerts` lagrer én rad per kansellert avgang.
- `alert_key` er unik per avgangstid, rute, retning og alert-type.
- Slack-varsel sendes bare når en kansellering oppdages første gang.

## GitHub Actions

Workflow-mal ligger i repoet på:

- `.github/workflows/svipper-brensholmen-slack-alert.yml`

Secrets som må settes i GitHub:

- `SVIPPER_DATABASE_URL`
- `SVIPPER_SLACK_WEBHOOK_URL`

Hvis du vil bruke Slack Bot API i stedet for webhook:

- `SVIPPER_SLACK_BOT_TOKEN`
- `SVIPPER_SLACK_CHANNEL`

## Manuell test i GitHub Actions

1. Push mappen til ditt repository.
2. Legg inn secrets.
3. Gå til **Actions**.
4. Velg workflowen `Svipper Brensholmen Slack Alert`.
5. Kjør **Run workflow** manuelt.

## Begrensninger

- Løsningen baserer seg på at Svipper fortsatt viser kanselleringer i `__NUXT_DATA__` eller i tilhørende driftsmeldinger.
- Dette er en monitor for Brensholmen-siden. Dersom du senere vil overvåke Botnhamn-siden eksplisitt, bør vi legge til en egen stop-place-kilde når Svipper gjør den tilgjengelig.
