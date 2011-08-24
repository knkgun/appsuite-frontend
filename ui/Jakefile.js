/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) Open-Xchange Inc., 2011 Mail: info@open-xchange.com
 * 
 * @author Viktor Pracht <viktor.pracht@open-xchange.com>
 */

var fs = require("fs");
var path = require("path");
var globSync = require("./lib/glob").globSync;

var builddir = process.env.builddir || "build";
console.log("Build path: " + builddir);

function pad(n) { return n < 10 ? "0" + n : n; }
var t = new Date;
var version = (process.env.version || "7.0.0") + "." + t.getUTCFullYear() +
    pad(t.getUTCMonth()) + pad(t.getUTCDate()) + "." +
    pad(t.getUTCHours()) + pad(t.getUTCMinutes()) +
    pad(t.getUTCSeconds());
console.log("Build version: " + version);

var counter = 0;

// default task

desc("Builds the GUI");
topLevelTask("default", [], function() {
    console.log("Touched " + counter + (counter == 1 ? " file" : " files"));
});

concat("login.js", ["lib/jquery.min.js", "lib/jquery-ui.min.js",
        "lib/jquery.plugins.js", "lib/require.js", "lib/modernizr.js",
        "src/tk/grid.js", "src/tk/selection.js", "src/login.js"]);

concat("pre-core.js", list("apps/io.ox/core", ["config.js", "base.js",
        "http.js", "event.js", "extensions.js", "cache.js", "main.js"]));

copy(list([".htaccess", "src/", "apps/"]));

copy(["index.html"], {
    filter: function(data) { return data.replace("@ version @", version); }
});

copyFile("lib/css.js", path.join(builddir, "apps/css.js"));

// doc task

desc("Developer documentation");
topLevelTask("doc", [], function() {
    console.log("Touched " + counter + (counter == 1 ? " file" : " files"));
});

var titles = [];
function docFile(file, title) {
    filename = "doc/" + file + ".html";
    concat(filename, ["doc/lib/header.html", filename, "doc/lib/footer.html"]);
    titles.push('<a href="' + file +'.html">' + title + '</a><br/>');
}

docFile("apache", "Apache Configuration");
docFile("extensions", "Extension Points");
docFile("features", "Features");
docFile("vgrid", "VGrid");

var indexFiles = ["lib/header.html", "index.html",
    { getData: function() { return titles.join("\n"); } }, "lib/footer.html"];
indexFiles.dir = "doc";
concat("doc/index.html", indexFiles);

copy(list("doc/lib", ["prettify.*", "default.css"]),
     { to: path.join(builddir, "doc") } );
copyFile("lib/jquery.min.js", path.join(builddir, "doc/jquery.min.js"));


////////////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////////////

/**
 * Defines a new top-level task.
 * Any subsequent file utility functions will add their target files to this
 * task as dependencies.
 * @param {String} name An optional name of the new task. If not specified,
 * no new task is created and automatic dependencies won't be created anymore.
 */
function topLevelTask(name) {
    topLevelTaskName = name;
    if (name) task.apply(this, arguments);
}

/**
 * The name of the current top-level task, if any.
 * @type String
 */
var topLevelTaskName;

/**
 * Copies one or more files.
 * Any missing directories are created automatically.
 * @param {Array} files An array of strings specifying filenames to copy.
 * @param {String} files.dir An optional common parent directory. All filenames
 * in files are relative to it. Defaults to the project root.
 * @param {Object} options An optional object containing various options.
 * @param {String} options.to An optional target directory. The target
 * filenames are generated by resolving each filename from files relative to
 * options.to instead of files.dir.
 * @param {Function} options.filter An optional filter function which takes
 * the contents of a file as parameter and returns the filtered contents.
 */
function copy(files, options) {
    var srcDir = files.dir || "";
    var destDir = options && options.to || builddir;
    var filter = options && options.filter;
    for (var i = 0; i < files.length; i++) {
        copyFile(path.join(srcDir, files[i]), path.join(destDir, files[i]),
                 filter);
    }
}

/**
 * Copies a single file.
 * Any missing directories are created automatically.
 * @param {String} src The filename of the source file.
 * @param {String} dest The filename of the target file.
 * @param {Function} filter An optional filter function which takes the contents
 * of the file as parameter and returns the filtered contents.
 */
function copyFile(src, dest, filter) {
    var dir = path.dirname(dest);
    directory(dir);
    file(dest, [src, dir, "Jakefile.js"], function() {
        var data = fs.readFileSync(src, "utf8");
        if (filter) data = filter(data);
        fs.writeFileSync(dest, data);
        counter++;
    });
    if (topLevelTaskName) task(topLevelTaskName, [dest]);
}

/**
 * Concatenates one or more files and strings to a single file.
 * Any missing directories are created automatically.
 * @param {String} name The name of the destination file relative to the build
 * directory.
 * @param {Array} files An array of things to concatenate.
 * Plain strings are interpreted as filenames relative to files.dir,
 * objects having a method getData should return the contents as a string.
 * @param {String} files.dir An optional common parent directory. All filenames
 * in files are relative to it. Defaults to the project root.
 * @param {Object} options An optional object containing various options.
 * @param {Function} options.filter An optional filter function which takes
 * the concatenated contents as parameter and returns the filtered contents.
 */
function concat(name, files, options) {
    var srcDir = files.dir || "";
    var dest = path.join(builddir, name);
    var destDir = path.dirname(dest);
    var deps = [];
    var filter = options && options.filter;
    for (var i = 0; i < files.length; i++) {
        if (typeof files[i] == "string") deps.push(path.join(srcDir, files[i]));
    }
    deps.push(destDir);
    deps.push("Jakefile.js");
    directory(destDir);
    file(dest, deps, function() {
        var fd = fs.openSync(dest, "w");
        for (var i = 0; i < files.length; i++) {
            var data = typeof files[i] == "string" ?
                fs.readFileSync(path.join(srcDir, files[i]), "utf8") :
                files[i].getData();
            if (filter) data = filter(data);
            fs.writeSync(fd, data, null);
        }
        fs.closeSync(fd);
        counter++;
    });
    if (topLevelTaskName) task(topLevelTaskName, [dest]);
}

/**
 * Returns a list of filenames specified by a root directory and one or more
 * glob patterns.
 * @param {String} dir Optional root directory. Defaults to the project root.
 * @param {String or Array of String} globs One or more glob patterns.
 * @type Array of String
 * @returns An array of file names relative to dir, which match the specified
 * patterns.
 * The property dir is set to the parameter dir for use with copy and concat.
 */
function list(dir, globs) {
    if (globs === undefined) {
        globs = dir;
        dir = "";
    }
    if (typeof globs == "string") globs = [globs];
    var arrays = globs.map(function(s) { return globSync(dir, s); });
    var retval = Array.prototype.concat.apply([], arrays);
    retval.dir = dir;
    return retval;
}
