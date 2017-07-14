var mosca = require('mosca');
var jwt = require('jsonwebtoken');
var config = require('../config');
var _ = require('underscore');

var settings = {
  port: 1883
};
 
//here we start mosca
var server = new mosca.Server(settings);
server.on('ready', setup);

//chat authentication
function chatAuth(token,callback){
    jwt.verify(token, config.ACCESS_TOKEN_SECRET_KEY, function (err, decoded) {
        if (err) {
            callback({"status":false});
        } else {
            callback({"status":true,"user":decoded});
        }
    });
}
// fired when the mqtt server is ready
function setup() {
  console.log('Mosca server is up and running')
}

// fired whena  client is connected
server.on('clientConnected', function(client) {
  console.log('Server:client connected', client.id);
});
 
// fired when a message is received
server.on('published', function(packet, client) {
    var topic = packet.topic;
    var messageJSON = packet.payload;
    if(_.isObject(packet.payload)){
        var messageJSON = JSON.parse(packet.payload.toString('utf8'));
        if(messageJSON.hasOwnProperty("token")){
            chatAuth(messageJSON.token,function(data){
                if(data.status){
                    console.log("Auth_User:",data);
                    if(messageJSON.chatType == "personal"){
                        //Store data in 1 to 1 chat using chatHelper
                        console.log("Received 1To1 Chat Message:\n",messageJSON);
                    }else if(messageJSON.chatType == "group"){
                        //Store data in group chat using chatHelper
                        console.log("Received Group Chat Message:\n",messageJSON);
                    }else if(messageJSON.chatType == "activity"){
                        //Store data in activity chat using chatHelper
                        console.log("Received Activity Chat Message:\n",messageJSON);
                    }
                }else{
                    console.log("User is not authorised please send valid token in payload");
                }
            });
        }
    }
});
 
// fired when a client subscribes to a topic
server.on('subscribed', function(topic, client) {
//  console.log('Server:subscribed : ', topic);
});
 
// fired when a client subscribes to a topic
server.on('unsubscribed', function(topic, client) {
  console.log('unsubscribed : ', topic);
});
 
// fired when a client is disconnecting
server.on('clientDisconnecting', function(client) {
  console.log('clientDisconnecting : ', client.id);
});
 
// fired when a client is disconnected
server.on('clientDisconnected', function(client) {
  console.log('clientDisconnected : ', client.id);
});

module.exports = server;