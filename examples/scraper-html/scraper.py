#!/usr/bin/env python3
"""
Brreg Kunngjøringer Scraper

Scraper kunngjøringer fra Brønnøysundregistrenes kunngjøringsdatabase.
Henter data som firmanavn, organisasjonsnummer, dato, kunngjøringstype, etc.

Generert: 2026-03-21
"""

import requests
from bs4 import BeautifulSoup
import re
import os
from datetime import datetime
from typing import List, Dict, Optional
import sys
import json


class BrregScraper:
    """Scraper for Brønnøysundregistrenes kunngjøringssider"""

    BASE_URL = "https://w2.brreg.no/kunngjoring/"
    USER_AGENT = os.getenv(
        'USER_AGENT',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    )

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.USER_AGENT
        })

    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """
        Hent og parse HTML fra URL

        Args:
            url: URL til siden som skal hentes

        Returns:
            BeautifulSoup objekt eller None ved feil
        """
        try:
            print(f"Henter: {url}", file=sys.stderr)
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            return soup

        except requests.exceptions.RequestException as e:
            print(f"Feil ved henting av {url}: {e}", file=sys.stderr)
            return None

    def parse_announcement(self, p_tags: List, index: int) -> Optional[Dict]:
        """
        Parse en enkelt kunngjøring fra p-tags

        Struktur observert på siden:
        p[index-3]: Firmanavn
        p[index-2]: Dato (DD.MM.YYYY)
        p[index-1]: Tom (whitespace)
        p[index]: Lenke med kunngjøringstype

        Args:
            p_tags: Liste med alle <p> tags
            index: Index til <p> taggen med lenken

        Returns:
            Dictionary med kunngjøringsdata eller None
        """
        try:
            link_p = p_tags[index]
            link = link_p.find('a', href=re.compile(r'hent_en\.jsp'))

            if not link:
                return None

            # Hent URL-data
            href = link.get('href', '')
            kid_match = re.search(r'kid=(\d+)', href)
            org_match = re.search(r'sokeverdi=(\d+)', href)

            kid = kid_match.group(1) if kid_match else None
            org_nr = org_match.group(1) if org_match else None
            kunngjoringstype = link.get_text(strip=True)

            # Hent firmanavn fra p[index-3]
            firma = None
            if index >= 3:
                firma_text = p_tags[index - 3].get_text(strip=True)
                # Valider at det er et firmanavn (ikke "Oslo", "Dato", etc.)
                if firma_text and firma_text not in ['Oslo', 'Dato', 'Kunngjøringstype', '']:
                    firma = firma_text

            # Hent dato fra p[index-2]
            dato = None
            if index >= 2:
                dato_text = p_tags[index - 2].get_text(strip=True)
                # Valider dato-format (DD.MM.YYYY)
                if re.match(r'\d{2}\.\d{2}\.\d{4}', dato_text):
                    dato = dato_text

            # Hvis vi ikke fant firma, bruk org.nr som identifikator
            if not firma and org_nr:
                firma = f"Org.nr {org_nr}"

            # Bygg detaljert URL
            detail_url = f"{self.BASE_URL}{href}" if href else None

            return {
                'company_name': firma,
                'org_number': org_nr,
                'date': dato,
                'announcement_type': kunngjoringstype,
                'kid': kid,
                'detail_url': detail_url,
                'scraped_at': datetime.now().isoformat()
            }

        except Exception as e:
            print(f"Feil ved parsing av kunngjøring ved index {index}: {e}", file=sys.stderr)
            return None

    def scrape_announcements(self, url: str) -> List[Dict]:
        """
        Scrape alle kunngjøringer fra en URL

        Args:
            url: URL til kunngjøringssiden

        Returns:
            Liste med dictionaries for hver kunngjøring
        """
        soup = self.fetch_page(url)
        if not soup:
            return []

        # Finn alle <p> tags
        p_tags = soup.find_all('p')
        print(f"Fant {len(p_tags)} <p> tags totalt", file=sys.stderr)

        announcements = []

        # Finn alle p-tags som inneholder kunngjøringslenker
        for i, p in enumerate(p_tags):
            link = p.find('a', href=re.compile(r'hent_en\.jsp'))
            if link:
                announcement = self.parse_announcement(p_tags, i)
                if announcement and announcement['company_name']:
                    announcements.append(announcement)

        print(f"Hentet {len(announcements)} kunngjøringer", file=sys.stderr)
        return announcements

    def build_search_url(
        self,
        date_from: str = "01.03.2026",
        date_to: str = "31.03.2026",
        region_id: int = 0,
        category_level1: int = 51,
        category_level2: str = "-+-+-",
        industry_id: int = 0
    ) -> str:
        """
        Bygg søke-URL med parametere

        Args:
            date_from: Fra-dato (DD.MM.YYYY)
            date_to: Til-dato (DD.MM.YYYY)
            region_id: Region ID (0 = alle)
            category_level1: Kategori nivå 1 (51 = standard)
            category_level2: Kategori nivå 2
            industry_id: Bransje ID (0 = alle)

        Returns:
            Komplett URL
        """
        base = f"{self.BASE_URL}kombisok.jsp"
        params = f"?datoFra={date_from}&datoTil={date_to}&id_region={region_id}"
        params += f"&id_niva1={category_level1}&id_niva2={category_level2}&id_bransje1={industry_id}"

        return base + params


def main():
    """Hovedfunksjon"""
    print("=" * 70, file=sys.stderr)
    print("Brreg Kunngjøringer Scraper", file=sys.stderr)
    print("=" * 70, file=sys.stderr)

    # Opprett scraper
    scraper = BrregScraper()

    # Bygg URL (kan tilpasses med egne datoer)
    url = scraper.build_search_url(
        date_from="01.03.2026",
        date_to="31.03.2026",
        region_id=0,        # 0 = alle regioner
        category_level1=51  # 51 = standard kategori
    )

    print(f"\nSøker i: {url}\n", file=sys.stderr)

    # Scrape kunngjøringer
    try:
        announcements = scraper.scrape_announcements(url)

        if not announcements:
            print("\n❌ Ingen kunngjøringer funnet", file=sys.stderr)
            return []

        # Print statistikk
        print(f"\n✅ Hentet {len(announcements)} kunngjøringer", file=sys.stderr)

        # Telle kunngjøringstyper
        types_count = {}
        for ann in announcements:
            ann_type = ann['announcement_type']
            types_count[ann_type] = types_count.get(ann_type, 0) + 1

        print(f"\nFordeling per type:", file=sys.stderr)
        for ann_type, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  - {ann_type}: {count}", file=sys.stderr)

        # Print eksempel
        print(f"\nEksempel på første kunngjøring:", file=sys.stderr)
        print(json.dumps(announcements[0], indent=2, ensure_ascii=False), file=sys.stderr)

        # Returner data som JSON til stdout
        print(json.dumps(announcements, indent=2, ensure_ascii=False))

        return announcements

    except Exception as e:
        print(f"\n❌ Feil under scraping: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return []


if __name__ == "__main__":
    main()
