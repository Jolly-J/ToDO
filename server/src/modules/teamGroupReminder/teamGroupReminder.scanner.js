const logger = require('../../utils/logger');
const service = require('./teamGroupReminder.service');

const SCAN_INTERVAL_MS = 60 * 1000;

let scanTimer = null;
let scanning = false;

async function scan() {
  if (scanning) {
    return;
  }
  scanning = true;
  try {
    await service.scanAndSendDueReminders();
  } catch (error) {
    if (String(error.message || '').includes('no such table')) {
      return;
    }
    logger.error('团队群聊提醒扫描失败', {
      action: 'team_group_reminder.scan.error',
      error: error.message,
    });
  } finally {
    scanning = false;
  }
}

function start() {
  if (scanTimer) {
    return;
  }

  scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
  if (typeof scanTimer.unref === 'function') {
    scanTimer.unref();
  }

  logger.debug('TeamGroupReminderScanner 已启动', {
    action: 'team_group_reminder.scanner.start',
  });
}

function stop() {
  if (!scanTimer) {
    return;
  }
  clearInterval(scanTimer);
  scanTimer = null;
}

module.exports = {
  start,
  stop,
  scan,
};
