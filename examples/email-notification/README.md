# Email Alert Template

Template for å sette opp email-varsling med Gmail.

## Beskrivelse

Dette er en template for å lage automatiserte email-varsler basert på data fra API-er, scrapers eller databaser. Systemet bruker Gmail SMTP for å sende varsler og kan integreres med PostgreSQL for å unngå duplikat-varsler.

## Forutsetninger

1. **Google-konto** med 2-faktor autentisering aktivert
2. **Gmail App Password** (se instruksjoner nedenfor)
3. **Python 3.11+**
4. (Valgfritt) **PostgreSQL database** for duplikat-sjekk

## Hvordan få Gmail App Password

Gmail krever app-spesifikke passord for SMTP-tilgang:

1. Gå til [Google Account Security](https://myaccount.google.com/security)
2. Aktiver **2-Step Verification** (obligatorisk)
3. Søk etter "App passwords" eller gå til [App Passwords](https://myaccount.google.com/apppasswords)
4. Velg app: **Mail**
5. Velg enhet: **Other** → gi navn (f.eks. "Python Email Alert")
6. Klikk **Generate**
7. Kopier 16-tegn koden (format: `xxxx xxxx xxxx xxxx`)
8. Bruk denne som `GMAIL_APP_PASSWORD` i .env-filen (fjern mellomrom)

**OBS:** Passordet vises kun én gang - kopier og lagre det sikkert!

## Setup lokalt

### 1. Installer dependencies

```bash
pip install -r requirements.txt
```

### 2. Konfigurer miljøvariabler

Opprett `.env` fil basert på `.env.example`:

```bash
cp .env.example .env
```

Rediger `.env` og fyll inn dine verdier:

```env
GMAIL_USER=din-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 16-tegn app-passord fra Google
EMAIL_RECIPIENTS=mottaker1@example.com,mottaker2@example.com
DATABASE_URL=postgresql://user:pass@localhost:5432/db  # Valgfritt
```

### 3. Implementer datahenting

Åpne `main.py` og implementer `fetch_data()` funksjonen:

```python
def fetch_data():
    """Hent data fra din API/scraper"""
    response = requests.get('https://api.example.com/data')
    return response.json()
```

### 4. Tilpass varslingskriterier

I `monitor()` funksjonen, implementer logikk for når varsler skal sendes:

```python
for item in data:
    # Definer hva som er en "alert"
    if item['status'] == 'critical':
        alert_id = str(item['id'])

        if not check_if_notified(alert_id):
            title = f"🚨 Kritisk hendelse: {item['name']}"
            details = {
                "Status": item['status'],
                "Tidspunkt": item['timestamp'],
                "Beskrivelse": item['description']
            }
            link = f"https://example.com/alerts/{item['id']}"

            # Send varsel...
```

### 5. Test lokalt

```bash
python main.py
```

## Deployment til GitHub Actions

### 1. Push kode til GitHub

```bash
git init
git add .
git commit -m "Initial commit: Email alert system"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

### 2. Konfigurer GitHub Secrets

Gå til repository → **Settings** → **Secrets and variables** → **Actions**

Legg til følgende secrets:

| Secret Name | Beskrivelse | Eksempel |
|------------|-------------|----------|
| `GMAIL_USER` | Din Gmail-adresse | `your-email@gmail.com` |
| `GMAIL_APP_PASSWORD` | App-spesifikt passord fra Google | `xxxxxxxxxxxxxxxx` (16 tegn) |
| `EMAIL_RECIPIENTS` | Kommaseparert liste med mottakere | `user1@example.com,user2@example.com` |
| `DATABASE_URL` | PostgreSQL connection string (valgfritt) | `postgresql://user:pass@host:5432/db` |

### 3. Tilpass workflow schedule

Rediger `.github/workflows/email-alert.yml`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Hver time
    # - cron: '0 9 * * *'  # Hver dag kl. 09:00
    # - cron: '*/30 * * * *'  # Hver 30. minutt
```

Bruk [crontab.guru](https://crontab.guru/) for å lage custom schedules.

### 4. Test workflow

- Gå til **Actions**-tab i GitHub
- Velg "Email Alert Monitor"
- Klikk **Run workflow** → **Run workflow**
- Sjekk logs for feil

### 5. Verifiser at emails sendes

Sjekk mottaker-innbokser:
- Kontroller at emails ikke havner i spam
- Verifiser at formatering ser bra ut
- Test både HTML og plain text visning

## Feilsøking

### "Username and Password not accepted"

- ✓ Sjekk at 2-faktor autentisering er aktivert
- ✓ Generer nytt app-passord i Google Account
- ✓ Fjern alle mellomrom i app-passordet
- ✓ Bruk hele 16-tegn koden

### Emails går til spam

- Legg til avsender i kontakter
- Be mottakere merke som "Not spam"
- Verifiser at avsender-adresse er korrekt
- Vurder å bruke egen domene med SPF/DKIM (avansert)

### Gmail SMTP blokkert

- Sjekk [Google Security Settings](https://myaccount.google.com/security)
- Verifiser at SMTP-tilgang er tillatt
- Prøv å logge inn via Gmail web først
- Sjekk at det ikke er "less secure app access" (ikke relevant for app passwords)

### GitHub Actions feiler

- Sjekk at alle secrets er korrekt satt
- Verifiser at secret-navn matcher koden
- Se detaljerte logs i Actions-tab
- Test lokalt først for å isolere problemet

### Database-feil

```
psycopg2.OperationalError: could not connect to server
```

- Verifiser DATABASE_URL format: `postgresql://user:password@host:port/database`
- Sjekk at database er tilgjengelig fra GitHub Actions (bruk managed database)
- Test database-tilkobling lokalt først

## Gmail Sending Limits

Gmail har følgende begrensninger:

- **Gratis konto**: ~500 emails/dag
- **Google Workspace**: ~2000 emails/dag

Best practices:
- Batch flere varsler til ett email hvis mulig
- Legg til forsinkelse mellom emails ved høyt volum
- Implementer rate limiting i koden

## Alternativer til Gmail

Hvis Gmail ikke passer ditt bruk, vurder:

| Tjeneste | Type | Gratis tier | Bruksområde |
|----------|------|-------------|-------------|
| SendGrid | API | 100 emails/dag | Høyt volum, API-basert |
| Mailgun | API | 5000 emails/mnd (trial) | Transaksjonelle emails |
| AWS SES | API | 62,000 emails/mnd (med EC2) | Stor skala, billig |
| Outlook/Office365 | SMTP | Avhenger av plan | Microsoft-brukere |

## Filstruktur

```
.
├── main.py                    # Hovedlogikk
├── requirements.txt           # Python dependencies
├── .env.example               # Template for miljøvariabler
├── .env                       # Lokale miljøvariabler (git-ignored)
├── .github/
│   └── workflows/
│       └── email-alert.yml    # GitHub Actions workflow
└── README.md                  # Denne filen
```

## Vedlikehold

### Database cleanup

Hvis du bruker PostgreSQL, rydd opp gamle varsler regelmessig:

```python
# main.py inneholder allerede cleanup-funksjon
cleanup_old_alerts(days=7)  # Slett varsler eldre enn 7 dager
```

### Loggføring

Sjekk GitHub Actions logs:
- Gå til Actions-tab
- Velg workflow run
- Klikk på "monitor" job
- Se detaljerte logs for hver step

### Overvåking

Legg til overvåking av workflow:
- Aktiver notifications i GitHub for failed workflows
- Bruk GitHub Actions badges i README
- Logg kritiske feil til eksternt system (f.eks. Sentry)

## Sikkerhet

- ✓ **Aldri commit** `.env` eller credentials til git
- ✓ Bruk GitHub Secrets for sensitive variabler
- ✓ Roter app-passord regelmessig (f.eks. hver 6. måned)
- ✓ Begrans tilgang til repository
- ✓ Bruk read-only database-brukere hvis mulig

## Støtte

For problemer eller spørsmål:
1. Sjekk feilsøkingsseksjonen ovenfor
2. Les [Gmail SMTP docs](https://support.google.com/mail/answer/7126229)
3. Sjekk [GitHub Actions docs](https://docs.github.com/en/actions)

## Lisens

Dette er en template - tilpass og bruk som du vil.
