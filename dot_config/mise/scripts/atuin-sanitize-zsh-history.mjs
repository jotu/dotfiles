import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_PATTERNS = [
  ["AWS access key", /A[KS]IA[0-9A-Z]{16}/],
  ["AWS secret environment variable", /AWS_(SECRET_ACCESS_KEY|SESSION_TOKEN)/i],
  ["Azure secret environment variable", /AZURE_.*_KEY/i],
  ["Google service account key environment variable", /GOOGLE_SERVICE_ACCOUNT_KEY/i],
  ["Atuin login", /atuin\s+login/i],
  ["GitHub token", /(?:gh[pousr]|ghs|github_pat|v1\.)[A-Za-z0-9._-]{20,}/],
  ["GitLab token", /glpat-[A-Za-z0-9_]{20,}/],
  ["Slack token or webhook", /(?:xox[bprs]-|hooks\.slack\.com\/services\/)/i],
  ["Stripe key", /sk_(?:test|live)_[A-Za-z0-9]{20,}/],
  ["Netlify token", /nf[pcoub]_[A-Za-z0-9]{20,}/],
  ["npm token", /npm_[A-Za-z0-9]{20,}/],
  ["Pulumi token", /pul-[0-9a-f]{40}/i],
  ["secret-bearing option", /--(?:password|passwd|pwd|passphrase|token|secret|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret)(?:=|\s)/i],
  ["secret environment assignment", /(?:^|\s)(?:export\s+)?[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*\s*=/i],
  ["credential command", /^(?:aws\s+configure|az\s+login|gcloud\s+auth|docker\s+login|npm\s+(?:login|token)|gh\s+auth\s+login|kubectl\s+create\s+secret|security\s+add-generic-password|op\s+(?:read|item\s+get)|pass(?:\s|$))/i],
  ["authenticated request", /(?:authorization:\s*bearer|curl.*\s(?:-u|--user|--header|-H)\s)/i],
];

function parseArguments(argv) {
  const options = {
    input: process.env.HISTFILE || path.join(os.homedir(), ".zsh_history"),
    output: null,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input") {
      options.input = argv[++index];
    } else if (argument === "--output") {
      options.output = argv[++index];
    } else if (argument === "--write") {
      options.write = true;
    } else if (argument === "--dry-run") {
      options.write = false;
    } else if (argument === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.write && !options.output) {
    throw new Error("--write requires --output");
  }
  if (options.output && path.resolve(options.input) === path.resolve(options.output)) {
    throw new Error("--input and --output must be different files");
  }

  return options;
}

function printUsage() {
  console.log("Usage: atuin-sanitize-zsh-history.mjs [options]");
  console.log("  --input PATH    source zsh history (default: HISTFILE or ~/.zsh_history)");
  console.log("  --output PATH   sanitized output path");
  console.log("  --write         write the sanitized output; default is dry-run");
  console.log("  --dry-run       inspect without writing (default)");
}

function splitRecords(text) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }

  const records = [];
  let physicalLines = [];
  for (const line of lines) {
    physicalLines.push(line);
    if (!line.endsWith("\\")) {
      records.push({ raw: physicalLines.join("\n"), unterminated: false });
      physicalLines = [];
    }
  }

  if (physicalLines.length > 0) {
    records.push({ raw: physicalLines.join("\n"), unterminated: true });
  }
  return records;
}

function commandFromRecord(raw) {
  const lines = raw.split("\n");
  const extended = lines[0].match(/^: \d+:-?\d+;(.*)$/);
  if (lines[0].startsWith(": ") && !extended) {
    return { command: null, reason: "malformed extended record" };
  }

  const commandLines = [extended ? extended[1] : lines[0], ...lines.slice(1)];
  return {
    command: commandLines
      .map((line) => (line.endsWith("\\") ? line.slice(0, -1) : line))
      .join("\n")
      .trimEnd(),
    reason: null,
  };
}

function matchingReason(command) {
  return SECRET_PATTERNS.find(([, pattern]) => pattern.test(command))?.[0] || null;
}

export function sanitizeHistory(text) {
  const safeRecords = [];
  const reasons = new Map();
  let malformed = 0;

  for (const record of splitRecords(text)) {
    let reason = record.unterminated ? "unterminated multiline record" : null;
    const parsed = reason ? { command: null } : commandFromRecord(record.raw);
    reason ||= parsed.reason;
    if (!reason && (!parsed.command || parsed.command.includes("\ufffd"))) {
      reason = "empty or invalid UTF-8 record";
    }
    reason ||= matchingReason(parsed.command);

    if (reason) {
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
      if (reason.includes("record") || reason.includes("UTF-8")) {
        malformed += 1;
      }
    } else {
      safeRecords.push(record.raw);
    }
  }

  return {
    safeText: safeRecords.length > 0 ? `${safeRecords.join("\n")}\n` : "",
    total: safeRecords.length + [...reasons.values()].reduce((sum, count) => sum + count, 0),
    kept: safeRecords.length,
    dropped: [...reasons.values()].reduce((sum, count) => sum + count, 0),
    malformed,
    reasons,
  };
}

function writePrivateFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, content, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function printSummary(input, result, output) {
  console.log(`Input: ${input}`);
  console.log(`Records: ${result.total}`);
  console.log(`Kept: ${result.kept}`);
  console.log(`Dropped: ${result.dropped}`);
  console.log(`Malformed or ambiguous: ${result.malformed}`);
  for (const [reason, count] of result.reasons) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log(output ? `Wrote sanitized history: ${output}` : "Dry-run only; no file written.");
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const source = fs.readFileSync(options.input, "utf8");
  const result = sanitizeHistory(source);

  if (options.write) {
    writePrivateFile(options.output, result.safeText);
  }
  printSummary(options.input, result, options.write ? options.output : null);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`History sanitization failed: ${error.message}`);
    process.exitCode = 1;
  }
}
