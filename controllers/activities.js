var express = require('express');
var router = express.Router();
var config = require('../config');
var cron = require('node-cron');

var Activity = require("../models/activity");
var User = require("../models/user");

var bothelper = require('../helpers/bot_helpers');
var jsonhelper = require('../helpers/json_helpers');

var moment = require('moment');
var fs = require('fs');
var path = require('path');
var async = require('async');
var _ = require('underscore');

/**
 * @api {get} /activity Get all activity - READY
 * @apiName Get All activity
 * @apiGroup Activity
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {Array} new Array of new activities
 * @apiSuccess (Success 200) {Array} upcoming Array of upcoming activities
 * @apiSuccess (Success 200) {Array} going Array of im_going activities
 * @apiSuccess (Success 200) {Array} createdByMe Array of created by me activities
 * @apiSuccess (Success 200) {Array} pinned Array of pinned activities
 * @apiSuccess (Success 200) {Array} notInterested Array of not interested activities
 * @apiSuccess (Success 200) {Array} archived Array of archived activities
 * @apiSuccess (Success 200) {Array} all Array of all activities
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.get('/', function (req, res, next) {
    async.parallel({
        others: function (callback) {
            User.find({_id: req.userInfo.id})
                    .select('activities')
                    .populate({path: 'activities.activity_id', model: 'activities', match: {isDeleted: {$ne: true}}})
                    .exec(function (err, data) {
                        if (err) {
                            callback('Error in fetching activities', null);
                        }
                        callback(null, data);
                    });
        },
        createdByMe: function (callback) {
            Activity.find({user_id: req.userInfo.id, isDeleted: {$ne: true}}, function (err, data) {
                if (err) {
                    callback('Error in fetching My activity', null);
                }

                var ret = [];

                async.each(data, function (item, callback1) {
                    User.find({'activities': {"$elemMatch": {'activity_id': item._id}}, _id: {$eq: req.userInfo.id}}, {'activities.$': 1}, function (err, subdata) {
                        if (err)
                            callback("Activity not found");

                        var activityDetails = {};
                        activityDetails = Object.assign({}, item.toObject());
                        activityDetails.action = subdata[0].activities[0].action;
                        activityDetails.isPinned = subdata[0].activities[0].isPinned || false;

                        ret.push(activityDetails);
                        callback1();
                    });
                }, function (err) {
                    callback(null, ret);
                });
            });
        },
    }, function (err, results) {
        if (err) {
            return next(err);
        }
        var responseData = {
            new : [],
            upcoming: [],
            going: [],
            createdByMe: (results.createdByMe && results.createdByMe.length > 0) ? results.createdByMe : [],
            pinned: [],
            notInterested: [],
            archived: [],
            all: []
        };

        if (results.others.length > 0 && results.others[0].activities.length > 0) {
            var activities = _.filter(results.others[0].activities, function (activity) {
                return activity.activity_id;
            }) || [];

            var previousDate = new Date(moment().subtract(6, 'days').format("YYYY-MM-DD")).getTime();
            var nextTwoDate = new Date(moment().add(3, 'days').format("YYYY-MM-DD HH:mm")).getTime();
            var currentDate = new Date().getTime();
            var invited = _.filter(activities, function (activity) {
                return (activity.action === "invited" || activity.action === "going") && activity.activity_id;
            });

            //pinned
            var pinned = _.filter(activities, function (activity) {
                return activity.isPinned && !activity.activity_id.isArchived;
            });

            if (pinned.length > 0)
            {
                _.each(pinned, function (obj) {
                    var activityDetails = {};
                    activityDetails = Object.assign({}, obj.activity_id.toObject());
                    activityDetails.action = obj.action;
                    activityDetails.isPinned = obj.isPinned || false;

                    responseData.pinned.push(activityDetails);
                });
                responseData.pinned = sortActivityByDate(responseData.pinned, 'desc', 'createdAt');
            }

            //new
            if (invited.length > 0) {
                _.each(invited, function (obj) {
                    var activityDetails = {};
                    activityDetails = Object.assign({}, obj.activity_id.toObject());
                    activityDetails.action = obj.action;
                    activityDetails.isPinned = obj.isPinned || false;

                    var createdDate = new Date(activityDetails.createdAt).getTime();
                    var modifiedDate = new Date(activityDetails.modifiedAt).getTime();
                    if ((createdDate >= previousDate && createdDate <= currentDate) || (modifiedDate >= previousDate && modifiedDate <= currentDate)) {
                        var flag = jsonhelper.isExist(responseData.new, activityDetails._id);
                        if (!flag) {
                            responseData.new.push(activityDetails);
                        }
                    }
                });
                responseData.new = sortActivityByDate(responseData.new, 'asc', 'startTime');
            }

            //going
            going = _.filter(activities, function (activity) {
                return activity.action === "going" && !activity.activity_id.isArchived;
            });

            if (going.length > 0)
            {
                _.each(going, function (obj) {
                    var activityDetails = {};
                    activityDetails = Object.assign({}, obj.activity_id.toObject());
                    activityDetails.action = obj.action;
                    activityDetails.isPinned = obj.isPinned || false;

                    responseData.going.push(activityDetails);
                });
                responseData.going = sortActivityByDate(responseData.going, 'asc', 'startTime');
            }

            //upcoming
            if (responseData.going.length > 0) {
                _.each(responseData.going, function (obj) {
                    var activityDate = new Date(obj.startDate);
                    var day = activityDate.getDate();
                    var month = activityDate.getMonth();
                    var year = activityDate.getFullYear();
                    var activityTime = new Date(obj.startTime);
                    var hours = activityTime.getHours();
                    var minute = activityTime.getMinutes();
                    var activityDateTime = new Date(year, month, day, hours, minute, 0).getTime();

                    var currentDate = new Date().getTime();
                    if (activityDateTime <= nextTwoDate && activityDateTime > currentDate) {
                        var flag = jsonhelper.isExist(responseData.upcoming, obj._id);
                        if (!flag) {
                            responseData.upcoming.push(obj);
                        }
                    }
                });
                responseData.upcoming = sortActivityByDate(responseData.upcoming, 'asc', 'startTime');
            }

            //Not Intrested
            notInterested = _.filter(activities, function (activity) {
                return activity.action === "not_interested" && !activity.activity_id.isArchived;
            });

            if (notInterested.length > 0)
            {
                _.each(notInterested, function (obj) {
                    var activityDetails = {};
                    activityDetails = Object.assign({}, obj.activity_id.toObject());
                    activityDetails.action = obj.action;
                    activityDetails.isPinned = obj.isPinned || false;

                    responseData.notInterested.push(activityDetails);
                });
                responseData.notInterested = sortActivityByDate(responseData.notInterested, 'desc', 'createdAt');
            }

            //all
            all = _.filter(activities, function (activity) {
                return (activity.action === "invited" || activity.action === "going") && !activity.activity_id.isArchived;
            });

            if (all.length > 0)
            {
                _.each(all, function (obj) {
                    var activityDetails = {};
                    activityDetails = Object.assign({}, obj.activity_id.toObject());
                    activityDetails.action = obj.action;
                    activityDetails.isPinned = obj.isPinned || false;

                    responseData.all.push(activityDetails);
                });
                responseData.all = sortActivityByDate(responseData.all, 'desc', 'createdAt');
            }

            //archived
            responseData.archived = _.filter(_.union(invited, results.createdByMe), function (activity) {
                return activity.isArchived === true;
            });
            responseData.archived = sortActivityByDate(responseData.archived, 'desc', 'createdAt');
        }
        res.status(config.OK_STATUS).json(responseData);
    });
});

/**
 * @api {post} /activity Insert Activity - READY
 * @apiName Insert Activity 
 * @apiGroup Activity
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {file} [file] form-data: file object for image [jpg,png]
 * @apiParam {String} name  form-data: Activity name
 * @apiParam {Date} startDate form-data: Activity start date, format: ISO date
 * @apiParam {Date} startTime form-data: Activity start time, format: ISO date
 * @apiParam {Date} [endDate] form-data: Activity end date, format: ISO date
 * @apiParam {Date} [endTime] form-data: Activity end time, format: ISO date
 * @apiParam {String} location form-data: Activity location
 * @apiParam {String} [description] form-data: Activity description
 * @apiParam {Number} [noOfParticipants] form-data: Number of participants
 * @apiParam {Decimal} [costPerPerson] form-data: cost per person
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * @apiSuccess (Success 200) {Object} activity If activity successfully created
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.post('/', function (req, res, next) {
    var schema = {
        'name': {
            notEmpty: true,
            errorMessage: "name is required"
        },
        'startDate': {
            notEmpty: true,
            errorMessage: "start date is required"
        },
        'startTime': {
            notEmpty: true,
            errorMessage: "start time is required"
        },
        'location': {
            notEmpty: true,
            errorMessage: "location is required"
        }
    };
    req.checkBody(schema);

    if (req.body.hasOwnProperty('startDate') && req.body.hasOwnProperty('endDate')) {
        req.checkBody('startDate', 'Start date must be less then end date').startBefore(req.body.endDate);
    }

    if (req.body.hasOwnProperty('startDate') && req.body.hasOwnProperty('endDate') && req.body.hasOwnProperty('startTime') && req.body.hasOwnProperty('endTime')) {
        req.checkBody('startTime', 'Start date and time must be less then end date and time').startDateTimeBefore(req.body.endTime);
    }

    var errors = req.validationErrors();
    if (!errors) {

        var json = req.body;

        if (json.hasOwnProperty('startTime')) {
            json.startTime = moment(json.startTime, 'HH:mm');
        }
        if (json.hasOwnProperty('endTime')) {
            json.endTime = moment(json.endTime, 'HH:mm');
        }

        json.user_id = req.userInfo.id;

        if (req.files) {
            var file = req.files.file;
            var dir = "./upload/activity";
            if (['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'].indexOf(file.mimetype) !== -1) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
                extention = path.extname(file.name);
                filename = new Date().getTime() + extention;
                file.mv(dir + '/' + filename, function (err) {
                    if (err) {
                        return next(err);
                    } else {
                        json.photo = "/upload/activity/" + filename;
                        insertActivity(json, req, res)
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({message: "File format not allowed"});
            }
        } else {
            // insert activity
            insertActivity(json, req, res)
        }
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error",
            error: errors
        });
    }
});

/**
 * @api {put} /activity Update Activity - READY
 * @apiName Update Activity
 * @apiGroup Activity
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} id form-data: activity id that is going to update
 * @apiParam {file} file form-data: file object for image [jpg,png]
 * @apiParam {String} name  form-data: Activity name
 * @apiParam {Date} startDate form-data: Activity start date, format: ISO date
 * @apiParam {Date} startTime form-data: Activity start time, format: ISO date
 * @apiParam {Date} endDate form-data: Activity end date, format: ISO date
 * @apiParam {Date} endTime form-data: Activity end time, format: ISO date
 * @apiParam {String} location form-data: Activity location
 * @apiParam {String} description form-data: Activity description
 * @apiParam {Number} noOfParticipants form-data: Number of participants
 * @apiParam {Decimal} costPerPerson form-data: cost per person (2 decimal values allowed)
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.put('/', function (req, res, next) {

    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "activity id is required"
        }
    };
    req.checkBody(schema);

    if (req.body.hasOwnProperty('startDate') && req.body.hasOwnProperty('endDate')) {
        req.checkBody('startDate', 'Start date must be less then end date').startBefore(req.body.endDate);
    }

    if (req.body.hasOwnProperty('startDate') && req.body.hasOwnProperty('endDate') && req.body.hasOwnProperty('startTime') && req.body.hasOwnProperty('endTime')) {
        req.checkBody('startTime', 'Start date and time must be less then end date and time').startDateTimeBefore(req.body.endTime);
    }

    /*if (req.body.hasOwnProperty('startTime')) {
     req.body.startTime = moment(req.body.startTime, 'HH:mm');
     }
     if (req.body.hasOwnProperty('endTime')) {
     req.body.endTime = moment(req.body.endTime, 'HH:mm');
     }*/


    var errors = req.validationErrors();
    if (!errors) {
        var json = req.body;
        if (req.files) {
            var file = req.files.file;
            var dir = "./upload/activity";
            if (['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'].indexOf(file.mimetype) != -1) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
                extention = path.extname(file.name);
                filename = new Date().getTime() + extention;
                file.mv(dir + '/' + filename, function (err) {
                    if (err) {
                        return next(err);
                    } else {
                        data = {};
                        if (req.body) {
                            data = req.body;
                        }
                        data.photo = "/upload/activity/" + filename;
                        updateActivity(req.body.id, data, req, res);
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({message: "This File format is not allowed"});
            }
        } else {
            data = req.body;
            updateActivity(req.body.id, data, req, res);
        }
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

/**
 * @api {get} /activity/details?id=:id Get activity details - READY
 * @apiName Get activity details
 * @apiGroup Activity
 * 
 * @apiParam {String} id Activity id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * @apiSuccess (Success 200) {Json} activity Activity details
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.get('/details', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "Activity id is required to retrive details"
        }
    };
    req.checkQuery(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Activity.findOne({_id: req.query.id, isDeleted: {$ne: true}}, function (err, activityData) {
            if (err) {
                res.status(config.NOT_FOUND).json({message: "Activity not found"});
            }
            if (activityData) {
                async.parallel({
                    total_invites_sent: function (callback) {
                        User.count({'activities': {"$elemMatch": {'activity_id': req.query.id}}, _id: {$ne: activityData.user_id}}, function (err, data) {
                            if (err)
                                callback("Error in total invite sent");
                            callback(null, data);
                        });
                    },
                    total_invites_accepted: function (callback) {
                        User.count({'activities': {"$elemMatch": {'activity_id': req.query.id, 'action': {$eq: 'going'}}}, _id: {$ne: activityData.user_id}}, function (err, data) {
                            if (err)
                                callback("Error in total invite accepted");
                            callback(null, data);
                        });
                    },
                    total_invites_rejected: function (callback) {
                        User.count({'activities': {"$elemMatch": {'activity_id': req.query.id, 'action': {$eq: 'not_interested'}}}, _id: {$ne: activityData.user_id}}, function (err, data) {
                            if (err)
                                callback("Error in total invite rejected");
                            callback(null, data);
                        });
                    },
                    participants: function (callback) {
                        User.find({'activities': {"$elemMatch": {'activity_id': req.query.id}}}, {_id: 1, mobileNo: 1, name: 1, image: 1, 'activities.$': 1}, function (err, data) {
                            if (err)
                                callback("Error in participants");
                            callback(null, data);
                        });
                    }
                }, function (err, results) {
                    if (err) {
                        
                        return next(err);
                    }
                    if (activityData) {
                        var activityDetails = activityData.toObject();
                        activityDetails.totalInvitesSent = results.total_invites_sent || 0;
                        activityDetails.totalInvitesAccepted = results.total_invites_accepted || 0;
                        activityDetails.totalInvitesNotInterested = results.total_invites_rejected || 0;
                        activityDetails.participants = [];
                        _.each(results.participants, function (obj) {
                            var activityDetails1 = {};
                            activityDetails1._id = obj._id;
                            activityDetails1.mobileNo = obj.mobileNo;
                            activityDetails1.name = obj.name;
                            activityDetails1.image = obj.image;
                            activityDetails1.action = obj.activities[0].action;
                            activityDetails1.isPinned = obj.activities[0].isPinned || false;
                            activityDetails.participants.push(activityDetails1);
                        });

                        res.status(config.OK_STATUS).json(activityDetails);
                    } else {
                        res.status(config.NOT_FOUND).json({message: "Activity not found"});
                    }

                });
            }
        });



    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error",
            error: errors
        });
    }
});


/**
 * @api {Delete} /activity?id=:id Delete Activity - READY
 * @apiName Delete Activity
 * @apiGroup Activity
 * 
 * @apiParam {String} id Activity id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.delete('/', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "activity id is required"
        }
    };
    req.checkQuery(schema);
    var errors = req.validationErrors();
    if (!errors) {
        var json = {'isDeleted': true};
        Activity.update({_id: {$eq: req.query.id}}, {$set: json}, function (err, response) {
            if (err) {
                return next(err);
            } else {
                res.status(config.OK_STATUS).json({message: "Activity deleted successfully"});
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
 * @api {POST} /activity/invites Send activity invites - READY
 * @apiName Send activity invites
 * @apiGroup Activity
 * 
 * @apiParam {String} activity_id Activity id
 * @apiParam {Array} users Array of users id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/invites', function (req, res, next) {
    var schema = {
        'activity_id': {
            notEmpty: true,
            errorMessage: "Activity id is required."
        },
        'users': {
            notEmpty: true,
            errorMessage: "users are required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Activity.findOne({_id: req.body.activity_id}, function (err, activityData) {
            if (activityData) {
                async.each(req.body.users, function (userId, callback) {
                    User.findOne({_id: userId, "activities.activity_id": req.body.activity_id}, function (err, userData) {
                        if (err) {
                            callback("Error in finding user activity");
                        }
                        if (!userData) {
                            User.findOneAndUpdate({_id: userId}, {
                                $push: {
                                    activities: {
                                        "activity_id": req.body.activity_id,
                                        "action": "invited"
                                    }
                                }
                            }, function (err, data) {
                                if (err) {
                                    callback("Error in adding user activity action");
                                }
                                bothelper.add({
                                    'user_id': userId,
                                    'activity_id': req.body.activity_id,
                                    'actionType': 'invited'
                                }, function (err, result) {
                                    if (err) {
                                        callback("Error in adding data in bot");
                                    }
                                    callback();
                                });
                            });
                        } else {
                            callback();
                        }
                    });
                }, function (err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(config.OK_STATUS).json({message: "Users are invited succesfully"});
                });
            } else {
                res.status(config.BAD_REQUEST).json({message: "Activity not exist"});
            }

        });
    } else {
        res.status(config.BAD_REQUEST).json({message: "Validation error", error: errors});
    }
});

/**
 * @api {POST} /activity/actions Add/update activity action - READY
 * @apiName Add/update activity action
 * @apiDescription isPinned and action should be passed alternately depending on the action which needs to be done for the activity id passed.
 * @apiGroup Activity
 * 
 * @apiParam {String} id Activity id 
 * @apiParam {Boolean} [isPinned] Activity user pin status [true,false] 
 * @apiParam {String} [action] Activity user action status ["invited", "going", "not_interested"]
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.post('/actions', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "Activity id is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        req.body.activity_id = req.body.id;
        delete req.body.id;
        Activity.findOne({_id: req.body.activity_id}, function (err, activityData) {
            if (activityData) {
                if (req.body.hasOwnProperty('isPinned') || req.body.hasOwnProperty('action')) {
                    User.findOne({_id: req.userInfo.id, "activities.activity_id": req.body.activity_id}, function (err, userData) {
                        if (err) {
                            return next(err);
                        }
                        if (userData) {
                            var setJSON = {};
                            if (req.body.hasOwnProperty('isPinned')) {
                                setJSON["activities.$.isPinned"] = req.body.isPinned;
                            }
                            if (req.body.hasOwnProperty('action')) {
                                setJSON["activities.$.action"] = req.body.action;
                            }
                            User.findOneAndUpdate({_id: req.userInfo.id, "activities.activity_id": req.body.activity_id}, {
                                $set: setJSON
                            }, function (err, data) {
                                if (err) {
                                    return next(err);
                                }
                                userActivityAction(req, res);
                            });
                        } else {
                            User.findOneAndUpdate({_id: req.userInfo.id}, {
                                $push: {activities: req.body}
                            }, function (err, data) {
                                if (err) {
                                    return next(err);
                                }
                                userActivityAction(req, res);
                            });
                        }
                    });
                } else {
                    res.status(config.BAD_REQUEST).json({message: "You need to send either isPinned or action parameter"});
                }
            } else {
                res.status(config.BAD_REQUEST).json({message: "Activity is not exist"});
            }

        });
    } else {
        res.status(config.BAD_REQUEST).json({message: "Validation error", error: errors});
    }
});


/**
 * @api {POST} /activity/chat_actions Pin/Unpin chat item of activity
 * @apiName pin or unpin activity chat action
 * @apiGroup Activity
 * 
 * @apiParam {String} id Chat item id 
 * @apiParam {Boolean} isPinned Pin status [true,false] 
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.post('/chat_actions', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "Chat item id is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        if (req.body.hasOwnProperty('isPinned')) {
            Activity.findOne({"chatMessages._id": req.body.id}, function (err, acitivityData) {
                if (err) {
                    return next(err);
                }

                if (acitivityData) {
                    if (req.body.isPinned == true || req.body.isPinned == "true") {
                        // Insert into activity collection
                        Activity.findOneAndUpdate({_id: acitivityData._id}, {
                            $push: {pinnedItems: req.body.id}
                        }, function (err, data) { });

                        // Insert into user's activity collection
                        User.findOneAndUpdate({_id: req.userInfo.id, "activities.activity_id": acitivityData._id}, {
                            $push: {"activities.$.pinnedItems": req.body.id}
                        }, function (err, data) { });
                        res.status(config.OK_STATUS).json({message: "Chat item has pinned successfully"});
                    } else {
                        // Remove from activity collection
                        Activity.findOneAndUpdate({_id: acitivityData._id}, {
                            $pull: {pinnedItems: req.body.id}
                        }, function (err, data) { });

                        // Remove from user's collection
                        User.findOneAndUpdate({"activities.activity_id": acitivityData._id}, {
                            $pull: {"activities.$.pinnedItems": req.body.id}
                        }, function (err, data) { });
                        res.status(config.OK_STATUS).json({message: "Chat item has unpinned successfully"});
                    }
                } else {
                    res.status(config.NOT_FOUND).json({message: "Invalid chat id"});
                }

            });

        } else {
            res.status(config.BAD_REQUEST).json({message: "You need to send either isPinned or action parameter"});
        }
    } else {
        res.status(config.BAD_REQUEST).json({message: "Validation error", error: errors});
    }
});

cron.schedule('0 0 0 * * *', function () {
    console.log('running a task every day');
    archiveActivity();
});

function archiveActivity() {
    var today = moment();
    Activity.update({isArchived: {$ne: true}, endDate: {$lt: today}}, {$set: {isArchived: true}}, function (err, response) {
        if (err) {
            console.log("err in cron : ", err);
        }
        if (response) {
            console.log("cron executed");
        }
    });
}

function userActivityAction(req, res) {
    if (req.body.hasOwnProperty('isPinned') && req.body.hasOwnProperty('action')) {
        var action = (req.body.isPinned == true) || (req.body.isPinned == "true") ? "pin" : "unpin";
        async.parallel({
            pin: function (callback) {
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': req.body.activity_id,
                    'actionType': action
                }, function (err, result) {
                    if (err) {
                        callback({message: err.message}, null);
                    }
                    callback(null, {message: "Activity action updated successfully"});
                });
            },
            action: function (callback) {
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': req.body.activity_id,
                    'actionType': req.body.action
                }, function (err, result) {
                    if (err) {
                        callback({message: err.message}, null);
                    }
                    callback(null, {message: "Activity action updated successfully"});
                });
            }
        }, function (err, results) {
            if (err) {
                return next(err);
            }
            res.status(config.OK_STATUS).json({message: "Activity action updated successfully"});
        });
    } else {
        if (req.body.hasOwnProperty('isPinned')) {
            var action = (req.body.isPinned == true) || (req.body.isPinned == "true") ? "pin" : "unpin";
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': req.body.activity_id,
                'actionType': action
            }, function (err, result) {
                if (err) {
                    return next(err);
                }
                res.status(config.OK_STATUS).json({message: "Activity action updated successfully"});
            });
        } else if (req.body.hasOwnProperty('action')) {
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': req.body.activity_id,
                'actionType': req.body.action
            }, function (err, result) {
                if (err) {
                    return next(err);
                }
                res.status(config.OK_STATUS).json({message: "Activity action updated successfully"});
            });
        }
    }
}

function updateActivity(id, data, req, res) {
    Activity.update({_id: {$eq: id}, isArchived: {$ne: true}, isDeleted: {$ne: true}}, {$set: data}, function (err, response) {
        if (err) {
            return next(err);
        } else {
            if (response.n == 1) {
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': id,
                    'actionType': 'update'
                }, function (err, result) { });
                Activity.findOneAndUpdate({_id: id}, {
                    $push: {
                        chatMessages: {
                            user_id: req.userInfo.id,
                            message: "Activity details have changed",
                            mimeType: "notification"
                        }
                    }
                }, function (err, data) {
                    if (err) {
                        return next(err);
                    }
                });

                res.status(config.OK_STATUS).json({message: "Activity updated successfully"});
            } else {
                res.status(config.NOT_FOUND).json({message: "Invalid acitivity id"});
            }
        }
    });
}

function insertActivity(objData, req, res) {
    var activityObject = new Activity(objData);
    activityObject.save(function (err, acitivityData) {
        if (err) {
            return next(err);
        } else {
            // Add action in bot
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': acitivityData._id,
                'actionType': 'create'
            }, function (err, result) { });

            //Set user's deault acitivity action to going
            User.findOneAndUpdate({_id: req.userInfo.id}, {
                $push: {activities: {'activity_id': acitivityData._id, 'action': 'going'}}
            }, function (err, data) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({message: "Error in adding user activity action"});
                }
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': acitivityData._id,
                    'actionType': 'going'
                }, function (err, result) { });
            });

            res.status(config.OK_STATUS).json({message: "Activity created successfully", activity: acitivityData});
        }
    });
}

function sortActivityByDate(arr, order, sortingField) {
    if (order === "desc") {
        return _.sortBy(arr, function (node) {
            return -(new Date(node[sortingField]).getTime());
        });
    } else if (order === "asc") {
        return _.sortBy(arr, function (node) {
            return (new Date(node[sortingField]).getTime());
        });
    }
}

module.exports = router;