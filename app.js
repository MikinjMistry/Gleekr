var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var bodyParserJsonError = require('express-body-parser-json-error');
var config = require('./config');
var db = require('./models/db');
var moment = require('moment');
var moscaServer = require('./mqtt/mqttBroker');

var fileUpload = require('express-fileupload');
var expressValidator = require('express-validator');

//var pushMsg = require('./notification/pushNotification')

var app = express();
app.use(fileUpload());
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(bodyParserJsonError());

// Custom validation
app.use(expressValidator({
    customValidators: {
        startBefore: function (startDate, endDate) {
            startDate = moment(startDate);
            endDate = moment(endDate);
            return moment(startDate).isSameOrBefore(endDate);
        },
        startDateTimeBefore: function (startDateTime, endDateTime) {
            startDate = moment(startDateTime);
            endDate = moment(endDateTime);
            return moment(startDateTime).isBefore(endDateTime);
        }, isArray: function (value) {
            return Array.isArray(value);
        },
//        notEmpty: function (array) {
//            return array.length > 0;
//        }
    }
}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'doc')));
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Use routes and methods from controllers
app.use(require('./controllers'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    console.log("error:",err);
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        console.log("error:",err);
        res.json({
            message: err.message
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    console.log("error:",err);
    res.json({
        message: err.message
    });
});


app.listen((config.node_port || 3000), function () {
    console.log('Listening on port ' + (config.node_port || 3000) + '...');
})

module.exports = app;

