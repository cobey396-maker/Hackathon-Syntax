"""Mock VPN traffic for the Virtual Patch Sandbox dashboard.

Streams legitimate remote-worker AnyConnect/IKEv2 logins (green). Press a hotkey to inject
a malformed, zero-day VPN handshake (magenta), modelled on a VPN-parser overflow. Simulated;
no real exploit, and IPs use RFC 5737 documentation ranges.

Hotkeys:  z = inject zero-day (rotates mild -> moderate -> critical)   q = quit
Usage:    python traffic_simulator.py [--url http://localhost:3000/api/traffic] [--rate 1.0] [--auto-attack N]
Standard library only.
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.request
from datetime import datetime, timezone

GREEN, MAGENTA, RED, DIM, BOLD, RESET = "\033[92m", "\033[95m", "\033[91m", "\033[2m", "\033[1m", "\033[0m"

USERS = ["a.patel", "j.nguyen", "m.garcia", "s.kim", "r.oconnor", "l.mbeki", "t.schmidt", "e.rossi"]
GOOD_CIPHERS = [0x1301, 0x1302, 0x1303, 0xC02B, 0xC02C, 0xC02F, 0xC030, 0xCCA8, 0xCCA9]
PROTOCOLS = ["AnyConnect SSL", "AnyConnect SSL", "IKEv2"]
TIERS = ["mild", "moderate", "critical"]


# ── keyboard (non-blocking, cross-platform) ─────────────────────────────────────────
if os.name == "nt":
    import msvcrt

    class Keys:
        def __enter__(self):
            os.system("")  # enable ANSI colours in the Windows console
            return self

        def __exit__(self, *a):
            pass

        def poll(self):
            return msvcrt.getwch().lower() if msvcrt.kbhit() else None
else:
    import select
    import termios
    import tty

    class Keys:
        def __enter__(self):
            self.fd = sys.stdin.fileno()
            self.old = termios.tcgetattr(self.fd)
            tty.setcbreak(self.fd)
            return self

        def __exit__(self, *a):
            termios.tcsetattr(self.fd, termios.TCSADRAIN, self.old)

        def poll(self):
            return sys.stdin.read(1).lower() if select.select([sys.stdin], [], [], 0)[0] else None


# ── packets ─────────────────────────────────────────────────────────────────────────
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


def malformed(tier):
    p = legit()
    p["src_ip"] = ip("192.0.2")
    p["user"] = random.choice(["admin", "vpnuser", "test", "cisco", p["user"]])

    def bad_version():
        p["tls_version"] = random.choice([0x0305, 0x0307, 0x030A, 0x7F1C, 0xFEFD, 0x0000])

    def bad_ciphers():
        p["cipher_suites"] = random.choice([[], [0x0000, 0x0000], [0xC02B, 0xC02B, 0x00FF], [0xDEAD]])

    if tier == "mild":  # header/cipher oddities only: severity 1-4
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
    return p


def post(url, packet):
    req = urllib.request.Request(url, json.dumps(packet).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def send(url, p, tier=None):
    p["ts"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    p["payload_hex"] = hexdump(p["actual_len"])
    row = f"{p['ts'][11:19]}  {p['src_ip']:<15} {p['user']:<10} {p['protocol']:<15}"
    try:
        res = post(url, p)
    except Exception as e:
        print(f"{RED}post failed ({e}); is `npm run dev` running?{RESET}")
        return
    if tier:
        print(f"{MAGENTA}{BOLD}{row} !! ZERO-DAY injected ({tier}) -> held as {res.get('id')} severity {res.get('severity')}/10{RESET}")
    elif res.get("verdict") == "sandboxed":
        print(f"{RED}{row} flagged by AI -> {res.get('id')} severity {res.get('severity')}/10{RESET}")
    else:
        print(f"{GREEN}{row} login ok -> passed to firewall{RESET}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000/api/traffic")
    ap.add_argument("--rate", type=float, default=1.0, help="legit logins per second")
    ap.add_argument("--auto-attack", type=int, default=0, metavar="N", help="also inject ~1 zero-day per N logins (default: hotkey only)")
    args = ap.parse_args()

    tier_i = 0
    with Keys() as keys:
        print(f"{BOLD}Virtual Patch Sandbox traffic simulator{RESET}  ->  {args.url}")
        print(f"{DIM}legit logins at {args.rate}/s.  Press {RESET}{BOLD}z{RESET}{DIM} to inject a zero-day handshake, {RESET}{BOLD}q{RESET}{DIM} to quit.{RESET}\n")
        next_legit = time.monotonic()
        while True:
            k = keys.poll()
            if k == "q":
                break
            if k == "z":
                send(args.url, malformed(TIERS[tier_i]), TIERS[tier_i])
                tier_i = (tier_i + 1) % len(TIERS)
            now = time.monotonic()
            if now >= next_legit:
                if args.auto_attack and random.randint(1, args.auto_attack) == 1:
                    t = random.choice(TIERS)
                    send(args.url, malformed(t), t)
                else:
                    send(args.url, legit())
                next_legit = now + 1 / args.rate
            time.sleep(0.05)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
