/**
 * Designer Mode policy — single source of truth.
 *
 * Imported by:
 *  - .claude/hooks/designer-guard.mjs     (Claude Code PreToolUse)
 *  - .claude/hooks/designer-context.mjs   (Claude Code SessionStart / UserPromptSubmit)
 *  - .claude/hooks/designer-git-check.mjs (husky pre-commit / pre-push)
 *  - .opencode/plugins/designer-guard.js  (OpenCode tool.execute.before)
 *
 * Designer Mode is ON when the current git branch starts with `design/`
 * (or DESIGNER_MODE=1 is set). On any other branch every check is a no-op.
 *
 * These are guardrails for AI agents and local git, NOT a security boundary.
 * Real protection for shared branches (main, stage) must be configured as
 * branch protection on the remote (GitHub).
 *
 * Pure decision functions take a `repo` adapter (`{ isPreexisting(rel) }`)
 * so they can be unit-tested without git (see .claude/hooks/tests/).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path';

// ---------------------------------------------------------------------------
// Policy data
// ---------------------------------------------------------------------------

export const DESIGN_BRANCH_PREFIX = 'design/';

/** Branch refs used as the "before the designer started" baseline for public/. */
export const BASE_REFS = ['refs/heads/main', 'refs/remotes/origin/main'];

export const PUBLIC_DIR = 'public';

/** Top-level directories that are fully locked (matched case-insensitively). */
export const PROTECTED_DIRS = [
  '.agents',
  '.claude',
  '.opencode',
  '.husky',
  '.git',
  '.github',
  '.vscode',
  'docs',
  'node_modules'
];

/** Files locked only at the project root (matched case-insensitively). */
export const PROTECTED_ROOT_FILES = [
  'opencode.json',
  '.mcp.json',
  'migration.md',
  'claude.md',
  'agents.md',
  'rules.md',
  'readme.md',
  'pnpm-workspace.yaml',
  'skills-lock.json',
  '.prettierignore',
  '.editorconfig',
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  '.node-version'
];

/** File-name patterns locked anywhere in the project (tested on the lowercased basename). */
export const PROTECTED_FILE_PATTERNS = [
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^tsconfig.*\.json$/,
  /\.config\.(ts|js|mjs|cjs|mts|cts)$/,
  /^\.prettierrc/,
  /^\.eslintrc/,
  /^\.env/
];

/** package.json scripts a designer may run. */
export const ALLOWED_SCRIPTS = new Set([
  'dev',
  'build',
  'preview',
  'lint',
  'typecheck',
  'format',
  'test:guards'
]);

/** Environment variables that could switch off hooks or this guard. */
const FORBIDDEN_ENV =
  /^(HUSKY.*|GIT_.*|DESIGNER_.*|CLAUDE_.*|NODE_OPTIONS|LEFTHOOK.*)$/;

/** Plain read-only / harmless commands. */
const READ_ONLY_COMMANDS = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'egrep',
  'fgrep',
  'rg',
  'fd',
  'tree',
  'pwd',
  'echo',
  'printf',
  'which',
  'type',
  'file',
  'stat',
  'du',
  'df',
  'diff',
  'cmp',
  'sort',
  'uniq',
  'cut',
  'tr',
  'jq',
  'less',
  'more',
  'date',
  'whoami',
  'basename',
  'dirname',
  'realpath',
  'readlink',
  'test',
  '[',
  'true',
  'false',
  'sleep',
  'open',
  'ps',
  'lsof',
  'kill',
  'pkill',
  'column',
  'nl',
  'xxd',
  'md5',
  'shasum',
  'sha256sum',
  'uname',
  'id',
  'clear',
  'man',
  'bat',
  'eza'
]);

/** Commands that run arbitrary code or hide what they do. */
const OPAQUE_COMMANDS = new Set([
  'bash',
  'sh',
  'zsh',
  'fish',
  'dash',
  'eval',
  'exec',
  'source',
  '.',
  'xargs',
  'env',
  'sudo',
  'su',
  'doas',
  'command',
  'builtin',
  'alias',
  'python',
  'python3',
  'ruby',
  'perl',
  'php',
  'deno',
  'bun',
  'bunx',
  'osascript',
  'awk',
  'gawk',
  'parallel',
  'watch',
  'script'
]);

// ---------------------------------------------------------------------------
// Decisions and messages
// ---------------------------------------------------------------------------

export const ALLOW = Object.freeze({ allow: true });

/**
 * @param {string} reason plain-language explanation of what was blocked and why
 * @param {string} tip what the designer can do instead
 * @param {string} devNote short technical summary to pass to a developer
 */
export const deny = (reason, tip, devNote) => ({
  allow: false,
  reason,
  tip,
  devNote
});

const ASK_DEV = 'If this change is really needed, please ask a developer.';

