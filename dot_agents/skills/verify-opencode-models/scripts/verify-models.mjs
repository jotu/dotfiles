import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const DEFAULT_PROMPT = process.env.OPENCODE_VERIFY_PROMPT ?? "Reply with exactly: OK";
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.OPENCODE_VERIFY_TIMEOUT_MS ?? "120000", 10);
const DEFAULT_DIR = process.env.OPENCODE_VERIFY_DIR ?? process.cwd();

function parseArgs(argv) {
  const options = {
    mode: "verify",
    provider: undefined,
    prompt: DEFAULT_PROMPT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    dir: DEFAULT_DIR,
    json: false,
    modelFilters: [],
  };

  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("--")) {
    options.mode = rest.shift();
  }

  while (rest.length > 0) {
    const arg = rest.shift();
    switch (arg) {
      case "--provider":
        options.provider = rest.shift();
        break;
      case "--prompt":
        options.prompt = rest.shift() ?? options.prompt;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number.parseInt(rest.shift() ?? String(options.timeoutMs), 10);
        break;
      case "--dir":
        options.dir = rest.shift() ?? options.dir;
        break;
      case "--model":
        options.modelFilters.push(rest.shift());
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const envFilters = (process.env.OPENCODE_MODEL_FILTER ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  options.modelFilters.push(...envFilters);

  if (!options.provider) {
    throw new Error("Missing required --provider <openai|github-copilot>");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }

  return options;
}

function artifactPaths(provider) {
  const baseDir = resolve(dirname(new URL(import.meta.url).pathname), "..", "references");
  return {
    baseDir,
    json: resolve(baseDir, `model-matrix.${provider}.json`),
    markdown: resolve(baseDir, `model-matrix.${provider}.md`),
  };
}

function run(command, args, { timeoutMs = 120000, dir = process.cwd() } = {}) {
  const result = spawnSync(command, args, {
    cwd: dir,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function listModels(provider) {
  const plain = run("opencode", ["models", provider], { timeoutMs: 120000 });
  if (plain.status !== 0) {
    throw new Error(`Failed to list models for ${provider}: ${plain.stderr || plain.stdout}`);
  }

  const ids = plain.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const verbose = run("opencode", ["models", provider, "--verbose"], { timeoutMs: 120000 });
  const metadata = verbose.status === 0 ? parseVerboseMetadata(verbose.stdout) : new Map();

  return ids.map((fullId) => ({
    fullId,
    id: fullId.replace(`${provider}/`, ""),
    meta: metadata.get(fullId) ?? metadata.get(fullId.replace(`${provider}/`, "")) ?? null,
  }));
}

function parseVerboseMetadata(output) {
  const lines = output.split(/\r?\n/);
  const metadata = new Map();
  let currentId = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (!currentId && !line.startsWith("{")) {
      currentId = line;
      continue;
    }

    if (currentId && line.startsWith("{")) {
      let depth = 0;
      const chunk = [];
      for (; index < lines.length; index += 1) {
        const jsonLine = lines[index];
        chunk.push(jsonLine);
        depth += count(jsonLine, "{");
        depth -= count(jsonLine, "}");
        if (depth === 0) break;
      }
      try {
        metadata.set(currentId, JSON.parse(chunk.join("\n")));
      } catch {
        // Ignore metadata parse failures; verification can still proceed.
      }
      currentId = null;
    }
  }

  return metadata;
}

function count(text, char) {
  return [...text].filter((value) => value === char).length;
}

function filterModels(models, filters) {
  if (filters.length === 0) return models;
  return models.filter((model) => filters.includes(model.fullId) || filters.includes(model.id));
}

function loadMatrix(provider) {
  const paths = artifactPaths(provider);
  const payload = JSON.parse(readFileSync(paths.json, "utf8"));
  return {
    ...payload,
    paths,
  };
}

function smokeTestModel(model, options) {
  const startedAt = Date.now();
  const result = run(
    "opencode",
    [
      "run",
      "--model",
      model.fullId,
      "--format",
      "json",
      "--dir",
      options.dir,
      options.prompt,
    ],
    { timeoutMs: options.timeoutMs, dir: options.dir },
  );
  const latencyMs = Date.now() - startedAt;

  if (result.error) {
    return {
      provider: options.provider,
      model: model.fullId,
      status: "fail",
      latencyMs,
      failureClass: classifyFailure(result.error.message),
      note: result.error.message,
      response: "",
      meta: model.meta,
    };
  }

  if (result.status !== 0) {
    const text = `${result.stderr}\n${result.stdout}`.trim();
    return {
      provider: options.provider,
      model: model.fullId,
      status: "fail",
      latencyMs,
      failureClass: classifyFailure(text),
      note: summarizeText(text),
      response: "",
      meta: model.meta,
    };
  }

  const response = extractTextResponse(result.stdout);
  const passed = response.trim() === "OK";

  return {
    provider: options.provider,
    model: model.fullId,
    status: passed ? "pass" : "fail",
    latencyMs,
    failureClass: passed ? "-" : "unexpected-response",
    note: passed ? recommendationHint(model, "pass") : `Unexpected response: ${response.trim() || "(empty)"}`,
    response: response.trim(),
    meta: model.meta,
  };
}

function extractTextResponse(stdout) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let lastText = "";
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "text" && event.part?.text) {
        lastText = event.part.text;
      }
    } catch {
      // Ignore non-JSON noise.
    }
  }
  return lastText;
}

