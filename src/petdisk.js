import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import { customAlphabet } from 'nanoid';
import os from 'os';
import path from 'path';
import * as url from 'url';

import * as commands from './commands.js';
import * as log from './log.js';

const nanoid = customAlphabet('1234567890abcdef', 10);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const TIME = 'TIME';

// Output debug statements
const DEBUG = process.env.PD_DEBUG && process.env.PD_DEBUG === 'true' ? true : false;

// HTTP listen port
const PORT = process.env.PD_PORT ? parseInt(process.env.PD_PORT) : 3000;

// Readonly mode
const PETDISK_READ_ONLY = process.env.PD_READ_ONLY && process.env.PD_READ_ONLY === 'true' ? true : false;

// Path where files and disk images are located
const LIBRARY = process.env.PD_LIBRARY || path.resolve(path.join(__dirname, '..', 'library'));

// Maximum number of bytes per page
const MAX_PAGE_SIZE = process.env.PD_MAX_PAGE_SIZE ? parseInt(process.env.PD_MAX_PAGE_SIZE) : 512;

log.setDebug(DEBUG);
commands.setLibrary(LIBRARY);
commands.setMaxPageSize(MAX_PAGE_SIZE);

if (!fs.existsSync(LIBRARY)) {
  console.error(`Disk library at "${LIBRARY}" does not exist, exiting`);
  process.exit(1);
}

function badRequest(res, id, message) {
  log.error(id, message);
  res
    .status(400)
    .send("No");
}

const app = express();

app.all('*', (req, res, next) => {
  const id = nanoid();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  log.info(id, `${req.method} request received from ${ip}`);
  log.debug(id, `Path: ${req.path}, Query: ${JSON.stringify(req.query)}`);
  req['id'] = id;
  next();
});

app.get('/', (req, res) => {
  res.set('Content-Type', 'application/octet-stream');

  const cmdDirectory = req.query.d && req.query.d == 1;
  const filename = req.query.file;
  const cmdTime = filename && filename === TIME;

  if (cmdDirectory) {
    return commands.getDirectory(req, res);
  } else if (cmdTime) {
    return commands.getTime(req, res);
  } else if (filename) {
    return commands.getFile(req, res);
  }
  return commands.no(req, res);
});

app.put('/', (req, res) => {
  const id = req.id;

  if (PETDISK_READ_ONLY) {
    // ignore writes for read only mode
    log.info(id, `Read only is true, stopping`);
    return;
  }

  const filename = req.query.f;
  const isB64 = req.query.b64;
  const cmdNew = req.query.n;
  const cmdUpdate = req.query.u;

  if (!isValidFilename(filename)) {
    badRequest(res, id, `Bad filename: ${filename}`);
    return;
  }

  const writePath = path.join(LIBRARY, filename);
  let exists = fs.existsSync(writePath);

  const toWrite = isB64 ? Buffer.from(req.body, 'base64') : req.body;
  if (!toWrite.length) {
    badRequest(res, id, `Sent no body, nothing to update or append to`);
    return;
  }

  // remove existing file if new specified
  if (exists && cmdNew) {
    log.info(id, `Removed existing file: ${writePath}`);
    fs.unlinkSync(writePath);
    exists = false;
  }

  if (cmdUpdate) {
    // update specific block
    const start = parseInt(req.query.s);
    const end = parseInt(req.query.e);
    if (exists) {
      log.info(id, `Updating existing file: ${writePath} from ${start} to ${end}`);

      const tempFileName = path.join(os.tmpdir(), nanoid());
      const fTempWrite = fs.createWriteStream(tempFileName, { flags: 'w+' });
      const fRead = fs.createReadStream(writePath, { start: end + 1 });
      fRead.pipe(fTempWrite);
      fTempWrite.on('finish', () => {
        const fTempRead = fs.createReadStream(tempFileName);
        var fWrite = fs.createWriteStream(writePath, { start: start, flags: 'r+' });
        fWrite.write(toWrite);
        fTempRead.pipe(fWrite);
        res.send("");
      });
    } else {
      badRequest(res, id, `Attempted to update non-existent file: ${writePath}`);
      return;
    }
  } else {
    log.info(id, `Appending to path: ${writePath} with ${toWrite.length} bytes`);
    // append block to end of file
    fs.appendFileSync(writePath, toWrite);
    res.send("");
  }
});

app.disable('x-powered-by');
app.use(bodyParser.raw({ inflate: true, limit: '1440kb', type: '*/*' }));
app.listen(PORT, () => {
  console.log(`PETdisk MAX Streamer listening on port ${PORT}`);
});
