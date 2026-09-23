# QA Agent Setup

The QA agent uses Claude to review code, triage issues, and monitor CI — posting comments, Slack messages, and GitHub issues automatically.

## Required GitHub Secrets

Go to **Settings → Secrets → Actions** in the repo and add:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SLACK_WEBHOOK_URL` | Incoming Webhook URL from Slack |

### Creating a Slack Incoming Webhook
1. Go to https://api.slack.com/apps → create or select an app
2. Enable **Incoming Webhooks**
3. Add a new webhook → pick the channel (e.g. `#virtru-demo-qa`)
4. Copy the `https://hooks.slack.com/services/...` URL → paste as `SLACK_WEBHOOK_URL`

## What it monitors

| Trigger | Action |
|---------|--------|
| PR opened/updated | Reviews JS/TS diff with Claude, comments on PR, creates issue for critical bugs, Slacks on warnings+ |
| Push to `main` | Alerts Slack if it looks like an unreviewed direct commit |
| New issue opened | Triages type/severity/area, comments on issue, Slacks for critical/high |
| CI workflow failure | **Not active** — the repo has no other workflow to watch, and the old `workflows: ["*"]` trigger was a self-trigger loop. The handler is still in `qa-agent.mjs`; re-enable it by listing real workflow names under `workflow_run` in `qa-agent.yml` |

## Model

Defaults to `claude-sonnet-5`. Override per-run without editing the script by setting a `QA_MODEL`
env var on the **Run Claude QA Agent** step.

## Labels created automatically
The agent creates issues with labels `qa-agent` and `bug` or `ci-failure`.
Create these labels in the repo (Issues → Labels) or the API calls will still work — GitHub will just omit the labels.
