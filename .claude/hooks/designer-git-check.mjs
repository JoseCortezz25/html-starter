#!/usr/bin/env node
/**
 * Git-level Designer Mode checks, run by husky (works without any AI agent).
 *
 *   node .claude/hooks/designer-git-check.mjs pre-commit
 *   node .claude/hooks/designer-git-check.mjs pre-push <remote> <url>   (refs on stdin)
 *
 * No-op unless the current branch starts with `design/`.
 * - pre-commit: rejects staged changes to protected paths and changes/deletions
 *   of public/ files that already exist on `main`.
 * - pre-push: rejects pushing anything other than `refs/heads/design/*`,
 *   remote branch deletion and non-fast-forward (force) pushes.
 *
 * Guardrail only: `--no-verify` or HUSKY=0 skip it. Protect main/stage with
 * branch protection on the remote.
 */

import { execFileSync } from 'node:child_process';
import {
  createGitRepo,
  evaluatePushUpdates,
  evaluateStagedChanges,
  getDesignerContext
} from './lib/designer-policy.mjs';

const projectDir = process.cwd();
const mode = process.argv[2];

const git = args =>
  execFileSync('git', args, {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const fail = lines => {
  process.stderr.write(
    [
      '',
      '[Designer Mode] This git action was stopped to protect the project:',
      ...lines.map(line => `  - ${line}`),
      '',
      'Design branches can only change pages, src/ files and the public/ files you added,',
      'and can only push design/* branches. Please ask a developer if you need more.',
      ''
    ].join('\n')
  );
  process.exit(1);
};

const { active, branch } = getDesignerContext(projectDir);
if (!active) process.exit(0);

try {
  if (mode === 'pre-commit') {
    const output = git([
      'diff',
      '--cached',
      '--name-status',
      '--no-renames',
      '-z'
    ]);
    const parts = output.split('\0').filter(Boolean);
    const changes = [];
    for (let i = 0; i + 1 < parts.length; i += 2)
      changes.push({ status: parts[i][0], path: parts[i + 1] });
    const repo = createGitRepo(projectDir, { unbornFallback: 'none' });
    const violations = evaluateStagedChanges(changes, repo);
    if (violations.length) {
      fail(
        violations.map(({ path, decision }) => `${path}: ${decision.devNote}`)
      );
    }
  } else if (mode === 'pre-push') {
    const updates = (await readStdin())
      .split('\n')
      .map(line => line.trim().split(/\s+/))
      .filter(fields => fields.length === 4)
      .map(([localRef, localSha, remoteRef, remoteSha]) => ({
        localRef,
        localSha,
        remoteRef,
        remoteSha
      }));
    const isAncestor = (ancestor, descendant) => {
      try {
        execFileSync(
          'git',
          ['merge-base', '--is-ancestor', ancestor, descendant],
          { cwd: projectDir, stdio: 'ignore' }
        );
        return true;
      } catch (error) {
        return error?.status === 1 ? false : null;
      }
    };
    const violations = evaluatePushUpdates(updates, isAncestor);
    if (violations.length)
      fail(violations.map(({ message }) => `from ${branch}: ${message}`));
  } else {
    process.stderr.write(`designer-git-check: unknown mode "${mode}"\n`);
    process.exit(1);
  }
} catch (error) {
  fail([
    `the safety check could not run (${error instanceof Error ? error.message.split('\n')[0] : String(error)}).`
  ]);
}
process.exit(0);
