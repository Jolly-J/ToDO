const { execFileSync } = require('node:child_process');

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function uniqPids(pids) {
  return [...new Set(pids)].filter(Number.isInteger);
}

function findPortPids(port, options = {}) {
  const runCommand = options.execFileSyncImpl ?? execFileSync;

  try {
    const output = runCommand('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    });

    return output
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter(Number.isInteger);
  } catch (error) {
    if (error && error.status === 1) {
      return [];
    }

    throw error;
  }
}

function waitForPortRelease(port, options = {}) {
  const findPortPidsImpl = options.findPortPids ?? findPortPids;
  const timeoutMs = options.timeoutMs ?? 3000;
  const intervalMs = options.intervalMs ?? 100;
  const stableMs = options.stableMs ?? 0;
  const sleepImpl = options.sleep ?? sleep;
  const deadline = Date.now() + timeoutMs;
  let freeSince = null;

  while (Date.now() <= deadline) {
    if (findPortPidsImpl(port).length === 0) {
      if (stableMs <= 0) {
        return;
      }

      freeSince = freeSince ?? Date.now();

      if (Date.now() - freeSince >= stableMs) {
        return;
      }
    } else {
      freeSince = null;
    }

    sleepImpl(intervalMs);
  }

  const pids = uniqPids(findPortPidsImpl(port));
  const pidHint = pids.length > 0 ? `，仍被进程 ${pids.join(', ')} 占用` : '';
  throw new Error(`端口 ${port} 释放超时${pidHint}，请手动检查占用进程`);
}

function killPid(pid, options = {}) {
  const processKill = options.processKill ?? process.kill;
  const signal = options.signal ?? 'SIGKILL';

  processKill(pid, signal);
}

function isProcessGoneError(error) {
  return error && error.code === 'ESRCH';
}

function tryKillPid(pid, signal, killPidImpl) {
  try {
    killPidImpl(pid, {
      signal,
    });
    return true;
  } catch (error) {
    if (isProcessGoneError(error)) {
      return false;
    }

    throw error;
  }
}

function ensurePortsAvailable(ports, options = {}) {
  const findPortPidsImpl = options.findPortPids ?? findPortPids;
  const killPidImpl = options.killPid ?? killPid;
  const waitForPortReleaseImpl = options.waitForPortRelease ?? waitForPortRelease;
  const logger = options.logger ?? console.log;
  const sleepImpl = options.sleep ?? sleep;
  const forceTimeoutMs = options.forceTimeoutMs ?? 8000;
  const termGraceMs = options.termGraceMs ?? 250;
  const loopIntervalMs = options.loopIntervalMs ?? 100;
  const stableMs = options.stableMs ?? 300;
  const probeTimeoutMs = options.probeTimeoutMs ?? 600;

  for (const port of ports) {
    const deadline = Date.now() + forceTimeoutMs;
    const terminated = new Set();

    while (Date.now() <= deadline) {
      const pids = uniqPids(findPortPidsImpl(port));

      if (pids.length === 0) {
        if (terminated.size === 0) {
          break;
        }

        waitForPortReleaseImpl(port, {
          findPortPids: findPortPidsImpl,
          timeoutMs: Math.max(loopIntervalMs, deadline - Date.now()),
          intervalMs: loopIntervalMs,
          stableMs,
          sleep: sleepImpl,
        });
        break;
      }

      for (const pid of pids) {
        if (tryKillPid(pid, 'SIGTERM', killPidImpl)) {
          terminated.add(pid);
        }
      }

      sleepImpl(termGraceMs);

      const survivors = uniqPids(findPortPidsImpl(port));
      for (const pid of survivors) {
        if (tryKillPid(pid, 'SIGKILL', killPidImpl)) {
          terminated.add(pid);
        }
      }

      const remainingWindow = Math.max(loopIntervalMs, deadline - Date.now());
      try {
        waitForPortReleaseImpl(port, {
          findPortPids: findPortPidsImpl,
          timeoutMs: Math.min(probeTimeoutMs, remainingWindow),
          intervalMs: loopIntervalMs,
          stableMs,
          sleep: sleepImpl,
        });
        break;
      } catch (error) {
        if (Date.now() > deadline) {
          throw error;
        }
      }
    }

    if (terminated.size > 0) {
      logger(`[dev] 端口 ${port} 被占用，已强制终止进程 ${[...terminated].join(', ')}`);
    }
  }
}

module.exports = {
  ensurePortsAvailable,
  findPortPids,
  killPid,
  waitForPortRelease,
};
