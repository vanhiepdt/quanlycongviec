import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const source = path.resolve('..', 'deploy/restart.sh');
const temporary = [];
const shellPath = (value) =>
  process.platform === 'win32'
    ? value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase())
    : value;

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    if (
      path.dirname(directory) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('qlcv-restart-test-')
    )
      throw new Error('Unsafe test cleanup');
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(failure = '', args = []) {
  const root = mkdtempSync(path.join(path.resolve(tmpdir()), 'qlcv-restart-test-'));
  temporary.push(root);
  for (const directory of ['deploy', 'bin', '.git', 'server/storage'])
    mkdirSync(path.join(root, directory), { recursive: true });
  copyFileSync(source, path.join(root, 'deploy/restart.sh'));
  writeFileSync(path.join(root, 'deploy/docker-compose.yml'), 'services: {}\n');
  writeFileSync(path.join(root, 'deploy/.env'), 'LOCAL_TEST_ONLY=yes\n');
  const stub = (name, body) =>
    writeFileSync(path.join(root, 'bin', name), '#!/usr/bin/env bash\nset -e\n' + body, {
      mode: 0o755,
    });
  stub('uname', 'echo Linux\n');
  if (process.platform === 'win32') {
    stub('mkdir', '/usr/bin/mkdir -p "${@: -1}"\n');
    stub(
      'mktemp',
      '/usr/bin/mkdir -p "$QLCV_BACKUP_ROOT/restart-fixture"; echo "$QLCV_BACKUP_ROOT/restart-fixture"\n'
    );
  }
  stub(
    'git',
    `case "$*" in *--git-path*) echo .git/qlcv-restart.lock;; *--short*) echo test123;; esac\n`
  );
  stub('flock', 'exit 0\n');
  stub('curl', `case "$*" in *healthcheck*) echo true;; *) echo '{"ok":true,"db":"up"}';; esac\n`);
  stub(
    'docker',
    `printf '%s\\n' "$*" >> "$QLCV_TEST_LOG"
case "$*" in
 inspect*) echo healthy;;
 *'exec -T db sh -c'*) [[ "$QLCV_TEST_FAIL" != backup ]] || exit 12; printf 'test dump';;
 *'exec -T db pg_restore --list'*) cat >/dev/null;;
 *'build app') [[ "$QLCV_TEST_FAIL" != build ]] || exit 13;;
 *'run --rm --no-deps -T app npm run migrate:up') [[ "$QLCV_TEST_FAIL" != migrate ]] || exit 14;;
esac\n`
  );
  const log = path.join(root, 'commands.log');
  const result = spawnSync(
    bash,
    [
      '--noprofile',
      '--norc',
      '-c',
      'script=$1; shift; export PATH="$QLCV_TEST_BIN:$PATH"; source "$script" "$@"',
      'qlcv-test',
      shellPath(path.join(root, 'deploy/restart.sh')),
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        PATH: path.join(root, 'bin') + path.delimiter + process.env.PATH,
        QLCV_TEST_LOG: shellPath(log),
        QLCV_TEST_BIN: shellPath(path.join(root, 'bin')),
        QLCV_TEST_FAIL: failure,
        QLCV_BACKUP_ROOT: shellPath(path.join(root, 'backups')),
      },
    }
  );
  return { result, root, commands: existsSync(log) ? readFileSync(log, 'utf8') : '' };
}

describe('restart VPS không reset dữ liệu và dừng khi lỗi', () => {
  it('backup/build trước stop, migrate trước app; giữ file cấu hình', () => {
    const { result, root, commands } = run();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const operations = [
      'exec -T db sh -c',
      'build app',
      'stop app onlyoffice',
      'up -d --force-recreate db onlyoffice',
      'run --rm --no-deps -T app npm run migrate:up',
      'up -d --force-recreate app',
    ];
    const indices = operations.map((operation) => commands.indexOf(operation));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((left, right) => left - right));
    expect(commands).not.toMatch(/down|prune|seed|volume rm/);
    expect(readFileSync(path.join(root, 'deploy/.env'), 'utf8')).toBe('LOCAL_TEST_ONLY=yes\n');
    expect(readdirSync(path.join(root, 'backups'))).toHaveLength(1);
  });
  it.each(['backup', 'build', 'migrate'])(
    'lỗi %s không bật app sai trạng thái và trả thất bại',
    (failure) => {
      const { result, commands } = run(failure);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`buoc ${failure}`);
      expect(commands).not.toContain('up -d --force-recreate app');
      if (failure !== 'migrate') expect(commands).not.toContain('stop app onlyoffice');
    }
  );
  it('--check chỉ đọc trạng thái, không backup/build/stop/migrate', () => {
    const { result, root, commands } = run('', ['--check']);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(commands).not.toMatch(/build|stop|force-recreate|migrate|pg_dump/);
    expect(existsSync(path.join(root, 'backups'))).toBe(false);
  });
});
