var jwt = require('jsonwebtoken');
module.exports = function (req, res, next) {
    //need to by pass auth verification for OTP related calls
    console.log("Middleware called");
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token,process.env.JWT_SECRET, function (err, decoded) {
            if (err) {
                return res.status(401).json({message: 'Invalid token'});
            } else {
                req.userInfo = decoded;
                next();
            }
        });
    } else {

        return res.status(401).json({
            message: 'Unauthorized access'
        });
    }
}