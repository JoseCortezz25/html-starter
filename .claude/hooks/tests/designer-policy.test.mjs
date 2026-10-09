/**
 * Unit tests for the Designer Mode policy. Run: `pnpm test:guards`.
 * Uses a virtual project dir and a fake baseline, so no git is required.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeBash,
  checkPath,
  classifyPath,
  evaluateFileChange,
  evaluatePushUpdates,
  evaluateStagedChanges,
  isDesignBranch,
  isDesignRef,
  parsePatchTargets,
  tokenizeShell
} from '../lib/designer-policy.mjs';

const projectDir = '/virtual/html-starter';
const baseline = new Set(['public/favicon.svg', 'public/images/hero.png']);
const repo = {
  isPreexisting: rel => {
    const lower = rel.toLowerCase();
    return [...baseline].some(
      path => path === lower || path.startsWith(`${lower}/`)
    );
  }
};
const options = { cwd: projectDir, projectDir, repo };

const allowed = command => analyzeBash(command, options).allow;
const assertAllowed = commands => {
  for (const command of commands)
    assert.equal(allowed(command), true, `expected ALLOW: ${command}`);
};
const assertBlocked = commands => {
  for (const command of commands)
    assert.equal(allowed(command), false, `expected BLOCK: ${command}`);
};

describe('branches', () => {
  it('detects design branches and refs', () => {
    assert.equal(isDesignBranch('design/hero'), true);
    assert.equal(isDesignBranch('design/'), false);
    assert.equal(isDesignBranch('main'), false);
    assert.equal(isDesignBranch('feature/design/x'), false);
    assert.equal(isDesignRef('refs/heads/design/hero'), true);
    assert.equal(isDesignRef('refs/tags/design/v1'), false);
    assert.equal(isDesignRef('refs/heads/main'), false);
  });
});

describe('classifyPath', () => {
  const cases = {
    '.claude/settings.json': 'protected',
    '.opencode/plugins/designer-guard.js': 'protected',
    '.agents/skills/x/SKILL.md': 'protected',
    '.husky/pre-push': 'protected',
    '.git/config': 'protected',
    'docs/specs/a.md': 'protected',
    'CLAUDE.md': 'protected',
    'claude.md': 'protected',
    'AGENTS.md': 'protected',
    'README.md': 'protected',
    'MIGRATION.md': 'protected',
    'RULES.md': 'protected',
    'package.json': 'protected',
    'pnpm-lock.yaml': 'protected',
    'tsconfig.json': 'protected',
    'tsconfig.node.json': 'protected',
    'vite.config.ts': 'protected',
    'eslint.config.mjs': 'protected',
    'commitlint.config.ts': 'protected',
    '.prettierrc.json': 'protected',
    '.env': 'protected',
    '.env.local': 'protected',
    'src/.env': 'protected',
    'opencode.json': 'protected',
    '.mcp.json': 'protected',
    '.gitignore': 'protected',
    public: 'public-root',
    'public/': 'public-root',
    'public/favicon.svg': 'public',
    'index.html': 'editable',
    'about.html': 'editable',
    'src/main.ts': 'editable',
    'src/styles/main.css': 'editable',
    'src/docs/notes.md': 'editable',
    'src/README.md': 'editable',
    '': 'root'
  };
  for (const [path, expected] of Object.entries(cases)) {
    it(`${path || '(root)'} -> ${expected}`, () =>
      assert.equal(classifyPath(path), expected));
  }
  it('outside project', () => assert.equal(classifyPath(null), 'outside'));
});

describe('checkPath / file tools', () => {
  it('blocks protected files', () => {
    assert.equal(
      checkPath('.claude/hooks/designer-guard.mjs', 'write', repo).allow,
      false
    );
    assert.equal(
      evaluateFileChange('package.json', options, repo).allow,
      false
    );
    assert.equal(
      evaluateFileChange(`${projectDir}/CLAUDE.md`, options, repo).allow,
      false
    );
    assert.equal(
      evaluateFileChange(`${projectDir}/src/../AGENTS.md`, options, repo).allow,
      false
    );
  });
  it('allows pages and src', () => {
    assert.equal(
      evaluateFileChange(`${projectDir}/index.html`, options, repo).allow,
      true
    );
    assert.equal(
      evaluateFileChange(
        'src/styles/components/atoms/button.css',
        options,
        repo
      ).allow,
      true
    );
  });
  it('blocks files outside the project', () => {
    assert.equal(evaluateFileChange('/etc/hosts', options, repo).allow, false);
    assert.equal(
      evaluateFileChange('../other/index.html', options, repo).allow,
      false
    );
  });
  it('public: new files ok, pre-existing locked, folder locked', () => {
    assert.equal(
      evaluateFileChange('public/images/new.png', options, repo).allow,
      true
    );
    assert.equal(
      evaluateFileChange('public/favicon.svg', options, repo).allow,
      false
    );
    assert.equal(
      evaluateFileChange('public/FAVICON.svg', options, repo).allow,
      false
    );
    assert.equal(checkPath('public', 'delete', repo).allow, false);
    assert.equal(checkPath('public', 'move', repo).allow, false);
    assert.equal(checkPath('public/images', 'delete', repo).allow, false);
    assert.equal(checkPath('public/mine', 'delete', repo).allow, true);
    assert.equal(checkPath('public/new.svg', 'delete', repo).allow, true);
  });
  it('rejects a missing path', () => {
    assert.equal(evaluateFileChange(undefined, options, repo).allow, false);
  });
});

describe('apply_patch targets', () => {
  it('parses add/update/move/delete markers', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: src/a.ts',
      '+x',
      '*** Update File: public/favicon.svg',
      '*** Move to: public/icon.svg',
      '*** Delete File: CLAUDE.md',
      '*** End Patch'
    ].join('\n');
    assert.deepEqual(parsePatchTargets(patch), [
      { path: 'src/a.ts', op: 'write' },
      { path: 'public/favicon.svg', op: 'move' },
      { path: 'public/icon.svg', op: 'write' },
      { path: 'CLAUDE.md', op: 'delete' }
    ]);
  });
});

describe('shell lexer', () => {
  it('splits segments and redirects', () => {
    const { segments, complex } = tokenizeShell(
      'echo hi > out.txt && cat a | grep b; ls 2>/dev/null'
    );
    assert.equal(complex, null);
    assert.equal(segments.length, 4);
    assert.equal(segments[0].redirects[0].target.value, 'out.txt');
  });
  it('flags command substitution', () => {
    assert.notEqual(tokenizeShell('rm $(cat list)').complex, null);
    assert.notEqual(tokenizeShell('echo `whoami`').complex, null);
  });
  it('treats heredoc bodies as data', () => {
    const command =
      'git commit -m "$(cat <<\'EOF\'\nfeat: hero\n\nrm -rf .claude\nEOF\n)"';
    assert.equal(tokenizeShell(command).complex, null);
    assert.equal(allowed(command), true);
  });
});

describe('bash: everyday designer workflow is allowed', () => {
  it('dev commands', () => {
    assertAllowed([
      'pnpm dev',
      'pnpm build',
      'pnpm preview',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm format',
      'pnpm run dev',
      'pnpm test:guards',
      'pnpm install',
      'pnpm install --frozen-lockfile',
      'pnpm exec prettier --check .',
      'npx prettier --write src/styles/main.css index.html',
      'pnpm exec prettier --write src',
      'npx tsc --noEmit',
      'PORT=4000 pnpm dev',
      'npm run build'
    ]);
  });
  it('read-only commands', () => {
    assertAllowed([
      'ls -la',
      'cat index.html',
      'grep -rn "hero" src',
      'find src -name "*.css"',
      'head -n 20 src/main.ts | tail -5',
      'pwd && ls public',
      'cat CLAUDE.md',
      'ls 2>/dev/null',
      'pnpm build 2>&1 | tail -20'
    ]);
  });
  it('file commands on editable paths', () => {
    assertAllowed([
      'mkdir -p src/styles/components/organisms',
      'touch src/styles/components/atoms/badge.css',
      'cp public/favicon.svg public/favicon-alt.svg',
      'mv src/a.css src/b.css',
      'rm src/styles/components/atoms/old.css',
      'echo "x" > src/notes.txt',
      'mkdir -p public/images/team',
      'curl -o public/images/photo.jpg https://example.com/photo.jpg',
      'rm public/images/my-new-photo.png',
      'cd src && touch styles/x.css'
    ]);
  });
  it('git workflow', () => {
    assertAllowed([
      'git status',
      'git diff',
      'git log --oneline -5',
      'git add .',
      'git add index.html src',
      'git commit -m "feat(hero): new layout"',
      'git commit -am "style: tweak"',
      'git stash',
      'git stash pop',
      'git checkout -b design/new-hero',
      'git switch -c design/footer',
      'git switch design/footer',
      'git checkout design/hero',
      'git branch design/x',
      'git branch',
      'git branch -a',
      'git branch -d design/old',
      'git push',
      'git push -u origin design/hero',
      'git push origin HEAD',
      'git push origin design/a:design/a',
      'git pull',
      'git pull origin main',
      'git fetch',
      'git merge main',
      'git restore index.html',
      'git reset',
      'git reset --soft HEAD~1',
      'git config user.name "Ana"',
      'git config --list',
      'git rebase --abort',
      'git remote -v'
    ]);
  });
});

describe('bash: protected paths are blocked', () => {
  it('writes and deletions', () => {
    assertBlocked([
      'rm -rf .claude',
      'rm .claude/hooks/designer-guard.mjs',
      'rm -rf .',
      'rm -rf *',
      'rm -rf ./*',
      'mv CLAUDE.md OLD.md',
      'cp /tmp/x .claude/settings.json',
      'echo "{}" > package.json',
      'echo x >> .gitignore',
      'cat foo | tee AGENTS.md',
      'sed -i "" "s/a/b/" vite.config.ts',
      'sed -i.bak s/a/b/ tsconfig.json',
      'chmod +x .husky/pre-push',
      'ln -s /tmp/x .opencode/plugins/x.js',
      'touch .env',
      'truncate -s 0 README.md',
      'find . -name "*.md" -delete',
      'find . -exec rm {} \\;',
      'cd .claude && rm settings.json',
      'cd docs; touch x.md',
      'mkdir .vscode',
      'cp index.html docs/',
      'rm -r docs',
      'npx prettier --write .',
      'pnpm exec eslint --fix',
      'eslint --fix eslint.config.mjs',
      'pnpm lint --fix',
      'echo x > ~/outside.txt',
      'echo x > ../outside.txt',
      'curl -o package.json https://example.com/x'
    ]);
  });
  it('public folder and pre-existing public files', () => {
    assertBlocked([
      'rm -rf public',
      'mv public assets',
      'rm public/favicon.svg',
      'mv public/favicon.svg public/old.svg',
      'echo x > public/favicon.svg',
      'cp other.svg public/favicon.svg',
      'rm -r public/images',
      'rm public/*',
      'npx prettier --write public'
    ]);
  });
});

describe('bash: git outside the designer scope is blocked', () => {
  it('push rules', () => {
    assertBlocked([
      'git push origin main',
      'git push origin stage',
      'git push origin staging',
      'git push origin HEAD:main',
      'git push origin design/x:main',
      'git push --force',
      'git push -f origin design/x',
      'git push -uf origin design/x',
      'git push --force-with-lease',
      'git push --force-with-lease=design/x origin design/x',
      'git push origin +design/x',
      'git push origin :design/x',
      'git push --delete origin design/x',
      'git push --all',
      'git push --tags',
      'git push --mirror',
      'git push --no-verify',
      'git push origin v1.0.0'
    ]);
  });
  it('history rewriting, hooks and branches', () => {
    assertBlocked([
      'git commit --no-verify -m "x"',
      'git commit -n -m "x"',
      'git commit -anm "x"',
      'git reset --hard',
      'git reset --hard origin/main',
      'git rebase main',
      'git rebase -i HEAD~3',
      'git pull --rebase',
      'git config core.hooksPath /dev/null',
      'git config --unset core.hooksPath',
      'git config alias.p "!rm -rf .claude"',
      'git -c core.hooksPath=/dev/null commit -m x',
      'git checkout main',
      'git checkout stage',
      'git checkout -b feature/x',
      'git switch main',
      'git switch -c hotfix',
      'git checkout -',
      'git checkout --detach',
      'git checkout main -- .claude/settings.json',
      'git branch feature/x',
      'git branch -D main',
      'git branch -m main old-main',
      'git branch -u origin/main',
      'git clean -fd',
      'git rm package.json',
      'git rm --cached CLAUDE.md',
      'git mv README.md docs/README.md',
      'git restore --source=main CLAUDE.md',
      'git restore .claude/settings.json',
      'git fetch origin main:main',
      'git tag v1',
      'git remote add evil https://x',
      'git worktree add ../x',
      'git apply patch.diff',
      'git filter-branch',
      'git update-ref refs/heads/main HEAD',
      'HUSKY=0 git commit -m x',
      'export HUSKY=0',
      'GIT_DIR=/tmp git status'
    ]);
  });
});

describe('bash: dependencies, scripts and opaque commands are blocked', () => {
  it('blocks', () => {
    assertBlocked([
      'pnpm add lodash',
      'pnpm add -D sass',
      'pnpm install lodash',
      'pnpm i react',
      'pnpm remove gsap',
      'pnpm update',
      'pnpm dlx create-vite',
      'npm install',
      'npm i lodash',
      'yarn add x',
      'npx some-random-package',
      'pnpm prepare',
      'node .claude/hooks/designer-guard.mjs',
      "node -e \"require('fs').rmSync('.claude',{recursive:true})\"",
      'bash -c "rm -rf .claude"',
      'sh script.sh',
      'python3 -c "print(1)"',
      'eval "rm -rf .claude"',
      'xargs rm < list.txt',
      'sudo rm -rf /',
      'rm $(cat files.txt)',
      'rm `cat files.txt`',
      '(cd .claude && rm x)',
      'rm "$TARGET"',
      'wget https://x',
      'rsync -a src/ .claude/',
      'some-unknown-binary --do-things'
    ]);
  });
});

describe('git hooks', () => {
  it('pre-commit flags protected and pre-existing public changes', () => {
    const violations = evaluateStagedChanges(
      [
        { status: 'M', path: 'index.html' },
        { status: 'A', path: 'public/new.png' },
        { status: 'M', path: 'public/favicon.svg' },
        { status: 'D', path: 'public/images/hero.png' },
        { status: 'M', path: 'package.json' },
        { status: 'A', path: '.claude/hooks/evil.mjs' }
      ],
      repo
    );
    assert.deepEqual(
      violations.map(v => v.path),
      [
        'public/favicon.svg',
        'public/images/hero.png',
        'package.json',
        '.claude/hooks/evil.mjs'
      ]
    );
  });
  it('pre-commit allows a clean design commit', () => {
    assert.equal(
      evaluateStagedChanges(
        [
          { status: 'M', path: 'src/styles/main.css' },
          { status: 'A', path: 'public/images/team.jpg' }
        ],
        repo
      ).length,
      0
    );
  });
  it('pre-push rules', () => {
    const zero = '0000000000000000000000000000000000000000';
    const sha = n => String(n).repeat(40);
    const isAncestor = a => (a === sha(1) ? true : a === sha(2) ? false : null);
    const check = update =>
      evaluatePushUpdates([update], isAncestor).length === 0;
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/design/a',
        remoteSha: zero
      }),
      true
    );
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/design/a',
        remoteSha: sha(1)
      }),
      true
    );
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/main',
        remoteSha: sha(1)
      }),
      false
    );
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/stage',
        remoteSha: zero
      }),
      false
    );
    assert.equal(
      check({
        localRef: 'refs/tags/v1',
        localSha: sha(9),
        remoteRef: 'refs/tags/v1',
        remoteSha: zero
      }),
      false
    );
    assert.equal(
      check({
        localRef: '(delete)',
        localSha: zero,
        remoteRef: 'refs/heads/design/a',
        remoteSha: sha(1)
      }),
      false
    );
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/design/a',
        remoteSha: sha(2)
      }),
      false
    );
    assert.equal(
      check({
        localRef: 'refs/heads/design/a',
        localSha: sha(9),
        remoteRef: 'refs/heads/design/a',
        remoteSha: sha(3)
      }),
      false
    );
  });
});
