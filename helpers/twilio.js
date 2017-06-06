var twilio = require('twilio');
var config = require('../config');
var VoiceResponse = twilio.twiml.VoiceResponse;
// Send OTP to provided number
var json = {};
json.sendMessage = function (number, code, res) {
    var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: 'Use ' + code + ' as Gleekr account security code'
    }, function (error, message) {
        if (!error) {
            res.status(200).json({message: "OTP has been sent successfully."});
        } else {
            res.status(422).json({ message: "Error in sending sms." });
        }
    });
}
// Send contact card to specified number
json.send_card = function (number, msg) {
    var client = new twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: config.TWILIO_NUMBER,
        body: msg
    }, function (error, message) {
        if (!error) {
            result = {
                success: 1,
                message: "Contact card has been sent successfully."
            };
        } else {
            var result = {
                success: 0,
                message: "Error in sending sms.",
                error: error
            };
        }
    });
}
module.exports = json;