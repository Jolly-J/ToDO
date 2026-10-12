const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PORTS = {
  CLIENT_PORT: '8821',
  SERVER_PORT: '8344',
};

function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = rawLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    let value = rawLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function normalizePort(value, fallback) {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) ? normalized : fallback;
}

function ensureDevEnv(rootDir) {
  const clientEnvPath = path.join(rootDir, 'client', '.env');
  const serverEnvPath = path.join(rootDir, 'server', '.env');

  const clientParsed = fs.existsSync(clientEnvPath) ? parseEnvFile(fs.readFileSync(clientEnvPath, 'utf8')) : {};
  const serverParsed = fs.existsSync(serverEnvPath) ? parseEnvFile(fs.readFileSync(serverEnvPath, 'utf8')) : {};

  const clientPort = normalizePort(clientParsed.CLIENT_PORT, DEFAULT_PORTS.CLIENT_PORT);
  const serverPort = normalizePort(serverParsed.SERVER_PORT || serverParsed.PORT, DEFAULT_PORTS.SERVER_PORT);

  return {
    envPath: serverEnvPath,
    clientPort,
    serverPort,
  };
}

module.exports = {
  DEFAULT_PORTS,
  ensureDevEnv,
  normalizePort,
  parseEnvFile,
};
