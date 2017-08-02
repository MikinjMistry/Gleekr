var notifications = {}
var apn = require('apn');
var options = {
    token: {
        key: "./notification/cert.p8",
        keyId: "key-id",
        teamId: "developer-team-id"
    },
    production: false
};
apnProvider = new apn.Provider(options);
notifications.sendMessage = function (messageJSON, deviceToken) {
    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
//    note.badge = 3; 
//    note.sound = "ping.aiff";
    note.alert = "You have a new message";
    note.payload = messageJSON;
    
    apnProvider.send(note, deviceToken).then( result => {
        console.log(result);
    });
}
module.exports = notifications;

