# Oracle bundle for GPT Pro

This repo uses the `@steipete/oracle` CLI to bundle prompts plus repo files into a single text file you can paste into GPT Pro (or other LLMs).

## Generate a bundle file

```bash
PROMPT="Summarize the repo and answer my request." \
  scripts/oracle_bundle.sh
```

Writes `llm_oracle_bundle.txt` at the repo root. Pass a custom output path as the first argument if needed.

## Copy the bundle to clipboard

```bash
COPY=1 PROMPT="Review this repo and propose fixes." \
  scripts/oracle_bundle.sh
```

## Run directly (browser)

If you want Oracle to open ChatGPT in the browser, run it directly and supply your own prompt:

```bash
npx -y @steipete/oracle --engine browser -p "<your prompt>" \
  --file "apps/**" \
  --file "packages/**" \
  --file "docs/**" \
  --file "scripts/**"
```

Notes:
- File include/exclude patterns live in `scripts/oracle_bundle.sh`.
- Keep the prompt short and specific; the bundle already contains the code context.
- Large binaries (e.g., `.r1cs`, `.zkey`, images) and previous bundle outputs are excluded to avoid Oracle's 1 MB per-file limit.
