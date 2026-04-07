import subprocess
import sys
import re

input_file = r"C:\Users\Austin\js_files.txt"
output_file = r"C:\Users\Austin\Desktop\agains\f11\src\results.txt"
secretfinder = r"C:\Users\Austin\tools\SecretFinder\SecretFinder.py"

# ============================================================
# WHITELIST — Only these patterns are considered REAL findings
# Format: (label, regex)
# ============================================================
REAL_SECRET_REGEX = [
    ("AWS Access Key ID",       r"AKIA[0-9A-Z]{16}"),
    ("AWS Secret Key",          r"(?i)aws(.{0,20})secret(.{0,20})['\"][0-9a-zA-Z/+]{40}['\"]"),
    ("Stripe Live Secret",      r"sk_live_[0-9a-zA-Z]{24,}"),
    ("Stripe Live Public",      r"pk_live_[0-9a-zA-Z]{24,}"),
    ("Slack Bot Token",         r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}"),
    ("Slack User Token",        r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}"),
    ("Slack Webhook",           r"https://hooks\.slack\.com/services/T[a-zA-Z0-9]+/B[a-zA-Z0-9]+/[a-zA-Z0-9]+"),
    ("Twilio Real SID",         r"AC[a-f0-9]{32}"),
    ("Twilio Auth Token",       r"(?i)twilio(.{0,10})token['\"\s:=]+[a-f0-9]{32}"),
    ("Heroku Real Key",         r"HRKU-[a-zA-Z0-9]{36}"),
    ("Google API Key",          r"AIza[0-9A-Za-z\-_]{35}"),
    ("Google OAuth",            r"[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com"),
    ("Firebase URL",            r"https://[a-z0-9-]+\.firebaseio\.com"),
    ("JWT Token",               r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"),
    ("GitHub Token",            r"gh[pousr]_[A-Za-z0-9_]{36,}"),
    ("GitHub Classic Token",    r"ghp_[a-zA-Z0-9]{36}"),
    ("NPM Token",               r"npm_[a-zA-Z0-9]{36}"),
    ("Sendgrid Key",            r"SG\.[a-zA-Z0-9\-_]{22}\.[a-zA-Z0-9\-_]{43}"),
    ("Mailgun Key",             r"key-[0-9a-zA-Z]{32}"),
    ("Mailchimp Key",           r"[0-9a-f]{32}-us[0-9]{1,2}"),
    ("Shopify Token",           r"shpat_[a-fA-F0-9]{32}"),
    ("Shopify Secret",          r"shpss_[a-fA-F0-9]{32}"),
    ("Square Access Token",     r"sq0atp-[0-9A-Za-z\-_]{22}"),
    ("Paypal Client ID",        r"A[a-zA-Z0-9_-]{79}"),
    ("Private Key Header",      r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
    ("Bearer Token",            r"(?i)bearer\s+[a-zA-Z0-9\-_\.]{20,}"),
    ("Basic Auth in URL",       r"https?://[a-zA-Z0-9]+:[a-zA-Z0-9@!#$%^&*]{6,}@[a-zA-Z]"),
    ("S3 Bucket with Path",     r"s3\.amazonaws\.com/[a-zA-Z0-9_-]{3,}/"),
    ("Azure Key",               r"(?i)AccountKey=[a-zA-Z0-9+/=]{88}"),
    ("Twilio API Key",          r"SK[a-f0-9]{32}"),
]

def scan_with_whitelist(text):
    """Scan raw JS content against whitelist patterns directly."""
    hits = []
    for label, pattern in REAL_SECRET_REGEX:
        matches = re.findall(pattern, text)
        for match in matches:
            if isinstance(match, tuple):
                match = "".join(match)
            hits.append((label, match.strip()))
    return hits

def fetch_js(url):
    """Fetch raw JS content using SecretFinder output or fallback."""
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return None

# ============================================================
# MAIN
# ============================================================
with open(input_file) as f:
    urls = [line.strip() for line in f if line.strip()]

total = len(urls)
found_count = 0

print(f"[*] Loaded {total} URLs")
print(f"[*] Mode: WHITELIST ONLY (real secrets)\n")

with open(output_file, "w") as out:
    out.write("=" * 60 + "\n")
    out.write("Bug Bounty - Whitelist Secret Scan Results\n")
    out.write("=" * 60 + "\n\n")

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{total}] Scanning: {url}")

        js_content = fetch_js(url)

        if not js_content:
            print(f"  [!] Failed to fetch")
            continue

        hits = scan_with_whitelist(js_content)

        if hits:
            found_count += 1
            print(f"  [!!!] REAL SECRET FOUND:")
            out.write(f"\n{'=' * 60}\n")
            out.write(f"URL: {url}\n")
            out.write(f"{'=' * 60}\n")
            for label, value in hits:
                print(f"        [{label}] => {value}")
                out.write(f"  [{label}] => {value}\n")
        else:
            print(f"  [-] Clean")

print(f"\n{'=' * 60}")
print(f"[+] Scan complete.")
print(f"[+] Total scanned  : {total}")
print(f"[+] Real finds     : {found_count}")
print(f"[+] Saved to       : {output_file}")
print(f"{'=' * 60}")