function classifyFailure(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("unsupported") || normalized.includes("not supported") || normalized.includes("model_not_found")) {
    return "unsupported-model";
  }
  if (normalized.includes("auth") || normalized.includes("oauth") || normalized.includes("permission") || normalized.includes("access") || normalized.includes("forbidden") || normalized.includes("entitlement")) {
    return "auth-or-access";
  }
  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return "rate-limit";
  }
  if (normalized.includes("timed out") || normalized.includes("timeout") || normalized.includes("etimedout")) {
    return "timeout";
  }
  if (normalized.includes("provider") || normalized.includes("5xx") || normalized.includes("500") || normalized.includes("503")) {
    return "provider-error";
  }
  return "unknown";
}

function summarizeText(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180) || "(no error text)";
}

function recommendationHint(model, status) {
  if (status !== "pass") return "";
  const id = model.id.toLowerCase();
  if (/(^|[-.])pro($|[-.])/.test(id) || id.endsWith("-pro")) return "strong flagship candidate";
  if (id.includes("codex")) return "strong coding-default candidate";
  if (id.includes("flash")) return "strong helper-cheap candidate";
  if (id.includes("mini") || id.includes("spark")) return "strong helper-cheap candidate";
  if (id.includes("fast")) return "fast general-purpose candidate";
  return "general-purpose passing candidate";
}

function rankFlagship(result) {
  const id = result.model.toLowerCase();
  let score = 0;
  if (id.includes("-pro")) score += 100;
  if (id.includes("gpt-5.5")) score += 30;
  if (id.includes("gpt-5.4")) score += 20;
  if (id.includes("gpt-5.3")) score += 10;
  if (id.includes("codex")) score -= 5;
  if (id.includes("mini") || id.includes("spark") || id.includes("fast")) score -= 20;
  score += Math.max(0, 5000 - result.latencyMs) / 1000;
  return score;
}

function rankCodingDefault(result) {
  const id = result.model.toLowerCase();
  let score = 0;
  if (id.includes("codex")) score += 80;
  if (id.includes("gpt-5.3")) score += 25;
  if (id.includes("gpt-5.2")) score += 15;
  if (id.includes("gpt-5.4")) score += 10;
  if (id.includes("mini") || id.includes("spark")) score -= 10;
  if (id.includes("max") || id.includes("pro")) score -= 5;
  score += Math.max(0, 5000 - result.latencyMs) / 1000;
  return score;
}

function rankHelperCheap(result) {
  const id = result.model.toLowerCase();
  let score = 0;
  if (id.includes("flash")) score += 95;
  if (id.includes("mini")) score += 80;
  if (id.includes("spark")) score += 60;
  if (id.includes("fast")) score += 25;
  if (id.includes("codex-mini") || id.includes("mini-latest")) score -= 25;
  if (id.includes("pro") || id.includes("max")) score -= 50;
  if (!id.includes("mini") && !id.includes("spark")) score -= 10;
  score += Math.max(0, 5000 - result.latencyMs) / 1000;
  return score;
}

function recommend(results) {
  const passing = results.filter((result) => result.status === "pass");
  return {
    flagship: pickBest(passing, rankFlagship),
    codingDefault: pickBest(passing, rankCodingDefault),
    helperCheap: pickBest(passing, rankHelperCheap),
  };
}

