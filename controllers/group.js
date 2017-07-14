var express = require('express');
var router = express.Router();
var config = require('../config');

var Group = require("../models/group");

var fs = require('fs');
var path = require('path');

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
                            res.status(config.OK_STATUS).json({message: 'Group created successfully.', data: groupData});
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
                res.status(config.OK_STATUS).json({message: 'Group created successfully.'});
            }
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
    var json = req.body;
    var id = json.id;
    delete json['id'];
    var schema = {
        'id': {
            notEmpty: true,
            errorMessage: "activity id is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
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
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});
/**
 * @api {delete} /group?id=:id Delete Group
 * @apiName Delete Group
 * @apiGroup User - READY
 * 
 * @apiParam {String} id Activity id
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
            errorMessage: "group id is required"
        }
    };
    req.checkQuery(schema);
    var errors = req.validationErrors();
    if (!errors) {
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
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error ",
            error: errors
        });
    }
});
module.exports = router;