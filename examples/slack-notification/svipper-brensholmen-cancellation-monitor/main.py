#!/usr/bin/env python3
"""
Svipper Brensholmen cancellation monitor.

Fetches the current departure list from ferge.svipper.no and sends a Slack alert
when route 181 departures from Brensholmen to Botnhamn are marked as cancelled
or have disruption text that clearly indicates cancellation.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import psycopg2
import requests
from bs4 import BeautifulSoup


USER_AGENT = "CodexSvipperMonitor/1.0 (+https://svipper.no)"
ROBOTS_URLS = [
    "https://svipper.no/robots.txt",
    "https://ferge.svipper.no/robots.txt",
]
SOURCE_URL = "https://ferge.svipper.no/"
ALERT_ROUTE = "181"
ALERT_ORIGIN = "Brensholmen ferjekai"
ALERT_DESTINATION = "Botnhamn"
REQUEST_TIMEOUT = 30
MIN_REQUEST_INTERVAL_SECONDS = 1.0
CANCELLATION_KEYWORDS = (
    "innstilt",
    "kansellert",
    "cancelled",
    "canceled",
    "avlyst",
)


@dataclass
class CancellationAlert:
    alert_key: str
    route: str
    origin: str
    destination: str
    departure_time: str
    date: str
    alert_type: str
    message_lines: list[str]
    situations: list[str]
    raw: dict[str, Any]


class PoliteSession:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._last_request_monotonic = 0.0

    def get(self, url: str) -> requests.Response:
        elapsed = time.monotonic() - self._last_request_monotonic
        if self._last_request_monotonic and elapsed < MIN_REQUEST_INTERVAL_SECONDS:
            time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)

        response = self.session.get(url, timeout=REQUEST_TIMEOUT)
        self._last_request_monotonic = time.monotonic()
        response.raise_for_status()
        return response


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Monitor Svipper ferry cancellations.")
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print parsed departures as JSON and exit without database or Slack.",
    )
    return parser.parse_args()


def ensure_allowed_by_robots(session: PoliteSession, target_url: str) -> None:
    for robots_url in ROBOTS_URLS:
        try:
            response = session.get(robots_url)
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                logging.info("robots.txt not found at %s; continuing", robots_url)
                continue
            raise

        parser = urllib.robotparser.RobotFileParser()
        parser.parse(response.text.splitlines())
        if not parser.can_fetch(USER_AGENT, target_url):
            raise RuntimeError(f"robots.txt does not allow scraping {target_url} via {robots_url}")

        logging.info("robots.txt allows %s via %s", target_url, robots_url)


def extract_nuxt_payload(html: str) -> Any:
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", attrs={"id": "__NUXT_DATA__"})
    if script is None or not script.string:
        raise RuntimeError("Could not find __NUXT_DATA__ payload on the page")

    return json.loads(script.string)


def resolve_nuxt_payload(payload: list[Any]) -> Any:
    memo: dict[int, Any] = {}

    def resolve_ref(index: int) -> Any:
        if index in memo:
            return memo[index]

        raw = payload[index]

        if isinstance(raw, dict):
            placeholder: dict[str, Any] = {}
            memo[index] = placeholder
            for key, value in raw.items():
                placeholder[key] = resolve(value)
            return placeholder

        if isinstance(raw, list) and not is_special_tag(raw):
            placeholder_list: list[Any] = []
            memo[index] = placeholder_list
            placeholder_list.extend(resolve(value) for value in raw)
            return placeholder_list

        resolved = resolve(raw)
        memo[index] = resolved
        return resolved

    def resolve(value: Any) -> Any:
        if isinstance(value, bool):
            return value

        if isinstance(value, int):
            if value >= 0 and value < len(payload):
                return resolve_ref(value)
            return value

        if isinstance(value, list):
            if is_special_tag(value):
                tag = value[0]
                ref = value[1] if len(value) > 1 else None

                if tag in {"Ref", "Reactive", "ShallowReactive"}:
                    if not isinstance(ref, int):
                        raise RuntimeError(f"Unexpected reference value for tag {tag}: {ref!r}")
                    return resolve_ref(ref)

                if tag == "Set":
                    target = resolve(ref)
                    return list(target) if isinstance(target, list) else []

                return tag

            return [resolve(item) for item in value]

        if isinstance(value, dict):
            return {key: resolve(item) for key, item in value.items()}

        return value

    return resolve(payload[0])


def is_special_tag(value: list[Any]) -> bool:
    return bool(value) and isinstance(value[0], str)


def fetch_departures(session: PoliteSession) -> tuple[str, list[dict[str, Any]]]:
    ensure_allowed_by_robots(session, SOURCE_URL)
    response = session.get(SOURCE_URL)
    root = resolve_nuxt_payload(extract_nuxt_payload(response.text))

    stop = root.get("pinia", {}).get("stop", {})
    stop_name = stop.get("name", ALERT_ORIGIN)
    departures = stop.get("departures", [])

    if not isinstance(departures, list) or not departures:
        raise RuntimeError("No departures found in Svipper payload")

    logging.info("Fetched %s departures from %s", len(departures), stop_name)
    return stop_name, departures


def flatten_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    if isinstance(value, dict):
        if "value" in value and isinstance(value["value"], str):
            return value["value"].strip()
        return " ".join(filter(None, (flatten_text(item) for item in value.values()))).strip()

    if isinstance(value, list):
        parts = [flatten_text(item) for item in value]
        return " ".join(part for part in parts if part).strip()

    return str(value).strip()


def extract_situations(departure: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    for situation in departure.get("situations", []) or []:
        summary = flatten_text(situation.get("summary"))
        description = flatten_text(situation.get("description"))
        combined = " - ".join(part for part in (summary, description) if part)
        if combined:
            texts.append(combined)
    return texts


def departure_time_parts(iso_timestamp: str) -> tuple[str, str]:
    dt = datetime.fromisoformat(iso_timestamp)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


def build_alerts(stop_name: str, departures: list[dict[str, Any]]) -> list[CancellationAlert]:
    alerts: list[CancellationAlert] = []

    for departure in departures:
        destination = flatten_text(departure.get("destinationDisplay"))
        if destination.lower() != ALERT_DESTINATION.lower():
            continue

        route = flatten_text(
            departure.get("serviceJourney", {}).get("journeyPattern", {}).get("line", {}).get("publicCode")
        )
        if route != ALERT_ROUTE:
            continue

        expected_departure = flatten_text(departure.get("expectedDepartureTime")) or flatten_text(
            departure.get("aimedDepartureTime")
        )
        if not expected_departure:
            continue

        situations = extract_situations(departure)
        cancellation = bool(departure.get("cancellation"))
        keyword_match = any(
            keyword in text.lower() for text in situations for keyword in CANCELLATION_KEYWORDS
        )

        if not cancellation and not keyword_match:
            continue

        date_part, time_part = departure_time_parts(expected_departure)
        alert_type = "cancellation" if cancellation else "situation_cancellation"
        situation_lines = [f"  - {text}" for text in situations]
        message_lines = [
            f"Route {route}: {stop_name} -> {destination}",
            f"Scheduled departure: {date_part} {time_part}",
            f"Trigger: {alert_type}",
        ]

        if situation_lines:
            message_lines.append("Situations:")
            message_lines.extend(situation_lines)

        alert_key = "|".join(
            [
                alert_type,
                route,
                stop_name.lower(),
                destination.lower(),
                expected_departure,
            ]
        )

        alerts.append(
            CancellationAlert(
                alert_key=alert_key,
                route=route,
                origin=stop_name,
                destination=destination,
                departure_time=expected_departure,
                date=date_part,
                alert_type=alert_type,
                message_lines=message_lines,
                situations=situations,
                raw=departure,
            )
        )

    logging.info("Detected %s cancelled departures", len(alerts))
    return alerts


def create_db_client():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for monitoring mode")

    return psycopg2.connect(
        database_url,
        sslmode="disable" if "localhost" in database_url else "require",
    )


def setup_database() -> None:
    with create_db_client() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS svipper_cancellation_alerts (
                    alert_key TEXT PRIMARY KEY,
                    route TEXT NOT NULL,
                    origin TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    departure_time TIMESTAMPTZ NOT NULL,
                    alert_type TEXT NOT NULL,
                    first_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    payload_json JSONB NOT NULL
                )
                """
            )
    logging.info("Database setup complete")


