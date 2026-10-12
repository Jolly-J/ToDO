/**
 * 环境变量加载器
 *
 * 负责从 server 根目录读取 `.env` 文件并保证只初始化一次。
 */
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) {
    return;
  }

  const serverEnvPath = path.resolve(__dirname, '../../.env');

  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, quiet: true });
  }

  loaded = true;
}

module.exports = {
  loadEnv,
};
