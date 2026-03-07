import requests

url = "https://gitlab.com/gitlab-org/gitlab-pages/-/refs/master/logs_tree/?format=json&offset=10&ref_type=HEADS"
r = requests.get(url)
data = r.json()

personal_emails = []

for commit in data:
    for email_field in ["author_email", "committer_email"]:
        email = commit["commit"].get(email_field)
        if email and not (email.endswith("@gitlab.com") or email.endswith("@users.noreply.gitlab.com")):
            personal_emails.append(email)

print(set(personal_emails))