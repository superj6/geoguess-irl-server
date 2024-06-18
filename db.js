const sqlite3 = require('sqlite3');
const mkdirp = require('mkdirp');
const crypto = require('crypto');

mkdirp.sync('./var/db');
const db = new sqlite3.Database('./var/db/geoguess-irl.db');
//const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    hashed_password BLOB,
    salt BLOB,
    gamegroups BLOB
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    gameid TEXT UNIQUE,
    groupid TEXT,
    startpos BLOB,
    endpos BLOB,
    solpos BLOB,
    starttime DATE,
    endtime DATE,
    radiuslimit INTEGER,
    timelimit INTEGER
  );`);
});

module.exports = db;

