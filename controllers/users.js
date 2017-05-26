var express = require('express');
var router = express.Router();

var twilio = require('twilio');
var moment = require('moment');

var otp = require("../models/otp");
var user = require("../models/user");

var fs = require('fs');
var path = require('path');
require('dotenv').config();

var _ = require('underscore');
var jwt = require('jsonwebtoken');

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
// Send contact card to specified number
var send_card = function (number, msg) {
    var client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: process.env.TWILIO_NUMBER,
        body: msg
    }, function (error, message) {
        if (!error) {
            result = {
                success: 1,
                message: "Contact card has been sent successfully."
            };
        } else {
            var result = {
                success: 0,
                message: "Error in sending sms.",
                error: error
            };
        }
    });
}



/**
 * @api {get} /users Get User profile
 * @apiName User Profile Information
 * @apiGroup User
 *
 * @apiHeader {String}  x-access-token Users unique access-key.
 *
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {Json} data mobile_no,email,image_path,job_title,company_name.
 */
router.get('/', function (req, res, next) {
    user.findOne({'_id': req.userInfo.id}, function (err, user) {
        if (err) {
            result = {
                success: 0,
                message: "Error in get user profile",
                error: err
            };
            res.json(result);
        } else {
            var result = {
                success: 1,
                message: "",
                data: user
            };
            res.json(result);
        }
    });
});

/**
 * @api {delete} /users/deleteAccount Remove user account
 * @apiName Delete User Account
 * @apiGroup User
 *
 * @apiHeader {String}  x-access-token Users unique access-key.
 *
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 */
router.delete('/deleteAccount', function (req, res, next) {
    var json = {'is_deleted': true};
    user.update({_id: {$eq: req.userInfo.id}}, {$set: json}, function (err, responce) {
        if (err) {
            result = {
                success: 0,
                message: "Error in removing use account",
                error: err
            };
            res.json(result);
        } else {
            var result = {
                success: 1,
                message: "Your account removed successfully."
            };
            res.json(result);
        }
    });
});

router.post('/uploadImage', function (req, res, next) {
    file = req.files.file;
    console.log("file:", file);
    if (file) {
        file.mv('./upload/profile.jpg', function (err) {
            if (err) {
                result = {
                    success: 0,
                    message: "Error in profile image upload",
                    error: err
                };
                res.json(result);
            } else {
                result = {
                    success: 1,
                    message: "File is uploaded successfully",
                };
                res.json(result);
            }
        });
    } else {
        result = {
            success: 0,
            message: "Image is not provided",
            error: []
        };
        res.json(result);
    }
});

/**
 * @api {put} /users/updateProfile Update user profile
 * @apiName Update Profile
 * @apiGroup User
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {file} file form-data: file object [jpg,png]
 * @apiParam {String} email  form-data: user email
 * @apiParam {String} job_title form-data: job title 
 * @apiParam {String} company_name form-data:company name
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 */
router.put('/updateProfile', function (req, res, next) {
    var json = req.body;
    var userInfo = req.userInfo;
    if (req.files) {
        var file = req.files.file;
        var dir = "./upload/" + userInfo.id;
        var mimetype = ['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'];
        if (mimetype.indexOf(file.mimetype) != -1) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            extention = path.extname(file.name);
            filename = new Date().getTime() + extention;
            file.mv(dir + '/' + filename, function (err) {
                if (err) {
                    result = {
                        success: 0,
                        message: "Error in profile image upload",
                        error: err
                    };
                    res.json(result);
                } else {
                    imagepath = "/upload/" + userInfo.id + "/" + filename;
                    data = {};
                    if (req.body) {
                        data = req.body;
                    }
                    data.image = imagepath;
                    updateUser(userInfo.id, data, res);
                }
            });
        } else {
            result = {
                success: 0,
                message: "This File format is not allowed",
                error: []
            };
            res.json(result);
        }
    } else {
        data = req.body;
        updateUser(userInfo.id, data, res);
    }
});

