/** 在 worker thread 中执行 ZIP 解压，避免阻塞主 HTTP 事件循环。 */

const { parentPort, workerData } = require('node:worker_threads');
const storage = require('./dingtalkBroadcast.storage');

try {
  const result = storage.prepareZipPackageSync(workerData.broadcastId, Buffer.from(workerData.zipBuffer));
  parentPort.postMessage({ success: true, result });
} catch (error) {
  parentPort.postMessage({ success: false, error: error.message });
}
