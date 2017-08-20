var apn = require('apn');
var config = require('../config');

var notifications = {}
var options = {
    token: {
        key: "./notification/AuthKey_GTM5XKR9AG.p8",
        keyId: config.IOS_KEYID,
        teamId: config.IOS_TEAMID
    },
    production: true
};

apnProvider = new apn.Provider(options);
notifications.sendMessage = function (messageJSON, deviceToken) {

    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // Expires after 24 hour from now.
    note.badge = 2;
    note.sound = "ping.aiff";
    note.alert = "You have a notification from Gleekr";
    note.payload = messageJSON;

    // Replace this with your app bundle ID:
    note.topic = "com.domainname.gleekrappPush";

    apnProvider.send(note, deviceToken).then(function (result) {
        console.log(result.sent);
        console.log(result.failed);
    });

    // Close the server
    apnProvider.shutdown();
}
module.exports = notifications;

