/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define("plugins/portal/rss/register",
    ["io.ox/core/extensions",
    "io.ox/core/strings",
    "io.ox/messaging/accounts/api",
    "io.ox/messaging/services/api",
    "io.ox/messaging/messages/api",
    'io.ox/keychain/api',
    'less!plugins/portal/rss/style.css'], function (ext, strings, accountApi, serviceApi, messageApi, keychain) {

    "use strict";
    
    var feeds = [];

    ext.point("io.ox/portal/widget").extend({
        id: 'rss',
        index: 100,
        title: 'RSS',
        load: function () {
            var def = $.Deferred();
            var requests = [];
            var id2name = {};
            accountApi.all('com.openexchange.messaging.rss').done(function (accounts) {
                _(accounts).each(function (account) {
                    var folderId = "com.openexchange.messaging.rss://" + account.id + "/";
                    id2name[folderId] = account.displayName;
                    requests.push(messageApi.all(folderId));
                });
                $.when.apply($, requests).done(function () {
                    def.resolve($.makeArray(arguments));
                }).fail(function (failure) {
                    console.log("Error when retrieving RSS feeds:", failure);
                    def.resolve();
                });
            });
            return def.pipe(function (data) {
                var result = _(data).map(function (elem) { return elem[0]; }); //drop the timestamp
                result = _.flatten(result); // merge arrays
                _(result).each(function (elem) { elem.feedName = id2name[elem.folder]; });
                result = _.sortBy(result, function (elem) {return -1 * elem.receivedDate; }); //sort by date, newest first
                return result;
            });
        },
        
        draw: function (feed) {
            var togglePreview = function () {
                $(this).parent().find('.io-ox-portal-rss-content').toggleClass('portal-preview');
                $(this).parent().find('.io-ox-portal-previewToggle').toggleClass('icon-chevron-down');
            };
            var $node = $('<div class="io-ox-portal-rss">').appendTo(this);
            
            $('<h1 class="clear-title">').text("RSS").appendTo($node);

            _(feed).each(function (entry) {
                var body = _(entry.body).find(function (candidate) {
                    return candidate.contentType.type === 'text/html';
                }).body;
                //TODO: run through HTML white list

                var $entry = $('<div class="io-ox-portal-rss-entry">').appendTo($node);
                $entry.append(
                    $('<h2 class="io-ox-portal-rss-feedTitle">').text(entry.subject).click(togglePreview),
                    $('<div class="io-ox-portal-rss-source">').append(
                        $('<span class="io-ox-portal-feedName">').text(entry.feedName + ": "),
                        $('<a class="io-ox-portal-feedUrl" target="_blank">').attr({href: entry.url}).text(strings.shortenUri(entry.url, 30))
                    ),
                    $('<div class="io-ox-portal-rss-content portal-preview">').html(body).click(togglePreview)
                );
            });
            return $.Deferred().resolve();
        }
    });
});