def cleanup_old_alerts(days: int = 14) -> None:
    cutoff = datetime.utcnow() - timedelta(days=days)
    with create_db_client() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM svipper_cancellation_alerts WHERE first_seen < %s",
                (cutoff,),
            )
            deleted = cur.rowcount
    logging.info("Cleaned up %s old alert rows", deleted)


def find_new_alerts(alerts: list[CancellationAlert]) -> list[CancellationAlert]:
    if not alerts:
        return []

    keys = [alert.alert_key for alert in alerts]
    with create_db_client() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT alert_key FROM svipper_cancellation_alerts WHERE alert_key = ANY(%s)",
                (keys,),
            )
            existing = {row[0] for row in cur.fetchall()}

    new_alerts = [alert for alert in alerts if alert.alert_key not in existing]
    logging.info("%s new cancellation alerts after deduplication", len(new_alerts))
    return new_alerts


def store_alerts(alerts: list[CancellationAlert]) -> None:
    if not alerts:
        return

    with create_db_client() as conn:
        with conn.cursor() as cur:
            for alert in alerts:
                cur.execute(
                    """
                    INSERT INTO svipper_cancellation_alerts (
                        alert_key,
                        route,
                        origin,
                        destination,
                        departure_time,
                        alert_type,
                        payload_json
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                    ON CONFLICT (alert_key) DO UPDATE
                    SET last_seen = CURRENT_TIMESTAMP,
                        payload_json = EXCLUDED.payload_json
                    """,
                    (
                        alert.alert_key,
                        alert.route,
                        alert.origin,
                        alert.destination,
                        alert.departure_time,
                        alert.alert_type,
                        json.dumps(alert.raw, ensure_ascii=False),
                    ),
                )
    logging.info("Stored %s alert rows", len(alerts))


