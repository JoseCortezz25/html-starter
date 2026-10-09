#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: Designer Mode guard.
 * Wired in .claude/settings.json for Edit | Write | MultiEdit | NotebookEdit | Bash.
 *
 * - Off (exit 0) unless the current git branch starts with `design/`.
 * - On a design branch, applies .claude/hooks/lib/designer-policy.mjs and
 *   blocks with exit code 2 + a plain-language stderr message, which Claude
 *   Code feeds back to the agent.
 * - Fails closed: if the event can't be understood on a design branch, the
 *   tool call is blocked.
 *
 * Guardrail, not a security boundary: see "Designer Mode" in CLAUDE.md.
 */

import {
  analyzeBash,
  createGitRepo,
  deny,
  evaluateFileChange,
  formatBlockMessage,
  getDesignerContext
} from './lib/designer-policy.mjs';

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const block = decision => {
  process.stderr.write(`${formatBlockMessage(decision)}\n`);
  process.exit(2);
};

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const context = getDesignerContext(projectDir);
if (!context.active) process.exit(0);

try {
  const raw = await readStdin();
  const {
    tool_name: toolName,
    tool_input: toolInput = {},
    cwd
  } = JSON.parse(raw || '{}');
  const repo = createGitRepo(projectDir, { unbornFallback: 'disk' });
  const location = { cwd: cwd || projectDir, projectDir };

  let decision;
  switch (toolName) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      decision = evaluateFileChange(toolInput.file_path, location, repo);
      break;
    case 'NotebookEdit':
      decision = evaluateFileChange(toolInput.notebook_path, location, repo);
      break;
    case 'Bash':
      decision = analyzeBash(toolInput.command, { ...location, repo });
      break;
    default:
      process.exit(0);
  }
  if (!decision.allow) block(decision);
  process.exit(0);
} catch (error) {
  block(
    deny(
      'Something went wrong while checking this action, so I stopped it to keep the project safe.',
      'Try again. If it keeps happening, please ask a developer.',
      `designer-guard.mjs failed: ${error instanceof Error ? error.message : String(error)}`
    )
  );
}
