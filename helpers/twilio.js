var twilio = require('twilio');
var config = require('../config');
var VoiceResponse = twilio.twiml.VoiceResponse;
var json = {};
var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
/* 
 * Send contact card to specified number
 * @param Integer number phone number to whom contact card will be send
 * @param String msg content of contact card
*/
json.send_card = function (number, msg) {
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: msg
    });
}
/* 
 * Send sms to specified number
 * @param Integer to phone number to whom sms will be send
 * @param String msg content of message
 * @param String succ Success message
 * @param String err Error Message
 * @param Object res Response object of parent api
*/
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
/* 
 * Create call to specified number
 * @param Integer to phone number on which call will be created
 * @param String url callback function / api called by twilio
 * @param String succ Success message
 * @param String err Error Message
 * @param Object res Response object of parent api
*/
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
/* 
 * Create call to specified number
 * @param Integer mobileNo phone number on which call will be dialed
 * @param String succ Success message
 * @param Object response Response object of parent api
*/
json.dailCall = function(mobileNo, msg, response) {
    var twimlResponse = new VoiceResponse();
    wimlResponse.say(msg, {voice: 'alice'});
    twimlResponse.dial(mobileNo);
    response.send(twimlResponse.toString());
}
module.exports = json;