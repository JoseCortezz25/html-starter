#!/usr/bin/env node
/**
 * Claude Code SessionStart / UserPromptSubmit hook: announces Designer Mode.
 * Wired in .claude/settings.json.
 *
 * On a `design/*` branch it injects `hookSpecificOutput.additionalContext`
 * (full briefing on SessionStart, a one-line reminder on UserPromptSubmit).
 * On any other branch it prints nothing. Never blocks.
 */

import {
  designerContextText,
  getDesignerContext
} from './lib/designer-policy.mjs';

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

try {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { active, branch } = getDesignerContext(projectDir);
  if (!active) process.exit(0);

  const raw = await readStdin();
  const { hook_event_name: event = 'SessionStart' } = JSON.parse(raw || '{}');
  const short = event === 'UserPromptSubmit';

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event,
        additionalContext: designerContextText(branch, { short })
      }
    })
  );
} catch {
  // Context is best-effort; the PreToolUse guard still enforces the rules.
}
process.exit(0);
