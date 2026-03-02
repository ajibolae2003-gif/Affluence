import requests
import time

BASE = "https://console.aiven.io"

# Try correct auth endpoints
endpoints = [
    ("/v1/userauth", {"email": "test@test.com", "password": "wrongpass"}),
    ("/v1/authentication", {"email": "test@test.com", "password": "wrongpass"}),
    ("/v1/user/login", {"email": "test@test.com", "password": "wrongpass"}),
]

for path, body in endpoints:
    r = requests.post(BASE + path, json=body, timeout=10)
    print(f"{r.status_code} {path}")

print("\nTesting rapid fire on correct endpoint...")
# Once you find the right one, test 20 rapid requests
results = []
for i in range(20):
    r = requests.post(BASE + "/v1/userauth", json={
        "email": "test@test.com", 
        "password": f"wrong{i}"
    }, timeout=10)
    results.append(r.status_code)
    if r.status_code == 429:
        print(f"Rate limited at request {i+1}")
        break
    time.sleep(0.05)

print(f"Status codes seen: {set(results)}")
if 429 not in results:
    print("!! No rate limiting detected")