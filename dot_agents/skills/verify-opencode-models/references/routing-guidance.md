# Routing Guidance

Use this reference after model verification succeeds and you need to turn the results into safe OpenCode and oh-my-openagent routing.

## Purpose

Convert a verified model matrix into conservative routing decisions.

Prioritize:

1. live usability on the active auth path
2. role fit
3. stability
4. cost and latency

Do not optimize for catalog presence alone.

## Tier Definitions

### Flagship

Use for the highest-risk reasoning and review work.

Typical targets:

- `plan`
- `oracle`
- `ultrabrain`

### Coding Default

Use for implementation-heavy work where quality and throughput both matter.

Typical targets:

- OpenCode `model`
- `build`
- `sisyphus`
- `deep`
- `explore`
- `librarian`

### Helper Cheap

Use for quick, repetitive, or high-throughput work.

Typical targets:

- OpenCode `small_model`
- `quick`
- `unspecified-low`
- `documentation`

## Selection Policy

Apply these rules in order.

1. Verified availability beats catalog listing.
2. A slightly weaker passing model beats a theoretically better failing one.
3. Do not route every role to the most expensive model.
4. Do not route flagship reasoning to the cheapest model unless the verified set is very limited.
5. If two passing models are close, prefer the one closer to current routing intent to reduce churn.

## Failure Handling

### Unsupported Model

Meaning:

- provider rejects the model name for the active account or path

Action:

- exclude from recommendations until the provider setup changes

### Auth or Access Error

Meaning:

- model may exist, but the active account, token, OAuth path, or entitlement cannot use it

Action:

- exclude from defaults and note that availability may differ across machines or auth paths

### Rate Limit

Meaning:

- model may be usable, but the test was inconclusive under current limits

Action:

- mark as uncertain and prefer clearly passing models first

### Timeout or Provider Error

Meaning:

- availability is unclear

Action:

- mark as uncertain and do not use as a default until re-tested successfully

## Provider-Specific Guidance

### OpenAI

Treat live verification as more important than local `provider.openai.models` entries.

This matters most when auth mode or account entitlements differ from what the local catalog suggests.

### GitHub Copilot

Use the same verification method as OpenAI.

Do not force symmetry if Copilot and OpenAI expose different usable models. The workflow should match, but the final routing may differ.

## Mapping Process

After verification:

1. list all passing models
2. identify the strongest reasoning model
3. identify the best implementation or coding model
4. identify the cheapest reliable helper model
5. map them into routing targets
6. keep only verified-working assignments

## Handoff To Config Updates

When handing off to `update-opencode-models`, provide:

- provider
- scope: `work`, `personal`, or `both`
- verified passing models
- chosen flagship model
- chosen coding default model
- chosen helper cheap model
- exclusions with failure reasons
