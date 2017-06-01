var express = require('express');
var router = express.Router();

require('../helpers/twilio');
var moment = require('moment');

var Otp = require("../models/otp");
var User = require("../models/user");

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
 * @apiHeader {String}  x-access-token Users unique access-key.
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
                    res.status(415).json(result);
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
                message: "This File format is not allowed",
                error: []
            };
            res.status(417).json(result);
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
 * @apiHeader {String}  x-access-token Users unique access-key.
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.delete('/', function (req, res, next) {
    User.update({ _id: { $eq: req.userInfo.id } }, { $set: { 'isDeleted': true } }, function (err, responce) {
        if (err) {
            res.status(422).json({ message: "Error in removing use account"});
        } else {
            res.status(200).json({message: "Your account removed successfully."});
        }
    });
});

/**
 * @api {post} /user/change_number Change phone number
 * @apiName Change Number
 * @apiGroup User
 * 
 * @apiParam {String} newMobileNo New phone number on which OTP will be sent
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/change_number', function (req, res, next) {
    // creating schema for validation
    var schema = {
        'newMobileNo': {
            notEmpty: true,
            errorMessage: "New phone number must needed."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();

    if (!errors) {
        var code = Math.floor(1000 + Math.random() * 9000);
        User.findOne({ mobileNo: req.userInfo.mobileNo }, function (err, userData) {
            if (err) {
                // Error in find user
                result = {
                    message: "Error in find user"
                };
                res.status(422).json(result);
            } else {
                // error is not occured
                if (userData) {
                    // Found user in database
                    User.findOne({ mobileNo: req.body.newMobileNo }, function (err, newUserData) {
                        // finding new number is already registered or not
                        if (err) {
                            // Error in find operation
                            result = {
                                message: "Error in find user"
                            };
                            res.status(422).json(result);
                        } else {
                            if (newUserData) {
                                // User is already available in database
                                result = {
                                    message: "New number is already available in database"
                                };
                                res.status(417).json(result);
                            } else {
                                // Send OTP to update new number
                                Otp.findOne({ mobileNo: req.body.newMobileNo }, function (err, otpData) {
                                    if (err) {
                                        result = {
                                            message: "Error in send OTP"
                                            //error: errors
                                        };
                                        res.status(417).json(result);
                                    }
                                    if (otpData) {
                                        var json = { code: code, modified_datetime: new Date() };
                                        Otp.update({ _id: { $eq: otpData._id } }, { $set: json }, function (err, responce) {
                                            if (err) {
                                                result = {
                                                    message: "Error in updating OTP"
                                                };
                                                res.status(422).json(result);
                                            } else {
                                                sendMessage(req.body.newMobileNo, code, res);
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
                                                    message: "Error in inserting OTP"
                                                };
                                                res.status(422).json(result);
                                            } else {
                                                sendMessage(req.body.newMobileNo, code, res);
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
                        message: "User not available in database"
                    };
                    res.status(417).json(result);
                }
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
 * @api {post} /user/verifyotp verify OTP for change number
 * @apiName Verify OTP for change number
 * @apiGroup User
 * 
 * @apiParam {String} newMobileNo New phone number on which OTP has been sent
 * @apiParam {String} otp OTP recevied by user
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess {String} token New token.
 * 
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/verifyotp', function (req, res, next) {
    var schema = {
        'newMobileNo': {
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
        Otp.findOne({ mobileNo: req.body.newMobileNo }, function (err, otpData) {
            if (err) {
                res.status(417).json({ message: "Error in finding user with otp" });
            }
            if (otpData) {
                opt_send_date = moment(otpData.updated_date);
                now = moment();
                var duration = now.diff(opt_send_date, 'minutes');
                if (duration > process.env.OTP_EXPIRETION) {
                    res.status(401).json({ message: "Your OTP code is expired" });
                } else if (otpData.code == req.body.otp) {
                    json = { mobileNo: otpData.mobileNo };
                    User.findOne(json, function (err, userData) {
                        if (err) {
                            res.status(417).json({ message: "Phone number is incorrect" });
                        }
                        if (userData) {
                            Otp.remove({ _id: otpData._id }, function (err) {
                                if (err) {
                                    res.status(422).json({ message: "Error in deleteing OTP" });
                                }
                                res.status(422).json({ message: "New phone is already registered with us" });
                            })
                        } else {
                            // OTP matched
                            var userJson = { id: req.userInfo.id, mobileNo: req.body.newMobileNo };
                            var token = jwt.sign(userJson, process.env.JWT_SECRET, {
                                expiresIn: 60 * 60 * 24 // expires in 24 hours
                            });
                            json = { mobileNo: req.body.newMobileNo };
                            User.update({ _id: { $eq: req.userInfo.id } }, { $set: json }, function (err, responce) {
                                if (err) {
                                    res.status(422).json({ message: "Error in updating phone number" });
                                } else {
                                    Otp.remove({ _id: otpData._id }, function (err) {
                                        if (err) {
                                            res.status(422).json({ message: "Error in deleteing OTP" });
                                        }
                                        var result = { message: "Phone number has been changed", new_token: token };
                                        res.status(200).json(result);
                                    });
                                }
                            });
                        }
                    });

                } else {
                    res.status(417).json({ message: "OTP is wrong" });
                }
            } else {
                res.status(417).json({ message: "Mobile number has not requested for sendOTP" });
            }
        });
    } else {
        res.status(417).json({ message: "Validation Error : " + errors });
    }
});

/**
* @api {post} /user/send_card User's contact card which will be send to any user
* @apiName Send Contact Card
* @apiGroup User
* 
* @apiParam {Array} contacts raw data : Array of object [{mobile_no:contact_no}]. User's contact list 
* 
* @apiHeader {String}  x-access-token Users unique access-key.
* 
* @apiSuccess (Success 200) {String} message Success message.
* @apiError (Error 4xx) {String} message Validation or error message.
*/
router.post('/send_card', function (req, res, next) {
    var schema = {
        'contacts': {
            notEmpty: true,
            errorMessage: "To sync contact, contacts are required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        var contactList = _.pluck(req.body.contacts, "mobile_no");
        User.findOne({ '_id': req.userInfo.id }, function (err, userdata) {
            if (err) {
                res.status(422).json({ message: "Error in finding user." });
            } else {

                _.each(contactList, function (con) {
                    User.findOne({ mobileNo: con }, function (err, data) {
                        var msg = (typeof userdata.name != 'undefined' ? userdata.name : 'Your friend') + ' has sent his card from Gleekr.\n';
                        msg += 'Contact : ' + userdata.mobileNo + '\nEmail id : ' + (typeof userdata.email != 'undefined' ? userdata.email : '-') + '\nJob title : ' + (typeof userdata.jobTitle != 'undefined' ? userdata.jobTitle : '-') + '\nCompany : ' + (typeof userdata.companyName != 'undefined' ? userdata.companyName : '-');
                        if (data != null) {
                            console.log('Gleekr contact', 'user_' + data._id);
                            console.log('Gleekr contact', msg);

                            client.publish('user_' + data._id, msg);
                        } else {
                            console.log('Not Gleekr user');
                            console.log(msg);
                            send_card(con, msg);
                        }
                    });
                });
                var result = {
                    message: "Contact card send successfully."
                };
                res.status(200).json(result)
            }
        });
    } else {
        var result = {
            message: errors
        };
        res.status(417).json(result)
    }
});

/**
 * @api {get} /user Get User profile - READY
 * @apiName User Profile Information
 * @apiGroup User
 *
 * @apiHeader {String}  x-access-token Users unique access-key.
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
            res.status(422).json(result);
        } else {
            var result = {
                data: user
            };
            res.status(200).json(result);
        }
    });
});

/**
 * @api {post} /users/sync_contact User's contact synchronized
 * @apiName Sync Contact
 * @apiGroup User
 * 
 * @apiParam {Array} contacts raw data : Array of object [{name:contact_name,mobile_no:contact_no}].  User's contact list 
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 * @apiSuccess {String} error optional to describe error
 */
 router.post('/sync_contact',function(req,res,next){
    var schema = {
            'contacts': {
                notEmpty: true,
                errorMessage: "To sync contact, contacts are required."
            }
        };
    req.checkBody(schema);
    var errors = req.validationErrors();
     if (!errors) {
      contact.find({user_id:req.userInfo.id},function(err,contactData){
       // Finding user in database
                if (err) {
                    var result = {
                        success: 0,
                        message: "Error in finding user with otp",
                        error: err
                    };
                    res.json(result);
                }
       
       var dbContact = _.pluck(contactData,"mobile_no");
       var inputContact = _.pluck(req.body.contacts,"mobile_no");
       
       // Find contact that is available in contactData and not available in req.body.contacts and delete those contact
       var del_contact = _.difference(dbContact,inputContact);
       console.log("del = ",del_contact);
       
       // Find contact that is not available in contactData and available in req.body.contacts and insert those contact
       var ins_contact = _.difference(inputContact,dbContact);
       console.log("ins = ",ins_contact);
       
       // Iterate each contact for insert
       _.each(ins_contact,function(con){
        
        var current_contact = _.findWhere(req.body.contacts,{"mobile_no":con});
        
        // Check contact is gleekr contact or not
        user.findOne({mobile_no: con}, function (err, userData) {
         if(!err)
         {
          // Add new contact in database
          if(userData)
          {
           // Gleekr contact
           var new_contact = {
            'name':current_contact.name,
            'mobile_no':con,
            'user_id':req.userInfo.id,
            'is_gleekr_contact':1
           };
          }
          else
          {
           // Non-gleekr contact
           var new_contact = {
            'name':current_contact.name,
            'mobile_no':con,
            'user_id':req.userInfo.id,
            'is_gleekr_contact':0
           };
          }
          var contactObj = new contact(new_contact);
          contactObj.save(function(err,data){
           console.log('contact has been added');
          });
         }
        });
       });
       
       // Iterate each contact for delete
       _.each(del_contact,function(con){
        // Add new contact in database
        var old_contact = {
         'mobile_no':con,
         'user_id':req.userInfo.id
        };
        contact.remove(old_contact,function(err,data){
         console.log('contact has been deleted');
        });
       });
       
       var result = {
        success: 1,
        message: "successfully synchronized contacts"
       };
       res.json(result);
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
    User.update({ _id: { $eq: id } }, { $set: data }, function (err, responce) {
        if (err) {
            result = {
                message: "Error in updating profile",
                error: err
            };
            res.status(422).json(result);
        } else {
            var result = {
                message: "Profile updated successfully",
            };
            res.status(200).json(result);
        }
    });
}

module.exports = router;