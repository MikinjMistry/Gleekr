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
    client.subscribe(["Topic1", "Topic2","Topic3"]);
    
    //Mqtt Client publish message 
    
    //Send payload with valid token
    client.publish("Topic1",'{"chatType":"personal","toUserId":"2","message":"Hii Mikinj","mimeType":"text","token":"eyJhbGciOiJIUzI1NiIInR5cCI6IkpXVCJ9.eyJpZCI6IjU5NWE0MjJiYWQzNDQ4MjAwODU2MjEzZCIsIm1vYmlsZU5vIjoiKzkxODg2NjI4MDMyNiIsImlhdCI6MTUwMDA1MzIzOSwiZXhwIjoxNTAwMTM5NjM5fQ.s4BmRw2KVkh_stKwUlMzbhiiFJFVzxhsN7mIDVwwOzs"}');
    //Send payload with invalid token
    client.publish("Topic2",'{"chatType":"group","groupId":"1","message":"Hello guyz","mimeType":"text","token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU5NWE0MjJiYWQzNDQ4MjAwODU2MjEzZCIsIm1vYmlsZU5vIjoiKzkxODg2NjI4MDMyNiIsImlhdCI6MTUwMDA1MzIzOSwiZXhwIjoxNTAwMTM5NjM5fQ.s4BmRw2KVkh_stKwUlMzbhiiFJFVzxhsN7mIDVww"}');
    //Send payload with valid token
    client.publish("Topic3",'{"chatType":"activity","activityId":"1","message":"Hello..","mimeType":"","token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU5NWE0MjJiYWQzNDQ4MjAwODU2MjEzZCIsIm1vYmlsZU5vIjoiKzkxODg2NjI4MDMyNiIsImlhdCI6MTUwMDA1MzIzOSwiZXhwIjoxNTAwMTM5NjM5fQ.s4BmRw2KVkh_stKwUlMzbhiiFJFVzxhsN7mIDVwwOzs"}');
    
})

/*** client on reconnect ***/
client.on("reconnect", function () {
    console.log("cleint is reconnected");
})

/*** client on error ***/
client.on("error", function (err) {
    console.log("error from client --> ", err);
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
