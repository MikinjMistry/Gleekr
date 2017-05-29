var express = require('express');
var router = express.Router();

var activity = require("../models/activity");

var fs = require('fs');
var path = require('path');
require('dotenv').config();

/* GET activity listing. */
router.get('/', function(req, res, next) {
  res.send('Activity controller called!');
});

/**
 * @api {put} /activities/insert
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
 * @apiSuccess {Number} Success 0 : Fail and 1 : Success.
 * @apiSuccess {String} message Validation or success message.
 */
router.post('/insert', function(req, res, next) {
    var json = req.body;
	json.user_id = req.userInfo.id;
	json.isDeleted = true;
	if (req.files) {
		var file = req.files.file;
        var dir = "./upload/activity";
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
                    json.photo = "/upload/activity/" + filename;
					var activityObject = new activity(json);
					activityObject.save(function(err,data){
						if(err)
						{
							var result = {
								success: 0,
								message: "Error in creating activity"
							};
						}
						else
						{
							var result = {
								success: 1,
								message: "Activity has been added",
								activity : data
							};
						}
						res.json(result);
					});
                }
            });
        } else {
            result = {
                success: 0,
                message: "This File format is not allowed",
                error: []
            };
        }
	}
	else
	{
		var activityObject = new activity(json);
		activityObject.save(function(err,data){
			if(err)
			{
				var result = {
					success: 0,
					message: "Error in creating activity"
				};
			}
			else
			{
				var result = {
					success: 1,
					message: "Activity has been added",
					activity : data
				};
			}
			res.json(result);
		});
	}
});

/* Edit activity */
router.post('/update',function(req,res,next){
	var json = req.body;
    activity.update({_id: {$eq: req.body.id}}, {$set: json}, function (err, responce) {
        if (err) {
            result = {
                success: 0,
                message: "Activity updation process has been failed",
                error: err
            };
        } else {
            var result = {
                success: 1,
                message: "Activity has been updated."
            };
        }
		res.json(result);
    });
});

/* Delete activity */
router.delete('/delete',function(req,res,next){
	var json = {'is_delete' : true};
    activity.update({_id: {$eq: req.query.id}}, {$set: json}, function (err, responce) {
        if (err) {
            result = {
                success: 0,
                message: "Activity delete operation has been failed",
                error: err
            };
        } else {
            var result = {
                success: 1,
                message: "Activity has been deleted."
            };
        }
		res.json(result);
    });
});

module.exports = router;
