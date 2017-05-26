var express = require('express');
var router = express.Router();

/* Require Models */
var Otp = require("../models/otp");

/* GET users listing. */
router.get('/', function (req, res, next) {
  //Sample find method
  /*
      find({}) -> find with query
      find({}, '') -> find with query and get only selected fields
   */
  Otp.find(function (err, data) {
    if (err)
      res.json({ error: err });
    res.json(data);
  });
});

router.post('/', function (req, res, next) {

  //Sample save method
  var newOtp = new Otp({
    mobileNo: "55574563210",
    code: "9555563210"
  });
  newOtp.save(function (err, data) {
    if (err) res.json({ error: "OTP could not be generated!" });

    res.send(true);
  });

});

module.exports = router;