/** Message shown to the agent (and relayed to the designer). */
export function formatBlockMessage(decision) {
  return [
    `[Designer Mode] ${decision.reason}`,
    `What you can do: ${decision.tip}`,
    `Note for a developer: ${decision.devNote}`,
    '(Agent: explain this to the designer in simple, friendly words and in their language. Do not try to work around this block.)'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Branch detection
// ---------------------------------------------------------------------------

export const isDesignBranch = name =>
  typeof name === 'string' &&
  name.startsWith(DESIGN_BRANCH_PREFIX) &&
  name.length > DESIGN_BRANCH_PREFIX.length;

const stripHeadsPrefix = ref => ref.replace(/^refs\/heads\//, '');

/** `design/x` or `refs/heads/design/x`. Tags and other namespaces are never design refs. */
export const isDesignRef = ref =>
  typeof ref === 'string' &&
  (ref.startsWith('refs/heads/') || !ref.startsWith('refs/')) &&
  isDesignBranch(stripHeadsPrefix(ref));

const runGit = (args, cwd) => {
  try {
    const out = execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    });
    return { ok: true, out };
  } catch (error) {
    return { ok: false, out: '', status: error?.status ?? null };
  }
};

/** Reads `.git/HEAD` directly when the git binary is unavailable. */
function readHeadFile(projectDir) {
  try {
    const head = readFileSync(join(projectDir, '.git', 'HEAD'), 'utf8').trim();
    const match = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Current branch name, or null when detached / not a repository.
 * Works on an unborn branch (repository without commits).
 */
export function getCurrentBranch(projectDir) {
  const symbolic = runGit(
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    projectDir
  );
  if (symbolic.ok) return symbolic.out.trim() || null;
  // symbolic-ref exits 1 when detached, 128 when not a repo / git missing.
  if (symbolic.status === 1) return null;
  return readHeadFile(projectDir);
}

/**
 * @returns {{ active: boolean, branch: string | null, forced: boolean }}
 */
export function getDesignerContext(projectDir, env = process.env) {
  const branch = getCurrentBranch(projectDir);
  const forced = env.DESIGNER_MODE === '1';
  return { active: forced || isDesignBranch(branch), branch, forced };
}

// ---------------------------------------------------------------------------
// Baseline (what already existed in public/ before the designer's branch)
// ---------------------------------------------------------------------------

/**
 * Git-backed repo adapter.
 *
 * Baseline for "pre-existing public files":
 *  1. `main` (local), else `origin/main`  -> a public path is pre-existing if it exists there.
 *  2. no main yet but the branch has commits -> the repository's root commit(s).
 *  3. no commits at all (unborn) -> `unbornFallback`:
 *     - 'disk': anything already on disk counts as pre-existing (fail closed; AI guard)
 *     - 'none': nothing counts as pre-existing (git hooks: everything staged is new)
 * If git fails while reading the baseline, the path is treated as pre-existing.
 */
export function createGitRepo(projectDir, { unbornFallback = 'disk' } = {}) {
  let baseline;

  const loadBaseline = () => {
    if (baseline) return baseline;
    let refs = [];
    let kind = 'none';
    for (const ref of BASE_REFS) {
      const result = runGit(
        ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
        projectDir
      );
      if (result.ok && result.out.trim()) {
        refs = [result.out.trim()];
        kind = ref;
        break;
      }
    }
    if (!refs.length) {
      const roots = runGit(['rev-list', '--max-parents=0', 'HEAD'], projectDir);
      if (roots.ok && roots.out.trim()) {
        refs = roots.out.trim().split('\n');
        kind = 'root-commit';
      }
    }
    let paths = new Set();
    let failed = false;
    for (const ref of refs) {
      const tree = runGit(
        ['ls-tree', '-r', '--name-only', ref, '--', `${PUBLIC_DIR}/`],
        projectDir
      );
      if (!tree.ok) {
        failed = true;
        break;
      }
      for (const line of tree.out.split('\n')) {
        if (line.trim()) paths.add(line.trim().toLowerCase());
      }
    }
    baseline = { kind, paths, failed };
    return baseline;
  };

  return {
    get baselineKind() {
      return loadBaseline().kind;
    },
    isPreexisting(rel) {
      const { kind, paths, failed } = loadBaseline();
      if (failed) return true;
      if (kind === 'none') {
        return unbornFallback === 'disk'
          ? existsSync(join(projectDir, rel))
          : false;
      }
      const lower = rel.toLowerCase().replace(/\/+$/, '');
      if (paths.has(lower)) return true;
      for (const path of paths) if (path.startsWith(`${lower}/`)) return true;
      return false;
    }
  };
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const toPosix = path => path.split(sep).join('/');

const expandTilde = path =>
  path === '~'
    ? homedir()
    : path.startsWith('~/')
      ? join(homedir(), path.slice(2))
      : path;

/** Project-relative POSIX path ('' = project root), or null when outside the project. */
export function toProjectPath(target, { cwd, projectDir }) {
  const absolute = resolve(cwd ?? projectDir, expandTilde(target));
  const rel = relative(projectDir, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return toPosix(rel);
}

/** Resolves symlinks on the nearest existing ancestor (catches symlink escapes). */
function realProjectPath(target, { cwd, projectDir }) {
  try {
    const realRoot = realpathSync(projectDir);
    let current = resolve(cwd ?? projectDir, expandTilde(target));
    const rest = [];
    while (!existsSync(current)) {
      const parent = dirname(current);
      if (parent === current) return undefined;
      rest.unshift(basename(current));
      current = parent;
    }
    const real = join(realpathSync(current), ...rest);
    const rel = relative(realRoot, real);
    if (rel.startsWith('..') || isAbsolute(rel)) return null;
    return toPosix(rel);
  } catch {
    return undefined;
  }
}

/** Lexical + symlink-resolved project paths for a target (deduplicated). */
export function resolveProjectPaths(target, location) {
  const lexical = toProjectPath(target, location);
  const real = realProjectPath(target, location);
  const result = [lexical];
  if (real !== undefined && real !== lexical) result.push(real);
  return result;
}

/** @returns {'outside'|'root'|'protected'|'public-root'|'public'|'editable'} */
export function classifyPath(rel) {
  if (rel === null || rel === undefined) return 'outside';
  const lower = rel.toLowerCase().replace(/\/+$/, '');
  if (lower === '' || lower === '.') return 'root';
  const parts = lower.split('/');
  const top = parts[0];
  const name = parts[parts.length - 1];
  if (PROTECTED_DIRS.includes(top)) return 'protected';
  if (parts.length === 1 && PROTECTED_ROOT_FILES.includes(lower))
    return 'protected';
  if (PROTECTED_FILE_PATTERNS.some(pattern => pattern.test(name)))
    return 'protected';
  if (lower === PUBLIC_DIR) return 'public-root';
  if (top === PUBLIC_DIR) return 'public';
  return 'editable';
}

const OP_LABELS = {
  write: 'change',
  'write-tree': 'rewrite files in',
  delete: 'delete',
  move: 'move or rename',
  mkdir: 'create a folder at',
  restore: 'restore',
  chmod: 'change permissions of'
};

/**
 * Decision for one operation on one project-relative path.
 * @param {string|null} rel
 * @param {'write'|'write-tree'|'delete'|'move'|'mkdir'|'restore'|'chmod'} op
 * @param {{ isPreexisting(rel: string): boolean }} repo
 */
export function checkPath(rel, op, repo) {
  const kind = classifyPath(rel);
  const label = OP_LABELS[op] ?? op;
  const shown = rel ? `\`${rel}\`` : 'the project folder';

  switch (kind) {
    case 'outside':
      return deny(
        `I can't ${label} files outside this project folder while Designer Mode is on.`,
        'Keep your work inside the project (pages, `src/` and new files in `public/`).',
        `Blocked ${op} outside the project root.`
      );
    case 'root':
      if (op === 'restore' || op === 'mkdir') return ALLOW;
      return deny(
        `That would ${label} the whole project folder at once, which could also touch locked setup files.`,
        'Point the action at a specific file or folder instead (for example a page or a file in `src/`).',
        `Blocked ${op} on the project root.`
      );
    case 'protected':
      return deny(
        `I can't ${label} ${shown}. It belongs to the project's setup (configuration, tooling, dependencies, AI instructions or documentation), so it is locked on design branches.`,
        ASK_DEV,
        `Blocked ${op} on protected path ${rel}.`
      );
    case 'public-root':
      if (['delete', 'move', 'chmod', 'write-tree'].includes(op)) {
        return deny(
          `The \`public/\` folder itself can't be deleted, renamed or rewritten as a whole.`,
          'You can still add new files inside `public/`, and change or remove the ones you added.',
          `Blocked ${op} on public/ itself.`
        );
      }
      return ALLOW;
    case 'public':
      if (op === 'restore' || op === 'mkdir') return ALLOW;
      if (repo.isPreexisting(rel)) {
        return deny(
          `${shown} was already part of the project before your design branch, so it can't be changed, moved or removed.`,
          'Add a new file with a different name and use that one instead, or ask a developer to replace the original.',
          `Blocked ${op} on pre-existing public asset ${rel}.`
        );
      }
      return ALLOW;
    default:
      return ALLOW;
  }
}

/** Checks a file path coming from an edit/write tool. */
export function evaluateFileChange(filePath, location, repo, op = 'write') {
  if (typeof filePath !== 'string' || !filePath) {
    return deny(
      "I couldn't tell which file this change was for, so I stopped to be safe.",
      'Try again, naming the file you want to change.',
      'Edit/write tool call without a file path.'
    );
  }
  for (const rel of resolveProjectPaths(filePath, location)) {
    const decision = checkPath(rel, op, repo);
    if (!decision.allow) return decision;
  }
  return ALLOW;
}

/** Targets of an OpenCode `apply_patch` envelope. */
export function parsePatchTargets(patchText) {
  const targets = [];
  for (const line of String(patchText ?? '').split('\n')) {
    const match = line.match(
      /^\*\*\* (Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/
    );
    if (!match) continue;
    const [, action, path] = match;
    if (action === 'Delete File') targets.push({ path, op: 'delete' });
    else if (action === 'Move to') {
      const previous = targets[targets.length - 1];
      if (previous) previous.op = 'move';
      targets.push({ path, op: 'write' });
    } else targets.push({ path, op: 'write' });
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Shell lexer
// ---------------------------------------------------------------------------

const OUTPUT_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>']);
const SAFE_REDIRECT_TARGETS = new Set([
  '/dev/null',
  '/dev/stdout',
  '/dev/stderr',
  '/dev/tty'
]);

/** Neutralizes heredoc bodies (data, not commands) before lexing. */
function stripHeredocs(input) {
  return input
    .replace(
      /\$\(\s*cat\s+<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*\n?\s*\)/g,
      "'HEREDOC'"
    )
    .replace(
      /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*(?=\n|$)/g,
      ' $3'
    );
}

/**
 * Small POSIX-ish lexer. Returns segments (simple commands) with their words
 * and redirections. Anything it can't analyze statically (command
 * substitution, subshells, process substitution) is reported as `complex`.
 */
export function tokenizeShell(raw) {
  const input = stripHeredocs(String(raw));
  const segments = [];
  let complex = null;
  let segment = { words: [], redirects: [] };
  let word = null;
  let pending = null;

  const newWord = () => ({
    value: '',
    glob: false,
    variable: false,
    tilde: false,
    quoted: false
  });
  const ensureWord = () => (word ??= newWord());
  const endWord = () => {
    if (!word) return;
    if (pending) {
      pending.target = word;
      segment.redirects.push(pending);
      pending = null;
    } else segment.words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    if (pending) {
      complex ??= 'redirection without a target';
      pending = null;
    }
    if (segment.words.length || segment.redirects.length)
      segments.push(segment);
    segment = { words: [], redirects: [] };
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];

    if (c === ' ' || c === '\t') {
      endWord();
      continue;
    }
    if (c === '\n' || c === ';') {
      endSegment();
      continue;
    }
    if (c === '#' && !word) {
      while (i < input.length && input[i] !== '\n') i++;
      i--;
      continue;
    }
    if (c === '\\') {
      if (next === '\n') {
        i++;
        continue;
      }
      ensureWord().value += next ?? '';
      word.quoted = true;
      i++;
      continue;
    }
    if (c === "'") {
      ensureWord().quoted = true;
      const end = input.indexOf("'", i + 1);
      if (end === -1) {
        complex ??= 'unclosed quote';
        break;
      }
      word.value += input.slice(i + 1, end);
      i = end;
      continue;
    }
    if (c === '"') {
      ensureWord().quoted = true;
      let j = i + 1;
      for (; j < input.length && input[j] !== '"'; j++) {
        const d = input[j];
        if (d === '\\' && j + 1 < input.length) {
          word.value += input[j + 1];
          j++;
          continue;
        }
        if (d === '`' || (d === '$' && input[j + 1] === '('))
          complex ??= 'command substitution';
        if (d === '$') word.variable = true;
        word.value += d;
      }
      if (j >= input.length) {
        complex ??= 'unclosed quote';
        break;
      }
      i = j;
      continue;
    }
    if (c === '`') {
      complex ??= 'command substitution';
      continue;
    }
    if (c === '(' || c === ')') {
      complex ??= 'subshell';
      continue;
    }
    if (c === '&') {
      if (next === '&') {
        endSegment();
        i++;
      } else if (next === '>') {
        endWord();
        const append = input[i + 2] === '>';
        pending = { op: append ? '&>>' : '&>', fd: 'all' };
        i += append ? 2 : 1;
      } else endSegment();
      continue;
    }
    if (c === '|') {
      endSegment();
      if (next === '|' || next === '&') i++;
      continue;
    }
    if (c === '>' || c === '<') {
      if ((next === '(' && (c === '<' || c === '>')) || pending) {
        complex ??=
          next === '(' ? 'process substitution' : 'double redirection';
      }
      let fd = c === '>' ? '1' : '0';
      if (word && /^\d+$/.test(word.value) && !word.quoted) {
        fd = word.value;
        word = null;
      }
      endWord();
      let op = c;
      if (c === '>' && (next === '>' || next === '|' || next === '&'))
        op += next;
      else if (c === '<' && (next === '<' || next === '>' || next === '&'))
        op += next;
      if (op === '<<' && input[i + 2] === '<') op = '<<<';
      i += op.length - 1;
      if (op === '>&' || op === '<&') {
        // fd duplication (2>&1, >&-) or, in bash, `>&file`
        let j = i + 1;
        while (input[j] === ' ') j++;
        const dup = input.slice(j).match(/^(\d+|-)(?=[\s;&|]|$)/);
        if (dup) {
          i = j + dup[0].length - 1;
          continue;
        }
        op = op === '>&' ? '&>' : '<';
      }
      pending = { op, fd };
      continue;
    }
    // ordinary character
    const current = ensureWord();
    if (c === '$') {
      if (next === '(') complex ??= 'command substitution';
      current.variable = true;
    }
    if ('*?[{'.includes(c)) current.glob = true;
    if (c === '~' && current.value === '') current.tilde = true;
    current.value += c;
  }
  endSegment();
  return { segments, complex };
}

// ---------------------------------------------------------------------------
// Bash analysis
// ---------------------------------------------------------------------------

const blockedCommand = (name, why = '') =>
  deny(
    `I can't run \`${name}\` while Designer Mode is on${why ? ` — ${why}` : ''}.`,
    'Stick to previewing and checking your work (for example `pnpm dev`, `pnpm build`, `git status`, `git add`, `git commit`). For anything else, please ask a developer.',
    `Blocked shell command: ${name}.`
  );

const unclearCommand = detail =>
  deny(
    `This command is too complex for me to check safely (${detail}), so I didn't run it.`,
    'Try a simpler, step-by-step version of the command, or ask a developer.',
    `Blocked shell command with ${detail}.`
  );

const firstGlobIndex = value => value.search(/[*?[{]/);

/** Checks a shell word that names a path the command will write/delete. */
function checkTargetWord(target, op, state) {
  if (target.variable) {
    return deny(
      "This command uses a variable for a file location, so I can't tell which file would change.",
      'Write the file path out in full and try again.',
      `Blocked ${op} on unresolved path ${target.value}.`
    );
  }
  let path = target.value;
  let effectiveOp = op;
  if (target.glob) {
    const prefix = path.slice(0, firstGlobIndex(path));
    path = prefix.includes('/')
      ? prefix.slice(0, prefix.lastIndexOf('/')) || '/'
      : '.';
    effectiveOp = op === 'mkdir' ? 'mkdir' : 'write-tree';
    // a wildcard can match any file in that folder, including pre-existing ones
    if (classifyPath(toProjectPath(path, state)) === 'root') {
      return deny(
        'This command uses a wildcard (`*`) at the top of the project, so it could touch locked setup files.',
        'Name the exact files you want to change, or ask a developer.',
        `Blocked ${op} with wildcard target ${target.value} at project root.`
      );
    }
  }
  for (const rel of resolveProjectPaths(path, state)) {
    const decision = checkPath(rel, effectiveOp, state.repo);
    if (!decision.allow) return decision;
  }
  return ALLOW;
}

const isDirectory = (path, state) => {
  try {
    return statSync(resolve(state.cwd, expandTilde(path))).isDirectory();
  } catch {
    return false;
  }
};

/** Splits args into operands, honouring `--` and skipping values of `valueFlags`. */
function operandsOf(args, valueFlags = new Set()) {
  const operands = [];
  let afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (afterDashDash) operands.push(arg);
    else if (arg.value === '--') afterDashDash = true;
    else if (arg.value.startsWith('-') && arg.value !== '-') {
      if (valueFlags.has(arg.value)) i++;
    } else operands.push(arg);
  }
  return operands;
}

const hasFlag = (args, ...names) =>
  args.some(arg =>
    names.some(name => arg.value === name || arg.value.startsWith(`${name}=`))
  );

const shortClusterHas = (args, letter) =>
  args.some(
    arg => /^-[A-Za-z]+$/.test(arg.value) && arg.value.slice(1).includes(letter)
  );

function checkAll(targets, op, state) {
  for (const target of targets) {
    const decision = checkTargetWord(target, op, state);
    if (!decision.allow) return decision;
  }
  return ALLOW;
}

/** cp / mv / ln / git mv: last operand is the destination. */
function checkCopyLike(operands, sourceOp, state) {
  if (!operands.length) return ALLOW;
  const sources = operands.length > 1 ? operands.slice(0, -1) : operands;
  const dest =
    operands.length > 1
      ? operands[operands.length - 1]
      : { value: '.', glob: false, variable: false };
  if (sourceOp) {
    const decision = checkAll(sources, sourceOp, state);
    if (!decision.allow) return decision;
  }
  const destIsDir =
    operands.length > 2 ||
    dest.value.endsWith('/') ||
    isDirectory(dest.value, state);
  if (!destIsDir) return checkTargetWord(dest, 'write', state);
  for (const source of sources) {
    const name = basename(source.value.replace(/\/+$/, ''));
    const decision = checkTargetWord(
      {
        ...dest,
        value: join(dest.value, name),
        glob: source.glob || dest.glob
      },
      'write',
      state
    );
    if (!decision.allow) return decision;
  }
  return ALLOW;
}

// -- git --------------------------------------------------------------------

const gitBlocked = (what, tip, devNote) =>
  deny(
    what,
    tip ??
      'On a design branch you can check your changes (`git status`, `git diff`), save them (`git add`, `git commit`), create or switch between `design/...` branches and push your own `design/...` branch. For anything else, please ask a developer.',
    devNote
  );

const notDesignBranch = name =>
  gitBlocked(
    `\`${name}\` is not a design branch. In Designer Mode you can only create, switch to or change branches whose names start with \`design/\`.`,
    'Use a name like `design/landing-hero`, or ask a developer if you need another branch.',
    `Blocked git operation on non-design branch ${name}.`
  );

const GIT_READ = new Set([
  'status',
  'diff',
  'log',
  'show',
  'ls-files',
  'ls-tree',
  'rev-parse',
  'describe',
  'blame',
  'shortlog',
  'cat-file',
  'grep',
  'help',
  'version',
  'whatchanged',
  'check-ignore',
  'show-ref',
  'rev-list',
  'name-rev',
  'diff-tree',
  'merge-base',
  'add',
  'stash',
  'revert',
  'cherry-pick',
  'merge'
]);

const GIT_CONFIG_WRITABLE = [
  /^user\.(name|email)$/,
  /^color\./,
  /^push\.autosetupremote$/,
  /^init\.defaultbranch$/
];

function analyzeGitCheckout(args, state) {
  let newBranch = null;
  const before = [];
  let after = null;
  for (let i = 0; i < args.length; i++) {
    const value = args[i].value;
    if (after) {
      after.push(args[i]);
      continue;
    }
    if (value === '--') after = [];
    else if (value === '-b' || value === '-B')
      newBranch = args[++i]?.value ?? '';
    else if (value === '--orphan' || value === '--detach' || value === '-') {
      return gitBlocked(
        'Switching to that kind of branch or commit is outside Designer Mode.',
        undefined,
        `Blocked git checkout ${value}.`
      );
    } else if (value.startsWith('-')) continue;
    else before.push(args[i]);
  }
  if (newBranch !== null)
    return isDesignBranch(newBranch) ? ALLOW : notDesignBranch(newBranch);
  if (after) {
    const [source] = before;
    if (source && source.value !== 'HEAD' && !isDesignBranch(source.value)) {
      return gitBlocked(
        `Copying files from \`${source.value}\` is outside Designer Mode.`,
        undefined,
        `Blocked git checkout ${source.value} -- <paths>.`
      );
    }
    return checkAll(after, 'restore', state);
  }
  if (before.length === 1 && isDesignBranch(before[0].value)) return ALLOW;
  // `git checkout <path>`: restore files when every operand is an existing path
  const allPaths =
    before.length > 0 &&
    before.every(arg => existsSync(resolve(state.cwd, arg.value)));
  if (allPaths) return checkAll(before, 'restore', state);
  return notDesignBranch(before[0]?.value ?? '(previous branch)');
}

function analyzeGitSwitch(args) {
  for (let i = 0; i < args.length; i++) {
    const value = args[i].value;
    if (['-c', '-C', '--create', '--force-create'].includes(value)) {
      const name = args[i + 1]?.value ?? '';
      return isDesignBranch(name) ? ALLOW : notDesignBranch(name);
    }
    const inline = value.match(/^--(?:force-)?create=(.+)$/);
    if (inline)
      return isDesignBranch(inline[1]) ? ALLOW : notDesignBranch(inline[1]);
    if (
      value === '--detach' ||
      value === '-d' ||
      value === '--orphan' ||
      value === '-'
    ) {
      return gitBlocked(
        'Switching to that kind of branch or commit is outside Designer Mode.',
        undefined,
        `Blocked git switch ${value}.`
      );
    }
  }
  const [target] = operandsOf(args);
  if (!target) return ALLOW;
  return isDesignBranch(target.value) ? ALLOW : notDesignBranch(target.value);
}

function analyzeGitBranch(args) {
  const flags = args
    .filter(arg => arg.value.startsWith('-'))
    .map(arg => arg.value);
  const operands = operandsOf(
    args,
    new Set([
      '--sort',
      '--format',
      '--contains',
      '--merged',
      '--no-merged',
      '--points-at'
    ])
  );
  const has = (...names) =>
    flags.some(flag =>
      names.some(name => flag === name || flag.startsWith(`${name}=`))
    );

  if (has('--edit-description'))
    return gitBlocked(
      'Editing branch descriptions is outside Designer Mode.',
      undefined,
      'Blocked git branch --edit-description.'
    );
  if (has('-u', '--set-upstream-to')) {
    const inline = flags
      .find(flag => flag.startsWith('--set-upstream-to='))
      ?.split('=')[1];
    const upstream = inline ?? operands[0]?.value ?? '';
    const branch = upstream.replace(/^[^/]+\/(?=design\/)/, '');
    return isDesignBranch(branch) ? ALLOW : notDesignBranch(upstream);
  }
  if (has('--unset-upstream')) return ALLOW;
  if (has('-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy')) {
    const bad = operands.find(arg => !isDesignBranch(arg.value));
    return bad ? notDesignBranch(bad.value) : ALLOW;
  }
  if (
    has(
      '--list',
      '-l',
      '-a',
      '--all',
      '-r',
      '--remotes',
      '--show-current',
      '-v',
      '-vv',
      '--verbose'
    ) ||
    !operands.length
  ) {
    return ALLOW;
  }
  return isDesignBranch(operands[0].value)
    ? ALLOW
    : notDesignBranch(operands[0].value);
}

const PUSH_SAFE_FLAGS = new Set([
  '-u',
  '--set-upstream',
  '-v',
  '--verbose',
  '-q',
  '--quiet',
  '--progress',
  '--no-progress',
  '-n',
  '--dry-run',
  '--porcelain',
  '--atomic',
  '--no-atomic'
]);

function analyzeGitPush(args) {
  for (const arg of args) {
    const value = arg.value;
    if (!value.startsWith('-') || value === '--') continue;
    const isCluster = /^-[A-Za-z]{2,}$/.test(value);
    const ok = isCluster
      ? [...value.slice(1)].every(letter => PUSH_SAFE_FLAGS.has(`-${letter}`))
      : PUSH_SAFE_FLAGS.has(value);
    if (!ok) {
      const force = /^(-f|--force.*|-[A-Za-z]*f[A-Za-z]*|--mirror)$/.test(
        value
      );
      return gitBlocked(
        force
          ? "Force-pushing can overwrite other people's work, so it is blocked in Designer Mode."
          : `The push option \`${value}\` is outside Designer Mode.`,
        'Push normally with `git push` (or `git push -u origin design/your-branch` the first time). If the push is rejected, ask a developer for help.',
        `Blocked git push ${value}.`
      );
    }
  }
  const [, ...refspecs] = operandsOf(args);
  for (const { value } of refspecs) {
    if (value.startsWith('+')) {
      return gitBlocked(
        "Force-pushing can overwrite other people's work, so it is blocked in Designer Mode.",
        undefined,
        `Blocked forced refspec ${value}.`
      );
    }
    const [source, destination] = value.includes(':')
      ? value.split(':', 2)
      : [value, value];
    if (source === '') {
      return gitBlocked(
        'Deleting branches on the shared repository is outside Designer Mode.',
        undefined,
        `Blocked remote delete ${value}.`
      );
    }
    if (destination === 'HEAD' && source === 'HEAD') continue; // current (design) branch
    if (!isDesignRef(destination)) {
      return gitBlocked(
        `Your work can only be sent to design branches (names starting with \`design/\`). Sending to \`${stripHeadsPrefix(destination)}\` is a developer step.`,
        'Push your own design branch instead (for example `git push -u origin design/your-branch`) and ask a developer to review and merge it.',
        `Blocked git push to non-design ref ${destination}.`
      );
    }
  }
  return ALLOW;
}

function analyzeGitConfig(args) {
  const values = args.map(arg => arg.value);
  const readFlags = [
    '--get',
    '--get-all',
    '--get-regexp',
    '--get-urlmatch',
    '--list',
    '-l',
    'get',
    'list'
  ];
  if (values.some(value => readFlags.includes(value))) return ALLOW;
  if (
    values.some(
      value =>
        ['-e', '--edit', 'edit', '-f', '--file', '--blob'].includes(value) ||
        value.startsWith('--file=')
    )
  ) {
    return gitBlocked(
      'Changing git settings that way is outside Designer Mode.',
      undefined,
      `Blocked git config ${values.join(' ')}.`
    );
  }
  const writeFlags = [
    '--unset',
    '--unset-all',
    '--add',
    '--replace-all',
    '--rename-section',
    '--remove-section',
    'set',
    'unset',
    'rename-section',
    'remove-section'
  ];
  const isWrite = values.some(value => writeFlags.includes(value));
  const operands = operandsOf(
    args,
    new Set(['--type', '--default', '--comment'])
  ).filter(
    arg =>
      !['set', 'unset', 'rename-section', 'remove-section'].includes(arg.value)
  );
  if (!isWrite && operands.length < 2) return ALLOW; // `git config user.name` reads
  const key = (operands[0]?.value ?? '').toLowerCase();
  if (GIT_CONFIG_WRITABLE.some(pattern => pattern.test(key))) return ALLOW;
  const aboutHooks =
    /hook|alias|include|fsmonitor|sshcommand|editor|pager/.test(key);
  return gitBlocked(
    aboutHooks
      ? "That git setting controls the project's safety checks or runs commands, so it is locked in Designer Mode."
      : `Changing the git setting \`${key || '(unknown)'}\` is outside Designer Mode.`,
    'You can set your name and email (`git config user.name "..."`). For other settings, please ask a developer.',
    `Blocked git config write ${key}.`
  );
}

/** `git commit -n` / `-an` / `-anm msg` (letters after a value flag are its value). */
function commitSkipsHooks(args) {
  for (let i = 0; i < args.length; i++) {
    const value = args[i].value;
    if (value === '--') break;
    if (!/^-[A-Za-z]+$/.test(value)) continue;
    for (const letter of value.slice(1)) {
      if (letter === 'n') return true;
      if ('mFCct'.includes(letter)) {
        if (value.endsWith(letter)) i++; // value is the next argument
        break;
      }
    }
  }
  return false;
}

function analyzeGit(args, state) {
  args = [...args];
  // global options before the subcommand
  while (args[0]?.value.startsWith('-')) {
    const value = args[0].value;
    if (
      [
        '--no-pager',
        '-P',
        '--paginate',
        '-p',
        '--no-optional-locks',
        '--literal-pathspecs'
      ].includes(value)
    ) {
      args.shift();
      continue;
    }
    if (['--version', '--help', '-h'].includes(value)) return ALLOW;
    return gitBlocked(
      `The git option \`${value}\` is outside Designer Mode.`,
      undefined,
      `Blocked git global option ${value}.`
    );
  }
  const sub = args.shift()?.value;
  if (!sub) return ALLOW;
  if (hasFlag(args, '--no-verify')) {
    return gitBlocked(
      "Skipping the project's safety checks (`--no-verify`) is not allowed in Designer Mode.",
      'Run the command without `--no-verify`. If a check fails, I can explain what it means, or you can ask a developer.',
      `Blocked git ${sub} --no-verify.`
    );
  }

  switch (sub) {
    case 'commit':
      if (commitSkipsHooks(args)) {
        return gitBlocked(
          "Skipping the project's safety checks (`-n`) is not allowed in Designer Mode.",
          'Commit without `-n`.',
          'Blocked git commit -n.'
        );
      }
      return ALLOW;
    case 'fetch':
    case 'pull': {
      if (hasFlag(args, '--rebase', '-r') || hasFlag(args, '--force', '-f')) {
        return gitBlocked(
          `\`git ${sub}\` with that option rewrites history, which is outside Designer Mode.`,
          'Use plain `git pull`, or ask a developer.',
          `Blocked git ${sub} rebase/force.`
        );
      }
      if (operandsOf(args).some(arg => arg.value.includes(':'))) {
        return gitBlocked(
          'Updating other branches directly is outside Designer Mode.',
          undefined,
          `Blocked git ${sub} with refspec.`
        );
      }
      return ALLOW;
    }
    case 'restore':
      if (hasFlag(args, '--source', '-s', '--pathspec-from-file')) {
        return gitBlocked(
          'Restoring files from another branch or commit is outside Designer Mode.',
          undefined,
          'Blocked git restore --source.'
        );
      }
      return checkAll(operandsOf(args), 'restore', state);
    case 'checkout':
      return analyzeGitCheckout(args, state);
    case 'switch':
      return analyzeGitSwitch(args);
    case 'branch':
      return analyzeGitBranch(args);
    case 'push':
      return analyzeGitPush(args);
    case 'config':
      return analyzeGitConfig(args);
    case 'rebase':
      if (hasFlag(args, '--abort', '--quit')) return ALLOW;
      return gitBlocked(
        'Rebasing rewrites the history of a branch, so it is outside Designer Mode.',
        'If your branch needs updating from `main`, please ask a developer (or use `git pull origin main`).',
        'Blocked git rebase.'
      );
    case 'reset':
      if (hasFlag(args, '--hard', '--keep', '--merge')) {
        return gitBlocked(
          '`git reset --hard` throws away work permanently, so it is blocked in Designer Mode.',
          'To undo changes in one file use `git restore <file>`, or ask a developer.',
          'Blocked git reset --hard/--keep/--merge.'
        );
      }
      return ALLOW;
    case 'clean':
      if (
        hasFlag(args, '-n', '--dry-run') &&
        !shortClusterHas(args, 'f') &&
        !hasFlag(args, '--force')
      )
        return ALLOW;
      return gitBlocked(
        '`git clean` permanently deletes files, so it is blocked in Designer Mode.',
        'Delete the specific file you no longer need instead, or ask a developer.',
        'Blocked git clean.'
      );
    case 'rm':
      return checkAll(operandsOf(args), 'delete', state);
    case 'mv':
      return checkCopyLike(operandsOf(args), 'move', state);
    case 'tag':
      if (!operandsOf(args).length || hasFlag(args, '-l', '--list'))
        return ALLOW;
      return gitBlocked(
        'Creating or deleting tags is a developer step.',
        undefined,
        'Blocked git tag write.'
      );
    case 'remote': {
      const [first] = args;
      if (
        !first ||
        ['-v', '--verbose', 'show', 'get-url'].includes(first.value)
      )
        return ALLOW;
      return gitBlocked(
        "Changing the project's remote repositories is outside Designer Mode.",
        undefined,
        `Blocked git remote ${first.value}.`
      );
    }
    case 'reflog': {
      const [first] = args;
      if (!first || first.value === 'show' || first.value.startsWith('-'))
        return ALLOW;
      return gitBlocked(
        "Changing git's history log is outside Designer Mode.",
        undefined,
        `Blocked git reflog ${first.value}.`
      );
    }
    default:
      if (GIT_READ.has(sub)) return ALLOW;
      return gitBlocked(
        `\`git ${sub}\` is outside Designer Mode.`,
        undefined,
        `Blocked git ${sub}.`
      );
  }
}

// -- package manager / tools --------------------------------------------------

const dependencyBlocked = what =>
  deny(
    `${what} changes the project's dependencies (\`package.json\` / \`pnpm-lock.yaml\`), which are locked in Designer Mode.`,
    'If you need a new library or tool, please ask a developer to add it.',
    `Blocked dependency change: ${what}.`
  );

const PRETTIER_VALUE_FLAGS = new Set([
  '--config',
  '--ignore-path',
  '--plugin',
  '--log-level',
  '--stdin-filepath',
  '--parser',
  '--cache-location',
  '--cache-strategy'
]);
const ESLINT_VALUE_FLAGS = new Set([
  '-c',
  '--config',
  '--ext',
  '--ignore-pattern',
  '--rule',
  '--format',
  '-f',
  '-o',
  '--output-file',
  '--max-warnings',
  '--parser',
  '--plugin',
  '--cache-location'
]);

function analyzeTool(tool, args, state) {
  switch (tool) {
    case 'prettier': {
      if (!hasFlag(args, '--write', '-w')) return ALLOW;
      const operands = operandsOf(args, PRETTIER_VALUE_FLAGS);
      if (!operands.length) return ALLOW;
      return checkAll(operands, 'write-tree', state);
    }
    case 'eslint': {
      if (hasFlag(args, '-o', '--output-file'))
        return blockedCommand('eslint --output-file');
      if (!hasFlag(args, '--fix')) return ALLOW;
      const operands = operandsOf(args, ESLINT_VALUE_FLAGS);
      return checkAll(
        operands.length
          ? operands
          : [{ value: '.', glob: false, variable: false }],
        'write-tree',
        state
      );
    }
    case 'tsc':
      if (hasFlag(args, '--init'))
        return blockedCommand(
          'tsc --init',
          'it would overwrite the TypeScript setup'
        );
      return ALLOW;
    case 'vite':
      return ALLOW;
    default:
      return blockedCommand(
        tool,
        'it is not one of the project tools available to designers'
      );
  }
}

const KNOWN_TOOLS = new Set(['prettier', 'eslint', 'tsc', 'vite']);

function analyzeScript(script, args, state) {
  if (!ALLOWED_SCRIPTS.has(script)) {
    return blockedCommand(
      `pnpm ${script}`,
      'that script is not available in Designer Mode'
    );
  }
  if (hasFlag(args, '--fix'))
    return analyzeTool(
      'eslint',
      [{ value: '--fix', glob: false, variable: false }, ...args],
      state
    );
  return ALLOW;
}

function analyzePnpm(args, state) {
  args = [...args];
  while (args[0]?.value.startsWith('-')) {
    const value = args[0].value;
    if (['-v', '--version', '-h', '--help'].includes(value)) return ALLOW;
    if (
      [
        '-C',
        '--dir',
        '--filter',
        '-F',
        '-w',
        '--workspace-root',
        '-g',
        '--global'
      ].includes(value) ||
      value.startsWith('--dir=') ||
      value.startsWith('--filter=')
    ) {
      return blockedCommand(
        `pnpm ${value}`,
        'it works outside this project or on other packages'
      );
    }
    args.shift();
  }
  const sub = args.shift()?.value;
  if (!sub) return ALLOW;
  if (sub === 'run' || sub === 'run-script') {
    const script = args.shift()?.value;
    return script ? analyzeScript(script, args, state) : ALLOW;
  }
  if (ALLOWED_SCRIPTS.has(sub)) return analyzeScript(sub, args, state);
  if (sub === 'install' || sub === 'i') {
    if (operandsOf(args).length || hasFlag(args, '-g', '--global'))
      return dependencyBlocked(`\`pnpm ${sub} <package>\``);
    return ALLOW;
  }
  if (
    [
      'add',
      'remove',
      'rm',
      'uninstall',
      'un',
      'update',
      'up',
      'upgrade',
      'link',
      'ln',
      'unlink',
      'patch',
      'patch-commit',
      'patch-remove',
      'import',
      'prune',
      'dedupe',
      'approve-builds',
      'rebuild',
      'rb',
      'pkg',
      'set-script',
      'init',
      'publish',
      'pack',
      'config',
      'c',
      'catalog'
    ].includes(sub)
  ) {
    return dependencyBlocked(`\`pnpm ${sub}\``);
  }
  if (
    [
      'list',
      'ls',
      'll',
      'la',
      'outdated',
      'why',
      'help',
      'root',
      'bin',
      'licenses'
    ].includes(sub)
  )
    return ALLOW;
  if (sub === 'audit')
    return hasFlag(args, '--fix')
      ? dependencyBlocked('`pnpm audit --fix`')
      : ALLOW;
  if (sub === 'exec') {
    const tool = args.shift()?.value;
    return tool ? analyzeTool(basename(tool), args, state) : ALLOW;
  }
  if (sub === 'dlx' || sub === 'create')
    return blockedCommand(`pnpm ${sub}`, 'it downloads and runs outside tools');
  if (KNOWN_TOOLS.has(sub)) return analyzeTool(sub, args, state);
  return blockedCommand(`pnpm ${sub}`);
}

function analyzeNpm(args, state) {
  const [sub, script, ...rest] = args;
  if (!sub || ['-v', '--version', 'ls', 'list', 'help'].includes(sub.value))
    return ALLOW;
  if ((sub.value === 'run' || sub.value === 'run-script') && script)
    return analyzeScript(script.value, rest, state);
  if (
    [
      'install',
      'i',
      'ci',
      'add',
      'uninstall',
      'remove',
      'rm',
      'update',
      'up'
    ].includes(sub.value)
  ) {
    return dependencyBlocked(`\`npm ${sub.value}\` (this project uses pnpm)`);
  }
  return blockedCommand(`npm ${sub.value}`);
}

function analyzeNpx(args, state) {
  const rest = [...args];
  while (rest[0]?.value.startsWith('-')) rest.shift();
  const tool = rest.shift()?.value;
  if (!tool) return ALLOW;
  const name = basename(tool).replace(/@[^/]*$/, '');
  if (!KNOWN_TOOLS.has(name))
    return blockedCommand(
      `npx ${tool}`,
      'it would download and run an outside tool'
    );
  return analyzeTool(name, rest, state);
}

// -- simple file commands ------------------------------------------------------

function analyzeFileCommand(cmd, args, state) {
  switch (cmd) {
    case 'rm':
    case 'rmdir':
    case 'unlink':
      return checkAll(operandsOf(args), 'delete', state);
    case 'touch':
    case 'tee':
      return checkAll(
        operandsOf(args, new Set(['-r', '-t', '-d'])),
        'write',
        state
      );
    case 'truncate':
      return checkAll(
        operandsOf(args, new Set(['-s', '--size', '-r', '--reference'])),
        'write',
        state
      );
    case 'mkdir':
      return checkAll(
        operandsOf(args, new Set(['-m', '--mode'])),
        'mkdir',
        state
      );
    case 'chmod':
    case 'chown':
    case 'chgrp': {
      const operands = operandsOf(args);
      const targets = hasFlag(args, '--reference')
        ? operands
        : operands.slice(1);
      return checkAll(targets, 'chmod', state);
    }
    case 'cp':
      return checkCopyLike(
        operandsOf(
          args,
          new Set(['-t', '--target-directory', '-S', '--suffix'])
        ),
        null,
        state
      );
    case 'mv':
      return checkCopyLike(
        operandsOf(
          args,
          new Set(['-t', '--target-directory', '-S', '--suffix'])
        ),
        'move',
        state
      );
    case 'ln':
      return checkCopyLike(
        operandsOf(
          args,
          new Set(['-t', '--target-directory', '-S', '--suffix'])
        ),
        null,
        state
      );
    case 'sed': {
      const inPlace = args.some(
        arg =>
          /^--in-place/.test(arg.value) || /^-[A-Za-z]*[iI]/.test(arg.value)
      );
      if (!inPlace) return ALLOW;
      const hasScriptFlag = hasFlag(args, '-e', '--expression', '-f', '--file');
      const operands = operandsOf(
        args,
        new Set(['-e', '--expression', '-f', '--file'])
      ).filter(arg => arg.value !== '');
      return checkAll(
        hasScriptFlag ? operands : operands.slice(1),
        'write',
        state
      );
    }
    case 'curl': {
      if (
        hasFlag(
          args,
          '-O',
          '--remote-name',
          '--remote-name-all',
          '-K',
          '--config',
          '--output-dir',
          '-J'
        )
      ) {
        return blockedCommand(
          'curl',
          'it would save a file without a clear name or location; use `-o <path>`'
        );
      }
      const outputs = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i].value === '-o' || args[i].value === '--output')
          outputs.push(
            args[i + 1] ?? { value: '', glob: false, variable: true }
          );
        else if (args[i].value.startsWith('--output='))
          outputs.push({ ...args[i], value: args[i].value.slice(9) });
      }
      return checkAll(outputs, 'write', state);
    }
    case 'find':
      if (
        hasFlag(
          args,
          '-delete',
          '-exec',
          '-execdir',
          '-ok',
          '-okdir',
          '-fprint',
          '-fprint0',
          '-fprintf',
          '-fls'
        )
      ) {
        return blockedCommand(
          'find',
          'with `-delete`/`-exec` it can change many files at once'
        );
      }
      return ALLOW;
    case 'sort':
    case 'tree':
      if (hasFlag(args, '-o', '--output')) return blockedCommand(`${cmd} -o`);
      return ALLOW;
    case 'node':
      if (args.length === 1 && ['-v', '--version'].includes(args[0].value))
        return ALLOW;
      return blockedCommand(
        'node',
        'it runs scripts that could change anything in the project'
      );
    case 'wget':
    case 'rsync':
    case 'dd':
    case 'install':
    case 'patch':
    case 'tar':
    case 'unzip':
    case 'zip':
    case 'git-lfs':
      return blockedCommand(
        cmd,
        "it can write many files in ways I can't check"
      );
    default:
      return null;
  }
}

/**
 * Decision for a full shell command line in Designer Mode.
 * @param {string} command
 * @param {{ cwd?: string, projectDir: string, repo: { isPreexisting(rel: string): boolean } }} options
 */
export function analyzeBash(command, { cwd, projectDir, repo }) {
  if (typeof command !== 'string' || !command.trim()) return ALLOW;
  const { segments, complex } = tokenizeShell(command);
  if (complex) return unclearCommand(complex);

  const state = { cwd: cwd ?? projectDir, projectDir, repo };

  for (const { words: rawWords, redirects } of segments) {
    for (const redirect of redirects) {
      if (!OUTPUT_REDIRECTS.has(redirect.op)) continue;
      if (SAFE_REDIRECT_TARGETS.has(redirect.target.value)) continue;
      const decision = checkTargetWord(redirect.target, 'write', state);
      if (!decision.allow) return decision;
    }

    const words = [...rawWords];
    while (
      words[0] &&
      !words[0].quoted &&
      /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0].value)
    ) {
      const name = words.shift().value.split('=')[0];
      if (FORBIDDEN_ENV.test(name)) {
        return deny(
          `Setting \`${name}\` could switch off the project's safety checks, so it is blocked in Designer Mode.`,
          'Run the command without it, or ask a developer.',
          `Blocked env override ${name}.`
        );
      }
    }
    while (words[0] && ['time', 'nohup'].includes(words[0].value))
      words.shift();
    if (!words.length) continue;

    const [commandWord, ...args] = words;
    if (commandWord.variable || commandWord.glob)
      return unclearCommand('a command name that is a variable');
    const cmd = commandWord.value.includes('/')
      ? basename(commandWord.value)
      : commandWord.value;

    let decision;
    if (cmd === 'cd') {
      const target = args[0];
      if (target?.variable)
        return unclearCommand('a folder that is a variable');
      state.cwd = resolve(state.cwd, expandTilde(target?.value ?? '~'));
      continue;
    } else if (cmd === 'export' || cmd === 'unset' || cmd === 'set') {
      const bad = args.find(arg => FORBIDDEN_ENV.test(arg.value.split('=')[0]));
      decision = bad
        ? deny(
            `Changing \`${bad.value.split('=')[0]}\` could switch off the project's safety checks.`,
            'Leave it as it is, or ask a developer.',
            `Blocked ${cmd} ${bad.value}.`
          )
        : ALLOW;
    } else if (cmd === 'git') decision = analyzeGit(args, state);
    else if (cmd === 'pnpm') decision = analyzePnpm(args, state);
    else if (cmd === 'npm') decision = analyzeNpm(args, state);
    else if (cmd === 'npx' || cmd === 'pnpx')
      decision = analyzeNpx(args, state);
    else if (cmd === 'yarn')
      decision = dependencyBlocked('`yarn` (this project uses pnpm)');
    else if (KNOWN_TOOLS.has(cmd)) decision = analyzeTool(cmd, args, state);
    else if (OPAQUE_COMMANDS.has(cmd))
      decision = blockedCommand(
        cmd,
        "it can run other commands that I can't check"
      );
    else decision = analyzeFileCommand(cmd, args, state);

    if (decision === null) {
      decision = READ_ONLY_COMMANDS.has(cmd)
        ? ALLOW
        : blockedCommand(
            cmd,
            "I can't be sure it is safe for the project setup"
          );
    }
    if (!decision.allow) return decision;
  }
  return ALLOW;
}

// ---------------------------------------------------------------------------
// Git hook checks (husky)
// ---------------------------------------------------------------------------

/**
 * @param {{ status: string, path: string }[]} changes from `git diff --cached --name-status --no-renames`
 * @returns {{ path: string, decision: object }[]}
 */
export function evaluateStagedChanges(changes, repo) {
  const violations = [];
  for (const { status, path } of changes) {
    const kind = classifyPath(path);
    if (kind === 'protected') {
      violations.push({ path, decision: checkPath(path, 'write', repo) });
    } else if (
      kind === 'public' &&
      status !== 'A' &&
      repo.isPreexisting(path)
    ) {
      violations.push({
        path,
        decision: checkPath(path, status === 'D' ? 'delete' : 'write', repo)
      });
    } else if (
      kind === 'public' &&
      status === 'A' &&
      repo.isPreexisting(path)
    ) {
      // re-adding a baseline path with different content is still a replacement
      violations.push({ path, decision: checkPath(path, 'write', repo) });
    }
  }
  return violations;
}

export const ZERO_SHA = /^0+$/;

/**
 * @param {{ localRef: string, localSha: string, remoteRef: string, remoteSha: string }[]} updates
 * @param {(ancestor: string, descendant: string) => boolean | null} isAncestor null = unknown
 */
export function evaluatePushUpdates(updates, isAncestor) {
  const violations = [];
  for (const update of updates) {
    const { remoteRef, localSha, remoteSha } = update;
    if (!isDesignRef(remoteRef)) {
      violations.push({
        update,
        message: `pushing to \`${remoteRef}\` — only \`refs/heads/design/*\` branches can be pushed from a design branch.`
      });
    } else if (ZERO_SHA.test(localSha)) {
      violations.push({
        update,
        message: `deleting remote branch \`${remoteRef}\` is a developer step.`
      });
    } else if (!ZERO_SHA.test(remoteSha)) {
      const fastForward = isAncestor(remoteSha, localSha);
      if (fastForward === false)
        violations.push({
          update,
          message: `\`${remoteRef}\` would be force-pushed (history rewritten).`
        });
      if (fastForward === null)
        violations.push({
          update,
          message: `\`${remoteRef}\` has commits you don't have yet — run \`git pull\` first.`
        });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Agent context
// ---------------------------------------------------------------------------

export function designerContextText(branch, { short = false } = {}) {
  if (short) {
    return `Designer Mode is active (branch \`${branch ?? 'design/*'}\`). The user is a non-technical designer: explain things simply and kindly, in their language. Setup/config files, dependencies, pre-existing \`public/\` files and git beyond \`design/*\` branches are locked — if something needs that, tell them to ask a developer and give a short summary they can pass along.`;
  }
  return [
    `DESIGNER MODE IS ACTIVE (git branch \`${branch ?? 'design/*'}\`).`,
    '',
    'The person you are working with is a UX/UI designer, not a developer.',
    '- Be intuitive, explanatory and easy to follow. Light technical terms are fine; avoid jargon depth and harsh or alarming words.',
    "- Reply in the designer's language.",
    '- When something fails, explain in simple terms what happened and what they can do next.',
    '- If a request is outside their scope (protected setup files, configuration, dependencies, git beyond design branches, build/tooling errors they cannot fix), kindly tell them to ask a developer and give them a short summary to pass along.',
    '- Still follow every project convention (one HTML file per page, `data-component`, BEM + `@apply` in component CSS, tokens in `@theme`).',
    '',
    'Locked on design branches (guards will block changes): `.agents/`, `.claude/`, `.opencode/`, `.husky/`, `.git/`, `.github/`, `.vscode/`, `docs/`, `node_modules/`, root docs (CLAUDE.md, AGENTS.md, RULES.md, README.md, MIGRATION.md), package.json, lockfiles, tsconfig*.json, *.config.*, Prettier/editor/git/npm/node config files and `.env*`.',
    '`public/`: the designer can add new files and change/remove files they added, but not files that already existed on `main`, and not the folder itself.',
    'Editable: pages (`*.html`) and `src/**`.',
    'Git: status/diff/log/add/commit/stash, create/switch `design/*` branches, push `design/*` branches. No force push, no `--no-verify`, no rebase, no `reset --hard`, no pushing to main/stage.',
    'Never try to work around a Designer Mode block.'
  ].join('\n');
}
