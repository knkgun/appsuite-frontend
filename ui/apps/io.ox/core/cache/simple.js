/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011 Mail: info@open-xchange.com
 *
 * @author Martin Holzhauer <martin.holzhauer@open-xchange.com>
 */

define('io.ox/core/cache/simple',
        function () {

            'use strict';

            var storage = {};
            var id = null;

            return {
                setId: function (theId) {
                    id = theId;
                    if (_(storage[id]).isUndefined()) {
                        storage[id] = {};
                    }
                },
                getStorageLayerName: function () {
                    return 'cache/simple';
                },
                isUsable: function () {
                    return true;
                },
                clear: function () {
                    storage[id] = {};
                    return $.Deferred().resolve();
                },
                get: function (key) {
                    return $.Deferred().resolve(storage[id][String(key)]);
                },
                set: function (key, data) {
                    storage[id][String(key)] = data;
                    return $.Deferred().resolve(key);
                },
                contains: function (key) {
                    return $.Deferred().resolve(
                            storage[id][String(key)] !== undefined);
                },
                remove: function (key) {
                    delete storage[id][String(key)];
                    return $.Deferred().resolve();
                },
                keys: function () {
                    var key, tmp = [];

                    for (key in storage[id]) {
                        tmp.push(key);
                    }
                    return $.Deferred().resolve(tmp);
                }
            };
        });