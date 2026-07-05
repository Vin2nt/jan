var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

var DATA_FILE = path.join(__dirname, '..', 'data.json');
var data = loadData();

function loadData() {
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    return [];
  }

  return [];
}

function writeData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function syncDataToApp(app) {
  if (app) {
    app.locals.data = data;
  }
}

function emitVotesUpdate(req) {
  syncDataToApp(req && req.app);
  var io = req.app.get('io');
  if (io) {
    io.emit('votesUpdated', { data: data });
  }
}

function clearWinner(req) {
  syncDataToApp(req && req.app);
  var io = req.app.get('io');
  if (io) {
    io.emit('timerState', { active: false, startedAt: null, elapsedSeconds: 0, winner: null });
  }
}

function getData() {
  return data;
}

/* GET main page. */
router.get('/', function(req, res, next) {
  syncDataToApp(req.app);
  var message = req.query.message || '';
  var messageType = req.query.type || 'success';
  res.render('main', { title: 'Late-Tracker', data: getData(), message: message, messageType: messageType });
});

/* GET Admin page. */
router.get('/admin', function(req, res, next) {
  syncDataToApp(req.app);
  var message = req.query.message || '';
  var messageType = req.query.type || 'success';
  res.render('admin', { title: 'Admin', data: getData(), message: message, messageType: messageType });
});

/* POST Vote */
router.post('/vote', function(req, res, next) {
  var name = req.body.name ? req.body.name.trim() : '';
  var time = req.body.time ? req.body.time.trim() : '';

  if (!name || !time) {
    return res.redirect('/?message=Name%20und%20Zeit%20sind%20erforderlich&type=error');
  }

  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    return res.redirect('/?message=Die%20Zeit%20muss%20im%20Format%20mm:ss%20sein&type=error');
  }

  if (data.some(function(item) { return item.name === name; })) {
    return res.redirect('/?message=Dieser%20Name%20existiert%20bereits&type=error');
  }

  if (data.some(function(item) { return item.time === time; })) {
    return res.redirect('/?message=Diese%20Zeit%20existiert%20bereits&type=error');
  }

  var formdata = { name: name, time: time };
  data.push(formdata);
  writeData();
  emitVotesUpdate(req);
  res.status(201).redirect('/?message=Stimme%20erfolgreich%20gespeichert&type=success');
});

/* POST Delete Vote */
router.post('/delete', function(req, res, next) {
  var name = req.body.name ? req.body.name.trim() : '';

  if (!name) {
    return res.redirect('/admin?message=Name%20ist%20erforderlich&type=error');
  } else if (!data.some(function(item) { return item.name === name; })) {
    return res.redirect('/admin?message=Dieser%20Name%20existiert%20nicht&type=error');
  }

  data = data.filter(function(item) { return item.name !== name; });
  writeData();
  emitVotesUpdate(req);
  res.status(200).redirect('/admin?message=Stimme%20erfolgreich%20gelöscht&type=success');
});

/* POST Reset Votes */
router.post('/reset', function(req, res, next) {
  data = [];
  writeData();
  emitVotesUpdate(req);
  clearWinner(req);
  res.status(200).redirect('/admin?message=Alle%20Stimmen%20erfolgreich%20zurückgesetzt&type=success');
});

module.exports = router;
