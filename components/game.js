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
  if(row.hasOwnProperty('gametype')) game.gameType = row.gametype;
  return game;
}

function groupIdFromUser(user){
  return `user-${user.username}`;
}

function inGameTime(game){
  let curTime = new Date(), limitTime = new Date(game.startTime);
  limitTime.setMinutes(limitTime.getMinutes() + game.timeLimit);
  return (game.gameType == "completion" || curTime < limitTime) && game.startTime > game.endTime;
}

function inGameQuitTime(game){
  let curTime = new Date(), limitTime = new Date(game.startTime);
  limitTime.setSeconds(limitTime.getSeconds() + 20);
  return curTime < limitTime;
}


function filterGameStats(game){
  if(!game.endPos){
    delete game.endPos;
    if(inGameTime(game)) delete game.solPos;
  }
  return game;
}

function genImageUrl(pos, direction, meta = false){
  let baseUrl = 'https://maps.googleapis.com/maps/api/streetview';
  if(meta) baseUrl += '/metadata';
  return `${baseUrl}?` + new URLSearchParams({
    size: '300x300',
    location: `${pos.latitude},${pos.longitude}`,
    heading: direction,
    key: process.env.MAPS_API
  });
}

async function getPosInRadius(startPos, radiusLimit, cb){
  for(let i = 0; i < 5; i++){
    let pos = randomLocation.randomCirclePoint(startPos, radiusLimit);
    let url = genImageUrl(pos, 0, true);
    let metadata = await fetch(url).then((data) => data.json());
    if(metadata.status === 'OK') return cb(null, metadata.location);
  }
  cb({'location': 'loc not found'});
}

function allUserGames(user, cb){
  let groupId = groupIdFromUser(user);
  db.all('SELECT * FROM games WHERE groupid = ?', [
    groupId,
  ], (e, rows) => {
    if(e) return cb(e);
    games = rows.map((row) => filterGameStats(gameFromRow(row)));
    cb(null, games);
  });
}

function newGame(user, startPos, radiusLimit, timeLimit, gameType, cb){
  getPosInRadius(startPos, radiusLimit, (e, solPos) => {
    if(e) return cb(e);

    let gameId = crypto.randomBytes(10).toString('hex');
    let groupId = user ? groupIdFromUser(user) : 'anonymous';
    let startTime = new Date();

    db.run('INSERT INTO games (gameid, groupId, startpos, solpos, starttime, radiuslimit, timelimit, gametype) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      gameId,
      groupId,
      JSON.stringify(startPos),
      JSON.stringify(solPos),
      startTime,
      radiusLimit,
      timeLimit,
      gameType,
    ], (e) => {
      if(e) return cb(e);   
      cb(null, {gameId: gameId, startTime: startTime});
    });
  });
}

function quitGame(gameId, cb){
  db.get('SELECT solpos,starttime,timelimit,endtime,gametype FROM games WHERE gameid = ?', [
    gameId
  ], (e, row) => {
    if(e) return cb(e);
    row = gameFromRow(row);
    if(!inGameTime(row)){
      return cb({time: 'out of time'});
    }
    if(!inGameQuitTime(row)){
      return cb({time: 'no quitting now'});
    }

    db.run('DELETE FROM games WHERE gameid = ?', [
      gameId
    ], (e) => {
      if(e) return cb(e);
      cb(null);
    });
  });
}

function submitGame(gameId, endPos, cb){
  db.get('SELECT solpos,starttime,timelimit,endtime,gametype FROM games WHERE gameid = ?', [
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
  quitGame: quitGame,
  submitGame: submitGame,
  imageStream: imageStream
}
