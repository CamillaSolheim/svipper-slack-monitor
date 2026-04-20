# Brreg Kunngjøringer Scraper

En Python-basert web scraper som henter kunngjøringer fra Brønnøysundregistrenes offentlige database.

## Funksjoner

Scraperen henter følgende data for hver kunngjøring:
- **Firmanavn** - Navn på selskapet
- **Organisasjonsnummer** - 9-sifret org.nr
- **Dato** - Kunngjøringsdato (DD.MM.YYYY)
- **Kunngjøringstype** - F.eks. "Konkursåpning", "Varsel om tvangsoppløsning", etc.
- **KID** - Kunngjørings-ID i Brreg-systemet
- **Detalj-URL** - Lenke til fullstendig kunngjøring på brreg.no
- **Scraped timestamp** - Tidspunkt for henting (ISO 8601)

## Installasjon

```bash
pip install requests beautifulsoup4 lxml
```

## Bruk

### Som kommandolinje-verktøy

```bash
python3 scraper.py > kunngjøringer.json
```

Output går til stdout (JSON-format), mens status/feilmeldinger går til stderr.

### Som Python-modul

```python
from scraper import BrregScraper

# Opprett scraper
scraper = BrregScraper()

# Bygg søke-URL
url = scraper.build_search_url(
    date_from="01.03.2026",
    date_to="31.03.2026",
    region_id=0,        # 0 = alle regioner
    category_level1=51  # Standard kategori
)

# Hent kunngjøringer
announcements = scraper.scrape_announcements(url)

# Behandle data
for ann in announcements:
    print(f"{ann['company_name']}: {ann['announcement_type']}")
```

Se `example_usage.py` for et komplett eksempel.

## Eksempel output

```json
{
  "company_name": "2ND HOME AS",
  "org_number": "928882128",
  "date": "20.03.2026",
  "announcement_type": "Varsel om tvangsoppløsning",
  "kid": "20260000128842",
  "detail_url": "https://w2.brreg.no/kunngjoring/hent_en.jsp?kid=20260000128842&sokeverdi=928882128&spraak=nb",
  "scraped_at": "2026-03-21T16:14:11.352962"
}
```

## Kunngjøringstyper

Scraperen henter følgende typer kunngjøringer:
- Varsel om tvangsoppløsning
- Konkursåpning
- Innstilling av bobehandling
- Avslutning av bobehandling
- Tvangsoppløsning
- Tvangsavvikling
- Endring av kunngjøring fra Konkursregisteret
- Konkursåpning i hjemlandet

## Konfigurasjon

### Miljøvariabler

**USER_AGENT** (valgfri): Tilpass User-Agent string

```bash
# Standard (default): Modern Chrome browser
python3 scraper.py

# Egendefinert: Identifiserbar bot
export USER_AGENT="BrregScraper/1.0 (+https://example.com/bot)"
python3 scraper.py
```

**Anbefalt for produksjon:**
```bash
export USER_AGENT="YourCompany-BrregBot/1.0 (+https://yourcompany.com/scraper-info)"
```

Dette gjør scraper-boten identifiserbar og profesjonell.

## Søkeparametere

`build_search_url()` støtter følgende parametere:

- `date_from` (str): Fra-dato i format "DD.MM.YYYY"
- `date_to` (str): Til-dato i format "DD.MM.YYYY"
- `region_id` (int): Region-ID (0 = alle regioner)
- `category_level1` (int): Kategori nivå 1 (51 = standard søk)
- `category_level2` (str): Kategori nivå 2 (default: "-+-+-")
- `industry_id` (int): Bransje-ID (0 = alle bransjer)

## Feilhåndtering

- HTTP-feil fanges opp og logges til stderr
- Parsing-feil for individuelle kunngjøringer hopper over den aktuelle posten
- Timeout satt til 30 sekunder for HTTP-requests
- Returnerer tom liste `[]` ved fullstendig feil

## Etiske hensyn

- Respekter Brønnøysundregistrenes bruksvilkår
- Dette er offentlig tilgjengelig data
- Implementer rate limiting ved intensiv bruk
- Vurder å cache data lokalt for å redusere belastning

## Begrensninger

- Henter kun data fra én side om gangen (ingen pagination)
- Støtter ikke innloggingskrevd innhold
- Statisk HTML-parsing (krever ikke JavaScript)
- Firma-navn ekstraheres fra HTML-struktur og kan være upresist i enkelte edge cases

## Tekniske detaljer

**HTML-struktur som parses:**

Kunngjøringene er strukturert som følgende i HTML:
```
<p>Firmanavn</p>
<p>20.03.2026</p>
<p></p>
<p><a href="hent_en.jsp?kid=...&sokeverdi=...">Kunngjøringstype</a></p>
```

**Dependencies:**
- `requests` - HTTP-requests
- `beautifulsoup4` - HTML-parsing
- `lxml` - Parser backend for BeautifulSoup

## Lisens

Generert for Codex-oppsett til undervisningsformål.

## Kontakt

For spørsmål eller problemer, se dokumentasjon på [Brønnøysundregistrene](https://www.brreg.no/).
