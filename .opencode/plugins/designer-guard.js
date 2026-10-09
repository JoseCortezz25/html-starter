/**
 * OpenCode plugin: Designer Mode guard (mirror of .claude/hooks/designer-guard.mjs).
 *
 * Active only when the current git branch starts with `design/`.
 * - tool.execute.before: throws (blocks the tool) for edit / write /
 *   apply_patch / bash calls that the shared policy denies.
 * - experimental.chat.system.transform: adds the Designer Mode briefing to
 *   the system prompt so the agent adapts its tone.
 *
 * Policy source of truth: .claude/hooks/lib/designer-policy.mjs
 */

import {
  analyzeBash,
  createGitRepo,
  designerContextText,
  evaluateFileChange,
  formatBlockMessage,
  getDesignerContext,
  parsePatchTargets
} from '../../.claude/hooks/lib/designer-policy.mjs';

const FILE_TOOLS = new Set(['edit', 'write', 'multiedit']);

export const DesignerGuard = async ({ directory, worktree }) => {
  const projectDir = worktree || directory;

  const evaluate = (tool, args) => {
    const repo = createGitRepo(projectDir, { unbornFallback: 'disk' });
    const location = { cwd: projectDir, projectDir };
    if (FILE_TOOLS.has(tool))
      return evaluateFileChange(args.filePath, location, repo);
    if (tool === 'apply_patch' || tool === 'patch') {
      const targets = parsePatchTargets(args.patchText ?? args.patch);
      for (const { path, op } of targets) {
        const decision = evaluateFileChange(path, location, repo, op);
        if (!decision.allow) return decision;
      }
      return { allow: true };
    }
    if (tool === 'bash') {
      return analyzeBash(args.command, {
        cwd: args.workdir || projectDir,
        projectDir,
        repo
      });
    }
    return { allow: true };
  };

  return {
    'tool.execute.before': async (input, output) => {
      if (!getDesignerContext(projectDir).active) return;
      let decision;
      try {
        decision = evaluate(input.tool, output.args ?? {});
      } catch (error) {
        decision = {
          allow: false,
          reason:
            'Something went wrong while checking this action, so I stopped it to keep the project safe.',
          tip: 'Try again. If it keeps happening, please ask a developer.',
          devNote: `designer-guard plugin failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      if (!decision.allow) throw new Error(formatBlockMessage(decision));
    },
    'experimental.chat.system.transform': async (_input, output) => {
      const { active, branch } = getDesignerContext(projectDir);
      if (active && Array.isArray(output.system))
        output.system.push(designerContextText(branch));
    }
  };
};
