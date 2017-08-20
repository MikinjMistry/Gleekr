var mqtt = require("mqtt");
var config = require('../config');
var url = 'mqtt://' + config.REMOTE_HOST + ':1883';
var client = mqtt.connect(url, { username: config.MQTT_USERNAME, password: config.MQTT_PASSWORD });
var User = require("../models/user");
var pushNotification = require('../notification/pushNotification');

/*** client on connect ***/
client.on("connect", function () {
    console.log("cleint is connected");
    client.subscribe("#");
});

/*** client on message ***/
client.on("message", function (topic, data) {
    if (topic) {
        User.findOne({ _id: { $eq: topic }, deviceToken: { $exists: true, $ne: null } }, function (error, userData) {
            if (error) {
                console.log("error in finding user", topic);
            }

            if (userData) {
                pushNotification.sendMessage(data.toString(), userData.deviceToken);
            }

        });
    }
});

/*** client on reconnect ***/
client.on("reconnect", function () {
    console.log("cleint is reconnected");
    client.subscribe("#");
});

/*** client on error ***/
client.on("error", function (err) {
    console.log("error from client --> ", err);
});

/*** client on close ***/
client.on("close", function () {
    console.log("cleint is closed");
});

/*** client on offline ***/
client.on("offline", function (err) {
    console.log("client is offline");
});

module.exports = client;