/**
 * @api {post} /users/change_number Change phone number
 * @apiName Change Number
 * @apiGroup User
 * 
 * @apiParam {String} new_phone New phone number on which OTP will be sent
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 */
router.post('/change_number', function (req, res, next) {
    // creating schema for validation
    var schema = {
        'new_phone': {
            notEmpty: true,
            errorMessage: "New phone number must needed."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();

    if (!errors) {
        var code = Math.floor(1000 + Math.random() * 9000);
        user.findOne({mobileNo: req.userInfo.mobileNo}, function (err, userData) {
            if (err) {
                // Error in find user
                result = {
                    success: 0,
                    message: "Error in find user"
                    //error: errors
                };
                res.json(result);
            } else {
                // error is not occured
                if (userData) {
                    // Found user in database
                    user.findOne({mobileNo: req.body.new_phone}, function (err, newUserData) {
                        // finding new number is already registered or not
                        if (err) {
                            // Error in find operation
                            result = {
                                success: 0,
                                message: "Error in find user"
                                //error: errors
                            };
                            res.json(result);
                        } else {
                            if (newUserData) {
                                // User is already available in database
                                result = {
                                    success: 0,
                                    message: "New number is already available in database"
                                    //error: errors
                                };
                                res.json(result);
                            } else {
                                // Send OTP to update new number
                                otp.findOne({mobileNo: req.body.new_phone}, function (err, otpData) {
                                    if (err) {
                                        result = {
                                            success: 0,
                                            message: "Error in send OTP",
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
                                                sendMessage(req.body.new_phone, code, res);
                                            }
                                        });
                                    } else {
                                        var json = {
                                            'mobile_no': req.body.new_phone,
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
                                                sendMessage(req.body.new_phone, code, res);
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                } else {
                    // User not found
                    result = {
                        success: 0,
                        message: "User not available in database",
                        error: err
                    };
                    res.json(result);
                }
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
 * @api {post} /users/verifyOTP verify OTP for change number
 * @apiName Verify OTP for change number
 * @apiGroup User
 * 
 * @apiParam {String} new_phone New phone number on which OTP has been sent
 * @apiParam {String} otp OTP recevied by user
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} error optional to describe error
 */
router.post('/verifyOTP', function (req, res, next) {
    var schema = {
        'new_phone': {
            notEmpty: true,
            errorMessage: "New phone number must needed."
        },
        'otp': {
            notEmpty: true,
            errorMessage: "OTP is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        otp.findOne({mobile_no: req.body.new_phone}, function (err, otpData) {
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
                if (duration > process.env.OTP_EXPIRETION) {
                    var result = {
                        success: 0,
                        message: "Your OTP code is expired",
                        error: []
                    };
                    res.json(result);
                } else if (otpData.code == req.body.otp) {
                    json = {mobile_no: otpData.mobile_no};
                    user.findOne({mobile_no: otpData.mobile_no}, function (err, userData) {
                        if (err) {
                            result = {
                                success: 0,
                                message: "Error in finding User",
                                error: err
                            };
                            res.json(result);
                        }
                        if (userData) {
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
                                    success: 0,
                                    message: "New phone is already registered with us"
                                };
                                res.json(result);
                            })
                        } else {
                            // OTP matched
                            var userJson = {id: req.userInfo.id, mobile_no: req.body.new_phone};
                            var token = jwt.sign(userJson, process.env.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            json = {mobile_no: req.body.new_phone};
                            user.update({_id: {$eq: req.userInfo.id}}, {$set: json}, function (err, responce) {
                                if (err) {
                                    result = {
                                        success: 0,
                                        message: "Error in updating phone number",
                                        error: err
                                    };
                                    res.json(result);
                                } else {
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
                                            message: "Phone number has been changed",
                                            new_token: token
                                        };
                                        res.json(result);
                                    });
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
 /**
 * @api {post} /users/send_contact User's contact card which will be send to any user
 * @apiName Send Contact
 * @apiGroup User
 * 
 * @apiParam {Array} contacts raw data : Array of object [{mobile_no:contact_no}]. User's contact list 
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} error optional to describe error
 */
router.post('/send_card', function(req, res, next){
    var schema = {
        'contacts': {
            notEmpty: true,
            errorMessage: "To sync contact, contacts are required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if(!errors) {
         var contactList = _.pluck(req.body.contacts,"mobile_no");
        user.findOne({'_id' : req.userInfo.id}, function(err, user) {
            if(err) {
                var result = {
                    success: 0,
                    message: "Error in finding user",
                    error: err
                };
                res.json(result);
            } else {

                user.find({}, function(err, users){
                    res.json(users);
                });





                // Find contact of user from db
                user.find({}, function(err, contactData){
                    if (err) {
                        var result = {
                            success: 0,
                            message: "Error in finding user contact.",
                            error: err
                        };
                        res.json(result);
                    } else {
                        // _.each(contactList, function(con){
                        //     if(contactData.length == 0) {
                        //         var msg = (typeof user.name != 'undefined' ? user.name : 'Your firend')+' has sent his card from Gleekr.\n';
                        //         msg += 'Contact : '+user.mobile_no+'\nEmail id : '+(typeof user.email != 'undefined' ? user.email : '-')+'\nJob title : '+(typeof user.job_title != 'undefined' ? user.job_title : '-' )+'\nCompany : '+(typeof user.company_name != 'undefined' ? user.company_name : '-');
                        //         send_card(con, msg);
                        //         console.log('send sms', msg);
                        //     } else {
                        //             var flag = 0;
                        //         _.each(contactData, function(condt){
                        //             if(condt.mobile_no == con && condt.is_gleekr_contact) {
                        //                 flag = 1;
                        //             }
                        //         });
                        //         if(flag == 1) {
                        //             console.log(con +' is gleekr contact.');
                        //         } else {
                        //             var msg = (typeof user.name != 'undefined' ? user.name : 'Your firend')+' has sent his card from Gleekr.\n';
                        //             msg += 'Contact : '+user.mobile_no+'\nEmail id : '+(typeof user.email != 'undefined' ? user.email : '-')+'\nJob title : '+(typeof user.job_title != 'undefined' ? user.job_title : '-' )+'\nCompany : '+(typeof user.company_name != 'undefined' ? user.company_name : '-');
                        //             send_card(con, msg);
                        //         }
                        //     }
                        // });
                        console.log(contactData);
                        var result = {
                            success: 1,
                            message: "Contact card send successfully."
                        };
                        res.json(result);
                    }
                });
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
function updateUser(id, data, res) {
    user.update({_id: {$eq: id}}, {$set: data}, function (err, responce) {
        if (err) {
            result = {
                success: 0,
                message: "Error in updating profile",
                error: err
            };
            res.json(result);
        } else {
            var result = {
                success: 1,
                message: "Profile updated successfully",
            };
            res.json(result);
        }
    });
}

module.exports = router;