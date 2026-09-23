import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "child_process";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const REPO = process.env.GITHUB_REPO;
const EVENT = process.env.EVENT_NAME;

// Everything this script handles is untrusted text: model output, PR titles, issue bodies. None of
// it may reach a shell. execFileSync with an argv array means no shell is spawned at all, and the
// JSON body goes in on stdin rather than into a quoted -d argument — the old form broke on the
// first apostrophe in a finding ("doesn't await") and let a backtick run commands on the runner.
function ghApi(path, opts = {}) {
  const method = opts.method || "GET";
  const args = [path, "-X", method, "--header", "Accept: application/vnd.github+json"];
  if (opts.body) args.push("--input", "-");
  const result = execFileSync("gh", args, {
    input: opts.body ? JSON.stringify(opts.body) : undefined,
    encoding: "utf8",
  });
  return JSON.parse(result);
}

// GITHUB_OUTPUT is a file, so append to it directly instead of shelling out to echo. The heredoc
// form with a random delimiter is what GitHub documents for multiline values; the old %0A escaping
// silently truncated any payload containing a newline.
function setOutput(name, value) {
  const delimiter = `ghadelim_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

// The Slack payload is JSON wrapping arbitrary model text, so it is written to a file and the
// workflow POSTs it with `curl --data-binary @file`. Only a boolean crosses the step boundary.
const SLACK_PAYLOAD_PATH = "/tmp/slack_payload.json";
function sendToSlack(payload) {
  writeFileSync(SLACK_PAYLOAD_PATH, payload);
  setOutput("slack", "true");
}

// Overridable so the model can be bumped without editing the script.
const MODEL = process.env.QA_MODEL || "claude-sonnet-5";

async function callClaude(systemPrompt, userMessage) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return msg.content[0].text;
}

const SYSTEM_PROMPT = `You are a QA agent for the virtru-demo-center project — an Electron app built with React 19, Vite, and the OpenTDF SDK that runs interactive Virtru security demos.

Your job is to review code changes and events for:
- Bugs and runtime errors (null refs, missing awaits, unhandled promise rejections)
- Logic errors and incorrect behavior
- Security issues (hardcoded secrets, unsafe eval, injection risks)
- Broken async patterns (race conditions, missing error handling)
- Dead code or unreachable branches
- API misuse (incorrect OpenTDF SDK calls, wrong Electron IPC patterns)

Be direct and specific. Only flag real issues — not style nits or minor refactors. If something looks fine, say so briefly.

Format your response as JSON with this shape:
{
  "severity": "critical|warning|info|ok",
  "summary": "one-line summary",
  "issues": [
    { "severity": "critical|warning", "file": "path/to/file.js", "line": 42, "description": "what's wrong and why" }
  ],
  "recommendation": "what to do (or 'No action needed')"
}`;

// ─── PR Review ────────────────────────────────────────────────────────────────
if (EVENT === "pull_request") {
  const prNumber = process.env.PR_NUMBER;
  const prTitle = process.env.PR_TITLE;
  const prAuthor = process.env.PR_AUTHOR;

  let diff = "";
  if (existsSync("/tmp/pr_diff.txt")) {
    diff = readFileSync("/tmp/pr_diff.txt", "utf8").slice(0, 12000); // cap at ~12k chars
  }

  const message = `PR #${prNumber} by @${prAuthor}: "${prTitle}"

Diff (JS/JSX/TS files only):
${diff || "(no JS/TS changes detected)"}`;

  const response = await callClaude(SYSTEM_PROMPT, message);
  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { severity: "info", summary: response, issues: [], recommendation: "Review manually" };
  }

  const shouldComment = parsed.severity === "critical" || parsed.severity === "warning";
  const issueCount = parsed.issues?.length ?? 0;

  // Post PR comment if issues found
  if (shouldComment) {
    const issueLines = parsed.issues
      .map((i) => `- **[${i.severity.toUpperCase()}]** \`${i.file}${i.line ? `:${i.line}` : ""}\` — ${i.description}`)
      .join("\n");

    const body = `## QA Agent Review\n\n**${parsed.summary}**\n\n${issueLines}\n\n**Recommendation:** ${parsed.recommendation}`;

    ghApi(`/repos/${REPO}/pulls/${prNumber}/reviews`, {
      method: "POST",
      body: { body, event: "COMMENT" },
    });

    // Create a GitHub issue for critical findings
    if (parsed.severity === "critical") {
      ghApi(`/repos/${REPO}/issues`, {
        method: "POST",
        body: {
          title: `[QA] Critical issues in PR #${prNumber}: ${prTitle}`,
          body: `The QA agent flagged critical issues in PR #${prNumber} by @${prAuthor}.\n\n${issueLines}\n\n**Recommendation:** ${parsed.recommendation}\n\n[View PR](https://github.com/${REPO}/pull/${prNumber})`,
          labels: ["qa-agent", "bug"],
        },
      });
    }

    // Slack notification
    const emoji = parsed.severity === "critical" ? ":red_circle:" : ":warning:";
    const slackMsg = JSON.stringify({
      text: `${emoji} *QA Agent* flagged ${issueCount} issue(s) in <https://github.com/${REPO}/pull/${prNumber}|PR #${prNumber}: ${prTitle}>`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *QA Agent* — <https://github.com/${REPO}/pull/${prNumber}|PR #${prNumber}: ${prTitle}>\n*${parsed.summary}*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: parsed.issues.map((i) => `• [${i.severity.toUpperCase()}] \`${i.file}\` — ${i.description}`).join("\n"),
          },
        },
      ],
    });
    sendToSlack(slackMsg);
  }

  console.log(`PR #${prNumber}: ${parsed.severity} — ${parsed.summary}`);
}

