var express = require('express');
var router = express.Router();

var activity = require("../models/activity");

var fs = require('fs');
var path = require('path');
require('dotenv').config();

/* GET activity listing. */
router.get('/', function(req, res, next) {
  res.status(200).send('Activity controller called!');
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
 * @apiSuccess {String} message Error or success message.
 * @apiSuccess {Object} activity If activity successfully inserted
 */
router.put('/insert', function(req, res, next) {
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
					res.status(422).json({message: "Error in activity image upload"});
                } else {
                    json.photo = "/upload/activity/" + filename;
					var activityObject = new activity(json);
					activityObject.save(function(err,data){
						if(err)
						{
							res.status(422).json({ message: "Error in creating activity" });
						}
						else
						{
							var result = {
								message: "Activity has been added",
								activity : data
							};
							res.status(200).json(result);
						}
					});
                }
            });
        } else {
            res.status(415).json({ message: "This File format is not allowed"});
        }
	}
	else
	{
		console.log("data = ",json);
		var activityObject = new activity(json);
		activityObject.save(function(err,data){
			if(err)
			{
				res.status(422).json({message: "Error in creating activity : ",err});
			}
			else
			{
				var result = {
					message: "Activity has been added",
					activity : data
				};
				res.status(200).json(result);
			}
		});
	}
});

/**
 * @api {put} /activities/update
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
 * @apiSuccess {String} message Error or success message.
 */
router.put('/update',function(req,res,next){
	var json = req.body;
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
                    res.status(422).json({message: "Error in activity image upload"});
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
            res.status(415).json({ message: "This File format is not allowed"});
        }
    } else {
        data = req.body;
        updateActivity(req.body.id, data, res);
    }
});

/**
 * @api {Delete} /activities/delete
 * @apiName Delete Activity
 * @apiGroup Activity
 * 
 * @apiParam {String} id Activity id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key.
 * 
 * @apiSuccess {String} message Error or success message.
 */
router.delete('/delete',function(req,res,next){
	var json = {'isDeleted' : true};
    activity.update({_id: {$eq: req.query.id}}, {$set: json}, function (err, responce) {
        if (err) {
			res.status(422).json({ message: "Activity delete operation has been failed" });
        } else {
			res.status(200).json({message: "Activity has been deleted."});
        }
    });
});

function updateActivity(id, data, res) {
    activity.update({_id: {$eq: id}}, {$set: data}, function (err, responce) {
        if (err) {
            res.status(422).json({ message: "Error in creating activity" });
        } else {
            res.status(200).json({message: "Activity has been updated"});
        }
    });
}

module.exports = router;