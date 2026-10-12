const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function unfoldIcsLines(icsText) {
  return String(icsText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function getIcsValue(line) {
  const index = line.indexOf(':');
  return index >= 0 ? line.slice(index + 1).trim() : '';
}

function normalizeIcsDate(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eachDateInExclusiveRange(startDate, endDate) {
  const dates = [];
  if (!startDate) {
    return dates;
  }

  const actualEndDate = endDate || addDays(startDate, 1);
  let cursor = startDate;
  let guard = 0;
  while (cursor < actualEndDate && guard < 400) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

function extractEvents(icsText) {
  const events = [];
  let current = null;

  for (const line of unfoldIcsLines(icsText)) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (!current) {
      continue;
    }

    if (line.startsWith('DTSTART')) {
      current.startDate = normalizeIcsDate(getIcsValue(line));
    } else if (line.startsWith('DTEND')) {
      current.endDate = normalizeIcsDate(getIcsValue(line));
    } else if (line.startsWith('SUMMARY')) {
      current.summary = getIcsValue(line);
    } else if (line.startsWith('DESCRIPTION')) {
      current.description = getIcsValue(line);
    }
  }

  return events;
}

function resolveWorkdayFlag(event) {
  const text = `${event.description || ''} ${event.summary || ''}`;
  if (text.includes('班')) {
    return true;
  }
  if (text.includes('休')) {
    return false;
  }
  return null;
}

function buildWorkdayOverridesFromIcs(icsText) {
  const overrides = new Map();

  for (const event of extractEvents(icsText)) {
    const isWorkday = resolveWorkdayFlag(event);
    if (isWorkday === null || !event.startDate) {
      continue;
    }

    for (const date of eachDateInExclusiveRange(event.startDate, event.endDate)) {
      overrides.set(date, {
        isWorkday,
        name: event.summary || event.description || '',
      });
    }
  }

  return overrides;
}

function normalizeDateInput(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value || '').slice(0, 10);
}

function isChinaWorkday(dateInput, overrides = new Map()) {
  const dateText = normalizeDateInput(dateInput);
  if (!dateText) {
    return false;
  }

  const override = overrides instanceof Map ? overrides.get(dateText) : null;
  if (override && typeof override.isWorkday === 'boolean') {
    return override.isWorkday;
  }

  const day = new Date(`${dateText}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

module.exports = {
  buildWorkdayOverridesFromIcs,
  isChinaWorkday,
};
