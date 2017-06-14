//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var MemberSchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

var GroupChatSchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    message: String,
    mimeType: { type: String, enum: ["text", "video", "image", "audio"] },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

var GroupSchema = new Schema({
    name: String,
    image: String,
    user_id: mongoose.Schema.Types.ObjectId,
    isDeleted: Boolean,
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
    members: [MemberSchema], //Embedding MemberSchema into group
    chatMessages: [GroupChatSchema] //Embedding GroupChatSchema into group for chat messages
	pinnedItems: [mongoose.Schema.Types.ObjectId], //Array of _id referring to GroupChatSchema.chat_messages _id
}, { versionKey: false });

// Compile model from schema
var Group = mongoose.model('group', GroupSchema, 'group');

module.exports = Group;