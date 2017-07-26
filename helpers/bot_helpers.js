var Bot = require("../models/bot");
var User = require("../models/user");
var Activity = require("../models/activity");

var async = require('async');
var client = require("../mqtt/mqttClient");
var _ = require('underscore');
var botFunction = {};

botFunction.add = function (botJson, loginUser, callback) {
    console.log("Add here");
    async.parallel({
        botNotification: function (parallelCallback) {
            async.waterfall([
                function (waterfallCallback) {
                    async.parallel({
                        "userInfo": function (parallel2Callback) {
                            User.findOne({ _id: loginUser }, function (err, userData) {
                                if (err) {
                                    parallel2Callback(err);
                                }
                                parallel2Callback(null, userData);
                            });
                        },
                        "activityInfo": function (parallel2Callback) {
                            Activity.findOne({ _id: botJson.activity_id }, function (err, activityData) {
                                if (err) {
                                    parallel2Callback(err);
                                }
                                parallel2Callback(null, activityData);
                            });
                        }
                    },
                        function (err, results) {
                            if (err) {
                                waterfallCallback(err);
                            }
                            waterfallCallback(null, results);
                        });

                },
                function (results, waterfallCallback) {
                    User.find({ 'activities': { "$elemMatch": { 'activity_id': botJson.activity_id, 'action': { $eq: 'going' } } } }, function (err, goingUser) {
                        if (err) {
                            waterfallCallback(err);
                        }
                        var userName = results.userInfo.mobileNo;
                        if (results.userInfo.hasOwnProperty('name')) {
                            userName = results.userInfo.name || results.userInfo.mobileNo;
                        }
                        _.each(goingUser, function (userObj) {
                            var activityName = results.activityInfo.name;
                            var action = botJson.actionType;
                            console.log("action:", action);
                            var message = "";
                            if (action == "create") {
                                message = "You have created " + activityInfo + " activity.";
                            } else if (action == "update") {
                                message = activityName + " has been updated by " + userName + ".";
                            } else if (action == "pin") {
                                message = userName + " has pinned " + activityName + " activity.";
                            }
                            else if (action == "unpin") {
                                message = userName + " has unpinned " + activityName + " activity.";
                            }
                            else if (action == "going") {
                                message = userName + " is going to attend " + activityName + " activity.";
                            }
                            else if (action == "not_interested") {
                                message = userName + " is declined to attend " + activityName + " activity.";
                            }
                            else if (action == "invited") {
                                message = userName + " has been invited to " + activityName + " activity.";
                            }
                            console.log("===>", userObj._id);
                            client.publishMessage(userObj._id, { "notification": message }, function (status) {
                                console.log("Notification send to " + userObj._id);
                            });
                        });
                        waterfallCallback(null, true)
                    });
                }
            ], function (err, result) {
                if (err) {
                    parallelCallback({ message: 'Error in notification' }, null);
                }
                parallelCallback(null, { message: 'Notification send successfully' });
            });
        },
        insertBot: function (parallelCallback) {
            botObj = new Bot(botJson);
            botObj.save(function (err, data) {
                if (err) {
                    parallelCallback({ message: 'Error in inserting bot' }, null);
                }
                parallelCallback(null, { message: 'Bot record is inserted successfuly.' });
            });
        }
    }, function (err, results) {
        if (err) {
            callback({ message: 'Error in inserting bot' }, null);
        }
        callback(null, { message: 'Bot record is inserted successfuly.' });
    });
}
module.exports = botFunction;