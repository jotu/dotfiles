export function parseVerboseMetadata(output) {
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

export function count(text, char) {
  return [...text].filter((value) => value === char).length;
}

export function filterModels(models, filters) {
  if (filters.length === 0) return models;
  return models.filter((model) => filters.includes(model.fullId) || filters.includes(model.id));
}

export function extractTextResponse(stdout) {
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

export function classifyFailure(text) {
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

export function recommendationHint(model, status) {
  if (status !== "pass") return "";
  const id = model.id.toLowerCase();
  if (/(^|[-.])pro($|[-.])/.test(id) || id.endsWith("-pro")) return "strong flagship candidate";
  if (id.includes("codex")) return "strong coding-default candidate";
  if (id.includes("flash")) return "strong helper-cheap candidate";
  if (id.includes("mini") || id.includes("spark")) return "strong helper-cheap candidate";
  if (id.includes("fast")) return "fast general-purpose candidate";
  return "general-purpose passing candidate";
}

export function rankFlagship(result) {
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

export function rankCodingDefault(result) {
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

export function rankHelperCheap(result) {
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

export function pickBest(results, ranker) {
  return [...results]
    .sort((left, right) => ranker(right) - ranker(left))
    .at(0) ?? null;
}

export function recommend(results) {
  const passing = results.filter((result) => result.status === "pass");
  return {
    flagship: pickBest(passing, rankFlagship),
    codingDefault: pickBest(passing, rankCodingDefault),
    helperCheap: pickBest(passing, rankHelperCheap),
  };
}

export function renderMarkdownMatrix(payload) {
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

export function formatRecommendation(result) {
  if (!result) return "none (no passing models)";
  return `${result.model} (${formatLatency(result.latencyMs)}, ${result.note})`;
}

export function formatLatency(latencyMs) {
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

export function escapePipe(text) {
  return (text || "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

export function computeExitCode(mode, results) {
  const passingCount = results.filter((result) => result.status === "pass").length;
  if (mode === "recommend" || mode === "refresh") {
    return passingCount > 0 ? 0 : 1;
  }

  const hasFailures = results.some((result) => result.status !== "pass");
  return hasFailures ? 1 : 0;
}
