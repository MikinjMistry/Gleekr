var express = require('express');
var router = express.Router();
var config = require('../config');

var User = require("../models/user");

router.post('/search', function (req, res, next) {
    var schema = {
        'mobileNo': {
            notEmpty: true,
            errorMessage: "Mobile number is required."
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if(!error){
        User.findOne({mobileNo:req.body.mobileNo,isDeleted:false},function(err,userData){
            if(err){
                res.status(config.DATABASE_ERROR_STATUS).json({message: "Something goes wrong in search contact"});
            }
            res.status(config.OK_STATUS).json({message: "Contact is search successfully",data:userData});
        })
    }else{
        res.status(config.BAD_REQUEST).json({message: errors});
    }
});


module.exports = router;