var express = require('express');
var router = express.Router();
var config = require('../config');

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
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.get('/', function (req, res, next) {
    async.parallel({
        others: function (callback) {
            User.find({ _id: req.userInfo.id })
                .select('activities')
                .populate({ path: 'activities.activity_id', model: 'activities', match: { isDeleted: { $ne: true } } })
                .exec(function (err, data) {
                    if (err) {
                        callback('Error in fetching activities', null);
                    }
                    callback(null, data);
                });
        },
        createdByMe: function (callback) {
            Activity.find({ user_id: req.userInfo.id, isDeleted: { $ne: true } }, function (err, data) {
                if (err) {
                    callback('Error in fetching My activity', null);
                }
                callback(null, data);
            });
        },
    }, function (err, results) {
        if (err) {
            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in fetching activity data" });
        }
        var responseData = {
            new: [],
            upcoming: [],
            going: [],
            createdByMe: (results.createdByMe && results.createdByMe.length > 0) ? results.createdByMe : [],
            pinned: [],
            notInterested: []
        };
        if (results.others.length != 0) {
            var activities = results.others[0].activities;
            var previousDate = new Date(moment().subtract(7, 'days').format("YYYY-MM-DD")).getTime();
            var nextTwoDate = new Date(moment().add(3, 'days').format("YYYY-MM-DD HH:mm")).getTime();
            var currentDate = new Date().getTime();
            var invited = _.filter(activities, function (activity) { return activity.action === "invited" && activity.activity_id; });

            //new
            var newActivity = _.union(invited, results.createdByMe);
            _.each(newActivity, function (obj) {
                var activityDate = new Date(obj.startDate).getTime();
                if (activityDate >= previousDate && activityDate <= currentDate) {
                    var flag = jsonhelper.isExist(responseData.new, obj._id);
                    if (!flag) {
                        responseData.new.push(obj);
                    }
                }
            });

            //going
            responseData.going = _.pluck(_.filter(activities, function (activity) { return activity.action === "going" && activity.activity_id; }), 'activity_id');

            //upcoming
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

            //Not Intrested
            responseData.notInterested = _.pluck(_.filter(activities, function (activity) { return activity.action === "not_interested" && activity.activity_id; }), 'activity_id');

            //pinned
            responseData.pinned = _.pluck(_.filter(activities, function (activity) { return activity.isPinned && activity.activity_id; }), 'activity_id');

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
                        res.status(config.MEDIA_ERROR_STATUS).json({ message: "Error in uploading activity image" });
                    } else {
                        json.photo = "/upload/activity/" + filename;
                        insertActivity(json, req, res)
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({ message: "File format not allowed" });
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

        if (req.body.hasOwnProperty('startTime')) {
            req.body.startTime = moment(req.body.startTime, 'HH:mm');
        }
        if (req.body.hasOwnProperty('endTime')) {
            req.body.endTime = moment(req.body.endTime, 'HH:mm');
        }


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
                        res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in activity image upload" });
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
                res.status(config.MEDIA_ERROR_STATUS).json({ message: "This File format is not allowed" });
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
        Activity.findOne({ _id: req.query.id, isDeleted: { $ne: true } }, function (err, activityData) {
            if (err) {
                res.status(config.DATABASE_ERROR_STATUS).json({ message: "Activity not found" });
            }

            if (activityData) {
                res.status(config.OK_STATUS).json(activityData);
            } else {
                res.status(config.NOT_FOUND).json({ message: "Activity not found" });
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
        var json = { 'isDeleted': true };
        Activity.update({ _id: { $eq: req.query.id } }, { $set: json }, function (err, response) {
            if (err) {
                res.status(config.DATABASE_ERROR_STATUS).json({ message: "Activity could not be deleted" });
            } else {
                res.status(config.OK_STATUS).json({ message: "Activity deleted successfully" });
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
 * @api {POST} /activity/actions Add or update activity action - IN PROGRESS
 * @apiName Add or update activity action
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
        if (req.body.hasOwnProperty('isPinned') || req.body.hasOwnProperty('action')) {
            User.findOne({ _id: req.userInfo.id, "activities.activity_id": req.body.activity_id }, function (err, userData) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in adding user activity action", err: err });
                }
                if (userData) {
                    User.findOneAndUpdate({ _id: req.userInfo.id, "activities.activity_id": req.body.activity_id }, {
                        $set: { "activities.$": req.body }
                    }, function (err, data) {
                        if (err) {
                            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in updating user activity" });
                        }
                        userActivityAction(req, res);
                    });
                } else {
                    User.findOneAndUpdate({ _id: req.userInfo.id }, {
                        $push: { activities: req.body }
                    }, function (err, data) {
                        if (err) {
                            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in adding user activity action", err: err });
                        }
                        userActivityAction(req, res);
                    });
                }
            });
        } else {
            res.status(config.BAD_REQUEST).json({ message: "You need to send either isPinned or action parameter" });
        }
    } else {
        res.status(config.BAD_REQUEST).json({ message: "Validation error", error: errors });
    }
});


function userActivityAction(req, res) {
    if (req.body.hasOwnProperty('isPinned') && req.body.hasOwnProperty('action')) {
        var action = req.body.isPinned ? "pin" : "unpin";
        async.parallel({
            pin: function (callback) {
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': req.body.activity_id,
                    'actionType': action
                }, function (err, result) {
                    if (err) {
                        callback({ message: err.message }, null);
                    }
                    callback(null, { message: "Activity action updated successfully" });
                });
            },
            action: function (callback) {
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': req.body.activity_id,
                    'actionType': req.body.action
                }, function (err, result) {
                    if (err) {
                        callback({ message: err.message }, null);
                    }
                    callback(null, { message: "Activity action updated successfully" });
                });
            }
        }, function (err, results) {
            if (err) {
                res.status(config.DATABASE_ERROR_STATUS).json({ message: 'Error in adding activity status' });
            }
            res.status(config.OK_STATUS).json({ message: "Activity action updated successfully" });
        });
    } else {
        if (req.body.hasOwnProperty('isPinned')) {
            var action = req.body.isPinned ? "pin" : "unpin";
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': req.body.activity_id,
                'actionType': action
            }, function (err, result) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: err.message });
                }
                res.status(config.OK_STATUS).json({ message: "Activity action updated successfully" });
            });
        } else if (req.body.hasOwnProperty('action')) {
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': req.body.activity_id,
                'actionType': req.body.action
            }, function (err, result) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: err.message });
                }
                res.status(config.OK_STATUS).json({ message: "Activity action updated successfully" });
            });
        }
    }
}

