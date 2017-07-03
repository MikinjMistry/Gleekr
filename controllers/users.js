var express = require('express');
var router = express.Router();

var config = require('../config');
var moment = require('moment');
var client = require('../mqtt/mqttClient');
var twiliohelper = require('../helpers/twilio');

var Otp = require("../models/otp");
var User = require("../models/user");
var Group = require("../models/group");
var Bot = require("../models/bot");
var Activity = require("../models/activity");

var fs = require('fs');
var path = require('path');

var _ = require('underscore');
var jwt = require('jsonwebtoken');

/**
 * @api {put} /user Update user profile
 * @apiName Update Profile
 * @apiGroup User - READY
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} name  form-data: full name of the user
 * @apiParam {String} email  form-data: user email
 * @apiParam {String} jobTitle form-data: job title 
 * @apiParam {String} companyName form-data:company name
 * @apiParam {String} address form-data:address
 * @apiParam {String} city form-data:city
 * @apiParam {String} state form-data:state
 * @apiParam {String} country form-data:country
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
                    return next(err);
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
 * @api {delete} /user Delete user account
 * @apiName Delete User Account
 * @apiGroup User - READY
 *
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.delete('/', function (req, res, next) {
    User.update({ _id: { $eq: req.userInfo.id } }, { $set: { isDeleted: true } }, function (err, response) {
        if (err) {
            return next(err);
        } else {
            var result = {
                message: "Account deleted successfully"
            };
            res.status(config.OK_STATUS).json(result);
        }
    });
});

/**
 * @api {post} /user/change_number Change phone number
 * @apiName Change Number
 * @apiGroup User - READY
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
        User.findOne({ mobileNo: req.userInfo.mobileNo, isDeleted: { $ne: true } }, function (err, userData) {
            if (err) {
                return next(err);
            }

            if (userData) { // User found
                User.findOne({ mobileNo: req.body.newMobileNo, isDeleted: { $ne: true } }, function (err, newUserData) {
                    // finding new number is already registered or not
                    if (err) {
                        // Error in find operation
                        result = {
                            message: "User not found"
                        };
                        res.status(config.NOT_FOUND).json(result);
                        return;
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
                                return next(err);
                            }

                            if (otpData) {
                                var json = { code: code, modified_datetime: new Date() };
                                Otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, response) {
                                    if (err) {
                                        return next(err);
                                    } else {
                                        twiliohelper.sendSMS(req.body.mobileNo, 'Use ' + code + ' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
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
                                        return next(err);
                                    } else {
                                        twiliohelper.sendSMS(req.body.mobileNo, 'Use ' + code + ' as Gleekr account security code', 'OTP has been sent successfully.', 'Error in sending sms.', res);
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
 * @api {post} /user/verifyotp verify OTP for new number
 * @apiName Verify OTP for change number
 * @apiGroup User - READY
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
                return next(err);
            }

            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                if (duration > process.env.OTP_EXPIRATION) {
                    res.status(config.BAD_REQUEST).json({ message: "OTP has expired" });
                } else if (otpData.code == req.body.otp) {
                    User.findOne({ mobileNo: otpData.mobileNo, isDeleted: { $ne: true } }, function (err, userData) {
                        if (err) {
                            return next(err);
                        }

                        if (userData) {
                            Otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    return next(err);
                                }
                                res.status(config.BAD_REQUEST).json({ message: "Mobile number already in use" });
                            })
                        } else {
                            // OTP matched
                            var token = jwt.sign({ id: req.userInfo.id, mobileNo: req.body.mobileNo }, process.env.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });

                            User.update({ _id: { $eq: req.userInfo.id } }, { $set: { mobileNo: req.body.mobileNo } }, function (err, response) {
                                if (err) {
                                    return next(err);
                                } else {
                                    Otp.remove({ _id: otpData._id }, function (err) {
                                        if (err) {
                                            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in deleting OTP" });
                                            return;
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
 * @api {post} /user/send_card Send user's contact card
 * @apiName Send Contact Card
 * @apiGroup User - READY
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
                return next(err);
            }
            if (userdata) {
                _.each(contactList, function (con) {
                    User.findOne({ mobileNo: con, isDeleted: { $ne: true } }, function (err, data) {
                        var msg = (userdata.name || 'Your friend') + ' has shared contact card from Gleekr.\n';
                        msg += 'Contact : ' + userdata.mobileNo + '\nEmail id : ' + (userdata.email || '-') + '\nJob title : ' + (userdata.jobTitle || '-') + '\nCompany : ' + (userdata.companyName || '-');
                        if (data) {
                            console.log('Gleekr contact', 'user_' + data._id + " ---" + con);
                            // console.log('Gleekr contact', msg);
                            client.publish('user_' + data._id, msg);
                        } else {
                            console.log('Not Gleekr user', con);
                            // console.log(msg);
                            twiliohelper.send_card(con, msg);
                        }
                    });
                });
                var result = {
                    message: "Contact card send successfully."
                };
                res.status(config.OK_STATUS).json(result)
            } else {
                res.status(config.NOT_FOUND).json({ message: "User data not found" });
            }
        });
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

/**
 * @api {get} /user Get User profile
 * @apiName User Profile Information
 * @apiGroup User - READY
 *
 * @apiHeader {String}  Content-Type application/json
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message
 * @apiSuccess {Json} User data
 *
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.get('/', function (req, res, next) {
    User.findOne({ _id: req.userInfo.id }, { activities: 0 }, function (err, user) {
        if (err) {
            return next(err);
        }

        if (user) {
            userData = user.toObject();

            Activity.count({ user_id: req.userInfo.id }, function (err, data) {
                if (err) {
                    return next(err);
                }

                if (data) {
                    userData.totalActivities = data;
                }

                res.status(config.OK_STATUS).json(userData);

            });

        } else {
            res.status(config.NOT_FOUND).json({ message: "User not found" });
        }
    });
});

/**
 * @api {post} /user/sync_contacts Sync contacts
 * @apiName Sync Contacts
 * @apiGroup User - READY
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

        User.find({ mobileNo: { $in: mobileNumbers }, isDeleted: { $ne: true } }, { name: 1, mobileNo: 1, email: 1, image: 1, companyName: 1, jobTitle: 1 }, function (error, matchedContacts) {
            if (error) {
                return next(error);
            }

            if (matchedContacts && matchedContacts.length > 0) { // Gleekr contacts
                responseData.gleekrUsers = matchedContacts;
            }

            //Get non gleekr users mobileNo
            var phoneContactNos = _.difference(mobileNumbers, _.pluck(responseData.gleekrUsers, "mobileNo"));
            responseData.phoneContacts = _.filter(req.body.contacts, function (contact) {
                return phoneContactNos.indexOf(contact.mobileNo) > -1;
            }); // Phone contacts

            //Get user's group
            Group.find({ "members._id": { "$in": _.pluck(responseData.gleekrUser, "_id") } }, function (error, groups) {
                if (error) {
                    return next(error);
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

/**
 * @api {get} /user/actions BOT TimeLine
 * @apiName BOT TimeLine
 * @apiDescription Example: /user/actions?start=[START INDEX]&offset=[LIMIT]
 * @apiGroup User - READY
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiParam {number} start Start index starting from 0
 * @apiParam {number} offset Offset indicates the number of records which needs to be fetch each time
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * @apiSuccess (Success 200) {Json} data User action on activity
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.get('/actions', function (req, res, next) {
    var schema = {
        'start': {
            notEmpty: true,
            errorMessage: "Start is required"
        },
        'offset': {
            notEmpty: true,
            errorMessage: "Offset is required"
        }

    };
    req.checkQuery(schema);
    var errors = req.validationErrors();
    if (!errors) {
<<<<<<< HEAD
        Bot.find({user_id: req.userInfo.id})
                .populate('activity_id', null, 'activities')
                .sort('-createdAt').skip(parseInt(req.query.start)).limit(parseInt(req.query.offset))
                .exec(function (err, botData) {
                    if (err) {
                        res.status(config.DATABASE_ERROR_STATUS).json({message: "Error in finding Bot"});
                    }
                    if (botData.length != 0) {
                        botData = _.groupBy(botData, function (b) {
                            var momentObj = moment(b.createdAt);
                            return momentObj.format('YYYY-MM-DD'); // 2016-07-15
                        });
                        res.status(config.OK_STATUS).json(botData);
                    } else {
                        res.status(config.NOT_FOUND).json({message: "User actions not found"});
                    }
                });
=======
        Bot.find({ user_id: req.userInfo.id })
            .populate('activity_id', null, 'activities')
            .sort('-createdAt').skip(parseInt(req.query.start)).limit(parseInt(req.query.offset))
            .exec(function (err, botData) {
                if (err) {
                    return next(err);
                }
                if (botData.length != 0) {
                    botData = _.groupBy(botData, function (b) {
                        var momentObj = moment(b.createdAt);
                        return momentObj.format('YYYY-MM-DD'); // 2016-07-15
                    });
                    res.status(config.OK_STATUS).json(botData);
                } else {
                    res.status(config.NOT_FOUND).json({ message: "User actions not found" });
                }
            });
>>>>>>> 63e61dfbc1bdbed5d7510c7a24d46b14fc1b2a4a
    } else {
        res.status(config.BAD_REQUEST).json({ message: errors });
    }
});

/* Update User details */
function updateUser(id, data, res) {
    User.update({ _id: { $eq: id } }, { $set: data }, function (err, response) {
        if (err) {
            return next(err);
        } else {
            res.status(config.OK_STATUS).json({ message: "Profile updated successfully" });
        }
    });
}

module.exports = router;