var twilio = require('twilio');
var VoiceResponse = twilio.twiml.VoiceResponse;
// Send OTP to provided number
var json = {};
json.sendMessage = function (number, code, res) {
    var client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: process.env.TWILIO_NUMBER,
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
    var client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    client.messages.create({
        to: number,
        from: process.env.TWILIO_NUMBER,
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

// Voice call for otp
json.voice_call = function(mobileNo, code, response) {
    var twimlResponse = new VoiceResponse();
    twimlResponse.say('Your Gleekr OTP is ' + code,{ voice: 'alice' });
    twimlResponse.dial(mobileNo);
    response.send(twimlResponse.toString());
}

module.exports = json;