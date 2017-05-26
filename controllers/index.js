var express = require('express');
var router = express.Router();

var moment = require('moment');
var jwt = require('jsonwebtoken');
var twilio = require('twilio');
var user = require("../models/user");
var otp = require("../models/otp");
require('dotenv').config();
/* Include controllers to handle routes */
var users = require('./users');
var activities = require('./activities');
var auth = require('../middlewares/auth');
/* Link controllers with routes */
router.use('/users',auth,users);
router.use('/activities',auth,activities);

/* GET home page. */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Express' });
  res.send({test: 'hello world'});
});

/**
 * @api {post} /sendOTP Send / Re-send OTP
 * @apiName Send / Re-send OTP
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 */
router.post('/sendOTP', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "mobile number is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    var result = {};
    if (!errors) {
        var code = Math.floor(1000 + Math.random() * 9000);
        otp.findOne({mobileNo: req.body.mobileNo}, function (err, otpData) {
            if (err) {
                result = {
                    success: 0,
                    message: "Error in find OTP",
                    error: errors
                };
                res.json(result);
            }
            if (otpData) {
                var json = {code: code, modified_datetime: new Date()};
                otp.update({_id: {$eq: otpData._id}}, {$set: json}, function (err, responce) {
                    if (err) {
                        result = {
                            success: 0,
                            message: "Error in updating OTP",
                            error: err
                        };
                        res.json(result);
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            } else {
                var json = {
                    'mobileNo': req.body.mobileNo,
                    'code': code
                };
                var otpObject = new otp(json);
                otpObject.save(function (err, data) {
                    if (err) {
                        result = {
                            success: 0,
                            message: "Error in inserting OTP",
                            error: err
                        };
                        res.json(result);
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            }
        });
    } else {
        result = {
            success: 0,
            message: "Validation Error",
            error: errors
        };
        res.json(result);
    }
});
/**
 * @api {post} /verifyOTP Verify OTP
 * @apiName Otp verification
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * @apiParam {Number} otp Random four digit code
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} Error error message.
 */
router.post('/verifyOTP', function (req, res, next) {
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
        otp.findOne({mobileNo: req.body.mobileNo}, function (err, otpData) {
            if (err) {
                var result = {
                    success: 0,
                    message: "Error in finding user with otp",
                    error: err
                };
                res.json(result);
            }
            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                console.log("duration:", duration);
                console.log("otptime:", process.env.OTP_EXPIRETION);
                if (duration > process.env.OTP_EXPIRETION) {
                    var result = {
                        success: 0,
                        message: "Your OTP code is expired",
                        error: []
                    };
                    res.json(result);
                } else if (otpData.code == req.body.otp) {
                    json = {mobileNo: otpData.mobileNo};
                    user.findOne({mobileNo: otpData.mobileNo}, function (err, userData) {
                        if (err) {
                            result = {
                                success: 0,
                                message: "Error in finding User",
                                error: err
                            };
                            res.json(result);
                        }
                        if (userData) {
                            var userJson = {id: userData._id, mobileNo: userData.mobileNo};
                            var token = jwt.sign(userJson, process.env.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            otp.remove({_id: otpData._id}, function (err) {
                                if (err) {
                                    result = {
                                        success: 0,
                                        message: "Error in deleteing OTP",
                                        error: err
                                    };
                                    res.json(result);
                                }
                                var result = {
                                    success: 1,
                                    message: "OTP is verified successfully",
                                    token: token
                                };
                                res.json(result);
                            })
                        } else {
                            var userObject = new user(json);
                            userObject.save(function (err, responce) {
                                if (err) {
                                    result = {
                                        success: 0,
                                        message: "User is already regster with gleekr",
                                        error: err
                                    };
                                    res.json(result);
                                } else {
                                    var userJson = {id: responce._id, mobileNo: responce.mobileNo};
                                    var token = jwt.sign(userJson, process.env.JWT_SECRET, {
                                        expiresIn: 60 * 60 * 24 // expires in 24 hours
                                    });
                                    otp.remove({_id: otpData._id}, function (err) {
                                        if (err) {
                                            result = {
                                                success: 0,
                                                message: "Error in deleteing OTP",
                                                error: err
                                            };
                                            res.json(result);
                                        }
                                        var result = {
                                            success: 1,
                                            message: "OTP is verified successfully",
                                            token: token
                                        };
                                        res.json(result);
                                    })
                                }
                            });
                        }
                    });

                } else {
                    var result = {
                        success: 0,
                        message: "OTP is wrong",
                        error: []
                    };
                    res.json(result);
                }
            } else {
                var result = {
                    success: 0,
                    message: "Mobile number has not requested for sendOTP",
                    error: []
                };
                res.json(result);
            }
        });
    } else {
        var result = {
            success: 0,
            message: "Validation Error",
            error: errors
        };
        res.json(result);
    }
});

// Send OTP to provided number
var sendMessage = function (number, code, res) {
    var client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: process.env.TWILIO_NUMBER,
        body: 'Use ' + code + ' as Gleekr account security code'
    }, function (error, message) {
        if (!error) {
            result = {
                success: 1,
                message: "OTP has been sent successfully."
            };
            res.json(result);
        } else {
            var result = {
                success: 0,
                message: "Error in sending sms.",
                error: error
            };
            res.json(result);
        }
    });
}

module.exports = router;
