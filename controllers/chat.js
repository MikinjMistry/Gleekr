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
 * @api {post} /import Import your chat file
 * @apiName Imort Chat
 * @apiGroup Import / Export
 * @apiDescription You need to pass Form Data
 * 
 * @apiParam {file} file form-data: file object
 *  
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/import', function (req, res, next) {
    if (req.files) {
        var file = req.files.file;
        var dir = "./upload/" + req.userInfo.id + '/backup';
        var parentdir = "./upload/" + req.userInfo.id;
//            var mimetype = ['image/png', 'image/jpeg', 'image/jpeg', 'image/jpg'];
//            if (mimetype.indexOf(file.mimetype) != -1) {
        if (!fs.existsSync(parentdir)) {
            fs.mkdirSync(parentdir);
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        } else {
            deleteFolderRecursive(dir);
        }

        extention = path.extname(file.name);
        filename = "backup-" + new Date().getTime() + extention;
        file.mv(dir + '/' + filename, function (err) {
            if (err) {
                return next(err);
            } else {
//                        imagepath = "/upload/" + userInfo.id + "/" + filename;
//                        json.image = imagepath;
                res.status(config.OK_STATUS).json({message: 'Chat file imported successfully.'});
            }
        });
//            } else {
//                res.status(config.BAD_REQUEST).json({message: "This File format is not allowed"});
//            }
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Please select file first.",
        });
    }
});
/**
 * @api {get} /export Export your chat file
 * @apiName Export Chat
 * @apiGroup Import / Export
 *
 * @apiHeader {String}  x-access-token Users unique access-key
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.get('/export', function (req, res, next) {
    var dir = "./upload/" + req.userInfo.id + '/backup';
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var filepath = path + "/" + file;
            res.download(filepath);
        });
    } else {
        res.status(config.BAD_REQUEST).json({message:'Sorry! You haven\'t import any file.'});
    }
});
var deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
    }
};

module.exports = router;