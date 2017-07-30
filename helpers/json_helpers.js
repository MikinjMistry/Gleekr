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

jsonFunction.deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
    }
};
module.exports = jsonFunction;