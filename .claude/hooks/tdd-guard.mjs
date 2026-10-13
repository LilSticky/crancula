#!/usr/bin/env node
// TDD guards for Claude Code hooks.
//
//   node .claude/hooks/tdd-guard.mjs pre-edit  (PreToolUse on Edit|Write|MultiEdit)
//     Blocks edits to production code while no test file is changed in the working tree,
//     so a failing test must exist before implementation (red before green).
//
//   node .claude/hooks/tdd-guard.mjs stop      (Stop)
//     Runs lint and unit tests when code changed, and keeps the turn going while they fail,
//     so nothing is reported done while red.
//
// Exit code 2 blocks the action; stderr is fed back to Claude.
import { execSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

/** Directories holding production code that falls under TDD. */
const GUARDED_DIRS = ['src/', 'app/', 'api/'];
/** Production code file types. */
const GUARDED_EXTENSIONS = ['.ts', '.html', '.scss', '.js', '.mjs'];
/** Files that are tests themselves. */
const TEST_FILE = /(\.spec\.ts$)|(^e2e\/)/;
/** Files exempt from the guard: config, generated or declaration-only files. */
const EXEMPT = [
  /\.d\.ts$/,
  /^src\/environments\//,
  /^src\/tsconfig\..*\.json$/,
  /^app\/package(-lock)?\.json$/,
  /^src\/assets\//,
];

/** @returns {Promise<Record<string, unknown>>} */
async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** @param {string} cwd @returns {string[]} changed and untracked paths, repo-relative with forward slashes */
function changedFiles(cwd) {
  const out = execSync('git status --porcelain --untracked-files=all', { cwd, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
}

/** @param {string} path */
function isGuarded(path) {
  return (
    GUARDED_DIRS.some((dir) => path.startsWith(dir)) &&
    GUARDED_EXTENSIONS.some((ext) => path.endsWith(ext)) &&
    !TEST_FILE.test(path) &&
    !EXEMPT.some((pattern) => pattern.test(path))
  );
}

/** @param {Record<string, any>} input */
function preEdit(input) {
  const cwd = input.cwd ?? process.cwd();
  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== 'string') return 0;

  const path = relative(cwd, resolve(cwd, filePath)).replace(/\\/g, '/');
  if (!isGuarded(path)) return 0;

  const changedTests = changedFiles(cwd).filter((file) => TEST_FILE.test(file));
  if (changedTests.length > 0) return 0;

  process.stderr.write(
    `TDD guard: blocked edit to production file "${path}" because no test file is changed in the working tree.\n` +
      'Write or extend a failing test first (*.spec.ts for Vitest, e2e/ for Playwright), run it and confirm it fails ' +
      'for the expected reason, then implement. Use the test-first agent or the tdd skill.\n',
  );
  return 2;
}

/** @param {string} command @param {string} cwd @returns {string | null} output on failure, null on success */
function run(command, cwd) {
  try {
    execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    // An empty unit test suite is not red (e.g. only e2e tests changed so far).
    if (output.includes('No tests found matching')) return null;
    return output.split('\n').slice(-60).join('\n');
  }
}

/** @param {Record<string, any>} input */
function stop(input) {
  // Do not block a second time in a row; Claude already got the failure and may need to hand back to the user.
  if (input.stop_hook_active) return 0;

  const cwd = input.cwd ?? process.cwd();
  const codeChanged = changedFiles(cwd).some((file) => isGuarded(file) || TEST_FILE.test(file));
  if (!codeChanged) return 0;

  for (const command of ['npm run lint', 'npm run test']) {
    const failure = run(command, cwd);
    if (failure !== null) {
      process.stderr.write(
        `TDD guard: "${command}" fails. Do not report the task as done while red. ` +
          'Fix it, or tell the user explicitly that it is still red and why (e.g. you are in the red phase on purpose).\n\n' +
          failure,
      );
      return 2;
    }
  }
  return 0;
}

const mode = process.argv[2];
const input = await readInput();
process.exit(mode === 'pre-edit' ? preEdit(input) : mode === 'stop' ? stop(input) : 0);
