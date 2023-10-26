const express = require('express');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

// HTTP listen port
const PORT = 3000;

// Readonly mode
const PETDISK_READ_ONLY = false;

// Path where disk images are located
const DISK_LIBRARY = 'disks';

// Maximum number of files per page
const MAX_PAGE_SIZE = 512;


const TIME = 'TIME';
const app = express();
app.disable('x-powered-by');

if (!fs.existsSync(DISK_LIBRARY)) {
  console.error(`Disk library at "${DISK_LIBRARY}" does not exist, exiting`);
  process.exit(1);
}

function retrieveFile(requestedFileName) {
  const fullpath = path.join(
    DISK_LIBRARY,
    requestedFileName.replace(/\//g, '')
  );
  if (fs.existsSync(fullpath)) {
    return fullpath;
  }
  console.error(`Invalid file: ${requestedFileName}`);
  return;
}

function fileLength(res, file) {
  let fileSize = 0;
  if (file === TIME) {
    // length of time field
    // this will be YYYY-MM-DD HH:mm:ss\n
    fileSize = "YYYY-MM-DD HH:mm:ss\n".length();
  } else {
    fileSize = fs.statSync(file).size;
  }
  res.send(`${fileSize}\r\n`);
}

function fileGet(res, file, start, end) {
  const rs = fs.createReadStream(
    file,
    {
      start: start,
      end: end
    }
  );
  rs.pipe(res);
}

function directoryGet(res, page) {
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
    res.send(filename + "\n");
  }
}

app.get('/', (req, res) => {
  const id = uuid.v4();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.info(`${id}: Request received from ${ip}`);
  res.set('content-type', 'application/octet-stream');

  if (req.query.file) {
    console.info(`${id}: For file ${req.query.file}`);

    if (req.query.file === TIME) {
      res.send(new Date().toISOString().replace("T", " ").replace(/\..+/, '') + "\n");
      return;
    }

    const file = retrieveFile(req.query.file);
    if (file) {
      console.info(`${id}: File ${file} found`);
      if (req.query.l && req.query.l == 1) {
        console.info(`${id}: File ${file} sent length`);
        fileLength(res, file);
        return;

      } else if (req.query.d && req.query.d == 1) {
        const page = req.query.p ? parseInt(req.query.p) : 1;
        console.info(`${id}: Directory listing requested for page ${page}`);
        directoryGet(res, page);
        return;

      } else if (req.query.s && req.query.e) {
        const start = parseInt(req.query.s);
        const end = parseInt(req.query.e);
        console.info(`${id}: File ${file} sent from ${start} to ${end}`);
        fileGet(res, file, start, end);
        return;
      }
    }
  }
  res.status(404);
  res.send("No");
});

app.put('/', (req, res) => {
  if (PETDISK_READ_ONLY) {
      // ignore writes for read only mode
      return;
  }
});

app.listen(PORT, () => {
  console.log(`PETdisk MAX Streamer listening on port ${PORT}`);
});