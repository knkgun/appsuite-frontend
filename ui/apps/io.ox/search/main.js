/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/search/main',
    ['gettext!io.ox/search',
     'settings!io.ox/core',
     'io.ox/core/extensions',
     'io.ox/core/tk/dialogs',
     'io.ox/search/model',
     'io.ox/search/view',
     'io.ox/search/api',
     'io.ox/core/notifications',
     'less!io.ox/search/style'
    ], function (gt, settings, ext, dialogs, SearchModel, SearchView, api, notifications) {

    'use strict';

    ext.point('io.ox/search/main').extend({
        index: 100,
        id: 'default',
        config: function (data) {
            data.defaultApp =  settings.get('settings/search/default', 'io.ox/mail');
        }
    });

    ext.point('io.ox/search/main').extend({
        index: 200,
        id: 'custom',
        config: function (data) {
            data.custom =  settings.get('settings/search/custom/time', ['mail']);
        }
    });

    ext.point('io.ox/search/main').extend({
        index: 300,
        id: 'mandatory',
        config: function (data) {
            data.mandatory =  settings.get('settings/search/mandatory/folder', ['mail', 'infostore']);
        }
    });

    ext.point('io.ox/search/main').extend({
        index: 400,
        id: 'mapping',
        config: function (data) {
            //active app : app searched in
            data.mapping = {
                //name mapping
                //'io.ox/files' : 'io.ox/infostore',

                //TODO: when supported enable drive again
                'io.ox/files' : data.defaultApp,
                //fallback/default mapping
                'io.ox/portal' : data.defaultApp,
                'io.ox/search' : data.defaultApp,
                'io.ox/settings' : data.defaultApp
            };
        }
    });

    function openSidePopup(popup, e, target) {
        var id = target.attr('data-id'),
            item = model.get('items').get(id),
            baton = {};

        baton.data = item.get('data');

        // defer to get visual feedback first (e.g. script errors)
        _.defer(function () {
            ext.point('io.ox/search/items/' + model.getModule()).invoke('draw', popup, baton);
        });
    }

    //TODO: use custom node for autocomplete (autocomplete items appended here)
    //TODO: facete options (e.g. all, recipient, sender)
    var app = ox.ui.createApp({
            name: 'io.ox/search',
            title: 'Search'
            //TODO: destroys app
            //closable: true
        }),
        show = function (win) {
            var def = $.Deferred();
            win.show(def.resolve);
            return def;
        },
        yell = function (error) {
            notifications.yell('error', error.error_desc);
        },
        sidepopup = new dialogs.SidePopup({tabTrap: true}),
        win, model, run;

    //define launcher callback
    app.setLauncher(function (options) {
        var opt = $.extend({}, options || {});

        app.launched = true;

        //init window
        win = ox.ui.createWindow({
                name: 'io.ox/search',
                title: 'Search',
                toolbar: true,
                search: false
            });
        win.addClass('io-ox-search-main');
        app.setWindow(win);

        //use application view
        app.view = SearchView.factory
                    .create(app, model, win.nodes.main);

        //update model
        model.set({
            mode: 'window',
            query: opt.query
        });

        //TODO: gt
        app.setTitle(model.getTitle());

        // return deferred
        return show(win).done(function () {
            // add side popup and delgate item clicks
            sidepopup.delegate(app.view.$el, '.item', openSidePopup);
            //TODO:
            //$(input.app).focus();
        });
    });

    //extend app
    app = $.extend(true, app, {

        //use proxy for managing model (called via autocomplete)
        apiproxy: {
            //alias for autocomplete tk
            search: function (query, options) {
                var standard = {
                    params: {
                        module: model.getModule()
                    },
                    data: {
                        prefix: query,
                        //use returned facets array from last query request
                        facets: model.getFacets() //model.get('data').facets || ''
                    }
                };

                return api.autocomplete($.extend(standard, options))
                    .then(function (obj) {

                        //TODO: remove when backend is ready
                        _.each(obj.facets.values, function (value) {
                            //multifilter facet
                            if (value.options)
                                value.options = value.options[0];

                        });

                        //match convention in autocomplete tk
                        var data = {
                            list: obj.facets,
                            hits: 0
                        };
                        model.set({
                            query: query,
                            autocomplete: data.list
                        }, {
                            silent: true
                        });
                        return data;
                    }, yell);
            },
            query: function () {
                var opt = {
                        params: {
                            //translate app to module param
                            module: model.getModule()
                        },
                        data: {
                            facets: model.getFacets(),
                            start: model.get('start'),
                            size: model.get('size')
                        }
                    };

                return api.query(opt)
                        .then(function (result) {
                            model.setItems(result);
                            run();
                        }, yell);
            }
        }
    });

    //init model and listeners
    model = SearchModel.factory.create({mode: 'widget'})
            .on('query change:start change:size', app.apiproxy.query)
            // .on('all', function (name, model, value) {
            //     console.log('event: ', name, value);
            // })
            .on('reset change', function () {
                //console.log('-> redraw: ', arguments);
                app.view.redraw();
            });

    //run app
    run = function () {
        if (app.get('state') === 'running')
            app.view.redraw();
        else
            app.launch.call(app);
    };

    return {
        getApp: app.getInstance,
        run: run,
        init: function (container) {
            var $container = container || $('<div>');
            app.view = SearchView.factory
                        .create(app, model, $container)
                        .render($container);

            return $container;
        },
        reuse: function () {
            return ox.ui.App.reuse('io.ox/search');
        }
    };
});
