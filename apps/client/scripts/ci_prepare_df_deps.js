const { spawnSync } = require('child_process');

const isCi =
  Boolean(process.env.CI) ||
  Boolean(process.env.CF_PAGES) ||
  Boolean(process.env.CF_PAGES_BRANCH) ||
  Boolean(process.env.CF_PAGES_COMMIT_SHA);

if (!isCi) {
  console.log('[ci_prepare_df_deps] Skipping workspace prepares (not CI).');
  process.exit(0);
}

console.log('[ci_prepare_df_deps] Running workspace prepares for CI.');
const result = spawnSync('yarn', ['run', 'prepare:df-deps'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
