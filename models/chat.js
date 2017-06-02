//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var ChatSchema = new Schema({
    from_user_id: mongoose.Schema.Types.ObjectId,
    to_user_id: mongoose.Schema.Types.ObjectId,
    message: String,
    mimeType: { type: String, enum: ["text", "video", "image", "audio"] },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
}, { versionKey: false });

// Compile model from schema
var Chat = mongoose.model('chat', ChatSchema, 'chat');

module.exports = Chat;