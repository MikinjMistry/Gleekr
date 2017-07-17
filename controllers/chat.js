var express = require('express');
var router = express.Router();
var config = require('../config');

var Activity = require("../models/activity");
var User = require("../models/user");
var Chat = require("../models/chat");

var bothelper = require('../helpers/bot_helpers');
var jsonhelper = require('../helpers/json_helpers');
var mqttClient = require('../mqtt/mqttClient');

var moment = require('moment');
var fs = require('fs');
var path = require('path');
var async = require('async');
var _ = require('underscore');


/**
 * @api {POST} /chat/send_message Send chat message
 * @apiName Send chat message
 * @apiGroup Chat
 * @apiDescription Content type needs to be multipart/form-data
 * 
 * @apiParam {String} to_user_id form-data: ID of the user to whome the message needs to be sent
 * @apiParam {String} message form-data: Text message
 * @apiParam {String} mimeType form-data: Text message
 * 
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message
 * 
 * @apiError (Error 4xx) {String} message Validation or error message
 */
router.post('/send_message', function (req, res, next) {
    var schema = {
        'to_user_id': {
            notEmpty: true,
            errorMessage: "To user id is required."
        },
        'message': {
            notEmpty: true,
            errorMessage: "message required"
        },
        'mimeType': {
            notEmpty: true,
            errorMessage: "message required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();

    if (!errors) {

        User.findOne({ _id: req.userInfo.id }, function (error, data) {
            if (error) {
                return next(error);
            }

            if (data) {
                var messageData = Object.assign({}, req.body);
                messageData.fromUserId = req.userInfo.id;
                messageData.fromUserName = data.name;
                delete messageData.to_user_id;

                //Publish message
                mqttClient.publishMessage(req.body.to_user_id, messageData, function (data) {
                    if (data) {
                        ///Save chat
                        var chatData = Object.assign({}, messageData);
                        chatData.from_user_id = req.userInfo.id;
                        saveChat(chatData);
                        res.status(config.OK_STATUS).json({ message: "Message sent" });
                    } else {
                        res.status(config.BAD_REQUEST).json({ message: "Unable to send message" });
                    }
                });
            } else {
                res.status(config.BAD_REQUEST).json({ message: "Invalid sender" });
            }

        });

    } else {
        res.status(config.BAD_REQUEST).json({ message: "Validation error", error: errors });
    }
});

function saveChat(data) {
    var chat = new Chat(data);
    chat.save(function (error, data) {
        if (error) {
            return next(error);
        }
    });
}


module.exports = router;