function writeArtifacts(provider, prompt, results, recommendations) {
  const paths = artifactPaths(provider);
  mkdirSync(paths.baseDir, { recursive: true });

  const payload = {
    provider,
    prompt,
    generatedAt: new Date().toISOString(),
    results,
    recommendations,
  };

  writeFileSync(paths.json, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(paths.markdown, renderMarkdownMatrix(payload), "utf8");

  return paths;
}

function renderMarkdownMatrix(payload) {
  const lines = [
    `# ${payload.provider} Model Matrix`,
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    `Prompt: ${payload.prompt}`,
    "",
    "| provider | model | status | latency | error | note |",
    "|---|---|---|---:|---|---|",
  ];

  for (const result of payload.results) {
    lines.push(`| ${result.provider} | ${result.model} | ${result.status} | ${formatLatency(result.latencyMs)} | ${result.failureClass} | ${escapePipe(result.note)} |`);
  }

  lines.push(
    "",
    "## Recommended Tiers",
    "",
    `- Flagship: ${formatRecommendation(payload.recommendations.flagship)}`,
    `- Coding default: ${formatRecommendation(payload.recommendations.codingDefault)}`,
    `- Helper cheap: ${formatRecommendation(payload.recommendations.helperCheap)}`,
    "",
    "## Suggested Routing",
    "",
  );

  if (payload.recommendations.flagship) {
    lines.push(`- Use ${payload.recommendations.flagship.model} for flagship reasoning roles like plan/oracle/ultrabrain.`);
  }
  if (payload.recommendations.codingDefault) {
    lines.push(`- Use ${payload.recommendations.codingDefault.model} for OpenCode default implementation work and coding-heavy roles.`);
  }
  if (payload.recommendations.helperCheap) {
    lines.push(`- Use ${payload.recommendations.helperCheap.model} for small_model, quick, unspecified-low, and documentation-style helper work.`);
  }

  return `${lines.join("\n")}\n`;
}

function pickBest(results, ranker) {
  return [...results]
    .sort((left, right) => ranker(right) - ranker(left))
    .at(0) ?? null;
}

function printMatrix(results) {
  console.log("| provider | model | status | latency | error | note |");
  console.log("|---|---|---|---:|---|---|");
  for (const result of results) {
    console.log(`| ${result.provider} | ${result.model} | ${result.status} | ${formatLatency(result.latencyMs)} | ${result.failureClass} | ${escapePipe(result.note)} |`);
  }
}

function printRecommendations(provider, recommendations) {
  console.log("\nRecommended tiers");
  console.log(`- Flagship: ${formatRecommendation(recommendations.flagship)}`);
  console.log(`- Coding default: ${formatRecommendation(recommendations.codingDefault)}`);
  console.log(`- Helper cheap: ${formatRecommendation(recommendations.helperCheap)}`);
  console.log("\nSuggested routing");
  if (recommendations.flagship) {
    console.log(`- ${provider}: use ${recommendations.flagship.model} for flagship reasoning roles like plan/oracle/ultrabrain.`);
  }
  if (recommendations.codingDefault) {
    console.log(`- ${provider}: use ${recommendations.codingDefault.model} for OpenCode default implementation work and coding-heavy roles.`);
  }
  if (recommendations.helperCheap) {
    console.log(`- ${provider}: use ${recommendations.helperCheap.model} for small_model, quick, unspecified-low, and documentation-style helper work.`);
  }
}

function formatRecommendation(result) {
  if (!result) return "none (no passing models)";
  return `${result.model} (${formatLatency(result.latencyMs)}, ${result.note})`;
}

function formatLatency(latencyMs) {
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

function escapePipe(text) {
  return (text || "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let results;
  let recommendations;
  let prompt = options.prompt;
  let artifactPath;

  if (options.mode === "recommend" && options.modelFilters.length === 0) {
    const matrix = loadMatrix(options.provider);
    results = matrix.results;
    recommendations = recommend(results);
    prompt = matrix.prompt;
    artifactPath = matrix.paths.markdown;
  } else {
    const models = filterModels(listModels(options.provider), options.modelFilters);

    if (models.length === 0) {
      throw new Error(`No models matched for provider ${options.provider}`);
    }

    results = models.map((model) => smokeTestModel(model, options));
    recommendations = recommend(results);
    if (options.mode !== "recommend" || options.modelFilters.length === 0) {
      const paths = writeArtifacts(options.provider, prompt, results, recommendations);
      artifactPath = paths.markdown;
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ provider: options.provider, prompt, results, recommendations, artifactPath }, null, 2));
    return;
  }

  console.log(`Provider: ${options.provider}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Models tested: ${results.length}`);
  if (artifactPath) {
    console.log(`Matrix artifact: ${artifactPath}`);
  }
  printMatrix(results);

  if (options.mode === "recommend") {
    printRecommendations(options.provider, recommendations);
  }

  const passingCount = results.filter((result) => result.status === "pass").length;
  if (options.mode === "recommend" || options.mode === "refresh") {
    process.exitCode = passingCount > 0 ? 0 : 1;
    return;
  }

  const hasFailures = results.some((result) => result.status !== "pass");
  process.exitCode = hasFailures ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
