const passport = require('passport');
const crypto = require('crypto');

const db = require('../db');

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { username: user.username });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

function verify(username, password, cb){
  db.get('SELECT * FROM  users WHERE  username = ?', [ username ], function(err, row){
    if (err) { return cb(err); }
    if (!row) { return cb(null, false, { message: 'Incorrect username or password.' }); }
    
    crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (err) { return cb(err); }
      if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, row);
    });
  });
}

function addUser(username, password, cb){
  var salt = crypto.randomBytes(16);
  crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
    if (err) { return cb(err); }
    db.run('INSERT INTO users (username, hashed_password, salt) VALUES (?, ?, ?)', [
      username,
      hashedPassword,
      salt
    ], cb);
  });  
}

module.exports = {
  verify,
  addUser
};
