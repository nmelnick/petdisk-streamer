const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const uuid = require('uuid');

// HTTP listen port
const PORT = 3000;

// Readonly mode
const PETDISK_READ_ONLY = false;

// Path where files and disk images are located
const DISK_LIBRARY = path.resolve(path.join(__dirname, '..', 'library'));

// Maximum number of files per page
const MAX_PAGE_SIZE = 512;

const TIME = 'TIME';
if (!fs.existsSync(DISK_LIBRARY)) {
  console.error(`Disk library at "${DISK_LIBRARY}" does not exist, exiting`);
  process.exit(1);
}

function isValidFilename(filename) {
  if (filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  return true;
}

function retrieveFile(requestedFileName) {
  const fullpath = path.join(DISK_LIBRARY, requestedFileName);
  if (fs.existsSync(fullpath)) {
    return fullpath;
  }
  console.error(`Invalid file: ${requestedFileName}`);
  return;
}

function startRequest(req) {
  const id = uuid.v4();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.info(`${id}: ${req.method} request received from ${ip}`);
  return id;
}

function badRequest(res, message) {
  console.error(message);
  res
    .status(400)
    .send("No");
}


const app = express();
app.disable('x-powered-by');
app.use(bodyParser.raw({ inflate: true, limit: '1440kb', type: '*/*' }));

app.get('/', (req, res) => {
  const id = startRequest(req);
  res.set('content-type', 'application/octet-stream');

  if (req.query.file) {
    const filename = req.query.file;
    console.info(`${id}: For file ${filename}`);

    if (filename === TIME) {
      res.send(new Date().toISOString().replace("T", " ").replace(/\..+/, '') + "\n");
      return;
    }

    if (!isValidFilename(filename)) {
      badRequest(res, `${id}: Bad filename: ${filename}`);
      return;
    }

    const file = retrieveFile(filename);
    if (file) {
      console.info(`${id}: File ${file} found`);
      if (req.query.l && req.query.l == 1) {
        console.info(`${id}: File ${file} sent length`);

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

      } else if (req.query.d && req.query.d == 1) {
        const page = req.query.p ? parseInt(req.query.p) : 1;
        console.info(`${id}: Directory listing requested for page ${page}`);

        const allowedExtensions = ['prg', 'seq', 'd64'];
        const fileList = fs.readdirSync(DISK_LIBRARY)
          .filter((fn) => {
            const ext = path.extname(fn).replace('.', '');
            if (allowedExtensions.includes(ext)) {
              return true;
            }
            return false;
          })
          .map((fn) => fn.toUpperCase());
        for (const filename of fileList.slice(page * MAX_PAGE_SIZE - MAX_PAGE_SIZE, MAX_PAGE_SIZE)) {
          res.write(filename + "\n");
        }
        res.send();
        return;

      } else if (req.query.s && req.query.e) {
        const start = parseInt(req.query.s);
        const end = parseInt(req.query.e);
        console.info(`${id}: File ${file} sent from ${start} to ${end}`);

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
      console.info(`${id}: Read only is true, stopping`);
      return;
  }

  const filename = req.query.f;
  if (!isValidFilename(filename)) {
    badRequest(res, `${id}: Bad filename: ${filename}`);
    return;
  }

  const isNew = req.query.n;
  const isUpdate = req.query.u;
  const isB64 = req.query.b64;

  const writePath = path.join(DISK_LIBRARY, filename);
  let exists = fs.existsSync(writePath);

  const toWrite = isB64 ? Buffer.from(req.body, 'base64') : req.body;
  if (!toWrite.length) {
    badRequest(res, `${id}: Sent no body, nothing to update or append to`);
    return;
  }

  // remove existing file if new specified
  if (exists && isNew) {
    console.info(`${id}: Removed existing file: ${writePath}`);
    fs.unlinkSync(writePath);
    exists = false;
  }

  if (isUpdate) {
    // update specific block
    const start = parseInt(req.query.s);
    const end = parseInt(req.query.e);
    if (exists) {
      console.info(`${id}: Updating existing file: ${writePath} from ${start} to ${end}`);

      const tempFileName = path.join(os.tmpdir(), uuid.v4());
      const fWrite = fs.createWriteStream(tempFileName, {flags: 'w+'});
      const fRead = fs.createReadStream(writePath, {start: end+1});
      fRead.pipe(fWrite);
      fWrite.on('finish', () => {
        const fRead2 = fs.createReadStream(tempFileName);
        var fWrite2 = fs.createWriteStream(writePath, {start: start, flags: 'r+'});
        fWrite2.write(toWrite);
        fRead2.pipe(fWrite2);
        res.send("");
      });
    } else {
      badRequest(`${id}: Attempted to update non-existent file: ${writePath}`);
      return;
    }
  } else {
    console.info(`${id}: Appending to path: ${writePath} with ${toWrite.length} bytes`);
    // append block to end of file
    fs.appendFileSync(writePath, toWrite);
    res.send("");
  }
});

app.listen(PORT, () => {
  console.log(`PETdisk MAX Streamer listening on port ${PORT}`);
});

