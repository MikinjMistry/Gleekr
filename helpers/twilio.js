var twilio = require('twilio');
var config = require('../config');
var VoiceResponse = twilio.twiml.VoiceResponse;
// Send OTP to provided number
var json = {};
var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
// Send contact card to specified number
json.send_card = function (number, msg) {
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: msg
    });
}
// Send SMS
json.sendSMS = function(to, msg, succ, err, res) {
    client.messages.create({
        to: to,
        from: config.TWILIO_NUMBER,
        body: msg
    }, function (error, message) {
        if (!error) {
            res.status(200).json({message: succ});
        } else {
            res.status(422).json({ message: err});
        }
    });
}
// Create call
json.createCall = function(to, url, succ, res) {
    client.calls.create({
        to: req.body.mobileNo,
        from: config.TWILIO_NUMBER,
        url: url
    }).then((message) => {
        res.status(200).json({message: succ});
    }).catch((error) => {
        res.status(500).json(error);
    });
}
// Dail call
json.dailCall = function(mobileNo, msg, response) {
    var twimlResponse = new VoiceResponse();
    wimlResponse.say(msg, {voice: 'alice'});
    twimlResponse.dial(mobileNo);
    response.send(twimlResponse.toString());
}
module.exports = json;