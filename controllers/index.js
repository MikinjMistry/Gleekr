var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var jwt = require('jsonwebtoken');
var twilio = require('twilio');
var VoiceResponse = twilio.twiml.VoiceResponse;
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
 * @apiSuccess {Number} Success 422, 417 : Fail and 200 : Success.
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
                    message: "Error in find OTP"
                };
                res.status(422).json(result);
            }
            if (otpData) {
                var json = {code: code, modified_datetime: new Date()};
                otp.update({_id: {$eq: otpData._id}}, {$set: json}, function (err, responce) {
                    if (err) {
                        result = {
                            message: "Error in updating OTP"
                        };
                        res.status(422).json(result);
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
                            message: "Error in inserting OTP"
                        };
                        res.status(422).json(result);
                    } else {
                        sendMessage(req.body.mobileNo, code, res);
                    }
                });
            }
        });
    } else {
        result = {
            message: errors
        };
        res.status(417).json(result);
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
 * @apiSuccess {Number} Success 400,401,422,417 : Fail and 200 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} Token.
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
                    message: "Error in finding user with otp"
                };
                res.status(422).json(result);
            }
            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                console.log("duration:", duration);
                console.log("otptime:", config.OTP_EXPIRETION);
                if (duration > config.OTP_EXPIRETION) {
                    var result = {
                        message: "Your OTP code is expired"
                    };
                    res.status(401).json(result);
                } else if (otpData.code == req.body.otp) {
                    json = {mobileNo: otpData.mobileNo};
                    user.findOne({mobileNo: otpData.mobileNo}, function (err, userData) {
                        if (err) {
                            result = {
                                message: "Error in finding User"
                            };
                            res.status(422).json(result);
                        }
                        if (userData) {
                            var userJson = {id: userData._id, mobileNo: userData.mobileNo};
                            var token = jwt.sign(userJson, config.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            otp.remove({_id: otpData._id}, function (err) {
                                if (err) {
                                    result = {
                                        message: "Error in deleteing OTP"
                                    };
                                    res.status(422).json(result);
                                }
                                var result = {
                                    message: "OTP is verified successfully",
                                    token: token
                                };
                                res.status(200).json(result);
                            })
                        } else {
                            var userObject = new user(json);
                            userObject.save(function (err, responce) {
                                if (err) {
                                    result = {
                                        message: "User is already regster with gleekr"
                                    };
                                    res.status(400).json(result);
                                } else {
                                    var userJson = {id: responce._id, mobileNo: responce.mobileNo};
                                    var token = jwt.sign(userJson, config.JWT_SECRET, {
                                        expiresIn: 60 * 60 * 24 // expires in 24 hours
                                    });
                                    otp.remove({_id: otpData._id}, function (err) {
                                        if (err) {
                                            result = {
                                                message: "Error in deleteing OTP"
                                            };
                                            res.status(422).json(result);
                                        }
                                        var result = {
                                            message: "OTP is verified successfully",
                                            token: token
                                        };
                                        res.status(200).json(result);
                                    })
                                }
                            });
                        }
                    });

                } else {
                    var result = {
                        message: "OTP is wrong"
                    };
                    res.status(400).json(result);
                }
            } else {
                var result = {
                    message: "Mobile number has not requested for sendOTP"
                };
                res.status(400).json(result);
            }
        });
    } else {
        var result = {
            message: erros
        };
        res.status(417).json(result);
    }
});


/**
 * @api {post} /voiceCall
 * @apiName Send OTP through call
 * @apiGroup Root
 * 
 * @apiParam {String} mobileNo mobile number with contry code
 * 
 * @apiSuccess {Number} Success 400,422,500 : Fail and 200 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} Error error message.
 */
router.post('/voiceCall',function(req, res,next){
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
        var url = 'http://'+config.REMOTE_HOST+':'+config.node_port+'/outbound/' + encodeURIComponent(req.body.mobileNo);

        var options = {
            to: req.body.mobileNo,
            from:config.TWILIO_NUMBER,
            url: url,
        };
        console.log("option:",options);
        client.calls.create(options).then((message) => {
            res.status(200).json({
                message: 'OTP has been sent via call on given number.',
            });
        }).catch((error) => {
            res.status(500).json(error);
        });
    } else {
        result = {
            message : errors
        };
        res.status(400).json(result);
    }
});

router.post('/outbound/:mobileNo', function(request, response) {
    var mobileNo = request.params.mobileNo;
    var twimlResponse = new VoiceResponse();
    var code = Math.floor(1000 + Math.random() * 9000);
    otp.findOne({mobileNo: mobileNo}, function (err, otpData) {
        if (err) {
            result = {
                message: "Error in find OTP"
            };
            res.status(422).json(result);
        }
        if (otpData) {
            var json = {code: code, modified_datetime: new Date()};
            otp.update({_id: {$eq: otpData._id}}, {$set: json}, function (err, responce) {
                if (err) {
                    result = {
                        message: "Error in updating OTP"
                    };
                    res.status(422).json(result);
                } else {
                    twimlResponse.say('Your Gleekr OTP is '+code,
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
                    result = {
                        message: "Error in inserting OTP"
                    };
                    res.status(422).json(result);
                } else {
                    twimlResponse.say('Your Gleekr OTP is '+code,
                      { voice: 'alice' });
                    twimlResponse.dial(mobileNo);
                    response.send(twimlResponse.toString());
                }
            });
        }
    });
    
});
// Send OTP to provided number
var sendMessage = function (number, code, res) {
    var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: 'Use ' + code + ' as Gleekr account security code'
    }, function (error, message) {
        if (!error) {
            result = {
                message: "OTP has been sent successfully."
            };
            res.status(200).json(result);
        } else {
            var result = {
                message: "Error in sending sms."
            };
            res.status(422).json(result);
        }
    });
}

module.exports = router;
