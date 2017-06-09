var express = require('express');
var router = express.Router();
var config = require('../config');

var Activity = require("../models/activity");
var Bot = require("../models/bot");
var User = require("../models/user");

var moment = require('moment');
var fs = require('fs');
var path = require('path');

/* GET activity listing. */
router.get('/', function (req, res, next) {
    Activity.find({ 'user_id': req.userInfo.id }, function (err, activities) {
        if (err) {
            result = {
                message: "Error in get all activities"
            };
            res.status(config.DATABASE_ERROR_STATUS).json(result);
        } else {
            result = {
                data: activities
            }
            res.status(config.OK_STATUS).json(result);
        }
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
 * @apiParam {Date} startDate form-data: Activity start date 
 * @apiParam {Date} startTime form-data: Activity start time
 * @apiParam {Date} [endDate] form-data: Activity end time
 * @apiParam {Date} [endTime] form-data: Activity end time
 * @apiParam {String} location form-data: Activity location
 * @apiParam {String} [description] form-data: Activity description
 * @apiParam {Number} [noOfParticipants] form-data: Number of participants
 * @apiParam {Decimal} [costPerPerson] form-data: cost per person
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess (Success 200) {Object} activity If activity successfully inserted.
 * @apiError (Error 4xx) {String} message Validation or error message.
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
    var errors = req.validationErrors();
    if (!errors) {

        var json = req.body;

        if (json.hasOwnProperty('startTime')) {
            json.startTime = moment(json.startTime, 'HH:mm');
        }
        if (json.hasOwnProperty('endTime')) {
            json.endTime = moment(json.startTime, 'HH:mm');
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
                        res.status(config.MEDIA_ERROR_STATUS).json({ message: "Error in activity image upload" });
                    } else {
                        json.photo = "/upload/activity/" + filename;
                        var activityObject = new Activity(json);
                        activityObject.save(function (err, data) {
                            if (err) {
                                res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured in creating activity" });
                            } else {

                                //Bot
                                var botObj = new Bot({
                                    'user_id': req.userInfo.id,
                                    'activity_id': data._id,
                                    'actionType': 'create'
                                });
                                botObj.save(function (err, data) { });

                                //Set user's deault acitivity action to going

                                res.status(config.OK_STATUS).json({ message: "Activity created successfully", activity: data });
                            }
                        });
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({ message: "This File format is not allowed" });
            }
        }
        else {
            var activityObject = new Activity(json);
            activityObject.save(function (err, data) {
                if (err) {
                    res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured while creating activity : ", err });
                } else {
                    res.status(config.OK_STATUS).json({ message: "Activity created successfully", activity: data });
                }
            });
        }
    }
    else {
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
 * @apiParam {Date} startDate form-data: Activity start date 
 * @apiParam {Date} startTime form-data: Activity start time
 * @apiParam {Date} endDate form-data: Activity end time
 * @apiParam {Date} endTime form-data: Activity end time
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
    }
    else {
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
    }
    else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error",
            error: errors
        });
    }
});

/**
 * @api {Delete} /activity Delete Activity - READY
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
    }
    else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

function updateActivity(id, data, req, res) {
    Activity.update({ _id: { $eq: id } }, { $set: data }, function (err, response) {
        if (err) {
            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured while creating activity" });
        } else {
            botObj = new Bot({
                'user_id': req.userInfo.id,
                'activity_id': id,
                'actionType': 'update'
            });
            botObj.save(function (err, data) { });
            res.status(config.OK_STATUS).json({ message: "Activity updated successfully" });
        }
    });
}

module.exports = router;