# petdisk-streamer

This is a work in progress, and really just a port of
[petdisk.php](https://github.com/bitfixer/petdisk-max/blob/main/www/petdisk.php)
from
[bitfixer's petdisk-max repository](https://github.com/bitfixer/petdisk-max)
to JavaScript from PHP.

What works?
* Listing directories
* Loading files

What doesn't work?
* Saving files -- but I am not certain that normally works?

Please note that this should be run behind a web server on port 80, as the
PETdisk MAX does not support ports in the URL at this time.

## Why?

No judgment at all on PHP. I didn't want to create a Apache/PHP container, and
instead, wanted an application to spool up easily. Was this more work than
getting a container set up? Unfortunately.

## Usage

### Docker:

If necessary, build using `docker build -t nmelnick/petdisk-streamer:latest .`

Create a directory at `library` to store disk images and prg/seq files, or find
an appropriate directory.

Run using
`docker run -p 3000:3000 -v library:/usr/src/app/library nmelnick/petdisk-streamer:latest`

Environment variables can be used to customize options, and added to the docker
run line by one or more `-e` parameters, such as `-e PD_PORT=8080`.

| Variable         | Default   | Description                        |
|------------------|-----------|------------------------------------|
| PD_PORT          | 3000      | HTTP listen port                   |
| PD_DEBUG         | false     | Log debug statements               |
| PD_READ_ONLY     | false     | True if writes are disabled        |
| PD_LIBRARY       | ./library | Location of files to serve         |
| PD_MAX_PAGE_SIZE | 512       | Number of bytes per directory page |

### Locally:

Make sure Node v18 or higher is installed, along with npm for dependency
management.

Create a directory at `library` to store disk images and prg/seq files, or find
an appropriate directory.

Edit `petdisk.js` to change the library location, and/or the listen port or
whether this is in readonly mode.

Run `npm i` to install dependencies.

Run `npm run start` to start the streamer.
