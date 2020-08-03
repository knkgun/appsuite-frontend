/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/switchboard/presence', [
    'io.ox/switchboard/api',
    'gettext!io.ox/switchboard'
], function (api, gt) {

    'use strict';

    var users = {};

    var exports = {

        // returns jQuery node
        getPresenceString: function (userId) {
            var presence = this.getPresence(userId);
            return createPresenceNode(presence.availability, presence.id).append(
                $('<span class="availability">').text(this.getAvailabilityString(presence))
            );
        },

        // returns jQuery node
        getPresenceIcon: function (userId) {
            var presence = this.getPresence(userId);
            return createPresenceNode(presence.availability, presence.id);
        },

        getFixedPresenceIcon: function (availability) {
            return createPresenceIcon(availability);
        },

        // returns jQuery node
        getPresenceDot: function (userId) {
            var presence = this.getPresence(userId);
            return createPresenceNode(presence.availability, presence.id).addClass('dot');
        },

        getPresence: function (userId) {
            userId = api.trim(userId);
            if (!users[userId]) {
                users[userId] = { id: userId, lastSeen: 0, availability: 'offline' };
                api.socket.emit('presence-get', userId, function (data) {
                    exports.changePresence(userId, data);
                    if (api.isMyself(userId)) exports.trigger('change-own-availability', data.availability);
                });
            }
            return users[userId];
        },

        getAvailabilityString: function (presence) {
            switch (presence.availability) {
                case 'online':
                    return gt('Online now');
                case 'busy':
                    return gt('Busy');
                case 'absent':
                    return gt('Absent');
                default:
                    if (!presence.lastSeen) return gt('Offline');
                    // get last seen in minutes from now
                    var duration = Math.ceil((_.now() - presence.lastSeen) / 60000);
                    // this minute
                    if (duration <= 1) return gt('Last seen a minute ago');
                    // less than 1 hour
                    //#. %1$d is number of minutes
                    if (duration < 60) return gt('Last seen %1$d minutes ago', duration);
                    // less than 24 hours -> time
                    //#. %1$s is a time (e.g. 11:29 am)
                    if (duration < 1440) return gt('Last seen at %1$s', moment(presence.lastSeen).format('LT'));
                    //#. %1$s is a date (eg. 09.07.2020)
                    return gt('Last seen on %1$s', moment(presence.lastSeen).format('L'));
            }
        },

        changePresence: function (userId, changes) {
            var presence = this.getPresence(userId);
            if (changes.availability === presence.availability) return;
            _.extend(presence, changes, { lastSeen: _.now() });
            // update all DOM nodes for this user
            var $el = $('.presence[data-id="' + $.escape(presence.id) + '"]')
                .removeClass('online absent busy offline')
                .addClass(presence.availability);

            $el.find('.icon').attr('title', this.getAvailabilityString(presence));
            $el.find('.availability').text(this.getAvailabilityString(presence));
        },

        changeOwnAvailability: function (availability) {
            this.changePresence(api.userId, { availability: availability });
            // share might (soon) be: all, context, domain, (white) list
            api.socket.emit('presence-change', { availability: availability, visibility: 'all' });
            exports.trigger('change-own-availability', availability);
        },

        getMyAvailability: function () {
            return (users[api.userId] || {}).availability || 'offline';
        },

        users: users
    };

    // i18n
    var names = {
        online: gt('Online'),
        absent: gt('Absent'),
        busy: gt('Busy'),
        offline: gt('Offline')
    };

    // create template
    var tmpl = $('<div class="presence">')
        .append('<span class="icon" aria-hidden="true"><i class="fa"></i></span>');

    function createPresenceNode(availability, id) {
        return createPresenceIcon(availability).attr('data-id', id);
    }

    function createPresenceIcon(availability) {
        return tmpl.clone().addClass(availability).children('.icon').attr('title', names[availability]).end();
    }

    // respond to events
    api.socket.on('presence-change', function (userId, presence) {
        exports.changePresence(userId, presence);
    });

    api.socket.on('reconnect', function () {
        for (var userId in users) {
            delete users[userId];
            // assume offline by default
            exports.changePresence(userId, 'offline');
        }
    });

    // add an event hub. we need this to publish presence state changes
    _.extend(exports, Backbone.Events);

    return exports;
});
