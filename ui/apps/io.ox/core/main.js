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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define("io.ox/core/main",
    ["io.ox/core/desktop",
     "io.ox/core/session",
     "io.ox/core/http",
     "io.ox/core/api/apps",
     "io.ox/core/extensions",
     "io.ox/core/date",
     'io.ox/core/notifications',
     "gettext!io.ox/core/main",
     "io.ox/core/bootstrap/basics"], function (desktop, session, http, appAPI, ext, date, notifications, gt) {

    "use strict";

    var PATH = ox.base + "/apps/io.ox/core",
        DURATION = 250;

    var logout = function () {
        return session.logout()
            .always(function () {
                $("#background_loader").fadeIn(DURATION, function () {
                    $("#io-ox-core").hide();
                    _.url.redirect("signin");
                });
            });
    };

    var topbar = $('#io-ox-topbar'),
        container = topbar.find('launchers');

    function initRefreshAnimation() {

        var count = 0, timer = null;

        function off() {
            if (count === 0 && timer === null) {
                $("#io-ox-refresh-icon").removeClass("io-ox-progress");
            }
        }

        http.on("start", function () {
            if (count === 0) {
                if (timer === null) {
                    $("#io-ox-refresh-icon").addClass("io-ox-progress");
                }
                clearTimeout(timer);
                timer = setTimeout(function () {
                    timer = null;
                    off();
                }, 1500);
            }
            count++;
        });

        http.on("stop", function () {
            count = Math.max(0, count - 1);
            off();
        });
    }

    function globalRefresh() {
        // trigger global event
        if (ox.online && ox.session !== '') {
            try {
                console.debug('triggering automatic refresh ...');
                ox.trigger("refresh^");
            } catch (e) {
                console.error('globalRefresh()', e);
            }
        }
    }

    setInterval(globalRefresh, 60000 * 5); // 5 minute refresh interval!

    function launch() {

        ox.on('application:launch application:resume', function (e, app) {
            var name = app.getName(),
                id = app.getId(),
                launcher = $();
            // remove active class
            topbar.find('.launcher').removeClass('active');
            // has named launcher?
            launcher = topbar.find('.launcher[data-app-name=' + $.escape(name) + ']');
            // has no launcher?
            if (!launcher.length && !(launcher = topbar.find('.launcher[data-app-id=' + $.escape(id) + ']')).length) {
                launcher = desktop.addLauncher('left', app.getTitle(), app.launch).attr('data-app-id', id);
            }
            // mark as active
            launcher.addClass('active');
        });

        ox.on('application:quit', function (e, app) {
            var id = app.getId();
            topbar.find('.launcher[data-app-id=' + $.escape(id) + ']').remove();
        });

        ox.on('application:change:title', function (e, app) {
            var id = app.getId(), title = app.getTitle();
            topbar.find('.launcher[data-app-id=' + $.escape(id) + ']').text(title);
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'logo',
            index: 100,
            draw: function () {
                // add small logo to top bar
                this.append(
                    $('<div>', { id: 'io-ox-top-logo-small' })
                );
            }
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'notifications',
            index: 10000,
            draw: function () {
                notifications.attach(desktop, 'right');
                notifications.addFaviconNotification();
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'settings',
            index: 100,
            draw: function () {
                this.append(
                    $('<li>').append($('<a>').text(gt('Settings')))
                    .on('click', function () {
                        ox.launch('io.ox/settings/main');
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'settings',
            index: 100,
            draw: function () {
                this.append(
                    $('<li>').append($('<a>').text(gt('Settings')))
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'help',
            index: 200,
            draw: function () {
                this.append(
                    $('<li>').append($('<a>').text(gt('Help')))
                    .on('click', function () {
                        require(['io.ox/help/center'], function (center) {
                            setTimeout(function () {
                                center.toggle();
                            }, 1);
                        });
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'fullscreen',
            index: 200,
            draw: function () {
                this.append(
                    $('<li>').append($('<a>').text(gt('Fullscreen')))
                    .on('click', function () {
                        // Maximize
                        if (window.BigScreen.request) {
                            window.BigScreen.toggle();
                        }
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'logout',
            index: 1000,
            draw: function () {
                this.append(
                    $('<li class="divider"></li>'),
                    $('<li>').append($('<a>').text(gt('Sign out')))
                    .on('click', logout)
                );
            }
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'dropdown',
            index: 1000,
            draw: function () {
                var a, ul;
                this.append(
                    $('<div class="launcher right dropdown">').append(
                        a = $('<a class="dropdown-toggle" data-toggle="dropdown" href="#">').append(
                            $('<i class="icon-user icon-white">')
                        ),
                        ul = $('<ul class="dropdown-menu" role="menu" aria-labelledby="dLabel">')
                    )
                );
                ext.point('io.ox/core/topbar/right/dropdown').invoke('draw', ul);
                a.dropdown();
            }
        });

        // launchpad
        ext.point('io.ox/core/topbar/launchpad').extend({
            id: 'default',
            draw: function () {
                desktop.addLauncher("left", $('<i class="icon-th icon-white">'), function () {
                    return require(["io.ox/launchpad/main"], function (m) {
                        m.show();
                    });
                });
            }
        });

        // favorites
        ext.point('io.ox/core/topbar/favorites').extend({
            id: 'default',
            draw: function () {

                var addLauncher = function (app, tooltip) {
                    var launcher = desktop.addLauncher(app.side || 'left', app.title, function () {
                        return require([app.id + '/main'], function (m) {
                            var app = m.getApp();
                            launcher.attr('data-app-id', app.getId());
                            app.launch();
                        });
                    }, _.isString(tooltip) ? tooltip : void(0))
                    .attr('data-app-name', app.id);
                };

                _(appAPI.getFavorites()).each(addLauncher);
            }
        });


        ext.point('io.ox/core/topbar').extend({
            id: 'default',
            draw: function () {

                // right side
                ext.point('io.ox/core/topbar/right').invoke('draw', topbar);

                // refresh
                desktop.addLauncher("right", $('<i class="icon-refresh icon-white">'), function () {
                        globalRefresh();
                        return $.Deferred().resolve();
                    }, gt('Refresh'))
                    .attr("id", "io-ox-refresh-icon");

                // refresh animation
                initRefreshAnimation();

                ext.point('io.ox/core/topbar/launchpad').invoke('draw');
                ext.point('io.ox/core/topbar/favorites').invoke('draw');
            }
        });

        /**
         * Exemplary upsell widget
         */
        ext.point("io.ox/core/desktop").extend({
            id: "upsell",
            draw: function () {
                // does nothing - just to demo an exemplary upsell path
                this.append(
                    $('<div>').css({
                        position: "absolute",
                        width: "270px",
                        height: "140px",
                        right: "70px",
                        bottom: "150px"
                    })
                    .append(
                        $("<div>", { id: "io-ox-welcome-upsell" })
                        .addClass('abs')
                        .css({
                            padding: "30px",
                            zIndex: 1
                        })
                        .text("Confidential! Not to be disclosed to third parties.")
                    )
                );
            }
        });

        ext.point("io.ox/core/desktop").extend({
            id: "welcome",
            draw: function () {

                var d, update;

                this.append(
                    $("<div>", { id: "io-ox-welcome" })
                    .addClass("abs")
                    .append(
                        $("<div>").addClass("clear-title")
                        .append(
                            // split user into three parts, have to use inject here to get proper node set
                            _(String(ox.user).split(/(\@)/)).inject(function (tmp, s, i) {
                                    return tmp.add($("<span>").text(String(s)).addClass(i === 1 ? "accent": ""));
                                }, $())
                        )
                    )
                    .append(
                        d = $("<div>").addClass("clock clear-title").text("")
                    )
                );
                update = function () {
                    //d.text(new date.Local().format(date.FULL_DATE)); // FIXME: Seems to die on android
                };
                update();
                _.tick(1, "minute", update);
            }
        });

        var drawDesktop = function () {
            ext.point("io.ox/core/desktop").invoke("draw", $("#io-ox-desktop"), {});
            drawDesktop = $.noop;
        };

        ox.ui.windowManager.on("empty", function (e, isEmpty) {
            if (isEmpty) {
                drawDesktop();
            }
            if (isEmpty) {
                ox.ui.screens.show('desktop');
            } else {
                ox.ui.screens.show('windowmanager');
            }
        });

        // add some senseless characters to avoid unwanted scrolling
        if (location.hash === '') {
            location.hash = '#!';
        }

        var def = $.Deferred(),
            autoLaunch = _.url.hash("app") ? _.url.hash("app").split(/,/) : [],
            autoLaunchModules = _(autoLaunch)
                .map(function (m) {
                    return m.split(/:/)[0] + '/main';
                });

        $.when(
                def,
                ext.loadPlugins(),
                require(autoLaunchModules),
                require(['io.ox/core/api/account']).pipe(function (api) {
                    return api.all();
                })
            )
            .done(function (instantFadeOut) {

                // draw top bar now
                ext.point('io.ox/core/topbar').invoke('draw');

                // help here
                if (!ext.point('io.ox/core/topbar').isEnabled('default')) {
                    $('#io-ox-screens').css('top', '0px');
                    topbar.hide();
                }

                // auto launch
                _(autoLaunch).each(function (id) {
                    // split app/call
                    var pair = id.split(/:/),
                        launch = require(pair[0] + '/main').getApp().launch(),
                        call = pair[1];
                    // explicit call?
                    if (call) {
                        launch.done(function () {
                            if (this[call]) {
                                this[call]();
                            }
                        });
                    }
                });
                // restore apps
                ox.ui.App.restore();

                if (instantFadeOut === true) {
                    // instant fade out
                    $("#background_loader").idle().hide();
                }
            });

        var restoreLauncher = function (canRestore) {
            if (autoLaunch.length === 0 && !canRestore) {
                drawDesktop();
                def.resolve(true);
                return;
            }
            if (autoLaunch.length || canRestore || location.hash === '#!') {
                def.resolve(true);
            } else {
                // fade out animation
                $("#background_loader").idle().fadeOut(DURATION, def.resolve);
            }
        };

        ox.ui.App.canRestore()
            .done(function (canRestore) {
                if (canRestore) {
                    // clear auto start stuff (just conflicts)
                    autoLaunch = [];
                    autoLaunchModules = [];
                }
                restoreLauncher(canRestore);
            });
    }

    return {
        launch: launch
    };
});
