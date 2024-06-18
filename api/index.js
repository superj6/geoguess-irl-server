const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const ensureLogIn = require('connect-ensure-login').ensureLoggedIn

const game = require('../components/game');
const auth = require('../components/auth');

const router = express.Router();

passport.use(new LocalStrategy(auth.verify));

router.post('/auth/login', passport.authenticate('local', {
  failureRedirect: '/auth/login',
  failureMessage: true
}), (req, res) => {
  res.status(200).send('ok');
});

router.post('/auth/register', (req, res) => {
  auth.addUser(req.body.username, req.body.password, (e) => {
    if(e) return res.status(400).send(e);
    var user = {username: req.body.username};
    req.login(user, (e) => {
      if (e) return res.status(400).send(e);
      res.status(200).send('ok');
    }); 
  });
});

router.post('/auth/logout', ensureLogIn('/auth/login'), (req, res, next) => {
  req.logout((e) => {
    if(e) return next(e);
    res.status(200).send('ok');
  });
});

router.get('/user/stats', ensureLogIn('/auth/login'), (req, res) => {
  game.allUserGames(req.user, (e, games) => {
    if(e) return res.send(e);
    res.json(games);
  });
});

router.post('/game/new', ensureLogIn('/auth/login'), (req, res) => {
  game.newGame(req.user, req.body.startPos, req.body.radiusLimit, req.body.timeLimit, (e, game) => {
    if(e) return res.status(400).send(e);
    res.json(game);
  });
});

router.post('/game/:gameid/submit', (req, res) => {
  game.submitGame(req.params.gameid, req.body.endPos, (e, game) => {
    res.json(game);
  });
});

router.get('/game/:gameid/image', (req, res) => {
  game.imageStream(req.params.gameid, req.query.direction || 0, (e, stream) => {
    if(e) return res.send(e);
    stream.pipe(res);
  });
});

module.exports = router;
