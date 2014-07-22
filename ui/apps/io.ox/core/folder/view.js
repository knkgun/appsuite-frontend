/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/view',
    ['io.ox/core/extensions',
     'io.ox/core/folder/api',
     'settings!io.ox/core',
     'gettext!io.ox/core'
    ], function (ext, api, settings, gt) {

    'use strict';

    function initialize(options) {

        options = options || {};

        var app = options.app,
            tree = options.tree,
            module = tree.options.module,
            POINT = app.get('name') + '/folderview',
            visible = false,
            open = app.settings.get('folderview/open', {}),
            nodes = app.getWindow().nodes,
            sidepanel = nodes.sidepanel,
            hiddenByWindowResize = false;

        //
        // Utility functions
        //

        function storeVisibleState() {
            app.settings.set('folderview/visible/' + _.display(), visible).save();
        }

        function storeWidth(width) {
            app.settings.set('folderview/width/' + _.display(), width).save();
        }

        function getWidth() {
            return app.settings.get('folderview/width/' + _.display(), 250);
        }

        function applyWidth(x) {
            nodes.body.css('left', x + 'px');
            nodes.sidepanel.css('width', x + 'px');
        }

        function applyInitialWidth() {
            applyWidth(getWidth());
        }

        function resetLeftPosition() {
            var win = app.getWindow(),
                chromeless = win.options.chromeless,
                tooSmall = $(document).width() <= 700;
            nodes.body.css('left', chromeless || tooSmall ? 0 : 50);
        }

        //
        // Add API
        //

        app.folderView = {

            isVisible: function () {
                return visible;
            },

            show: function () {
                visible = true;
                if (!hiddenByWindowResize) storeVisibleState();
                applyInitialWidth();
                sidepanel.addClass('visible');
                app.trigger('folderview:open');
            },

            hide: function () {
                visible = false;
                if (!hiddenByWindowResize) storeVisibleState();
                resetLeftPosition();
                sidepanel.removeClass('visible').css('width', '');
                app.trigger('folderview:close');
            },

            toggle: function (state) {
                if (state === undefined) state = !visible;
                if (state) this.show(); else this.hide();
            },

            resize: (function () {

                var bar = $(),
                    maxSidePanelWidth = 0,
                    minSidePanelWidth = 150,
                    width = 0;

                function mousemove(e) {
                    var x = e.pageX;
                    if (x > maxSidePanelWidth || x < minSidePanelWidth) return;
                    app.trigger('folderview:resize');
                    applyWidth(width = x);
                }

                function mouseup(e) {
                    $(this).off('mousemove.resize mouseup.resize');
                    // auto-close?
                    if (e.pageX < minSidePanelWidth) app.folderView.hide();
                    else storeWidth(width || 250);
                }

                function mousedown(e) {
                    e.preventDefault();
                    maxSidePanelWidth = $(document).width() / 2;
                    $(document).on({
                        'mousemove.resize': mousemove,
                        'mouseup.resize': mouseup
                    });
                }

                return {
                    enable: function () {
                        sidepanel.append(
                            bar = $('<div class="resizebar">').on('mousedown.resize', mousedown)
                        );
                    }
                };
            }())
        };

        app.folderViewIsVisible = function () {
            return visible;
        };

        //
        // Respond to window resize
        //

        function handleWindowResize() {
            // get current width
            var width = $(document).width();
            // skip if window is invisible
            if (!nodes.outer.is(':visible')) return;
            // respond to current width
            if (!hiddenByWindowResize && visible && width <= 700) {
                app.folderView.hide();
                hiddenByWindowResize = true;
            } else if (hiddenByWindowResize && width > 700) {
                app.folderView.show();
                hiddenByWindowResize = false;
            }
        }

        $(window).on('resize', _.throttle(handleWindowResize, 200));

        //
        // Extensions
        //

        // default options
        ext.point(POINT + '/options').extend({
            id: 'defaults',
            index: 100,
            rootFolderId: '1',
            type: undefined,
            view: 'ApplicationFolderTree',
            // disable folder popup as it takes to much space for startup on small screens
            visible: _.device('small') ? false : app.settings.get('folderview/visible/' + _.display(), true)
        });

        // draw container
        ext.point(POINT + '/sidepanel').extend({
            index: 100,
            draw: function (baton) {

                this.prepend(
                    // sidepanel
                    baton.$.sidepanel = $('<div class="abs foldertree-sidepanel">')
                    .attr({
                        'role': 'navigation',
                        'aria-label': gt('Folders')
                    })
                    .append(
                        // container
                        $('<div class="abs foldertree-container">').append(
                            baton.$.container = $('<div class="foldertree">'),
                            baton.$.links = $('<div class="foldertree-links">')
                        )
                    )
                );

                ext.point(POINT + '/sidepanel/links').invoke('draw', baton.$.links, baton);
            }
        });

        //
        // Initialize
        //

        // migrate hidden folders
        if (module) {
            var hidden = settings.get(['folder/hidden', module]); // yep, folder/hidden is one key
            if (hidden === undefined) {
                hidden = app.settings.get('folderview/blacklist', {});
                if (_.isObject(hidden)) settings.set(['folder/hidden', module], hidden).save();
            }
        }

        // work with old non-device specific setting (<= 7.2.2) and new device-specific approach (>= 7.4)
        if (open && open[_.display()]) open = open[_.display()];
        open = _.isArray(open) ? open : [];

        // apply
        tree.options.open = open;

        // add border
        sidepanel.addClass('border-right');

        // render tree and add to DOM
        sidepanel.append(tree.render().$el);

        // a11y adjustments
        tree.$el.attr({
            'aria-label': gt('Folders')
        });

        // apply all options
        _(ext.point(POINT + '/options').all()).each(function (obj) {
            options = _.extend(obj, options || {});
        });

        // respond to folder change events

        (function folderChangeEvents() {

            var ignoreChangeEvent = false;

            tree.on('change', function (id) {
                ignoreChangeEvent = true;
                app.folder.set(id);
                ignoreChangeEvent = false;
            });

            app.on('folder:change', function (id) {
                if (ignoreChangeEvent) return;
                tree.selection.set(id);
            });

        }());

        // set initial folder
        var id = app.folder.get();
        if (id) {
            // try now
            tree.selection.preselect(id);
            // and on appear
            tree.once('appear:' + id, function () {
                tree.selection.preselect(id);
            });
        }

        // respond to folder removal
        api.on('remove:prepare', function (e, data) {
            // select parent or default folder
            var id = data.folder_id === '1' ? api.getDefaultFolder(data.module) || '1' : data.folder_id;
            tree.selection.set(id);
        });

        // respond to folder move
        api.on('move', function (e, id, newId) {
            tree.selection.set(newId);
        });

        // respond to open/close

        function getOpenFolders() {
            return _(tree.$el.find('.folder.open'))
                .map(function (node) {
                    return $(node).attr('data-id');
                })
                .sort();
        }

        tree.on('open close', function () {
            var open = getOpenFolders();
            app.settings.set('folderview/open/' + _.display(), open).save();
        });

        // show
        if (options.visible) app.folderView.show();
    }

    return {
        initialize: initialize
    };
});
