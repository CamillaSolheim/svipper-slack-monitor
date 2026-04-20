#!/usr/bin/env python3
"""
[VERKTØY_NAVN] 

Beskrivelse:
[BESKRIVELSE AV VERKTØYET]

Miljøvariabler:
- DATABASE_URL: PostgreSQL connection string (om datalagring trengs)
- SLACK_BOT_TOKEN: Slack bot token
- SLACK_CHANNEL: Slack kanal (default: #min-test-kanal)
"""

import os
import sys
import psycopg2
import requests
from datetime import datetime, timedelta

# Miljøvariabler
DATABASE_URL = os.getenv('DATABASE_URL')
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN')
SLACK_CHANNEL = os.getenv('SLACK_CHANNEL', '#min-test-kanal')

def setup_database():
    """Opprett database-tabeller hvis de ikke finnes"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            alert_id VARCHAR(100) UNIQUE NOT NULL,
            data TEXT,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notified BOOLEAN DEFAULT FALSE
        )
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Database setup complete")

def send_slack_alert(message):
    """Send melding til Slack"""
    headers = {
        'Authorization': f'Bearer {SLACK_BOT_TOKEN}',
        'Content-Type': 'application/json'
    }

    data = {
        'channel': SLACK_CHANNEL,
        'text': message
    }

    response = requests.post(
        'https://slack.com/api/chat.postMessage',
        headers=headers,
        json=data
    )

    if response.ok:
        print(f"Slack-melding sendt til {SLACK_CHANNEL}")
    else:
        print(f"Feil ved sending til Slack: {response.text}")

    return response.json()

def check_if_notified(alert_id):
    """Sjekk om vi allerede har varslet om denne hendelsen"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute(
        "SELECT notified FROM alerts WHERE alert_id = %s",
        (alert_id,)
    )
    result = cur.fetchone()

    cur.close()
    conn.close()

    return result is not None

def mark_as_notified(alert_id, data):
    """Marker hendelse som varslet"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO alerts (alert_id, data, notified)
        VALUES (%s, %s, TRUE)
        ON CONFLICT (alert_id) DO UPDATE SET notified = TRUE
        """,
        (alert_id, data)
    )

    conn.commit()
    cur.close()
    conn.close()
    print(f"Markert alert_id {alert_id} som varslet")

def cleanup_old_alerts(days=7):
    """Rydd opp gamle varsler"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cutoff_date = datetime.now() - timedelta(days=days)
    cur.execute(
        "DELETE FROM alerts WHERE detected_at < %s",
        (cutoff_date,)
    )

    conn.commit()
    deleted = cur.rowcount
    cur.close()
    conn.close()

    print(f"Ryddet opp {deleted} gamle varsler (eldre enn {days} dager)")

def format_slack_message(title, details, link=None):
    """
    Formater Slack-melding

    Args:
        title: Tittel med emoji (f.eks. "🚧 STENGT VEI 🚧")
        details: Dict med detaljer (f.eks. {"Lokasjon": "Rv. 555", "Fra": "2024-01-01"})
        link: Valgfri lenke til mer info

    Returns:
        Formatert Slack-melding
    """
    message = f"*{title}*\n\n"

    for key, value in details.items():
        message += f"*{key}:* {value}\n"

    if link:
        message += f"\n🔗 <{link}|Se mer>"

    message += f"\n📅 {datetime.now().strftime('%d. %B %Y, kl. %H:%M')}"

    return message

def fetch_data():
    """
    Hent data fra API/database

    Returns:
        List med data-objekter
    """
    # TODO: Implementer data-henting
    # Eksempel:
    # response = requests.get('https://api.example.com/data')
    # return response.json()

    return []

def monitor():
    """Hovedfunksjon for overvåking"""
    print(f"Starter overvåking: {datetime.now()}")

    try:
        # 1. Hent data
        data = fetch_data()
        print(f"Hentet {len(data)} records")

        # 2. Analyser og send varsler
        for item in data:
            # TODO: Implementer logikk for når varsler skal sendes
            alert_id = str(item.get('id', ''))  # Erstatt med faktisk ID

            if not check_if_notified(alert_id):
                # Formater melding
                title = "🔔 NY HENDELSE"  # TODO: Tilpass tittel
                details = {
                    "Info": str(item)  # TODO: Tilpass detaljer
                }
                link = None  # TODO: Legg til lenke hvis relevant

                message = format_slack_message(title, details, link)

                # Send varsel
                send_slack_alert(message)

                # Marker som varslet
                mark_as_notified(alert_id, str(item))

        print(f"Overvåking fullført: {datetime.now()}")

    except Exception as e:
        print(f"Feil under overvåking: {e}", file=sys.stderr)
        raise

def main():
    """Hovedfunksjon"""
    try:
        print("=" * 50)
        print(f"[VERKTØY_NAVN] - {datetime.now()}")
        print("=" * 50)

        # Sjekk miljøvariabler
        if not DATABASE_URL:
            print("FEIL: DATABASE_URL er ikke satt", file=sys.stderr)
            sys.exit(1)

        if not SLACK_BOT_TOKEN:
            print("FEIL: SLACK_BOT_TOKEN er ikke satt", file=sys.stderr)
            sys.exit(1)

        # Kjør overvåking
        setup_database()
        cleanup_old_alerts()
        monitor()

        print("=" * 50)
        print("FULLFØRT")
        print("=" * 50)

    except Exception as e:
        print(f"KRITISK FEIL: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
