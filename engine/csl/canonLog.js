/**
 * Canon Log
 * The only authoritative source of canonical entity creation.
 * No surface may become canonical without a logged event.
 */

function createCanonLog() {
  return {
    events: []
  };
}

function appendCanonEvent(log, event) {
  if (!event || typeof event.id !== 'string') {
    throw new Error('CanonLog: invalid event');
  }

  if (log.events.find(e => e.id === event.id)) {
    return log; // deterministic dedupe
  }

  return {
    events: [...log.events, event]
  };
}

function isCanonical(log, targetId) {
  return log.events.some(e => e.targetId === targetId);
}

export { createCanonLog, appendCanonEvent, isCanonical };
