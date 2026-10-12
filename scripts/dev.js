const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const { ensureDevEnv } = require('./dev-env');
const { ensurePortsAvailable } = require('./port-guard');

const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const { envPath, clientPort, serverPort } = ensureDevEnv(rootDir);
const sharedEnv = {
  ...process.env,
  CLIENT_PORT: clientPort,
  SERVER_PORT: serverPort,
  PORT: serverPort,
};

// 强制清理端口占用（自动终止占用进程）
ensurePortsAvailable([Number(clientPort), Number(serverPort)]);

const children = new Map();
let exitCode = 0;
let shuttingDown = false;

// ── 进程管理 ─────────────────────────────────────────────────────────────────

function allChildrenExited() {
  return [...children.values()].every((childState) => childState.exited);
}

function maybeExit() {
  if (allChildrenExited()) {
    process.exit(exitCode);
  }
}

function terminateChildren(signal = 'SIGTERM', excludedName) {
  shuttingDown = true;

  for (const [name, childState] of children.entries()) {
    if (name !== excludedName && !childState.exited && !childState.child.killed) {
      childState.child.kill(signal);
    }
  }

  setTimeout(() => {
    for (const [name, childState] of children.entries()) {
      if (name !== excludedName && !childState.exited && !childState.child.killed) {
        childState.child.kill('SIGKILL');
      }
    }
  }, 1500).unref();
}

function markExited(name) {
  const childState = children.get(name);

  if (childState) {
    childState.exited = true;
  }
}

function runProcess(name, args) {
  const child = spawn(npmCommand, args, {
    cwd: rootDir,
    env: sharedEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.set(name, {
    child,
    exited: false,
  });

  child.on('exit', (code, signal) => {
    markExited(name);

    if (!shuttingDown) {
      exitCode = code ?? (signal ? 1 : 0);
      terminateChildren('SIGTERM', name);
    }

    maybeExit();
  });

  child.on('error', (error) => {
    console.error(`[dev] ${name} 启动失败:`, error);
    exitCode = 1;
    markExited(name);
    terminateChildren('SIGTERM', name);
    maybeExit();
  });

  pipeOutput(name, child.stdout, 'stdout');
  pipeOutput(name, child.stderr, 'stderr');
}

function pipeOutput(name, stream, channel) {
  if (!stream) {
    return;
  }

  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const prefix = `[${name}]`;
      if (channel === 'stderr') {
        process.stderr.write(`${prefix} ${line}\n`);
      } else {
        process.stdout.write(`${prefix} ${line}\n`);
      }
    }
  });

  stream.on('end', () => {
    if (buffer.trim()) {
      const prefix = `[${name}]`;
      process.stdout.write(`${prefix} ${buffer.trim()}\n`);
      buffer = '';
    }
  });
}

process.on('SIGINT', () => {
  exitCode = 130;
  terminateChildren('SIGINT');
  maybeExit();
});

process.on('SIGTERM', () => {
  exitCode = 143;
  terminateChildren('SIGTERM');
  maybeExit();
});

console.log(`[dev] 使用环境文件: ${envPath}`);
console.log(`[dev] 前端端口: ${clientPort}`);
console.log(`[dev] 后端端口: ${serverPort}`);
console.log('[dev] 日志面板: [server] [client]');
console.log('[dev] 通知日志: logs/notification.log');

runProcess('client', ['--prefix', 'client', 'run', 'dev', '--', '--clearScreen', 'false']);
runProcess('server', ['--prefix', 'server', 'run', 'dev']);
