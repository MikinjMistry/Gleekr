//Require Mongodb connection
var db = require('./db');

//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var OtpSchema = new Schema({
    mobileNo: String,
    code: String,
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
}, { versionKey: false });

// Compile model from schema
var Otp = mongoose.model('otp', OtpSchema, 'otp');

module.exports = Otp;