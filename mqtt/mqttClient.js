//var mqtt = require("mqtt");
//var sys = require('util');
//var exec = require('child_process').exec;
//var config = require('../config');
//
//var url = 'mqtt://' + config.HOST + ':1883';
//// var url = 'mqtt://test.mosquitto.org';
//var client = mqtt.connect(url);
//
//
//client.on("message", function (topic, data) {
//    /*console.log("Topic", topic);
//    console.log("value", data.toString());
//    console.log("-------------------------------");*/
//})
//
///*** client on connect ***/
//client.on("connect", function () {
//    console.log("cleint is connected");
//    client.subscribe(["$SYS/#", "test"]);
//})
//
///*** client on reconnect ***/
//client.on("reconnect", function () {
//    console.log("cleint is reconnected");
//})
//
///*** client on error ***/
//client.on("error", function (err) {
//    console.log("error from client", err);
//})
//
///*** client on close ***/
//client.on("close", function () {
//    console.log("cleint is closed");
//})
///*** client on offline ***/
//client.on("offline", function (err) {
//    console.log("client is offline");
//});
//
//client.publishMessage = publishMessage;
//
///*
//    Publish Message through Mosquito shell command
//    @params: 
//        - sendTo Topic/userId to which the message needs to be published
//        - message Message body or content which needs to be sent
//        - callback Handling error and success
// */
//function publishMessage(sendTo, message, callback) {
//    console.log("#####################################");
//    console.log("publishMessage to: ", sendTo);
//    console.log("publishMessage: ", JSON.stringify(message));
//    //mqttClient.publish(req.body.to_user_id, JSON.stringify(messageData), { qos: 2 });
//    exec("mosquitto_pub -q 2 -t '" + sendTo + "' -m '" + JSON.stringify(message) + "' --will-payload '" + JSON.stringify(message) + "' --will-qos 2 --will-topic '" + sendTo + "' --will-retain", function (error, stdout, stderr) {
//        console.log('exec stdout: ' + stdout);
//        console.log('exec stderr: ' + stderr);
//        if (error !== null) {
//            console.log('exec error: ' + error);
//            callback(false);
//        } else {
//            callback(true);
//        }
//    });
//    console.log("#####################################");
//}
//
//module.exports = client;