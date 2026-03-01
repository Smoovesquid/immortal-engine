/**
 * Canon Log
 * The only authoritative source of canonical entity creation.
 * No surface may become canonical without a logged event.
 */


const ALLOWED_CANON_EVENT_TYPES = ['CANON_CREATE'];
function validateCanonEvent(event) {
    if (!event || typeof event !== 'object') {
        throw new Error('CanonLog: invalid event');
    }
    if (typeof event.id !== 'string') {
        throw new Error('CanonLog: invalid event id');
    }
    if (typeof event.type !== 'string' || !ALLOWED_CANON_EVENT_TYPES.includes(event.type)) {
        throw new Error('CanonLog: invalid event type');
    }
    if (typeof event.targetId !== 'string') {
        throw new Error('CanonLog: invalid targetId');
    }
}

function createCanonLog() {
  return {
    events: []
  };
}

function appendCanonEvent(log, event) {
 validateCanonEvent(event);

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
