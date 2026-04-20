#!/usr/bin/env python3
"""
Eksempel på bruk av Brreg scraper som modul
"""

from examples.scraper import BrregScraper
import json

def main():
    # Opprett scraper
    scraper = BrregScraper()
    
    # Definer søkeparametere
    url = scraper.build_search_url(
        date_from="01.03.2026",
        date_to="31.03.2026",
        region_id=0,        # 0 = alle regioner
        category_level1=51  # 51 = standard søk
    )
    
    print(f"Søker i: {url}\n")
    
    # Hent kunngjøringer
    announcements = scraper.scrape_announcements(url)
    
    print(f"Hentet {len(announcements)} kunngjøringer\n")
    
    # Eksempel: Filtrer konkurser
    konkurser = [a for a in announcements if 'konkurs' in a['announcement_type'].lower()]
    print(f"Herav {len(konkurser)} konkurser")
    
    # Eksempel: Vis første 3 konkurser
    print("\nFørste 3 konkurser:")
    for i, k in enumerate(konkurser[:3], 1):
        print(f"\n{i}. {k['company_name']}")
        print(f"   Org.nr: {k['org_number']}")
        print(f"   Dato: {k['date']}")
        print(f"   Type: {k['announcement_type']}")
        print(f"   URL: {k['detail_url']}")
    
    # Lagre til fil
    with open('konkurser.json', 'w', encoding='utf-8') as f:
        json.dump(konkurser, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Lagret {len(konkurser)} konkurser til konkurser.json")

if __name__ == "__main__":
    main()
