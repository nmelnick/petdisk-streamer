import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import { customAlphabet } from 'nanoid';
import os from 'os';
import path from 'path';
import * as url from 'url';

const nanoid = customAlphabet('1234567890abcdef', 10);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// Output debug statements
const DEBUG = process.env.PD_DEBUG && process.env.PD_DEBUG === 'true' ? true : false;

// HTTP listen port
const PORT = process.env.PD_PORT ? parseInt(process.env.PD_PORT) : 3000;

// Readonly mode
const PETDISK_READ_ONLY = process.env.PD_READ_ONLY && process.env.PD_READ_ONLY === 'true' ? true : false;

// Path where files and disk images are located
const LIBRARY = process.env.PD_LIBRARY || path.resolve(path.join(__dirname, '..', 'library'));

// Maximum number of files per page
const MAX_PAGE_SIZE = process.env.PD_MAX_PAGE_SIZE ? parseInt(process.env.PD_MAX_PAGE_SIZE) : 512;

const TIME = 'TIME';
if (!fs.existsSync(LIBRARY)) {
  console.error(`Disk library at "${LIBRARY}" does not exist, exiting`);
  process.exit(1);
}

function isValidFilename(filename) {
  return !(filename.includes('/') || filename.includes('\\'));
}

function retrieveFile(requestedFileName) {
  const fullpath = path.join(LIBRARY, requestedFileName);
  if (fs.existsSync(fullpath)) {
    return fullpath;
  }
  console.error(`Invalid file: ${requestedFileName}`);
  return;
}

function startRequest(req) {
  const id = nanoid();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logInfo(id, `${req.method} request received from ${ip}`);
  logDebug(id, `Path: ${req.path}, Query: ${JSON.stringify(req.query)}`);
  return id;
}

function badRequest(res, id, message) {
  logError(id, message);
  res
    .status(400)
    .send("No");
}

function logInfo(id, message) {
  console.info(`INFO  ${id}: ${message}`);
}

function logError(id, message) {
  console.error(`ERROR ${id}: ${message}`);
}

function logDebug(id, message) {
  if (DEBUG) {
    console.info(`DEBUG ${id}: ${message}`);
  }
}

const app = express();
app.disable('x-powered-by');
app.use(bodyParser.raw({ inflate: true, limit: '1440kb', type: '*/*' }));

app.get('/', (req, res) => {
  const id = startRequest(req);
  res.set('content-type', 'application/octet-stream');

  const filename = req.query.file;
  const cmdLength = req.query.l && req.query.l == 1;
  const cmdDirectory = req.query.d && req.query.d == 1;

  if (cmdDirectory) {
    const page = req.query.p ? parseInt(req.query.p) : 1;
    logInfo(id, `Directory listing requested for page ${page}`);

    const allowedExtensions = ['prg', 'seq', 'd64'];
    const fileList = fs.readdirSync(LIBRARY)
      .filter((fn) => {
        const ext = path.extname(fn).replace('.', '');
        if (allowedExtensions.includes(ext)) {
          return true;
        }
        return false;
      })
      .map((fn) => fn.toUpperCase());
    let output = '';
    for (const filename of fileList.slice(page * MAX_PAGE_SIZE - MAX_PAGE_SIZE, MAX_PAGE_SIZE)) {
      output = output + filename + "\n";
    }
    // Directory list ends with two linefeeds
    res.send(output + "\n");
    return;

  } else if (filename) {
    logInfo(id, `For file ${filename}`);

    if (filename === TIME) {
      res.send(new Date().toISOString().replace("T", " ").replace(/\..+/, '') + "\n");
      return;
    }

    if (!isValidFilename(filename)) {
      badRequest(res, id, `Bad filename: ${filename}`);
      return;
    }

    const file = retrieveFile(filename);
    if (file) {
      logInfo(id, `File ${file} found`);
      if (cmdLength) {
        logInfo(id, `File ${file} sent length`);

        let fileSize = 0;
        if (file === TIME) {
          // length of time field
          // this will be YYYY-MM-DD HH:mm:ss\n
          fileSize = "YYYY-MM-DD HH:mm:ss\n".length();
        } else {
          fileSize = fs.statSync(file).size;
        }
        res.send(`${fileSize}\r\n`);
        return;

      } else if (req.query.s && req.query.e) {
        const start = parseInt(req.query.s);
        const end = parseInt(req.query.e);
        logInfo(id, `File ${file} sent from ${start} to ${end}`);

        const rs = fs.createReadStream(
          file,
          {
            start: start,
            end: end
          }
        );
        rs.pipe(res);
        return;
      }
    }
  }
  res
    .status(404)
    .send("No");
});

app.put('/', (req, res) => {
  const id = startRequest(req);

  if (PETDISK_READ_ONLY) {
    // ignore writes for read only mode
    logInfo(id, `Read only is true, stopping`);
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
    logInfo(id, `Removed existing file: ${writePath}`);
    fs.unlinkSync(writePath);
    exists = false;
  }

  if (cmdUpdate) {
    // update specific block
    const start = parseInt(req.query.s);
    const end = parseInt(req.query.e);
    if (exists) {
      logInfo(id, `Updating existing file: ${writePath} from ${start} to ${end}`);

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
    logInfo(id, `Appending to path: ${writePath} with ${toWrite.length} bytes`);
    // append block to end of file
    fs.appendFileSync(writePath, toWrite);
    res.send("");
  }
});

app.listen(PORT, () => {
  console.log(`PETdisk MAX Streamer listening on port ${PORT}`);
});
