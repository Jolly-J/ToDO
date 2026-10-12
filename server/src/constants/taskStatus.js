const TASK_STATUS = {
  IN_PROGRESS: 'in_progress',
  DELAYED_IN_PROGRESS: 'delayed_in_progress',
  DONE: 'done',
  DELAYED_DONE: 'delayed_done',
  CANCELED: 'canceled',
};

const LEGACY_TODO_STATUS = 'todo';
const TASK_STATUSES = Object.values(TASK_STATUS);
const TASK_STATUS_SET = new Set(TASK_STATUSES);
const COMPLETED_TASK_STATUSES = new Set([TASK_STATUS.DONE, TASK_STATUS.DELAYED_DONE]);
const TERMINAL_TASK_STATUSES = new Set([
  TASK_STATUS.DONE,
  TASK_STATUS.DELAYED_DONE,
  TASK_STATUS.CANCELED,
]);
const DELAYED_TASK_STATUSES = new Set([
  TASK_STATUS.DELAYED_IN_PROGRESS,
  TASK_STATUS.DELAYED_DONE,
]);

function normalizeTaskStatus(status, fallback = TASK_STATUS.IN_PROGRESS) {
  if (!status) return fallback;
  if (status === LEGACY_TODO_STATUS) return TASK_STATUS.IN_PROGRESS;
  return TASK_STATUS_SET.has(status) ? status : fallback;
}

function isCompletedTaskStatus(status) {
  return COMPLETED_TASK_STATUSES.has(status);
}

function isTerminalTaskStatus(status) {
  return TERMINAL_TASK_STATUSES.has(status);
}

function isDelayedTaskStatus(status) {
  return DELAYED_TASK_STATUSES.has(status);
}

module.exports = {
  TASK_STATUS,
  TASK_STATUSES,
  LEGACY_TODO_STATUS,
  normalizeTaskStatus,
  isCompletedTaskStatus,
  isTerminalTaskStatus,
  isDelayedTaskStatus,
};
