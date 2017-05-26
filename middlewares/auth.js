module.exports = function (req, res, next) {

    //need to by pass auth verification for OTP related calls
    console.log("Middleware called");
    next();
}