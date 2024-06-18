const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const SQLiteStore = require('connect-sqlite3')(session)

const api = require('./api');

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const sessionMiddleWare = session({
  secret: process.env.SESSION_SECRET,
  resave: false, // don't save session if unmodified
  saveUninitialized: true, // don't create session until something stored
  store: new SQLiteStore({ db: 'sessions.db', dir: './var/db' })
});

app.use(express.json());
app.use(sessionMiddleWare);
app.use(passport.initialize());
app.use(passport.session());

app.use('/api', api);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/*', (req, res) => {
  res.status(404);
  res.send('Error not found :(');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});
