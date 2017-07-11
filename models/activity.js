//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var ActivityChatSchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    message: String,
    mimeType: {type: String, enum: ["text", "video", "image", "audio","notification"]},
    createdAt: {type: Date, default: Date.now}
}, {versionKey: false});

var ActivitySchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    name: String,
    photo: String,
    startDate: Date,
    startTime: Date,
    endDate: Date,
    endTime: Date,
    location: String,
    description: String,
    noOfParticipants: Number,
    costPerPerson: Number,
    isDeleted: {type: Boolean, default: false},
    isArchived: {type: Boolean, default: false},
    isPublic: {type: Boolean, default: true},
    createdAt: {type: Date, default: Date.now},
    modifiedAt: {type: Date, default: Date.now},
    chatMessages: [ActivityChatSchema], //Embedding ActivityChatSchema into Activity
    pinnedItems: [mongoose.Schema.Types.ObjectId], //Array of _id referring to activity.chat_messages _id
}, {versionKey: false});

// Compile model from schema
var Activity = mongoose.model('activities', ActivitySchema, 'activities');

module.exports = Activity;