function updateActivity(id, data, req, res) {
    Activity.update({ _id: { $eq: id } }, { $set: data }, function (err, response) {
        if (err) {
            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured while updating activity",err:err });
        } else {
			if(response.n == 1)
			{
				bothelper.add({
					'user_id': req.userInfo.id,
					'activity_id': id,
					'actionType': 'update'
				}, function (err, result) { });
				res.status(config.OK_STATUS).json({ message: "Activity updated successfully" });
			}
			else
			{
				res.status(config.NOT_FOUND).json({ message: "Invalid acitivity id" });
			}
        }
    });
}

function insertActivity(objData, req, res) {
    var activityObject = new Activity(objData);
    activityObject.save(function (err, acitivityData) {
        if (err) {
            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured in creating activity" });
        } else {
            // Add action in bot
            bothelper.add({
                'user_id': req.userInfo.id,
                'activity_id': acitivityData._id,
                'actionType': 'create'
            }, function (err, result) { });

            //Set user's deault acitivity action to going
            User.findOneAndUpdate({ _id: req.userInfo.id }, {
                $push: { activities: { 'activity_id': acitivityData._id, 'action': 'going' } }
            }, function (err, data) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in adding user activity action", err: err });
                }
                bothelper.add({
                    'user_id': req.userInfo.id,
                    'activity_id': acitivityData._id,
                    'actionType': 'going'
                }, function (err, result) { });
            });

            res.status(config.OK_STATUS).json({ message: "Activity created successfully", activity: acitivityData });
        }
    });
}

module.exports = router;