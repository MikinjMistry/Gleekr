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

var groupAction = {
    created: "created",
    updatedName: "updated-name",
    updatedIcon: "updated-icon",
    addedMembers: "added-members",
    removedMembers: "removed-members",
    left: "left"
};
/**
 * @api {get} /group Get all group data
 * @apiName Get all Group
 * @apiGroup Group
 * @apiDescription You will get all groups detail
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
*/
router.get('/', function(req, res, next){
    Group.find({$or : [ {'members' : {"$elemMatch": {user_id : req.userInfo.id}}},{user_id : { $eq : req.userInfo.id}}]} , function(err, data){
        if (err)
            res.status(config.BAD_REQUEST).json("Error in get all group detail");
        res.status(config.OK_STATUS).json(data);
    });
});

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
            var groupDir = "./upload/" + userInfo.id + "/group";
            var mimetype = ['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'];
            if (mimetype.indexOf(file.mimetype) != -1) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
                if (!fs.existsSync(groupDir)) {
                    fs.mkdirSync(groupDir);
                }
                extention = path.extname(file.name);
                filename = "group_" + new Date().getTime() + extention;
                file.mv(groupDir + '/' + filename, function (err) {
                    if (err) {
                        return next(err);
                    } else {
                        json.image = '/upload/' + userInfo.id + '/group/' + filename;
                        json.members = [];
                        json.members.push({ user_id: userInfo.id });
                        createGroup(json, req, res);
                    }
                });
            } else {
                res.status(config.BAD_REQUEST).json({ message: "This File format is not allowed" });
            }
        } else {
            json.members = [];
            json.members.push({ user_id: userInfo.id });
            createGroup(json, req, res);
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
        Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } }, function (err, groupData) {
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
                    var groupDir = "./upload/" + userInfo.id + "/group";
                    var mimetype = ['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'];
                    if (mimetype.indexOf(file.mimetype) != -1) {
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir);
                        }
                        if (!fs.existsSync(groupDir)) {
                            fs.mkdirSync(groupDir);
                        }
                        extention = path.extname(file.name);
                        filename = "group_" + new Date().getTime() + extention;
                        file.mv(groupDir + '/' + filename, function (err) {
                            if (err) {
                                return next(err);
                            } else {
                                if (groupData.image) {
                                    var oldImage = "." + groupData.image;
                                    if (fs.existsSync(oldImage)) {
                                        fs.unlinkSync(oldImage);
                                    }
                                }
                                json.image = '/upload/' + userInfo.id + '/group/' + filename;
                                updateGroup(id, json, groupData, req, res);
                            }
                        });
                    } else {
                        res.status(config.BAD_REQUEST).json({ message: "This File format is not allowed" });
                    }
                } else {
                    updateGroup(id, json, groupData, req, res);
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
        Group.findOne({ _id: { $eq: req.query.id }, isDeleted: { $ne: true } }, function (err, groupData) {
            if (err) {
                return next(err);
            }
            if (groupData) {
                Group.update({ _id: { $eq: req.query.id } }, { $set: { isDeleted: true } }, function (err, response) {
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
        //Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } }, function (err, groupData) {

        Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
            .populate({ path: "members.user_id", select: ["_id", "mobileNo", "name"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
            .exec(function (err, groupData) {

                if (err) {
                    return next(err);
                }
                if (groupData) {

                    var membersArray = _.map(req.body.members, function (val) {
                        return { 'user_id': val };
                    });

                    Group.findOneAndUpdate({ _id: req.body.id }, {
                        $pushAll: {
                            'members': membersArray
                        }
                    }, function (err, updatedData) {
                        if (err) {
                            return next(err);
                        } else {
                            Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
                                .populate({ path: "members.user_id", select: ["_id", "mobileNo"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
                                .exec(function (error, group) {
                                    if (error) {
                                        return next(error);
                                    }

                                    if (group) {
                                        var updatedGroupData = Object.assign({}, group.toObject());
                                        updatedGroupData.members = _.chain(group.members).map(function (item) { return { mobileNo: item.user_id.mobileNo, user_id: item.user_id._id, createdAt: item.createdAt }; }).value();

                                        //send notification to all members
                                        if (updatedGroupData.members.length > 0) {
                                            var newMembers = _.filter(updatedGroupData.members, function (memberObj) {
                                                return req.body.members.indexOf(Object(memberObj.user_id).toString()) > -1;
                                            });

                                            _.every(_.pluck(updatedGroupData.members, 'user_id'), function (member) {
                                                client.publishMessage(member,
                                                    {
                                                        type: "group-notification",
                                                        action: groupAction.addedMembers,
                                                        fromMobileNo: req.userInfo.mobileNo,
                                                        data: _.omit(updatedGroupData, "pinnedItems", "chatMessages"),
                                                        members: newMembers
                                                    },
                                                    function (status) { });
                                            });
                                        }

                                        res.status(config.OK_STATUS).json({ 'message': 'Member successfully added.' });
                                    }
                                });
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
        Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
            .populate({ path: "members.user_id", select: ["_id", "mobileNo", "name"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
            .exec(function (err, groupData) {
                if (err) {
                    return next(err);
                }
                if (groupData) {
                    Group.findOneAndUpdate({ _id: req.body.id }, {
                        $pull: {
                            'members': { 'user_id': { '$in': req.body.members } }
                        }
                    }, function (err, data) {
                        if (err) {
                            return next(err);
                        } else {
                            Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
                                .populate({ path: "members.user_id", select: ["_id", "mobileNo"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
                                .exec(function (error, group) {
                                    if (error) {
                                        return next(error);
                                    }

                                    if (group) {
                                        var updatedGroupData = Object.assign({}, group.toObject());
                                        updatedGroupData.members = _.chain(group.members).map(function (item) { return { mobileNo: item.user_id.mobileNo, user_id: item.user_id._id, createdAt: item.createdAt }; }).value();

                                        //send notification to all members
                                        if (updatedGroupData.members.length > 0) {
                                            var oldGroupData = Object.assign({}, groupData.toObject());
                                            oldGroupData.members = _.chain(groupData.members).map(function (item) { return { mobileNo: item.user_id.mobileNo, user_id: item.user_id._id, createdAt: item.createdAt }; }).value();
                                            var removedMembers = _.filter(oldGroupData.members, function (memberObj) {
                                                return req.body.members.indexOf(Object(memberObj.user_id).toString()) > -1;
                                            });

                                            _.every(_.pluck(updatedGroupData.members, 'user_id'), function (member) {
                                                client.publishMessage(member,
                                                    {
                                                        type: "group-notification",
                                                        action: groupAction.removedMembers,
                                                        fromMobileNo: req.userInfo.mobileNo,
                                                        data: _.omit(updatedGroupData, "pinnedItems", "chatMessages"),
                                                        members: removedMembers
                                                    },
                                                    function (status) { });
                                            });
                                        }

                                        res.status(config.OK_STATUS).json({ 'message': 'Member successfully removed.' });
                                    }
                                });
                        }
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
        Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
            .populate({ path: "members.user_id", select: ["_id", "mobileNo", "name"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
            .exec(function (err, groupData) {
                if (err) {
                    return next(err);
                }
                if (groupData) {

                    Group.findOneAndUpdate({ _id: req.body.id }, {
                        $pull: {
                            'members': { 'user_id': { '$eq': req.userInfo.id } }
                        }
                    }, function (err, data) {
                        if (err) {
                            return next(err);
                        } else {
                            Group.findOne({ _id: { $eq: req.body.id }, isDeleted: { $ne: true } })
                                .populate({ path: "members.user_id", select: ["_id", "mobileNo"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
                                .exec(function (error, group) {
                                    if (error) {
                                        return next(error);
                                    }

                                    if (group) {
                                        var updatedGroupData = Object.assign({}, group.toObject());
                                        updatedGroupData.members = _.chain(group.members).map(function (item) { return { mobileNo: item.user_id.mobileNo, user_id: item.user_id._id, createdAt: item.createdAt }; }).value();

                                        //send notification to all members
                                        if (updatedGroupData.members.length > 0) {
                                            _.every(_.pluck(updatedGroupData.members, 'user_id'), function (member) {
                                                client.publishMessage(member,
                                                    {
                                                        type: "group-notification",
                                                        action: groupAction.left,
                                                        fromMobileNo: req.userInfo.mobileNo,
                                                        data: _.omit(updatedGroupData, "pinnedItems", "chatMessages")
                                                    },
                                                    function (status) { });
                                            });
                                        }

                                        res.status(config.OK_STATUS).json({ 'message': 'Left group successfully.' });
                                    }
                                });
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

function createGroup(data, req, res) {
    var groupObject = new Group(data);
    groupObject.save(function (err, groupData) {
        if (err) {
            return next(err);
        } else {
            var groupDetails = Object.assign({}, groupData.toObject());
            groupDetails.members[0].mobileNo = req.userInfo.mobileNo;
            delete groupDetails.members[0]._id;
            groupDetails = _.omit(groupDetails, "pinnedItems", "chatMessages");

            //send notification
            client.publishMessage(req.userInfo._id,
                {
                    type: "group-notification",
                    action: groupAction.created,
                    fromMobileNo: req.userInfo.mobileNo,
                    data: groupDetails
                },
                function (status) { });

            res.status(config.OK_STATUS).json({ message: 'Group created successfully.', group: groupDetails });
        }
    });
}

function updateGroup(id, data, oldData, req, res) {
    Group.update({ _id: { $eq: id } }, { $set: data }, function (err, response) {
        if (err) {
            return next(err);
        } else {
            var action = "";
            if (data.name && oldData.name !== data.name) {
                action = groupAction.updatedName;
            } else if (data.image && oldData.image !== data.image) {
                action = groupAction.updatedIcon;
            }

            if (action !== "") {
                Group.findOne({ _id: { $eq: id }, isDeleted: { $ne: true } })
                    .populate({ path: "members.user_id", select: ["_id", "mobileNo"], model: 'users', $elemMatch: { "isDeleted": { $ne: true } } })
                    .exec(function (error, group) {
                        if (error) {
                            return next(error);
                        }

                        if (group) {
                            var temp = _.map(group.members, function (item) { return { mobileNo: item.user_id.mobileNo, user_id: item.user_id._id, createdAt: item.createdAt }; });
                            group.members = temp;

                            //send notification to all members
                            if (group.members.length > 0) {
                                _.every(_.pluck(group.members, 'user_id'), function (member) {
                                    client.publishMessage(member,
                                        {
                                            type: "group-notification",
                                            action: action,
                                            fromMobileNo: req.userInfo.mobileNo,
                                            data: group
                                        },
                                        function (status) { });
                                });
                            }
                        }
                    });
            }

            res.status(config.OK_STATUS).json({ message: "Group updated successfully" });
        }
    });
}

module.exports = router;