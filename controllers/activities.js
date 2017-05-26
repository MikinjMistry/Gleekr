var express = require('express');
var router = express.Router();

var activity = require("../models/activity");


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('Activity controller called!');
});

module.exports = router;
