var express = require('express');
var router = express.Router();

/* Include controllers to handle routes */
var users = require('./users');
var activities = require('./activities');

/* Link controllers with routes */
router.use('/users', require('./users'));
router.use('/activities', require('./activities'));

/* GET home page. */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Express' });
  res.send({test: 'hello world'});
});

module.exports = router;
