//Require Mongoose
var mongoose = require('mongoose');
console.log("Hello world");
//Define a schema
var Schema = mongoose.Schema;

var ActivityChatSchema = new Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    message: String,
    mimeType: { type: String, enum: ["text", "video", "image", "audio"] },
    createdAt: { type: Date, default: Date.now }
});

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
    isDeleted: Boolean,
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
    chatMessages: [ActivityChatSchema] //Embedding ActivityChatSchema into Activity
});

// Compile model from schema
var Activity = mongoose.model('activities', ActivitySchema, 'activities');

module.exports = Activity;