"""Mock VPN traffic for the Virtual Patch Sandbox dashboard.

Streams legitimate remote-worker AnyConnect/IKEv2 logins and occasionally injects
a malformed handshake modelled on a VPN-parser zero-day (simulated; no real exploit).
Malformed packets come in three tiers so the dashboard's 1-10 severity grade
shows its full range: mild (2-4), moderate (5-7), critical (8-10).

Usage:  python traffic_simulator.py [--url http://localhost:3000/api/traffic] [--rate 1.0] [--attack-every 15]
Standard library only. IPs use RFC 5737 documentation ranges.
"""
import argparse
import json
import random
import time
import urllib.request
from datetime import datetime, timezone

USERS = ["a.patel", "j.nguyen", "m.garcia", "s.kim", "r.oconnor", "l.mbeki", "t.schmidt", "e.rossi"]
GOOD_CIPHERS = [0x1301, 0x1302, 0x1303, 0xC02B, 0xC02C, 0xC02F, 0xC030, 0xCCA8, 0xCCA9]
PROTOCOLS = ["AnyConnect SSL", "AnyConnect SSL", "IKEv2"]


def ip(prefix):
    return f"{prefix}.{random.randint(2, 254)}"


def hexdump(n):
    head = "16 03 03 " + " ".join(f"{random.randint(0, 255):02x}" for _ in range(13))
    body = " ".join(f"{random.randint(0, 255):02x}" for _ in range(min(n, 48) - 16))
    return f"{head} {body}".strip()


def legit():
    n = random.randint(220, 900)
    return {
        "src_ip": ip(random.choice(["198.51.100", "203.0.113"])),
        "user": random.choice(USERS),
        "protocol": random.choice(PROTOCOLS),
        "tls_version": random.choice([0x0303, 0x0304]),
        "declared_len": n,
        "actual_len": n,
        "cipher_suites": random.sample(GOOD_CIPHERS, random.randint(3, 6)),
    }


def malformed():
    p = legit()
    p["src_ip"] = ip("192.0.2")
    p["user"] = random.choice(["admin", "vpnuser", "test", "cisco", p["user"]])
    tier = random.choice(["mild", "moderate", "critical"])

    def bad_version():
        p["tls_version"] = random.choice([0x0305, 0x0307, 0x030A, 0x7F1C, 0xFEFD, 0x0000])

    def bad_ciphers():
        p["cipher_suites"] = random.choice([[], [0x0000, 0x0000], [0xC02B, 0xC02B, 0x00FF], [0xDEAD]])

    if tier == "mild":  # header/cipher oddities only: 2-4
        bad_version()
        if random.random() < 0.6:
            bad_ciphers()
    elif tier == "moderate":  # length mismatch + extras: 5-7
        p["declared_len"] = p["actual_len"] + random.randint(40, 4000)
        bad_ciphers()
        if random.random() < 0.5:
            bad_version()
    else:  # overflow-sized length that crashes the parser: 8-10
        p["declared_len"] = random.choice([0x4400, 0x8000, 0xFFFF])
        if random.random() < 0.7:
            bad_ciphers()
        if random.random() < 0.5:
            bad_version()
    return p, tier


def post(url, packet):
    req = urllib.request.Request(url, json.dumps(packet).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000/api/traffic")
    ap.add_argument("--rate", type=float, default=1.0, help="events per second")
    ap.add_argument("--attack-every", type=int, default=15, help="~1 malformed packet per N events")
    args = ap.parse_args()

    print(f"streaming to {args.url} at {args.rate}/s (Ctrl+C to stop)")
    while True:
        if random.randint(1, args.attack_every) == 1:
            p, tier = malformed()
        else:
            p, tier = legit(), None
        p["ts"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        p["payload_hex"] = hexdump(p["actual_len"])
        try:
            res = post(args.url, p)
            tag = f"!! ZERO-DAY ({tier}) -> {res.get('id')} severity {res.get('severity')}/10" if tier else "ok"
            print(f"{p['ts'][11:19]}  {p['src_ip']:<15} {p['user']:<10} {p['protocol']:<15} {tag}")
        except Exception as e:
            print(f"post failed ({e}); is `npm run dev` running?")
        time.sleep(1 / args.rate)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
