var express = require('express');
var router = express.Router();

var config = require('../config');
var moment = require('moment');
var client = require('../mqtt/mqttClient');
var twiliohelper = require('../helpers/twilio');

var Otp = require("../models/otp");
var User = require("../models/user");
var Group = require("../models/group");

var fs = require('fs');
var path = require('path');
require('dotenv').config();

var _ = require('underscore');
var jwt = require('jsonwebtoken');
/**
 * @api {put} /user Update user profile - READY
 * @apiName Update Profile
 * @apiGroup User
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} name  form-data: full name of the user
 * @apiParam {String} email  form-data: user email
 * @apiParam {String} jobTitle form-data: job title 
 * @apiParam {String} companyName form-data:company name
 * @apiParam {file} file form-data: file object [jpg,png]
 *  
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.put('/', function (req, res, next) {
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
                        message: "Error in profile image upload",
                        error: err
                    };
                    res.status(config.MEDIA_ERROR_STATUS).json(result);
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
            res.status(config.BAD_REQUEST).json({ message: "This File format is not allowed" });
        }
    } else {
        data = req.body;
        updateUser(userInfo.id, data, res);
    }
});

/**
 * @api {delete} /user Delete user account - READY
 * @apiName Delete User Account
 * @apiGroup User
 *
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.delete('/', function (req, res, next) {
    User.update({ _id: { $eq: req.userInfo.id } }, { $set: { 'isDeleted': true } }, function (err, responce) {
        if (err) {
			result = {
                message: "Error in deleting user account"
            };
            res.status(config.DATABASE_ERROR_STATUS).json(result);
        } else {
             var result = {
                message: "Account deleted successfully"
            };
            res.status(config.OK_STATUS).json(result);
        }
    });
});

/**
 * @api {post} /user/change_number Change phone number - READY
 * @apiName Change Number
 * @apiGroup User
 * 
 * @apiParam {String} newMobileNo New phone number on which OTP will be sent
 * 
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/change_number', function (req, res, next) {
    // creating schema for validation
    var schema = {
        'newMobileNo': {
            notEmpty: true,
            errorMessage: "Mobile number required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();

    if (!errors) {
        var code = Math.floor(1000 + Math.random() * 9000);
        User.findOne({ mobileNo: req.userInfo.mobileNo, isDeleted: null }, function (err, userData) {
            if (err) {
                // Error in finding user
                result = {
                    message: "User not found"
                };
                res.status(config.NOT_FOUND).json(result);
            }

            if (userData) { // User found
                User.findOne({ mobileNo: req.body.newMobileNo, isDeleted: null }, function (err, newUserData) {
                    // finding new number is already registered or not
                    if (err) {
                        // Error in find operation
                        result = {
                            message: "User not found"
                        };
                        res.status(config.NOT_FOUND).json(result);
                    }

                    if (newUserData) {
                        // User is already available in database
                        result = {
                            message: (newUserData._id === req.userInfo._id) ? "Number already in use" : "Number already in use by other user"
                        };
                        res.status(config.VALIDATION_FAILURE_STATUS).json(result);
                    } else {
                        // Send OTP to new number
                        Otp.findOne({ mobileNo: req.body.newMobileNo }, function (err, otpData) {
                            if (err) {
                                result = {
                                    message: "Error in sending OTP"
                                    //error: errors
                                };
                                res.status(config.VALIDATION_FAILURE_STATUS).json(result);
                            }

                            if (otpData) {
                                var json = { code: code, modified_datetime: new Date() };
                                Otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, responce) {
                                    if (err) {
                                        result = {
                                            message: "Error occured in generating OTP"
                                        };
                                        res.status(config.DATABASE_ERROR_STATUS).json(result);
                                    } else {
                                        twiliohelper.sendSMS(req.body.mobileNo, 'Use '+code +' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
                                    }
                                });
                            } else {
                                var json = {
                                    'mobileNo': req.body.newMobileNo,
                                    'code': code
                                };
                                var otpObject = new Otp(json);
                                otpObject.save(function (err, data) {
                                    if (err) {
                                        result = {
                                            message: "Error occured in generating OTP"
                                        };
                                        res.status(config.DATABASE_ERROR_STATUS).json(result);
                                    } else {
                                        twiliohelper.sendSMS(req.body.mobileNo, 'Use '+code +' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                // User not found
                result = {
                    message: "User not found"
                };
                res.status(404).json(result);
            }
        });
    } else {
        result = {
            message: "Validation Error",
            error: errors
        };
        res.status(417).json(result);
    }
});

/**
 * @api {post} /user/verifyotp verify OTP for new number - READY
 * @apiName Verify OTP for change number
 * @apiGroup User
 * 
 * @apiParam {String} mobileNo New phone number on which OTP has been sent
 * @apiParam {String} otp OTP recevied by user
 * 
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess {String} token New token.
 * 
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/verifyotp', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "Mobile number is required"
        },
        'otp': {
            notEmpty: true,
            errorMessage: "OTP is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Otp.findOne({ mobileNo: req.body.mobileNo }, function (err, otpData) {
            if (err) {
                res.status(config.NOT_FOUND).json({ message: "User not found" });
            }
            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                if (duration > process.env.OTP_EXPIRETION) {
                    res.status(config.BAD_REQUEST).json({ message: "OTP has expired" });
                } else if (otpData.code == req.body.otp) {
                    User.findOne({ mobileNo: otpData.mobileNo, isDeleted: null }, function (err, userData) {
                        if (err) {
                            res.status(config.NOT_FOUND).json({ message: "User not found" });
                        }

                        if (userData) {
                            Otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in deleting OTP" });
                                }
                                res.status(config.BAD_REQUEST).json({ message: "Mobile number already in use" });
                            })
                        } else {
                            // OTP matched
                            var token = jwt.sign({ id: req.userInfo.id, mobileNo: req.body.mobileNo }, process.env.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });

                            User.update({ _id: { $eq: req.userInfo.id } }, { $set: { mobileNo: req.body.mobileNo } }, function (err, responce) {
                                if (err) {
                                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in updating phone number" });
                                } else {
                                    Otp.remove({ _id: otpData._id }, function (err) {
                                        if (err) {
                                            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in deleting OTP" });
                                        }
                                        var result = { message: "Mobile number updated successfully", token: token };
                                        res.status(config.OK_STATUS).json(result);
                                    });
                                }

                            });
                        }
                    });

                } else {
                    res.status(config.BAD_REQUEST).json({ message: "Invalid OTP" });
                }
            } else {
                res.status(config.BAD_REQUEST).json({ message: "Invalid request" });
            }
        });
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

/**
* @api {post} /user/send_card Send user's contact card - READY
* @apiName Send Contact Card
* @apiGroup User
* @apiDescription SMS will be send to Phone Contacts [Done]
* @apiDescription Gleekr in-app message will be send to Gleekr contacts [Will be covered with chat integration]
* 
* @apiParam {Array} contacts raw data : Array of objects [{mobileNo: contact_no }]. User's contact list.
* 
* @apiHeader {String}  Content-Type application/json
* @apiHeader {String}  x-access-token Users unique access-key
* 
* @apiSuccess (Success 200) {String} message Success message.
* @apiError (Error 4xx) {String} message Validation or error message.
*/
router.post('/send_card', function (req, res, next) {
    var schema = {
        'contacts': {
            notEmpty: true,
            errorMessage: "Contacts are required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        var contactList = _.pluck(req.body.contacts, "mobileNo");
        User.findOne({ '_id': req.userInfo.id }, function (err, userdata) {
            if (err) {
                res.status(config.NOT_FOUND).json({ message: "User data not found" });
            } else {
                _.each(contactList, function (con) {
                    User.findOne({ mobileNo: con, isDeleted: null }, function (err, data) {
                        var msg = (userdata.name || 'Your friend') + ' has shared contact card from Gleekr.\n';
                        msg += 'Contact : ' + userdata.mobileNo + '\nEmail id : ' + (userdata.email || '-') + '\nJob title : ' + (userdata.jobTitle || '-') + '\nCompany : ' + (userdata.companyName || '-');
                        if (data != null) {
                            console.log('Gleekr contact', 'user_' + data._id);
                            console.log('Gleekr contact', msg);
                            client.publish('user_' + data._id,msg);
                        } else {
                            console.log('Not Gleekr user');
                            console.log(msg);
                            // twiliohelper.send_card(con, msg);
                        }
                        console.log(userdata);
                    });
                });
                var result = {
                    message: "Contact card send successfully."
                };
                res.status(config.OK_STATUS).json(result)
            }
        });
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

/**
 * @api {get} /user Get User profile - READY
 * @apiName User Profile Information
 * @apiGroup User
 *
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess {Json} User data.
 *
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.get('/', function (req, res, next) {
    User.findOne({ '_id': req.userInfo.id }, function (err, user) {
        if (err) {
            result = {
                message: "Error in get user profile"
            };
            res.status(config.DATABASE_ERROR_STATUS).json(result);
        } else {
            var result = {
                data: user
            };
            res.status(config.OK_STATUS).json(result);
        }
    });
});

/**
* @api {post} /user/sync_contacts Sync contacts - READY
* @apiName Sync Contacts
* @apiGroup User
* 
* @apiParam {Array} contacts raw data : Array of objects [{mobileNo: contact_no, firstName: first_name, lastName: last_name, email: email }]
* 
* @apiHeader {String}  Content-Type application/json
* @apiHeader {String}  x-access-token Users unique access-key
* 
* @apiSuccess (Success 200) {Array} gleekrUsers Array of Gleekr users objects.
* @apiSuccess (Success 200) {Array} gleekrGroups Array of user's Gleekr groups
* @apiSuccess (Success 200) {Array} phoneContacts Array of Phone contacts
* @apiError (Error 4xx) {String} message
*/
router.post('/sync_contacts', function (req, res, next) {
    var schema = {
        'contacts': {
            notEmpty: true,
            errorMessage: "Contacts are required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        var responseData = {
            gleekrUsers: [],
            gleekrGroups: [],
            phoneContacts: []
        };

        //Pluck all mobile numbers
        var mobileNumbers = _.pluck(req.body.contacts, "mobileNo");

        User.find({ mobileNo: { $in: mobileNumbers }, isDeleted: null }, { name: 1, mobileNo: 1, email: 1, image: 1, companyName: 1, jobTitle: 1 }, function (error, matchedContacts) {
            if (error) {
                res.status(config.DATABASE_ERROR_STATUS).json({ message: "Problem occured while syncing your contacts" });
            }

            if (matchedContacts && matchedContacts.length > 0) { // Gleekr contacts
                responseData.gleekrUsers = matchedContacts;
            }

            //Get non gleekr users mobileNo
            var phoneContactNos = _.difference(mobileNumbers, _.pluck(responseData.gleekrUsers, "mobileNo"));
            responseData.phoneContacts = _.filter(req.body.contacts, function (contact) { return phoneContactNos.indexOf(contact.mobileNo) > -1; }); // Phone contacts

            //Get user's group
            Group.find({ "members._id": { "$in": _.pluck(responseData.gleekrUser, "_id") } }, function (error, groups) {
                if (error) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Problem occured while syncing your contacts" });
                }

                if (groups && groups.length > 0) {
                    responseData.gleekrGroups = groups;
                }

                //Send sync_contacts response
                res.status(config.OK_STATUS).json(responseData);
            });
        });

    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

/* Update User details */
function updateUser(id, data, res) {
    User.update({ _id: { $eq: id } }, { $set: data }, function (err, responce) {
        if (err) {
            result = {
                message: "Error in updating profile",
                error: err
            };
            res.status(config.DATABASE_ERROR_STATUS).json(result);
        } else {
            res.status(config.OK_STATUS).json({ message: "Profile updated successfully" });
        }
    });
}

module.exports = router;