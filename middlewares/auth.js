var jwt = require('jsonwebtoken');
var config = require('../config');
module.exports = function (req, res, next) {
    //need to by pass auth verification for OTP related calls

    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.ACCESS_TOKEN_SECRET_KEY, function (err, decoded) {
            if (err) {
                return res.status(config.UNAUTHORIZED).json({ message: err.message });
            } else {
                req.userInfo = decoded;
                next();
            }
        });
    } else {
        return res.status(config.UNAUTHORIZED).json({
            message: 'Unauthorized access'
        });
    }
}