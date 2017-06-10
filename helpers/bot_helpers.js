var Bot = require("../models/bot");
var botFunction = {};

botFunction.add = function(botJson,callback){
    botObj = new Bot(botJson);
    botObj.save(function (err, data) { 
        if(err){
            callback({message:'Error in inserting bot'},null);
        }
        callback(null,{message:'Bot record is inserted successfuly.'});
    });
}
module.exports = botFunction;