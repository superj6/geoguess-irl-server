const fs = require('fs');
const crypto = require('crypto');
const stream = require('stream');
const randomLocation = require('random-location');

const db = require('../db');

function gameFromRow(row){
  let game = {};
  if(row.hasOwnProperty('gameid')) game.gameId = row.gameid;
  if(row.hasOwnProperty('groupid')) game.groupId = row.groupid;
  if(row.hasOwnProperty('startpos')) game.startPos = JSON.parse(row.startpos);
  if(row.hasOwnProperty('endpos')) game.endPos = JSON.parse(row.endpos);
  if(row.hasOwnProperty('solpos')) game.solPos = JSON.parse(row.solpos);
  if(row.hasOwnProperty('starttime')) game.startTime = new Date(row.starttime);
  if(row.hasOwnProperty('endtime')) game.endTime = new Date(row.endtime);
  if(row.hasOwnProperty('radiuslimit')) game.radiusLimit = row.radiuslimit;
  if(row.hasOwnProperty('timelimit')) game.timeLimit = row.timelimit;
  return game;
}

function inGameTime(game){
  let curTime = new Date(), limitTime = new Date(game.startTime);
  limitTime.setMinutes(limitTime.getMinutes() + game.timeLimit);
  return curTime < limitTime && game.startTime > game.endTime;
}

function genImageUrl(solPos, direction){
  return 'https://maps.googleapis.com/maps/api/streetview?' + new URLSearchParams({
    size: '300x300',
    location: `${solPos.latitude},${solPos.longitude}`,
    heading: direction,
    key: process.env.MAPS_API
  });
}

function allUserGames(user, cb){
  let groupId = user.username;
  db.all('SELECT * FROM games WHERE groupid = ?', [
    groupId,
  ], (e, rows) => {
    if(e) return cb(e);
    games = rows.map((row) => gameFromRow(row));
    cb(null, games);
  });
}

function newGame(user, startPos, radiusLimit, timeLimit, cb){
  let gameId = crypto.randomBytes(10).toString('hex');
  let groupId = user.username;
  let solPos = randomLocation.randomCirclePoint(startPos, radiusLimit);
  let startTime = new Date();

  db.run('INSERT INTO games (gameid, groupId, startpos, solpos, starttime, radiuslimit, timelimit) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    gameId,
    groupId,
    JSON.stringify(startPos),
    JSON.stringify(solPos),
    startTime,
    radiusLimit,
    timeLimit
  ], (e) => {
    if(e) return cb(e);   
    cb(null, {gameId: gameId, startTime: startTime});
  });
}

function submitGame(gameId, endPos, cb){
  db.get('SELECT solpos,starttime,timelimit,endtime FROM games WHERE gameid = ?', [
    gameId
  ], (e, row) => {
    if(e) return cb(e);
    row = gameFromRow(row);
    if(!inGameTime(row)){
      return cb({time: 'out of time'});
    }

    let endTime = new Date();

    db.run('UPDATE games SET endpos = ?, endtime = ? WHERE gameid = ?', [
      JSON.stringify(endPos), 
      endTime, 
      gameId
    ], (e) => {
      if(e) return cb(e);
      cb(null, {solPos: row.solPos, endTime: endTime});
    });
  });
}

function imageStream(gameId, direction, cb){
  db.get('SELECT solpos,starttime,timelimit,endtime FROM games WHERE gameid = ?', [
    gameId
  ], (e, row) => {
    if(e) return cb(e);
    row = gameFromRow(row);
    if(!inGameTime(row)){
      return cb({time: 'out of time'});
    }

    let url = genImageUrl(row.solPos, direction);
    fetch(url).then((data) => {
      let dataStream = stream.Readable.fromWeb(data.body);
      cb(null, dataStream);
    });
  });
}

module.exports = {
  allUserGames: allUserGames,
  newGame: newGame,
  submitGame: submitGame,
  imageStream: imageStream
}
