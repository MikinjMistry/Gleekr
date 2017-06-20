var jsonFunction = {};
jsonFunction.isExist = function (array, id) {
    var success = false;
    array.forEach(function (obj) {
        if (obj._id.toString() == id.toString()) {
            success = true;
            return success;
        }
    });
    return success;
};
module.exports = jsonFunction;