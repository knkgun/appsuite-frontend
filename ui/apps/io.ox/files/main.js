/**
 * 
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 * 
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com 
 * 
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 *
 */

 define("io.ox/files/main", [
    "io.ox/files/base", "io.ox/files/api",
    "io.ox/core/tk/vgrid",  "io.ox/files/upload", "css!io.ox/files/style.css"
    ], function (base, api, VGrid, upload) {

    // application object
    var app = ox.ui.createApp(),
        // app window
        win;
    
    // launcher
    app.setLauncher(function () {
        
        // get window
        app.setWindow(win = ox.ui.createWindow({
            title: "Files",
            subtitle: "Private files",
            search: true
        }));
        
        // left side
        var left = $("<div/>").addClass("leftside border-right")
            .css({
                width: "309px",
                overflow: "auto"
            })
            .appendTo(win.nodes.main);

        var right = $("<div/>")
            .css({ left: "347px", overflow: "auto" })
            .addClass("rightside")
            .appendTo(win.nodes.main);

        // Grid
        var grid = new VGrid(left);
        // add template
        grid.addTemplate({
            build: function () {
                var name;
                this
                    .addClass("file")
                    .append(name = $("<div/>").addClass("name"));
                return { name: name };
            },
            set: function (data, fields, index) {
                fields.name.text(data.title);
            }
        });
        
        // all request
        grid.setAllRequest(function (cont) {
            api.getAll().done(cont);
        });
        
        // search request
        grid.setAllRequest("search", function (cont) {
            api.search(win.search.query).done(cont);
        });
        
        // list request
        grid.setListRequest(function (ids, cont) {
            api.getList(ids).done(cont);
        });
        
        /*
         * Search handling
         */
        win.bind("search", function (q) {
            grid.setMode("search");
        });
        
        win.bind("cancel-search", function () {
            grid.setMode("all");
        });
        
        // LFO callback
        function drawDetail(data) {
            var detail = base.draw(data);
            right.idle().empty().append(detail);
            right.parent().scrollTop(0);
        }
        
        grid.selection.bind("change", function (selection) {
            if (selection.length === 1) {
                // get file
                right.busy(true);
                api.get(selection[0]).done(_.lfo(drawDetail));
            } else {
                right.empty();
            }
        });
        
        // explicit keyboard support
        win.bind("show", function () { grid.selection.keyboard(true); });
        win.bind("hide", function () { grid.selection.keyboard(false); });
        
        // go!
        win.show();
        grid.paint();
        
        // Uploads
        var queue = upload.createQueue({
            processFile: function (file) {
                return api.uploadFile({file: file})
                    .done(function (data) {
                        // select new item
                        grid.selection.set([data]);
                        grid.refresh();
                        // TODO: Error Handling
                    });
            }
        });
        
        var dropZone = upload.dnd.createDropZone();
        dropZone.bind("drop", function (file) {
            queue.offer(file);
        });
        
        win.bind("show", function () {
            dropZone.include();
        });
        
        win.bind("hide", function () {
            dropZone.remove();
        });
    });
    
    return {
        getApp: app.getInstance
    };
});
