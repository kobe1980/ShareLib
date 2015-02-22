# ShareLib

The aim of this project is to build a mediacenter for synology's NAS.
It allows you to browse your movie library and stream it in your lan and in the wan.

### Dependencies

No Real dependencies, because every module is included

Here is the list of modules included

My own version of [tmdbv3] (https://github.com/kobe1980/node-tmdb.git)
This version is a branch from Raqqa [tmdbv3] (https://github.com/raqqa/node-tmdb.git)

[express] (https://github.com/strongloop/express.git)

[access-log] (https://github.com/bahamas10/node-access-log.git)

[ejs] (https://github.com/mde/ejs.git)

[vid-streamer] (https://github.com/meloncholy/vid-streamer.git)

[serve-favicon] (https://github.com/expressjs/serve-favicon.git)

### Usage

Install from github

Then modify config/config.json to match your environment

modify node_modules/digest/config/digest.key.json to set your own key or file

run node server.js


