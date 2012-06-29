/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/main',
    ['io.ox/files/api',
     'io.ox/office/toolbar',
     'io.ox/office/controller',
     'io.ox/office/editor',
     'gettext!io.ox/office/main',
     'io.ox/office/actions',
     'less!io.ox/office/main.css'
    ], function (filesApi, ToolBar, Controller, Editor, gt) {

    'use strict';

    var // application identifier
        MODULE_NAME = 'io.ox/office';

    // class MainToolBar ======================================================

    /**
     * Creates and returns a new instance of the main editor tool bar.
     *
     * @constructor
     */
    var MainToolBar = ToolBar.extend({

        constructor: function () {

            // call base constructor
            ToolBar.call(this);

            // add all tool bar controls
            this
            .addButtonGroup()
                .addButton('action/undo', { icon: gt('icon-io-ox-undo'), tooltip: gt('Revert last operation') })
                .addButton('action/redo', { icon: gt('icon-io-ox-redo'), tooltip: gt('Restore last operation') })
            .end()
            .addButtonGroup()
                .addButton('character/font/bold',      { icon: gt('icon-io-ox-bold'),      tooltip: gt('Bold'),      toggle: true })
                .addButton('character/font/italic',    { icon: gt('icon-io-ox-italic'),    tooltip: gt('Italic'),    toggle: true })
                .addButton('character/font/underline', { icon: gt('icon-io-ox-underline'), tooltip: gt('Underline'), toggle: true })
            .end()
            .addRadioGroup('paragraph/alignment', { type: 'auto', columns: 2, tooltip: gt('Paragraph alignment') })
                .addButton('left',    { icon: gt('icon-align-left'),    tooltip: gt('Left') })
                .addButton('center',  { icon: gt('icon-align-center'),  tooltip: gt('Center') })
                .addButton('right',   { icon: gt('icon-align-right'),   tooltip: gt('Right') })
                .addButton('justify', { icon: gt('icon-align-justify'), tooltip: gt('Justify') })
            .end()
            .addButton('action/debug', { icon: 'icon-eye-open', tooltip: 'Debug mode', toggle: true });

        } // end of constructor

    }); // class MainToolBar

    // class EditorController =================================================

    var EditorController = Controller.extend({

        constructor: function (app) {

            var // current editor having the focus
                editor = null;

            // base constructor -----------------------------------------------

            Controller.call(this, {

                'action/undo': {
                    enable: function () { return editor.hasUndo(); },
                    set: function (list) { editor.undo(); editor.grabFocus(); }
                },
                'action/redo': {
                    enable: function () { return editor.hasRedo(); },
                    set: function (list) { editor.redo(); editor.grabFocus(); }
                },
                'action/debug': {
                    get: function () { return app.isDebugMode(); },
                    set: function (state) { app.setDebugMode(state); editor.grabFocus(); }
                },

                'character/font/bold': {
                    get: function () { return editor.getAttribute('bold'); },
                    set: function (state) { editor.setAttribute('bold', state); editor.grabFocus(); },
                    poll: true
                },
                'character/font/italic': {
                    get: function () { return editor.getAttribute('italic'); },
                    set: function (state) { editor.setAttribute('italic', state); editor.grabFocus(); },
                    poll: true
                },
                'character/font/underline': {
                    get: function () { return editor.getAttribute('underline'); },
                    set: function (state) { editor.setAttribute('underline', state); editor.grabFocus(); },
                    poll: true
                },

                'paragraph/alignment': {
                    set: function (value) { editor.grabFocus(); }
                }

            });

            // methods --------------------------------------------------------

            /**
             * Registers a new editor instance. If the editor has the browser
             * focus, this controller will use it as target for item actions
             * triggered by any registered view component.
             */
            this.registerEditor = function (newEditor, supportedItems) {
                newEditor
                    .on('focus', _.bind(function (event, focused) {
                        if (focused && (editor !== newEditor)) {
                            // set as current editor
                            editor = newEditor;
                            // update view components
                            this.enableAndDisable(supportedItems);
                        }
                    }, this))
                    .on('operation', _.bind(function () {
                        this.update(['action/undo', 'action/redo']);
                    }, this));
                return this;
            };

        } // end of constructor

    }); // class EditorController

    // createApplication() ====================================================

    function createApplication(options) {

        var // OX application object
            app = ox.ui.createApp({ name: MODULE_NAME }),

            // application window
            win = null,

            // connection to infostore file
            file = null,

            // controller as single connection point between editors and view elements
            controller = new EditorController(app),

            // main tool bar
            toolbar = new MainToolBar(),

            // editors mapped by text mode
            editors = {},

            // primary editor used in save, quit, etc.
            editor = null,

            debugMode = null;

        // private functions --------------------------------------------------

        function initializeApp(options) {
            file = _.isObject(options) ? options.file : null;

            app.setDebugMode(options && (options.debugMode === true));
        }

        /**
         * Returns the URL passed to the AJAX calls used to convert a document
         * file from and to an operations list.
         */
        function getFilterUrl(action) {
            return file && (ox.apiRoot +
                '/oxodocumentfilter' +
                '?action=' + action +
                '&id=' + file.id +
                '&folder_id=' + file.folder_id +
                '&version=' + file.version +
                '&filename=' + file.filename +
                '&session=' + ox.session);
        }

        /**
         * Shows a closable error message above the editor.
         *
         * @param {String} message
         *  The message text.
         *
         * @param {String} [title='Error']
         *  The title of the error message. Defaults to 'Error'.
         */
        function showError(message, title) {
            win.nodes.appPane
                .find('.alert').remove().end()
                .prepend($.alert(title || gt('Error'), message));
        }

        /**
         * Shows an error message extracted from the error object returned by
         * a jQuery AJAX call.
         *
         * @param {Object} response
         *  Response object returned by the failed AJAX call.
         */
        function showAjaxError(response) {
            showError(response.responseText, gt('AJAX Error'));
        }

        /**
         * Shows an error message for an unhandled exception.
         *
         * @param exception
         *  The exception to be reported.
         */
        function showExceptionError(exception) {
            showError('Exception caught: ' + exception, 'Internal Error');
        }

        /**
         * Sets application title (launcher) and window title according to the
         * current file name.
         */
        function updateTitles() {
            var fileName = (file && file.filename) ? file.filename : gt('Unnamed');
            app.setTitle(fileName);
            win.setTitle(gt('OX Office') + ' - ' + fileName);
        }

        /**
         * Recalculates the size of the editor frame according to the current
         * view port size.
         */
        function windowResizeHandler() {
            var debugHeight = debugMode ? win.nodes.debugPane.outerHeight() : 0;
            win.nodes.appPane.height(window.innerHeight - win.nodes.appPane.offset().top - debugHeight);
        }

        /**
         * The handler function that will be called while launching the
         * application. Creates and initializes a new application window.
         */
        function launchHandler() {
            // create the application window
            win = ox.ui.createWindow({
                name: MODULE_NAME,
                close: true,
                search: false,
                toolbar: true
            });
            app.setWindow(win);

            // do not detach when hiding to keep edit selection alive
            win.detachable = false;

            // create panes and attach them to the main window
            win.nodes.main.addClass('io-ox-office-main').append(
                // top pane for tool bars
                win.nodes.toolPane = $('<div>').addClass('io-ox-office-tool-pane'),
                // main application container
                win.nodes.appPane = $('<div>').addClass('container'),
                // bottom pane for debug output
                win.nodes.debugPane = $('<div>').addClass('io-ox-office-debug-pane')
            );

            // update editor 'div' on window size change
            $(window).resize(windowResizeHandler);

            // trigger all window resize handlers on 'show' events
            win.on('show', function () { $(window).resize(); });
        }

        /**
         * The handler function that will be called when the application shuts
         * down. If the edited document has unsaved changes, a dialog will be
         * shown asking whether to save or drop the changes.
         *
         * @returns {jQuery.Deferred}
         *  A deferred that will be resolved if the application can be closed
         *  (either if it is unchanged, or the user has chosen to save or lose
         *  the changes), or will be rejected if the application must remain
         *  alive (user has cancelled the dialog, save operation failed).
         */
        function quitHandler() {
            var def = $.Deferred().done(app.destroy);

            function saveChanges() {
                app.save().pipe(function () { def.resolve(); }, function () { def.reject(); });
            }

            if (editor && editor.isModified()) {
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt('Do you really want to cancel editing this document?'))
                        .addPrimaryButton('delete', gt('Lose changes'))
                        .on('delete', function () { def.resolve(); })
                        .addAlternativeButton('save', gt('Save'))
                        .on('save', saveChanges)
                        .addButton('cancel', gt('Cancel'))
                        .on('cancel', function () { def.reject(); })
                        .show();
                });
            } else {
                def.resolve();
            }

            return def;
        }

        function createOperationsList(result) {

            var operations = [],
                value = null;

            try {
                value = JSON.parse(result.data).operations;
            } catch (e) {
                window.console.warn("Failed to parse JSON data. Trying second parse process.");
            }

            if (!value) {
                try {
                    value = result.data.operations; // code for Dummy Operations.
                } catch (e) {
                    window.console.warn("Failed to parse JSON data. No JSON data could be loaded.");
                }
            }

            if (_(value).isArray()) {
                _(value).each(function (json, j) {
                    if (_(json).isObject()) {
                        operations.push(json);  // the value has already the correct object notation, if it was sent as JSONObject from Java code
                    }
                });
            }

            return operations;
        }

        // methods ============================================================

        app.getFileDescriptor = function () {
            return file;
        };

        /**
         * Shows the application window and activates the editor.
         *
         * @returns {jQuery.Deferred}
         *  A deferred that is resolved if the application has been made
         *  visible, or rejected if the application is in an invalid state.
         */
        app.show = function () {
            var def = $.Deferred();

            if (win && editor) {
                win.show();
                updateTitles();
                editor.grabFocus();
                def.resolve();
            } else {
                def.reject();
            }

            return def;
        };

        /**
         * Loads the document described in the file descriptor passed to the
         * constructor of this application, and shows the application window.
         *
         * @returns {jQuery.Deferred}
         *  A deferred that reflects the result of the load operation.
         */
        app.load = function () {
            var def = null;

            // do not load twice (may be called repeatedly from app launcher)
            app.load = app.show;

            // do not try to load, if file descriptor is missing
            if (!file) {
                return app.show();
            }

            // show application window
            win.show().busy();
            $(window).resize();
            updateTitles();

            // initialize the deferred return
            def = $.Deferred().always(function () {
                editor.setModified(false);
                editor.grabFocus(true);
            });

            // load the file
            $.ajax({
                type: 'GET',
                url: getFilterUrl('importdocument'),
                dataType: 'json'
            })
            .done(function (response) {
                try {
                    var operations = createOperationsList(response);
                    editor.applyOperations(operations, false, true);
                    win.idle();
                    def.resolve();
                } catch (ex) {
                    showExceptionError(ex);
                    editor.initDocument();
                    win.idle();
                    def.reject();
                }
            })
            .fail(function (response) {
                showAjaxError(response);
                editor.initDocument();
                win.idle();
                def.reject();
            });

            return def;
        };

        /**
         * Saves the document to its origin.
         *
         * @returns {jQuery.Deferred}
         *  A deferred that reflects the result of the save operation.
         */
        app.save = function () {
            var def = $.Deferred();

            // do not try to save, if file descriptor is missing
            if (!file) {
                editor.grabFocus();
                return def.reject();
            }

            win.busy();
            var allOperations = editor.getOperations();
            var dataObject = { operations: JSON.stringify(allOperations) };

            $.ajax({
                type: 'POST',
                url: getFilterUrl('exportdocument'),
                dataType: 'json',
                data: dataObject,
                beforeSend: function (xhr) {
                    if (xhr && xhr.overrideMimeType) {
                        xhr.overrideMimeType('application/j-son;charset=UTF-8');
                    }
                }
            })
            .done(function (response) {
                filesApi.caches.get.clear(); // TODO
                filesApi.caches.versions.clear();
                filesApi.trigger('refresh.all');
                editor.setModified(false);
                editor.grabFocus();
                win.idle();
                def.resolve();
            })
            .fail(function (response) {
                showAjaxError(response);
                editor.grabFocus();
                win.idle();
                def.reject();
            });

            return def;
        };

        app.failSave = function () {
            var point = { file: file, debugMode: debugMode };
            return { module: MODULE_NAME, point: point };
        };

        app.failRestore = function (point) {
            initializeApp(point);
            return app.load();
        };

        /**
         * Returns whether the application is in debug mode. See method
         * setDebugMode() for details.
         */
        app.isDebugMode = function () {
            return debugMode;
        };

        /**
         * Enables or disables the debug mode. In debug mode, displays colored
         * borders and background for 'p' and 'span' elements in the rich-text
         * editor, and shows a plain-text editor and an output console for
         * processed operations.
         */
        app.setDebugMode = function (state) {
            if (debugMode !== state) {
                debugMode = state;
                editor.getNode().toggleClass('debug-highlight', state);
                win.nodes.debugPane[state ? 'show' : 'hide']();
                // resize editor pane
                windowResizeHandler();
            }
            return this;
        };

        /**
         * Destructs the application. Will be called automatically in a forced
         * quit, but has to be called manually for a regular quit (e.g. from
         * window close button).
         */
        app.destroy = function () {
            $(window).off('resize', windowResizeHandler);
            controller.destroy();
            toolbar.destroy();
            app = win = toolbar = controller = editors = editor = null;
        };

        // initialization -----------------------------------------------------

        // create the rich-text and plain-text editor
        _(Editor.TextMode).each(function (textMode) {
            var node = $('<div>')
                    .addClass('io-ox-office-editor user-select-text ' + textMode)
                    .attr('lang', 'undefined')  // TODO
                    .attr('contenteditable', true);
            editors[textMode] = new Editor(node, textMode);
        });

        // register GUI elements and editors at the controller
        controller
            .registerViewComponent(toolbar)
            .registerEditor(editors[Editor.TextMode.RICH])
            .registerEditor(editors[Editor.TextMode.PLAIN], /^action\//);

        // primary editor for global operations (e.g. save)
        editor = editors[Editor.TextMode.RICH];

        // operations output console
        editors.output = {
            node: $('<div>').addClass('io-ox-office-editor user-select-text output'),
            on: function () { return this; },
            applyOperation: function (operation) {
                this.node.append($('<p>').text(JSON.stringify(operation)));
                this.node.scrollTop(this.node.get(0).scrollHeight);
            }
        };

        // build debug table for plain-text editor and operations output console
        win.nodes.debugPane.append($('<table>').append(
            $('<colgroup>').append(
                $('<col>').attr('width', '50%'),
                $('<col>').attr('width', '50%')
            ),
            $('<tr>').append(
                $('<td>').append(editors[Editor.TextMode.PLAIN].getNode()),
                $('<td>').append(editors.output.node)
            )
        ));

        // insert elements into panes
        win.nodes.toolPane.append(toolbar.getNode());
        win.nodes.appPane.append(editor.getNode());

        // listen to operations and deliver them to editors and output console
        _(editors).each(function (editor) {
            editor.on('operation', function (event, operation) {
                _(editors).each(function (targetEditor) {
                    if (editor !== targetEditor) {
                        targetEditor.applyOperation(operation);
                    }
                });
            });
        });

        // configure OX application
        initializeApp(options);
        return app.setLauncher(launchHandler).setQuit(quitHandler);

    } // createApplication()

    // exports ================================================================

    // io.ox.launch() expects an object with the method getApp()
    return {
        getApp: function (options) {

            var // get file descriptor from options
                file = _.isObject(options) ? options.file : null,

                // find running editor application
                running = _.isObject(file) ? ox.ui.App.get(MODULE_NAME).filter(function (app) {
                    var appFile = app.getFileDescriptor();
                    // TODO: check file version too?
                    return _.isObject(appFile) &&
                        (file.id === appFile.id) &&
                        (file.folder_id === appFile.folder_id);
                }) : [];

            return running.length ? running[0] : createApplication(options);
        }
    };

});
