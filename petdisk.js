const express = require('express');
const fs = require('fs');
const path = require('path'); 

const app = express();
const port = 3000;
const diskLibrary = "disks";

if (!fs.existsSync(diskLibrary)) {
  console.error(`Disk library at "${diskLibrary}" does not exist, exiting`);
  process.exit(1);
}

function retrieveFile(requestedFileName) {
  const fullpath = path.join(diskLibrary, requestedFileName);
  if (fs.existsSync(fullpath)) {
    return fullpath;
  }
  throw new Error("Invalid file");
}

app.get('/', (req, res) => {
  let file;
  if (req.query.file) {
    if (req.query.file === 'TIME') {
        file = 'TIME';
        res.send("t");
    } else {
        file = retrieveFile(req.query.file);
        res.send("f");
    }
  }
  res.send("OK");
});

app.listen(port, () => {
  console.log(`PETdisk MAX Streamer listening on port ${port}`);
});