import fs from 'fs';
import path from 'path';

import * as log from './log.js';

let LIBRARY = './library';
let MAX_PAGE_SIZE = 512;

export function setLibrary(library) {
  LIBRARY = library;
}

export function setMaxPageSize(maxPageSize) {
  MAX_PAGE_SIZE = maxPageSize;
}

export function getTime(req, res) {
  const cmdLength = req.query.l && req.query.l == 1;

  const current = new Date().toISOString().replace("T", " ").replace(/\..+/, '');
  if (cmdLength) {
    log.info(req.id, `Sent file TIME length`)
    res.send(current.length + "\r\n");
  } else {
    log.info(req.id, `Sent file TIME as ${current}`)
    res.send(current + "\n");
  }
  return;
}

export function getFile(req, res) {
  const cmdLength = req.query.l && req.query.l == 1;
  const filename = req.query.file;

  if (!isValidFilename(filename)) {
    badRequest(res, req.id, `Bad filename: ${filename}`);
    return;
  }

  const file = retrieveFile(filename);
  if (file) {
    log.info(req.id, `File ${filename} found as ${file}`);
    if (cmdLength) {
      const fileSize = fs.statSync(file).size;
      log.info(req.id, `Sending length of ${fileSize}`);
      res.send(fileSize + "\r\n");
      return;

    } else if (req.query.s && req.query.e) {
      const start = parseInt(req.query.s);
      const end = parseInt(req.query.e);
      log.info(req.id, `Sending from ${start} to ${end}`);

      const rs = fs.createReadStream(
        file,
        {
          start: start,
          end: end - 1
        }
      );
      const chunks = [];
      rs.on('data', (chunk) => chunks.push(chunk));
      rs.on('end', () => res.send(Buffer.concat(chunks)));
      return;
    }
  }
  return no(req, res);
}

export function getDirectory(req, res) {
  const page = req.query.p ? parseInt(req.query.p) : 0;
  log.info(req.id, `Directory listing requested for page ${page}`);

  // Only include files ending in the allowed extensions
  const allowedExtensions = ['prg', 'seq', 'd64'];
  const fileList = fs.readdirSync(LIBRARY)
    .filter((fn) => {
      const ext = path.extname(fn).toLowerCase().replace('.', '');
      if (allowedExtensions.includes(ext)) {
        return true;
      }
      return false;
    })
    .map((fn) => fn.toUpperCase() + "\n");

  // Split list into blocks of MAX_PAGE_SIZE bytes
  const pages = [];
  let pageIterator = 0;
  for (const filename of fileList) {
    pages[pageIterator] ??= '';
    if (pages[pageIterator].length + filename.length > MAX_PAGE_SIZE) {
      pageIterator++;
    }
    pages[pageIterator] = pages[pageIterator] + filename;
  }

  // Directory list ends with two linefeeds
  res.send((pages[page] || '') + "\n");
  return;
}

export function no(req, res) {
  res
    .status(404)
    .send("No");
  return;
}

function isValidFilename(filename) {
  return !(filename.includes('/') || filename.includes('\\'));
}

function retrieveFile(requestedFileName) {
  const fileList = fs
    .readdirSync(LIBRARY)
    .filter((fn) => fn.toLowerCase() == requestedFileName.toLowerCase());
  if (fileList && fileList[0]) {
    return path.join(LIBRARY, fileList[0]);
  }
  return;
}

function badRequest(res, id, message) {
  log.error(id, message);
  res
    .status(400)
    .send("No");
}