//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var ActivitiesSchema = new Schema({
    activity_id: mongoose.Schema.Types.ObjectId,
    action: { type: String, enum: ["invited", "going", "not_interested"] },
    isPinned: Boolean,
    pinnedItems: [mongoose.Schema.Types.ObjectId], //Array of _id referring to activity.chat_messages _id
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
});

var UserSchema = new Schema({
    name: String,
    mobileNo: String,
    email: String,
    image: String,
    jobTitle: String,
    companyName: String,
    isDeleted: Boolean,
    groupPinnedItems: [mongoose.Schema.Types.ObjectId], //Array of _id referring to group.chat_messages _id
    personalChatPinnedItems: [mongoose.Schema.Types.ObjectId], //Array of _id referring to chat  _id
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
    activities: [ActivitiesSchema], //Embedding ActivitiesSchema into user
});

// Compile model from schema
var User = mongoose.model('users', UserSchema, 'users');

module.exports = User;