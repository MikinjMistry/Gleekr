var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var jwt = require('jsonwebtoken');
var path = require('path');

var User = require("../models/user");
var Otp = require("../models/otp");

require('../helpers/twilio');
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
		// Generate random code
        var code = Math.floor(1000 + Math.random() * 9000);
		
        Otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                res.status(422).json({ message: "OTP generation failed" });
            }
            if (otpData) { //re-generate OTP
                var updatedOTP = { code: code, modifiedAt: new Date() };
                Otp.update({ _id: { $eq: otpData._id } }, { $set: updatedOTP }, function (err, data) {
                    if (err) {
                        res.status(422).json({ message: "Error occured in generating OTP" });
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            } else { //generate new OTP
                var newOTP = new Otp({
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
        Otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                res.status(422).json({ message: "Invalid OTP" });
            }
            if (otpData) {
                if ( moment().diff( moment( otpData.updated_date ), 'minutes' ) > config.OTP_EXPIRETION ) { // Checking for expiration
                    res.status(401).json({ message: "Your OTP has expired" });
                } else if ( otpData.code == req.body.otp ) {
                    json = { mobileNo: otpData.mobileNo };
                    User.findOne({ mobileNo: otpData.mobileNo, isDeleted:false  }, function (err, userData) {
                        if (err) {
                            res.status(422).json({ message: "Error occured while finding User" });
                        }
                        if (userData) {
                            var userJson = { id: userData._id, mobileNo: userData.mobileNo };
                            var token = jwt.sign(userJson, config.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
							
                            Otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    res.status(422).json({ message: "Error occured in deleteing OTP" });
                                }
                                res.status(200).json({ message: "OTP is verified successfully", token: token });
                            });
                        } else {
                            var userObject = new User(json);
                            userObject.save(function (err, responce) {
                                if (err) {
                                    res.status(400).json({ message: "User is already regster with gleekr" });
                                } else {
                                    var userJson = { id: responce._id, mobileNo: responce.mobileNo };
                                    var token = jwt.sign(userJson, config.JWT_SECRET, {
//                                        expiresIn: 60 * 60 * 24 // expires in 24 hours
                                        expiresIn: 30
                                    });
                                    Otp.remove({ _id: otpData._id }, function (err) {
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
 * @api {post} /voice_call OTP via Call
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

// for twilio voice call callback
router.post('/outbound/:mobileNo', function (request, response) {
    var mobileNo = request.params.mobileNo;
    var code = Math.floor(1000 + Math.random() * 9000);
    Otp.findOne({ mobileNo: mobileNo }, function (err, otpData) {
        if (err) {
            res.status(422).json({ message: "Error in find OTP" });
        }
        if (otpData) {
            var json = { code: code, modified_datetime: new Date() };
            Otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, responce) {
                if (err) {
                    res.status(422).json({ message: "Error in updating OTP" });
                } else {
                    voice_call(mobileNo, code, response);
                }
            });
        } else {
            var otpObject = new Otp({
                'mobileNo': mobileNo,
                'code': code
            });
            otpObject.save(function (err, data) {
                if (err) {
                    res.status(422).json({ message: "Error in inserting OTP" });
                } else {
                    voice_call(mobileNo, code, response);
                }
            });
        }
    });
});

//router.post('/refresh_token',function(req,res,next){
//    var token = req.body.token || req.query.token || req.headers['x-access-token'];
//    if (token) {
//        jwt.verify(token,process.env.JWT_SECRET, function (err, decoded) {
//            if (err) {
//                return res.status(401).json({message: 'Invalid token'});
//            } else {
//                req.userInfo = decoded;
//                next();
//            }
//        });
//    } else {
//        return res.status(400).json({message: 'No token provided'});
//    }
//});
module.exports = router;