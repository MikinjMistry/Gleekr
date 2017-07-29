var express = require('express');
var router = express.Router();
var config = require('../config');
var async = require('async');

var Group = require("../models/group");
var User = require("../models/user");

var fs = require('fs');
var path = require('path');
var _ = require('underscore');

var client = require("../mqtt/mqttClient");

/**
 * @api {post} /group Create Group
 * @apiName Create Group
 * @apiGroup Group
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} name  form-data: group name
 * @apiParam {file} file form-data: file object [jpg,png]
 *  
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/', function (req, res, next) {
    var schema = {
        'name': {
            notEmpty: true,
            errorMessage: "name is required"
        }
    };
    req.checkBody(schema);

    var errors = req.validationErrors();
    if (!errors) {
        var json = req.body;
        var userInfo = req.userInfo;
        json.user_id = userInfo.id;
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
                        json.image = imagepath;
                        var groupObject = new Group(json);
                        groupObject.save(function (err, groupData) {
                            if (err) {
                                return next(err);
                            } else {
                                res.status(config.OK_STATUS).json({message: 'Group created successfully.', group: _.omit(groupData.toObject(), "pinnedItems", "chatMessages")});
                            }
                        });
                    }
                });
            } else {
                res.status(config.BAD_REQUEST).json({message: "This File format is not allowed"});
            }
        } else {
            var groupObject = new Group(json);
            groupObject.save(function (err, groupData) {
                if (err) {
                    return next(err);
                } else {
                    res.status(config.OK_STATUS).json({message: 'Group created successfully.', group: _.omit(groupData.toObject(), "pinnedItems", "chatMessages")});
                }
            });
        }
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error",
            error: errors
        });
    }
});
/**
 * @api {put} /group Update Group
 * @apiName Update Group
 * @apiGroup Group
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {String} id form-data: group id that is going to update
 * @apiParam {String} name  form-data: group name
 * @apiParam {file} file form-data: file object [jpg,png]
 *  
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.put('/', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            isMongoId: {
                errorMessage: "Invalid id"
            },
            errorMessage: "group id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();

    if (!errors) {
        Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
                var json = req.body;
                var userInfo = req.userInfo;
                var id = json.id;
                delete json['id'];
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
                                json.image = imagepath;
                                Group.update({_id: {$eq: id}}, {$set: json}, function (err, response) {
                                    if (err) {
                                        return next(err);
                                    } else {
                                        res.status(config.OK_STATUS).json({message: "Group updated successfully"});
                                    }
                                });
                            }
                        });
                    } else {
                        res.status(config.BAD_REQUEST).json({message: "This File format is not allowed"});
                    }
                } else {
                    Group.update({_id: {$eq: id}}, {$set: json}, function (err, response) {
                        if (err) {
                            return next(err);
                        } else {
                            res.status(config.OK_STATUS).json({message: "Group updated successfully"});
                        }
                    });
                }

            } else {
                res.status(config.NOT_FOUND).json({
                    message: "Group not found",
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});
/**
 * @api {delete} /group?id=:id Delete Group
 * @apiName Delete Group
 * @apiGroup Group
 * 
 * @apiParam {String} id Group id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.delete('/', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            isMongoId: {
                errorMessage: "Invalid id"
            },
            errorMessage: "group id is required"
        }
    };
    req.checkQuery(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Group.findOne({_id:{$eq: req.query.id}, isDeleted: {$ne: true}}, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
                Group.update({_id: {$eq: req.query.id}}, {$set: {isDeleted: true}}, function (err, response) {
                    if (err) {
                        return next(err);
                    } else {
                        var result = {
                            message: "Group deleted successfully"
                        };
                        res.status(config.OK_STATUS).json(result);
                    }
                });
            } else {
                res.status(config.NOT_FOUND).json({
                    message: "Group not found",
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

/**
 * @api {post} /group/add_member Add Member to Group
 * @apiName Add Member to Group
 * @apiGroup Group
 * 
 * @apiParam {Array} members array of userid to add as member
 * @apiParam {String} id Group id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/add_member', function (req, res, next) {
    var schema = {
        'members': {
            notEmpty: true,
            errorMessage: "Members are required"
        },
        'id': {
            notEmpty: true,
            isMongoId: {
                errorMessage: "Invalid id"
            },
            errorMessage: "group id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
				
                var arr = _.map(req.body.members, function (val) {
                    return {'user_id': val};
                });
				
                Group.findOneAndUpdate({_id: req.body.id}, {
                    $pushAll: {
                        'members': arr
                    }
                }, function (err, data) {
                    if (err) {
                        return next(err);
                    }
					
					async.waterfall([
						function(callback){
							Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
								if (!err) {
									if(groupData && groupData.members.length > 0){
										callback(null,_.pluck(groupData.members,'user_id'))
									} else {
										callback("No group member available");
									}
								}
								else{
									callback("Error in finding group members");
								}
							});
						},
						function(group_members,callback){
							
							async.eachSeries(arr,function(member,loop_callback){
						
								// Fetch info about new joined user
								User.findOne({ _id: member.user_id }, function (err, userData) {
									if (!err) {
										// Send notification for each member
										var username = userData.mobileNo;
										if(userData.name){
											username = userData.name;
										}
										
										// Send notification to each member
										_.each(group_members,function(member){
											client.publishMessage(member, 
												{"type":"group-notification",
												"message":username+" has been added in group "+groupData.name,
												data:groupData}, 
												function (status) {
													console.log("Notification send to " + member);
											});
										});
									}
									loop_callback();
								});
							},function(err){
								callback(null);
							});
						}
					],function(err,result){
						res.status(config.OK_STATUS).json({'message': 'Member successfully added.'});
					});
                });
            } else {
                res.status(config.NOT_FOUND).json({
                    message: "Group not found",
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});
/**
 * @api {post} /group/remove_member Delete member from Group
 * @apiName Delete member from Group
 * @apiGroup Group
 * 
 * @apiParam {Array} members array of userid to add as member
 * @apiParam {String} id Group id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/remove_member', function (req, res, next) {
    var schema = {
        'members': {
            notEmpty: true,
            errorMessage: "Members are required"
        },
        'id': {
            notEmpty: true,
            isMongoId: {
                errorMessage: "Invalid id"
            },
            errorMessage: "group id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
                Group.findOneAndUpdate({_id: req.body.id}, {
                    $pull: {
                        'members': {'user_id': {'$in': req.body.members}}
                    }
                }, function (err, data) {
                    if (err) {
                        return next(err);
                    }
					
					async.waterfall([
						function(callback){
							Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
								if (!err) {
									if(groupData && groupData.members.length > 0){
										callback(null,_.pluck(groupData.members,'user_id'))
									} else {
										callback("No group member available");
									}
								}
								else{
									callback("Error in finding group members");
								}
							});
						},
						function(group_members,callback){
							
							async.eachSeries(req.body.members,function(user,loop_callback){
						
								// Fetch info about new joined user
								User.findOne({ _id: user }, function (err, userData) {
									if (!err) {
										// Send notification for each member
										var username = userData.mobileNo;
										if(userData.name){
											username = userData.name;
										}
										
										// Send notification to each member
										_.each(group_members,function(member){
											client.publishMessage(member, 
												{"type":"group-notification",
												"message":username+" has removed from group "+groupData.name,
												data:groupData}, 
												function (status) {
													console.log("Notification send to " + member);
											});
										});
									}
									loop_callback();
								});
							},function(err){
								callback(null);
							});
						}
					],function(err,result){
						res.status(config.OK_STATUS).json({'message': 'Member successfully removed.'});
					});
                });

            } else {
                res.status(config.BAD_REQUEST).json({
                    message: "Group not found",
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});
/**
 * @api {post} /group/exit_group Exit from Group
 * @apiName Exit from Group
 * @apiGroup Group
 * 
 * @apiParam {String} id Group id
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 *
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/exit_group', function (req, res, next) {
    var schema = {
        'id': {
            notEmpty: true,
            isMongoId: {
                errorMessage: "Invalid id"
            },
            errorMessage: "group id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        Group.findOne({_id:{$eq: req.body.id}, isDeleted: {$ne: true}}, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
                Group.findOneAndUpdate({_id: req.body.id}, {
                    $pull: {
                        'members': {'user_id': {'$eq': req.userInfo.id}}
                    }
                }, function (err, data) {
                    if (err) {
                        return next(err);
                    }
					
					
					User.findOne({ _id: req.userInfo.id }, function (err, userData) {
						if (!err) {
							// Send notification for each member
							var username = userData.mobileNo;
							if(userData.name){
								username = userData.name;
							}
							
							// Send notification to each member
							_.each(groupData.members,function(member){
								client.publishMessage(member.user_id, 
									{"type":"group-notification",
									"message":username+" has removed from group "+groupData.name,
									data:groupData}, 
									function (status) {
										console.log("Notification send to " + member.user_id);
								});
							});
						}
					});

                    res.status(config.OK_STATUS).json({'message': 'Exit from group successfully.'});
                });
            } else {
                res.status(config.NOT_FOUND).json({
                    message: "Group not found",
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});

module.exports = router;