def format_slack_message(alerts: list[CancellationAlert]) -> str:
    lines = [
        "*Ferge kansellert på Svipper*",
        "",
        "Nye kanselleringer er oppdaget for sambandet Brensholmen -> Botnhamn:",
        "",
    ]

    for alert in alerts:
        lines.append(f"• *{alert.date} {departure_time_parts(alert.departure_time)[1]}*")
        lines.append(f"  Rute {alert.route}: {alert.origin} -> {alert.destination}")
        lines.append(f"  Type: {alert.alert_type}")
        for situation in alert.situations:
            lines.append(f"  Melding: {situation}")
        lines.append("")

    lines.append(f"<{SOURCE_URL}|Åpne Svipper fergeside>")
    lines.append(f"Kjørt: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')}")
    return "\n".join(lines)


def send_slack_message(message: str) -> None:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    bot_token = os.getenv("SLACK_BOT_TOKEN")
    channel = os.getenv("SLACK_CHANNEL")

    if webhook_url:
        response = requests.post(webhook_url, json={"text": message}, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        logging.info("Slack webhook message sent")
        return

    if not bot_token or not channel:
        raise RuntimeError(
            "Set SLACK_WEBHOOK_URL or both SLACK_BOT_TOKEN and SLACK_CHANNEL before running monitor mode"
        )

    response = requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json; charset=utf-8",
        },
        json={"channel": channel, "text": message, "mrkdwn": True},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError(f"Slack API error: {payload.get('error', 'unknown_error')}")

    logging.info("Slack bot message sent to %s", channel)


def monitor() -> int:
    session = PoliteSession()
    stop_name, departures = fetch_departures(session)
    alerts = build_alerts(stop_name, departures)

    if not alerts:
        logging.info("No cancellations detected; exiting without database or Slack activity")
        return 0

    setup_database()
    cleanup_old_alerts()

    new_alerts = find_new_alerts(alerts)
    if not new_alerts:
        logging.info("No new cancellations to notify")
        return 0

    message = format_slack_message(new_alerts)
    send_slack_message(message)
    store_alerts(new_alerts)
    logging.info("Sent Slack notification for %s new cancellations", len(new_alerts))
    return 0


def print_departures_json() -> int:
    session = PoliteSession()
    stop_name, departures = fetch_departures(session)
    alerts = build_alerts(stop_name, departures)

    output = {
        "stopName": stop_name,
        "sourceUrl": SOURCE_URL,
        "departureCount": len(departures),
        "cancellationCount": len(alerts),
        "departures": departures,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    configure_logging()
    args = parse_args()

    try:
        if args.print_json:
            return print_departures_json()

        return monitor()
    except Exception as exc:  # noqa: BLE001
        logging.error("Monitor failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
