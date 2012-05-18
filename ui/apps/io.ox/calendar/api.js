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
 *
 */

define("io.ox/calendar/api", ["io.ox/core/http", "io.ox/core/event"], function (http, Events) {

    "use strict";

    // really stupid caching for speed
    var all_cache = {},
        get_cache = {};

    var DAY = 60000 * 60 * 24;

    var api = {

        get: function (o) {

            o = o || {};

            var params = {
                action: "get",
                id: o.id,
                folder: o.folder || o.folder_id
            };

            if (o.recurrence_position !== null) {
                params.recurrence_position = o.recurrence_position;
            }

            var key = o.folder + "." + o.id + "." + (o.recurrence_position || 0);

            if (get_cache[key] === undefined) {
                return http.GET({
                        module: "calendar",
                        params: params
                    })
                    .done(function (data) {
                        get_cache[key] = data;
                    });
            } else {
                return $.Deferred().resolve(get_cache[key]);
            }
        },

        getAll: function (o) {

            o = $.extend({
                start: _.now(),
                end: _.now() + 28 * 1 * DAY
            }, o || {});

            // round start & end date
            o.start = (o.start / DAY >> 0) * DAY;
            o.end = (o.end / DAY >> 0) * DAY;

            var key = o.folder + "." + o.start + "." + o.end,
                params = {
                    action: "all",
                    columns: "1,20,207,201,200", // id, folder_id, recurrence_position, start_date, title
                    start: o.start,
                    end: o.end,
                    showPrivate: true,
                    recurrence_master: false,
                    sort: "201",
                    order: "asc"
                };

            if (o.folder !== undefined) {
                params.folder = o.folder;
            }

            if (all_cache[key] === undefined) {
                return http.GET({
                        module: "calendar",
                        params: params
                    })
                    .done(function (data) {
                        all_cache[key] = data;
                    });
            } else {
                return $.Deferred().resolve(all_cache[key]);
            }
        },

        getList: function (ids) {
            return http.fixList(ids,
                http.PUT({
                    module: "calendar",
                    params: {
                        action: "list"
                    },
                    data: http.simplify(ids)
                })
            );
        },

        search: function (query) {
            return http.PUT({
                    module: "calendar",
                    params: {
                        action: "search",
                        sort: "201",
                        order: "desc" // top-down makes more sense
                    },
                    data: {
                        pattern: query
                    }
                });
        },

        needsRefresh: function (folder) {
            // has entries in 'all' cache for specific folder
            return all_cache[folder] !== undefined;
        },

        update: function (o) {
            if (_.isEmpty(o.data)) {
                return $.when();
            } else {
                return http.PUT({
                    module: 'calendar',
                    params: {
                        action: 'update',
                        id: o.id,
                        folder: o.folder,
                        timestamp: o.timestamp
                    },
                    data: o.data
                })
                .pipe(function () {
                    return api.get({ id: o.id, folder: o.folder}, false)
                        .pipe(function (data) {
                            $.when(
                                /*api.caches.all.grepRemove(o.folder + '\t'),
                                api.caches.list.remove({id: o.id, folder: o.folder })*/
                            )
                            .pipe(function () {
                                all_cache = {};
                                api.trigger('refresh.all');
                                api.trigger('edit', {
                                    id: o.id,
                                    folder: o.folder
                                });
                                return data;

                            });
                        });
                })
                .fail(function (err) {
                    console.log('error on updating appointment');
                    console.log(err);
                });
            }

        },
        create: function (o) {
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'new'
                },
                data: o.data
            })
            .pipe(function () {
                console.log('ok piping');
                console.log(arguments);

            })
            .fail(function (err) {
                console.log('error on creating appointment');
                console.log(err);
            });
        }
    };

    Events.extend(api);

    // global refresh
    api.refresh = function () {
        // clear caches
        all_cache = {};
        // trigger local refresh
        api.trigger("refresh.all");
    };

    return api;
});
