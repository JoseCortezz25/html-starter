#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: format and lint-fix files edited via
 * Edit / Write / MultiEdit. Wired in .claude/settings.json.
 *
 * - Reads the hook event JSON from stdin and extracts the edited path.
 * - Only touches files inside the project root with a supported extension.
 * - Uses local binaries from node_modules/.bin (no npx downloads).
 * - Never fails the originating tool call: errors are swallowed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const PRETTIER_EXTENSIONS = /\.(ts|js|mjs|cjs|json|css|html|md|ya?ml)$/;
const ESLINT_EXTENSIONS = /\.(ts|js|mjs|cjs)$/;

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const runSilently = (bin, args, cwd) => {
  try {
    execFileSync(bin, args, { cwd, stdio: 'ignore' });
  } catch {
    // A formatter/linter exit code must not propagate.
  }
};

try {
  const raw = await readStdin();
  const { tool_input: toolInput = {}, tool_response: toolResponse = {} } =
    JSON.parse(raw || '{}');
  const file = toolResponse.filePath || toolInput.file_path;
  if (!file) process.exit(0);

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const absolutePath = resolve(projectRoot, file);

  if (!absolutePath.startsWith(projectRoot + sep)) process.exit(0);
  if (absolutePath.includes(`${sep}node_modules${sep}`)) process.exit(0);
  if (!existsSync(absolutePath)) process.exit(0);

  const prettier = resolve(projectRoot, 'node_modules/.bin/prettier');
  if (existsSync(prettier) && PRETTIER_EXTENSIONS.test(absolutePath)) {
    runSilently(
      prettier,
      ['--write', '--ignore-unknown', absolutePath],
      projectRoot
    );
  }

  const eslint = resolve(projectRoot, 'node_modules/.bin/eslint');
  if (existsSync(eslint) && ESLINT_EXTENSIONS.test(absolutePath)) {
    runSilently(
      eslint,
      ['--fix', '--no-warn-ignored', absolutePath],
      projectRoot
    );
  }
} catch {
  // Malformed stdin or JSON: stay silent.
}
