/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/calendar/settings/schedjoules/api', [
    'io.ox/core/http'
], function (http) {

    var api = {

        get: function (obj) {

            return http.GET({
                module: 'chronos/schedjoules',
                params: obj === undefined ? { action: 'browse' } : { action: 'browse', id: obj.id, language: obj.language, country: obj.country }
            });
        },

        getLanguages: function () {
            return http.GET({
                module: 'chronos/schedjoules',
                params: { action: 'languages' }
            });
        },


        getCountries: function (lang) {
            return http.GET({
                module: 'chronos/schedjoules',
                params: { action: 'countries', language: lang }
            });
        },

        subscribeCalendar: function (obj) {
            return http.PUT({
                module: 'folders',
                params: { action: 'new', autorename: true, folder_id: 1, tree: 0 },
                appendColumns: false,
                data: {
                    module: 'event',
                    subscribed: 1,
                    title: obj.name,
                    'com.openexchange.calendar.provider': 'schedjoules',
                    'com.openexchange.calendar.config': {
                        'itemId': obj.itemId,
                        'refreshInterval': 10080
                    },
                    'com.openexchange.calendar.extendedProperties': {
                        'color': { 'value': 'turquoise' }
                    }
                }

            });
        }

    };

    return api;

});
