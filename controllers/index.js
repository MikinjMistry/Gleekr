var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var jwt = require('jsonwebtoken');
var path = require('path');
var async = require('async');
var twiliohelper = require('../helpers/twilio');

var User = require("../models/user");
var Otp = require("../models/otp");

/* Include controllers to handle routes */
var users = require('./users');
var activities = require('./activities');
var auth = require('../middlewares/auth');

/* Link controllers with routes */
router.use('/user', auth, users);
router.use('/activity', auth, activities);

/* GET home page. */
router.get('/', function (req, res, next) {
    //res.send({ test: 'hello world' });
    res.sendFile(path.join(__dirname, '../doc', 'index.html'));
});

/**
 * @api {post} /sendotp Send / Re-send OTP
 * @apiName Send / Re-send OTP
 * @apiGroup Root - READY
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * 
 * @apiHeader {String}  Content-Type application/json    
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/sendotp', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "Mobile number is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    var result = {};
    if (!errors) {
        // Generate random code
        var code = Math.floor(1000 + Math.random() * 9000);
        Otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                return next(err);
            }
            if (otpData) { //re-generate OTP
                var updatedOTP = { code: code, modifiedAt: new Date() };
                Otp.update({ _id: { $eq: otpData._id } }, { $set: updatedOTP }, function (err, data) {
                    if (err) {
                        return next(err);
                    } else {
                        twiliohelper.sendSMS(req.body.mobileNo, 'Use ' + code + ' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
                    }
                });
            } else { //generate new OTP
                var newOTP = new Otp({
                    'mobileNo': req.body.mobileNo,
                    'code': code
                });
                newOTP.save(function (err, data) {
                    if (err) {
                        return next(err);
                    } else {
                        twiliohelper.sendSMS(req.body.mobileNo, 'Use ' + code + ' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
                    }
                });
            }
        });
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

/**
 * @api {post} /verifyotp Verify OTP
 * @apiName Otp verification
 * @apiGroup Root - READY
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * @apiParam {Number} otp Random four digit code
 * 
 * @apiHeader {String}  Content-Type application/json
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess (Success 200) {String} token Unique token which needs to be passed in subsequent requests.
 * @apiSuccess (Success 200) {String} refreshToken Unique token which will be used to get a new token
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/verifyotp', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "mobile number is required."
        },
        'otp': {
            notEmpty: true,
            errorMessage: "OTP is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                return next(err);
            }
            if (otpData) {
                if (moment().diff(moment(otpData.updated_date), 'minutes') > config.OTP_EXPIRATION) { // Checking for expiration
                    res.status(401).json({ message: "Your OTP has expired" });
                } else if (otpData.code === req.body.otp) {
                    json = { mobileNo: otpData.mobileNo, isDeleted: false };
                    User.findOne(json, function (err, userData) {
                        if (err) {
                            return next(err);
                        }
                        if (userData) {
                            var userJson = { id: userData._id, mobileNo: userData.mobileNo };
                            var token = jwt.sign(userJson, config.ACCESS_TOKEN_SECRET_KEY, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });

                            Otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    return next(err);
                                }
                                res.status(config.OK_STATUS).json({ message: "OTP is verified successfully", token: token, refreshToken: userData.refreshToken });
                            })
                        } else {
                            var userObject = new User(json);
                            userObject.save(function (err, newUser) {
                                if (err) {
                                    return next(err);
                                } else {
                                    var refreshToken = jwt.sign({ id: newUser._id }, config.REFRESH_TOKEN_SECRET_KEY, {});
                                    async.parallel({
                                        updateToken: function (callback) {
                                            User.update({ _id: { $eq: newUser._id } }, { $set: { 'refreshToken': refreshToken } }, function (err, response) {
                                                if (err) {
                                                    callback({ message: "Error in removing user account" }, null);
                                                }
                                                callback(null, true);
                                            });
                                        },
                                        removeOtp: function (callback) {
                                            Otp.remove({ _id: otpData._id }, function (err) {
                                                if (err) {
                                                    callback({ message: "Error in deleteing OTP" }, null);
                                                }
                                                callback(null, true);
                                            });
                                        }
                                    }, function (err, results) {
                                        if (err) {
                                            return next(err);
                                        }
                                        var userJson = { id: newUser._id, mobileNo: newUser.mobileNo };
                                        var token = jwt.sign(userJson, config.ACCESS_TOKEN_SECRET_KEY, {
                                            expiresIn: 60 * 60 * 24 // expires in 24 hours
                                        });
                                        res.status(config.OK_STATUS).json({ message: "OTP is verified successfully", token: token, refreshToken: refreshToken });
                                    });
                                }
                            });
                        }
                    });
                } else {
                    res.status(config.BAD_REQUEST).json({ message: "Invalid OTP" });
                }
            } else {
                res.status(config.BAD_REQUEST).json({ message: "Invalid OTP" });
            }
        });
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});


/**
 * @api {post} /voice_call OTP via call
 * @apiName Send OTP through call
 * @apiGroup Root - READY
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * 
 * @apiHeader {String}  Content-Type application/json
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/voice_call', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "mobile number is required to made call."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    var result = {};
    if (!errors) {
        var url = 'http://' + config.REMOTE_HOST + ':' + config.node_port + '/outbound/' + encodeURIComponent(req.body.mobileNo);
        twiliohelper.createCall(req.body.mobileNo, url, 'OTP has been sent via call.', res);
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

// for twilio voice call callback
router.post('/outbound/:mobileNo', function (request, response) {
    var mobileNo = request.params.mobileNo;
    var code = Math.floor(1000 + Math.random() * 9000);
    var voiceMsg = 'Your Gleekr OTP is ' + code + ' I repeat Your Gleekr OTP is ' + code;

    Otp.findOne({ mobileNo: mobileNo }, function (err, otpData) {
        if (err) {
            return next(err);
        }
        if (otpData) {
            var json = { code: code, modified_datetime: new Date() };
            Otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, data) {
                if (err) {
                    return next(err);
                } else {
                    twiliohelper.dailCall(mobileNo, voiceMsg, response);
                }
            });
        } else {
            var json = {
                'mobileNo': mobileNo,
                'code': code
            };
            var otpObject = new Otp(json);
            otpObject.save(function (err, data) {
                if (err) {
                    return next(err);
                } else {
                    twiliohelper.dailCall(mobileNo, voiceMsg, response);
                }
            });
        }
    });
});

/**
 * @api {post} /refresh_token Refresh Token
 * @apiName Refresh token
 * @apiGroup Root - READY
 * 
 * @apiHeader {String}  refreshToken 
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess (Success 200) {String} token Unique token which needs to be passed in subsequent requests.
 * @apiSuccess (Success 200) {String} refreshToken Unique token which needs to be passed to generate next access token.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/refresh_token', function (req, res, next) {
    var token = temp = req.body.refreshToken || req.query.refreshToken || req.headers['refreshtoken'];
    if (token) {
        jwt.verify(token, config.REFRESH_TOKEN_SECRET_KEY, function (err, decoded) {
            if (err) {
                return res.status(config.UNAUTHORIZED).json({ message: err.message });
            } else {
                User.findOne({ _id: decoded.id, isDeleted: false }, function (err, userData) {
                    if (err) {
                        return next(err);
                    }
                    if (userData) {
                        if (temp == userData.refreshToken) {
                            var userJson = { id: userData._id, mobileNo: userData.mobileNo };
                            var token = jwt.sign(userJson, config.ACCESS_TOKEN_SECRET_KEY, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            var refreshToken = jwt.sign({ id: userData._id }, config.REFRESH_TOKEN_SECRET_KEY, {});
                            User.update({ _id: { $eq: userData._id } }, { $set: { 'refreshToken': refreshToken } }, function (err, response) {
                                if (err) {
                                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in updating refresh token" });
                                }
                                res.status(config.OK_STATUS).json({ message: "Token refreshed successfully", token: token, refreshToken: refreshToken });
                            });
                        } else {
                            res.status(config.UNAUTHORIZED).json({ message: "Token expired" });
                        }
                    } else {
                        res.status(config.NOT_FOUND).json({ message: "User not found" });
                    }
                });
            }
        });
    } else {
        return res.status(config.UNAUTHORIZED).json({
            message: 'Unauthorized access'
        });
    }
});
module.exports = router;