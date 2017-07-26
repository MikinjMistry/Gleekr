var mqtt = require("mqtt");
var sys = require('util');
var exec = require('child_process').exec;
var config = require('../config');

var client = {};

client.publishMessage = publishMessage;

/*
    Publish Message through Mosquito shell command
    @params: 
        - sendTo Topic/userId to which the message needs to be published
        - message Message body or content which needs to be sent
        - callback Handling error and success
 */
function publishMessage(sendTo, message, callback) {
    console.log("#####################################");
    console.log("publishMessage to: ", sendTo);
    console.log("publishMessage: ", JSON.stringify(message));
    exec("mosquitto_pub -q 2 -t '" + sendTo + "' -m '" + JSON.stringify(message) + "' -u '" + config.MQTT_USERNAME + "' -P '" + config.MQTT_PASSWORD + "' --will-payload '" + JSON.stringify(message) + "' --will-qos 2 --will-topic '" + sendTo + "' --will-retain", function (error, stdout, stderr) {
        console.log('exec stdout: ' + stdout);
        console.log('exec stderr: ' + stderr);
        if (error !== null) {
            console.log('exec error: ' + error);
            callback(false);
        } else {
            callback(true);
        }
    });
    console.log("#####################################");
}

module.exports = client;