var mqtt = require("mqtt");
var config = require('../config');
var url = 'mqtt://' + config.HOST + ':1883';
// var url = 'mqtt://test.mosquitto.org';
var client = mqtt.connect(url);


client.on("message", function (topic, data) {
    /*console.log("Topic", topic);
    console.log("value", data.toString());
    console.log("-------------------------------");*/
})

/*** client on connect ***/
client.on("connect", function () {
    console.log("cleint is connected");
    client.subscribe(["$SYS/#", "test"]);
})

/*** client on reconnect ***/
client.on("reconnect", function () {
    console.log("cleint is reconnected");
})

/*** client on error ***/
client.on("error", function (err) {
    console.log("error from client", err);
})

/*** client on close ***/
client.on("close", function () {
    console.log("cleint is closed");
})
/*** client on offline ***/
client.on("offline", function (err) {
    console.log("client is offline");
});

module.exports = client;