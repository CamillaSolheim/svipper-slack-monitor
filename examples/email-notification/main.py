#!/usr/bin/env python3
"""
[VERKTØY_NAVN]

Beskrivelse:
[BESKRIVELSE AV VERKTØYET]

Miljøvariabler:
- GMAIL_USER: Gmail-adresse for avsender
- GMAIL_APP_PASSWORD: App-spesifikt passord fra Google (16 tegn)
- EMAIL_RECIPIENTS: Kommaseparert liste med mottaker-adresser
- DATABASE_URL: PostgreSQL connection string (om datalagring trengs)
"""

import os
import sys
import smtplib
import psycopg2
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

# Miljøvariabler
GMAIL_USER = os.getenv('GMAIL_USER')
GMAIL_APP_PASSWORD = os.getenv('GMAIL_APP_PASSWORD')
EMAIL_RECIPIENTS = os.getenv('EMAIL_RECIPIENTS', '').split(',')
DATABASE_URL = os.getenv('DATABASE_URL')

def setup_database():
    """Opprett database-tabeller hvis de ikke finnes"""
    if not DATABASE_URL:
        print("DATABASE_URL ikke satt - hopper over database setup")
        return

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_alerts (
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

def send_email_alert(subject, body, html_body=None):
    """
    Send email via Gmail SMTP

    Args:
        subject: Email subject line
        body: Plain text body
        html_body: Optional HTML body for rich formatting
    """
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = GMAIL_USER
    msg['To'] = ', '.join(EMAIL_RECIPIENTS)

    # Plain text version
    msg.attach(MIMEText(body, 'plain'))

    # HTML version (if provided)
    if html_body:
        msg.attach(MIMEText(html_body, 'html'))

    # Send via Gmail SMTP
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)

        print(f"✓ Email sendt til {len(EMAIL_RECIPIENTS)} mottakere")
        return True
    except Exception as e:
        print(f"✗ Feil ved sending av email: {e}", file=sys.stderr)
        return False

def check_if_notified(alert_id):
    """Sjekk om vi allerede har varslet om denne hendelsen"""
    if not DATABASE_URL:
        return False  # Ingen database = send alltid varsel

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute(
        "SELECT notified FROM email_alerts WHERE alert_id = %s",
        (alert_id,)
    )
    result = cur.fetchone()

    cur.close()
    conn.close()

    return result is not None

def mark_as_notified(alert_id, data):
    """Marker hendelse som varslet"""
    if not DATABASE_URL:
        return  # Ingen database

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO email_alerts (alert_id, data, notified)
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
    if not DATABASE_URL:
        return  # Ingen database

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cutoff_date = datetime.now() - timedelta(days=days)
    cur.execute(
        "DELETE FROM email_alerts WHERE detected_at < %s",
        (cutoff_date,)
    )

    conn.commit()
    deleted = cur.rowcount
    cur.close()
    conn.close()

    print(f"Ryddet opp {deleted} gamle varsler (eldre enn {days} dager)")

def format_email_html(title, details, link=None):
    """
    Formater HTML email

    Args:
        title: Tittel med emoji (f.eks. "🚨 NY HENDELSE")
        details: Dict med detaljer (f.eks. {"Lokasjon": "Oslo", "Type": "Varsel"})
        link: Valgfri lenke til mer info

    Returns:
        HTML-formatert email body
    """
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">{title}</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
    """

    for key, value in details.items():
        html += f"""
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; background-color: #ecf0f1;"><strong>{key}</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd;">{value}</td>
            </tr>
        """

    html += """
          </table>
    """

    if link:
        html += f"""
          <div style="margin-top: 20px; text-align: center;">
            <a href="{link}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">📄 Se mer informasjon</a>
          </div>
        """

    html += f"""
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            📅 Sendt: {datetime.now().strftime('%d. %B %Y, kl. %H:%M')}
          </p>
        </div>
      </body>
    </html>
    """

    return html

def format_email_plain(title, details, link=None):
    """
    Formater plain text email (fallback)

    Args:
        title: Tittel
        details: Dict med detaljer
        link: Valgfri lenke

    Returns:
        Plain text email body
    """
    text = f"{title}\n\n"
    text += "=" * 50 + "\n\n"

    for key, value in details.items():
        text += f"{key}: {value}\n"

    if link:
        text += f"\nSe mer: {link}\n"

    text += f"\n" + "=" * 50 + "\n"
    text += f"Sendt: {datetime.now().strftime('%d. %B %Y, kl. %H:%M')}\n"

    return text

def fetch_data():
    """
    Hent data fra API/database/scraper

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
        alerts_sent = 0
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

                # Lag både plain text og HTML
                plain_body = format_email_plain(title, details, link)
                html_body = format_email_html(title, details, link)

                # Send varsel
                subject = f"[Varsel] {title}"  # TODO: Tilpass subject
                if send_email_alert(subject, plain_body, html_body):
                    # Marker som varslet
                    mark_as_notified(alert_id, str(item))
                    alerts_sent += 1

        print(f"Overvåking fullført: {alerts_sent} nye varsler sendt")

    except Exception as e:
        print(f"Feil under overvåking: {e}", file=sys.stderr)
        raise

def main():
    """Hovedfunksjon"""
    try:
        print("=" * 60)
        print(f"[VERKTØY_NAVN] - {datetime.now()}")
        print("=" * 60)

        # Sjekk miljøvariabler
        if not GMAIL_USER:
            print("FEIL: GMAIL_USER er ikke satt", file=sys.stderr)
            sys.exit(1)

        if not GMAIL_APP_PASSWORD:
            print("FEIL: GMAIL_APP_PASSWORD er ikke satt", file=sys.stderr)
            sys.exit(1)

        if not EMAIL_RECIPIENTS or EMAIL_RECIPIENTS == ['']:
            print("FEIL: EMAIL_RECIPIENTS er ikke satt", file=sys.stderr)
            sys.exit(1)

        print(f"Sender varsler fra: {GMAIL_USER}")
        print(f"Mottakere: {', '.join(EMAIL_RECIPIENTS)}")
        print(f"Database: {'Aktivert' if DATABASE_URL else 'Deaktivert'}")
        print("=" * 60)

        # Kjør overvåking
        if DATABASE_URL:
            setup_database()
            cleanup_old_alerts()

        monitor()

        print("=" * 60)
        print("✓ FULLFØRT")
        print("=" * 60)

    except Exception as e:
        print(f"✗ KRITISK FEIL: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
