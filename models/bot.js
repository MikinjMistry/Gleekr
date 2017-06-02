//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var BotSchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    activity_id: mongoose.Schema.Types.ObjectId,
    actionType: { type: String, enum: ["create", "update", "pin", "unpin", "going", "not_interested", "invited"] },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
}, { versionKey: false });

// Compile model from schema
var Bot = mongoose.model('bot', BotSchema, 'bot');

module.exports = Bot;