// ─── CI Failure ───────────────────────────────────────────────────────────────
// Dormant: the workflow has no `workflow_run` trigger right now (see the note in qa-agent.yml).
// The `wfName !== "QA Agent"` guard is the second line of defence against the agent triaging its
// own failed run, filing an issue about it, and failing again on the next completion.
if (
  EVENT === "workflow_run" &&
  process.env.WF_CONCLUSION === "failure" &&
  process.env.WF_NAME !== "QA Agent"
) {
  const wfName = process.env.WF_NAME;
  const wfUrl = process.env.WF_URL;

  const message = `CI workflow "${wfName}" failed. URL: ${wfUrl}
Repository: ${REPO}
Please summarize what likely went wrong and what the team should check.`;

  const response = await callClaude(
    `You are a QA agent monitoring CI for an Electron + React + OpenTDF project. When a CI workflow fails, provide a brief triage: likely cause category (build error, test failure, lint, type error, infra), what files/areas to check, and recommended next steps. Keep it under 3 bullet points. Format as JSON: { "summary": "...", "likely_cause": "...", "check_areas": ["..."], "next_steps": "..." }`,
    message
  );

  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { summary: response, likely_cause: "unknown", check_areas: [], next_steps: "Check CI logs" };
  }

  // Create issue for CI failure
  ghApi(`/repos/${REPO}/issues`, {
    method: "POST",
    body: {
      title: `[QA] CI failure: ${wfName}`,
      body: `The QA agent detected a CI failure.\n\n**Summary:** ${parsed.summary}\n**Likely cause:** ${parsed.likely_cause}\n**Areas to check:** ${parsed.check_areas?.join(", ")}\n**Next steps:** ${parsed.next_steps}\n\n[View failed run](${wfUrl})`,
      labels: ["qa-agent", "ci-failure"],
    },
  });

  const slackMsg = JSON.stringify({
    text: `:x: *CI Failure* — ${wfName} failed in <https://github.com/${REPO}|${REPO}>`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:x: *CI Failure: ${wfName}*\n${parsed.summary}\n<${wfUrl}|View run>`,
        },
      },
    ],
  });
  sendToSlack(slackMsg);

  console.log(`CI failure: ${wfName} — ${parsed.summary}`);
}

// ─── Push to main ─────────────────────────────────────────────────────────────
if (EVENT === "push") {
  const branch = process.env.PUSH_BRANCH;
  const commit = process.env.PUSH_COMMIT?.slice(0, 7);
  const commitMsg = process.env.PUSH_MESSAGE;
  const author = process.env.PUSH_AUTHOR;

  // Only alert on main branch direct pushes (bypassing PR review)
  if (branch === "main") {
    const message = `Direct push to main branch detected.
Commit: ${commit} by ${author}
Message: "${commitMsg}"
Repo: ${REPO}

Is this commit message suspicious, does it indicate a hotfix that bypassed review, or does anything stand out as concerning?`;

    const response = await callClaude(
      `You are a QA agent monitoring a main branch for direct pushes. Flag anything that looks like an untested hotfix, accidental direct commit, or suspicious change. Format as JSON: { "severity": "warning|info|ok", "summary": "...", "action": "..." }`,
      message
    );

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = { severity: "info", summary: response, action: "Monitor" };
    }

    if (parsed.severity !== "ok") {
      const slackMsg = JSON.stringify({
        text: `:pushpin: *Direct push to main* by ${author} — <https://github.com/${REPO}/commit/${process.env.PUSH_COMMIT}|\`${commit}\`>: ${commitMsg}`,
      });
      sendToSlack(slackMsg);
    }

    console.log(`Push to main: ${parsed.severity} — ${parsed.summary}`);
  }
}

// ─── New Issue ────────────────────────────────────────────────────────────────
if (EVENT === "issues") {
  const issueNumber = process.env.ISSUE_NUMBER;
  const issueTitle = process.env.ISSUE_TITLE;
  const issueBody = process.env.ISSUE_BODY;
  const issueAuthor = process.env.ISSUE_AUTHOR;

  const message = `New issue #${issueNumber} by @${issueAuthor}: "${issueTitle}"

Body:
${issueBody?.slice(0, 2000) || "(empty)"}`;

  const response = await callClaude(
    `You are a QA agent triaging GitHub issues for an Electron + React + OpenTDF demo app. Classify the issue, assess severity, identify likely affected area (electron main/renderer, OpenTDF SDK, UI, auth, build), and suggest initial investigation steps. Format as JSON: { "type": "bug|feature|question|duplicate|other", "severity": "critical|high|medium|low", "area": "...", "summary": "...", "triage": "one sentence on what to investigate first" }`,
    message
  );

  let parsed;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { type: "other", severity: "medium", area: "unknown", summary: response, triage: "Review manually" };
  }

  // Comment on the issue with triage
  const comment = `**QA Agent Triage**\n\n- **Type:** ${parsed.type}\n- **Severity:** ${parsed.severity}\n- **Area:** ${parsed.area}\n- **Initial investigation:** ${parsed.triage}`;
  ghApi(`/repos/${REPO}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body: comment },
  });

  // Slack for critical/high issues
  if (parsed.severity === "critical" || parsed.severity === "high") {
    const emoji = parsed.severity === "critical" ? ":rotating_light:" : ":large_orange_circle:";
    const slackMsg = JSON.stringify({
      text: `${emoji} *New ${parsed.severity} issue* <https://github.com/${REPO}/issues/${issueNumber}|#${issueNumber}: ${issueTitle}> by @${issueAuthor}`,
    });
    sendToSlack(slackMsg);
  }

  console.log(`Issue #${issueNumber}: ${parsed.type}/${parsed.severity} — ${parsed.summary}`);
}
