var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var jwt = require('jsonwebtoken');
var twilio = require('twilio');
var path = require('path');
var VoiceResponse = twilio.twiml.VoiceResponse;

var user = require("../models/user");
var otp = require("../models/otp");

require('dotenv').config();

/* Include controllers to handle routes */
var users = require('./users');
var activities = require('./activities');
var auth = require('../middlewares/auth');

/* Link controllers with routes */
router.use('/user', auth, users);
router.use('/activities', auth, activities);

/* GET home page. */
router.get('/', function (req, res, next) {
    //res.send({ test: 'hello world' });
    res.sendFile(path.join(__dirname, '../doc', 'index.html'));
});

/**
 * @api {post} /sendotp Send / Re-send OTP - READY
 * @apiName Send / Re-send OTP
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
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
        var code = Math.floor(1000 + Math.random() * 9000);
        otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                res.status(422).json({ message: "OTP generation failed" });
            }
            if (otpData) { //re-generate OTP
                var updatedOTP = { code: code, modifiedAt: new Date() };
                otp.update({ _id: { $eq: otpData._id } }, { $set: updatedOTP }, function (err, data) {
                    if (err) {
                        res.status(422).json({ message: "Error occured in generating OTP" });
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            } else { //generate new OTP
                var newOTP = new otp({
                    'mobileNo': req.body.mobileNo,
                    'code': code
                });
                newOTP.save(function (err, data) {
                    if (err) {
                        res.status(422).json({ message: "Error occured in generating OTP" });
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            }
        });
    } else {
        res.status(417).json({ message: errors });
    }
});


/**
 * @api {post} /verifyotp Verify OTP - READY
 * @apiName Otp verification
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * @apiParam {Number} otp Random four digit code
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess (Success 200) {String} token Unique token which needs to be passed in subsequent requests.
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
        otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                res.status(422).json({ message: "Invalid OTP" });
            }            
            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                
                if (duration > config.OTP_EXPIRETION) {
                    res.status(401).json({ message: "Your OTP has expired" });
                } else if (otpData.code == req.body.otp) {
                    json = { mobileNo: otpData.mobileNo };
                    user.findOne({ mobileNo: otpData.mobileNo }, function (err, userData) {
                        if (err) {
                            res.status(422).json({ message: "Error in finding User" });
                        }
                        if (userData) {
                            var userJson = { id: userData._id, mobileNo: userData.mobileNo };
                            var token = jwt.sign(userJson, config.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    res.status(422).json({ message: "Error in deleteing OTP" });
                                }
                                res.status(200).json({ message: "OTP is verified successfully", token: token });
                            })
                        } else {
                            var userObject = new user(json);
                            userObject.save(function (err, responce) {
                                if (err) {
                                    res.status(400).json({ message: "User is already regster with gleekr" });
                                } else {
                                    var userJson = { id: responce._id, mobileNo: responce.mobileNo };
                                    var token = jwt.sign(userJson, config.JWT_SECRET, {
                                        expiresIn: 60 * 60 * 24 // expires in 24 hours
                                    });
                                    otp.remove({ _id: otpData._id }, function (err) {
                                        if (err) {
                                            res.status(422).json({ message: "Error in deleteing OTP" });
                                        }
                                        res.status(200).json({ message: "OTP is verified successfully", token: token });
                                    })
                                }
                            });
                        }
                    });

                } else {
                    res.status(400).json({ message: "OTP is wrong" });
                }
            } else {
                res.status(400).json({ message: "Mobile number has not requested for sendOTP" });
            }
        });
    } else {
        res.status(417).json({ message: errors });
    }
});

/**
 * @api {post} /voice-call OTP via Call
 * @apiName Send OTP through call
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
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
        var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
        var url = 'http://' + config.REMOTE_HOST + ':' + config.node_port + '/outbound/' + encodeURIComponent(req.body.mobileNo);
        var options = {
            to: req.body.mobileNo,
            from: config.TWILIO_NUMBER,
            url: url,
        };
        client.calls.create(options).then((message) => {
            res.status(200).json({ message: 'OTP has been sent via call on given number.' });
        }).catch((error) => {
            res.status(500).json(error);
        });
    } else {
        res.status(400).json({ message: errors });
    }
});

router.post('/outbound/:mobileNo', function (request, response) {
    var mobileNo = request.params.mobileNo;
    var twimlResponse = new VoiceResponse();
    var code = Math.floor(1000 + Math.random() * 9000);
    otp.findOne({ mobileNo: mobileNo }, function (err, otpData) {
        if (err) {
            res.status(422).json({ message: "Error in find OTP" });
        }
        if (otpData) {
            var json = { code: code, modified_datetime: new Date() };
            otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, responce) {
                if (err) {
                    res.status(422).json({ message: "Error in updating OTP" });
                } else {
                    twimlResponse.say('Your Gleekr OTP is ' + code,
                        { voice: 'alice' });
                    twimlResponse.dial(mobileNo);
                    response.send(twimlResponse.toString());
                }
            });
        } else {
            var json = {
                'mobileNo': mobileNo,
                'code': code
            };
            var otpObject = new otp(json);
            otpObject.save(function (err, data) {
                if (err) {
                    res.status(422).json({ message: "Error in inserting OTP" });
                } else {
                    twimlResponse.say('Your Gleekr OTP is ' + code,
                        { voice: 'alice' });
                    twimlResponse.dial(mobileNo);
                    response.send(twimlResponse.toString());
                }
            });
        }
    });

});

/* Send OTP to provided number */
var sendMessage = function (number, code, res) {
    var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: 'Use ' + code + ' as Gleekr account security code'
    }, function (error, message) {
        if (!error) {
            res.status(200).json({ message: "OTP successfully sent" });
        } else {
            res.status(422).json({ message: "Error in sending OTP" });
        }
    });
}

module.exports = router;