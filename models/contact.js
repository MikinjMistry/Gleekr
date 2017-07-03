//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;

var ContactSchema = new Schema({
    number:String,
    user_id: mongoose.Schema.Types.ObjectId,
}, { versionKey: false });

// Compile model from schema
var Contact = mongoose.model('contact', ContactSchema, 'contact');

module.exports = Contact;