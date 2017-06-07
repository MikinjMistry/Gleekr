var express = require('express');
var router = express.Router();
var config = require('../config');
var Activity = require("../models/activity");
var Bot = require("../models/bot");

var moment = require('moment');
var fs = require('fs');
var path = require('path');

/* GET activity listing. */
router.get('/', function(req, res, next) {
  res.status(config.OK_STATUS).send('Activity controller called!');
});

/**
 * @api {post} /activities
 * @apiName Insert Activity
 * @apiGroup Activity
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {file} photo form-data: file object for image [jpg,png]
 * @apiParam {String} name  form-data: Activity name
 * @apiParam {Date} startDate form-data: Activity start date 
 * @apiParam {Date} startTime form-data: Activity start time
 * @apiParam {Date} endDate form-data: Activity end time
 * @apiParam {Date} endTime form-data: Activity end time
 * @apiParam {String} location form-data: Activity location
 * @apiParam {String} description form-data: Activity description
 * @apiParam {Number} noOfParticipants form-data: Number of participants
 * @apiParam {Number} costPerPerson form-data: cost per person
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiSuccess (Success 200) {Object} activity If activity successfully inserted.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/', function(req, res, next) {

    var schema = {
        'name': {
            notEmpty: true,
            errorMessage: "Activity name is required"
        },
        'startDate': {
            notEmpty: true,
            errorMessage: "Activity start date is required"
        },
        'startTime': {
            notEmpty: true,
            errorMessage: "Activity start time is required"
        },
        'endDate': {
            notEmpty: true,
            errorMessage: "Activity end date is required"
        },
        'endTime': {
            notEmpty: true,
            errorMessage: "Activity end time is required"
        },
        'location': {
            notEmpty: true,
            errorMessage: "Activity location is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if(!errors)
    {

        var json = req.body;
		
		if(json.hasOwnProperty('startTime'))
		{
			json.startTime = moment(json.startTime, 'HH:mm');
		}
		if(json.hasOwnProperty('endTime'))
		{
			json.endTime = moment(json.startTime, 'HH:mm');
		}

		json.user_id = req.userInfo.id;
    	json.isDeleted = true;
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
    					res.status(config.MEDIA_ERROR_STATUS).json({message: "Error in activity image upload"});
                    } else {
                        json.photo = "/upload/activity/" + filename;
    					var activityObject = new Activity(json);
    					activityObject.save(function(err,data){
    						if(err) {
    							res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error occured in creating activity" });
    						} else {
    							botObj = new Bot({
    								'user_id':req.userInfo.id,
    								'activity_id':data._id,
    								'actionType':'create'
    							});
    							botObj.save(function(err,data){});
    							res.status(config.OK_STATUS).json({ message: "Activity has been added", activity:data});
    						}
    					});
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({ message: "This File format is not allowed"});
            }
    	}
    	else
    	{
    		var activityObject = new Activity(json);
    		activityObject.save(function(err,data){
    			if(err) {
    				res.status(config.DATABASE_ERROR_STATUS).json({message: "Error in creating activity : ",err});
    			} else {
    				res.status(config.OK_STATUS).json({ message: "Activity has been added", activity:data});
    			}
    		});
    	}
    }
    else
    {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

/**
 * @api {put} /activities
 * @apiName Update Activity
 * @apiGroup Activity
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} id form-data: activity id that is going to update
 * @apiParam {file} photo form-data: file object for image [jpg,png]
 * @apiParam {String} name  form-data: Activity name
 * @apiParam {Date} startDate form-data: Activity start date 
 * @apiParam {Date} startTime form-data: Activity start time
 * @apiParam {Date} endDate form-data: Activity end time
 * @apiParam {Date} endTime form-data: Activity end time
 * @apiParam {String} location form-data: Activity location
 * @apiParam {String} description form-data: Activity description
 * @apiParam {Number} noOfParticipants form-data: Number of participants
 * @apiParam {Number} costPerPerson form-data: cost per person
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.put('/',function(req,res,next){

    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "To update activity, activity id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if(!errors)
    {

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
                        res.status(config.DATABASE_ERROR_STATUS).json({message: "Error in activity image upload"});
                    } else {
                        data = {};
                        if (req.body) {
                            data = req.body;
                        }
                        data.photo = "/upload/activity/" + filename;
                        updateActivity(req.body.id, data, res);
                    }
                });
            } else {
                res.status(config.MEDIA_ERROR_STATUS).json({ message: "This File format is not allowed"});
            }
        } else {
            data = req.body;
            updateActivity(req.body.id, data, res);
        }
    }
    else
    {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

/**
 * @api {Delete} /activities
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
router.delete('/',function(req,res,next){
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "To delete activity, activity id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if(!errors)
    {
    	var json = {'isDeleted' : true};
        Activity.update({_id: {$eq: req.query.id}}, {$set: json}, function (err, response) {
            if (err) {
    			res.status(config.DATABASE_ERROR_STATUS).json({ message: "Activity delete operation has been failed" });
            } else {
    			res.status(config.OK_STATUS).json({message: "Activity has been deleted."});
            }
        });
    }
    else
    {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

function updateActivity(id, data, res) {
    Activity.update({_id: {$eq: id}}, {$set: data}, function (err, response) {
        if (err) {
            res.status(config.DATABASE_ERROR_STATUS).json({ message: "Error in creating activity" });
        } else {
			botObj = new Bot({
				'user_id':req.userInfo.id,
				'activity_id':id,
				'actionType':'update'
			});
			botObj.save(function(err,data){});
            res.status(config.OK_STATUS).json({message: "Activity has been updated"});
        }
    });
}

module.exports = router;