# petdisk-streamer

This is a work in progress, and really just a port of
[petdisk.php](https://github.com/bitfixer/petdisk-max/blob/main/www/petdisk.php)
from
[bitfixer's petdisk-max repository](https://github.com/bitfixer/petdisk-max)
to JavaScript from PHP.

Note that as of this commit, I have not yet plugged in the PETdisk MAX to make
sure this works. This is mostly a port of existing code, and there are a couple
of modes I need to validate came over properly.

## Why?

No judgment at all on PHP. I didn't want to create a Apache/PHP container, and
instead, wanted an application to spool up easily. Was this more work than
getting a container set up? Unfortunately.

## Usage

In a moment, probably use docker.

For now:

Make sure Node v12 or higher is installed, along with npm for dependency
management.

Create a directory at `disks` to store disk images and prg/seq files, or find
an appropriate directory.

Edit `petdisk.js` to change the library location, and/or the listen port or
whether this is in readonly mode.

Run `npm i` to install dependencies.

Run `npm run start` to start the streamer.