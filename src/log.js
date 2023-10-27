let DEBUG = false;

export function setDebug(debug) {
  DEBUG = debug;
}

export function info(id, message) {
  log('INFO ', id, message);
}

export function error(id, message) {
  log('ERROR', id, message);
}

export function debug(id, message) {
  if (DEBUG) {
    log('DEBUG', id, message);
  }
}

function log(level, id, message) {
  const now = new Date().toISOString();
  console.info(`${level} ${now} ${id}: ${message}`);
}