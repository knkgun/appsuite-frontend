/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('plugins/core/feedback/register', [
    'io.ox/backbone/views/modal',
    'io.ox/core/api/apps',
    'gettext!io.ox/core',
    'io.ox/core/yell',
    'io.ox/backbone/disposable',
    'settings!io.ox/core',
    'io.ox/core/api/user',
    'io.ox/core/extensions',
    'less!plugins/core/feedback/style'
], function (ModalDialog, appApi, gt, yell, DisposableView, settings, api, ext) {

    'use strict';

    var captions = {
        //#. 1 of 5 star rating
        1: gt.pgettext('rating', 'It\'s really bad'),
        //#. 2 of 5 star rating
        2: gt.pgettext('rating', 'I don\'t like it'),
        //#. 3 of 5 star rating
        3: gt.pgettext('rating', 'It\'s ok'),
        //#. 4 of 5 star rating
        4: gt.pgettext('rating', 'I like it'),
        //#. 5 of 5 star rating
        5: gt.pgettext('rating', 'It\'s awesome')
    };

    var StarRatingView = DisposableView.extend({

        className: 'star-rating rating-view',

        events: {
            'change input': 'onChange',
            'mouseenter label': 'onHover',
            'mouseleave label': 'onHover'
        },

        initialize: function (options) {
            this.options = _.extend({ hover: true }, options);
            this.value = 0;
            this.$el.attr('tabindex', -1);
        },

        render: function () {

            this.$el.append(
                _.range(1, 6).map(function (i) {
                    return $('<label>').append(
                        $('<input type="radio" name="star-rating" class="sr-only">').val(i)
                            .attr('title', gt('%1$d of 5 stars', i) + '. ' + captions[i]),
                        $('<i class="fa fa-star star" aria-hidden="true">')
                    );
                }),
                $('<caption aria-hidden="true">').text('\u00a0')
            );

            return this;
        },

        renderRating: function (value) {
            this.$('.star').each(function (index) {
                $(this).toggleClass('checked', index < value);
            });
            this.$('caption').text(captions[value]);
        },

        getValue: function () {
            return this.value;
        },

        setValue: function (value) {
            if (value < 1 || value > 5) return;
            this.value = value;
            this.renderRating(value);
        },

        onChange: function () {
            var value = this.$('input:checked').val() || 1;
            this.setValue(value);
        },

        onHover: function (e) {
            if (!this.options.hover) return;
            var value = e.type === 'mouseenter' ? $(e.currentTarget).find('input').val() : this.value;
            this.renderRating(value);
        }
    });

    var NpsRatingView = StarRatingView.extend({

        className: 'nps-rating rating-view',

        render: function () {

            this.$el.append(
                $('<caption>').text(gt('Not likely at all')),
                $('<div>').append(
                    _.range(0, 11).map(function (i) {
                        return $('<label>').append(
                            $('<input type="radio" name="nps-rating" class="sr-only">').val(i)
                                .attr('title', gt('%1$d of 10 points.', i)),
                            $('<i class="fa fa-circle score" aria-hidden="true">'),
                            (i % 5 === 0 ? $('<div class="score-number" aria-hidden="true">').text(i) : '')
                        );
                    })
                ),
                $('<caption>').text(gt('Extremly likely'))
            );

            return this;
        },

        renderRating: function (value) {
            this.$('.score').each(function (index) {
                $(this).toggleClass('checked', index <= value);
            });
        },

        setValue: function (value) {
            if (value < 0 || value > 11) return;
            this.value = value;
            this.renderRating(value);
        }
    });

    var feedbackService;

    ext.point('plugins/core/feedback').extend({
        id: 'api',
        index: 100,
        initialize: function () {
            feedbackService = {
                sendFeedback: function (data) {
                    console.log('Feedback API must be implemented. Use the extension point "plugins/core/feedback" and implement "sendFeedback".');
                    console.log(data);
                    // return a Deferred Object here ($.ajax)
                    // which sends data to your backend
                    return $.Deferred().resolve();
                }
            };
        }
    });

    var modes = {
        nps: {
            ratingView: NpsRatingView,
            //#. %1$s is the product name, for example 'OX App Suite'
            title: gt('How likely is it you would recommend %1$s to a friend?', ox.serverConfig.productName)
        },
        stars: {
            ratingView: StarRatingView,
            title: gt('Please rate this product')
        },
        modules: {
            ratingView: StarRatingView,
            title: gt('Please rate the following application:')
        }
    };

    function sendFeedback(data) {
        return feedbackService ? feedbackService.sendFeedback(data) : $.when();
    }

    var feedback = {

        show: function () {
            var options = { enter: 'send', point: 'plugins/core/feedback', title: gt('Your feedback'), class: settings.get('feedback/mode', 'stars') + '-feedback-view' };

            // nps view needs more space
            if (settings.get('feedback/mode', 'stars') === 'nps') {
                options.width = 600;
            }
            new ModalDialog(options)
                .extend({
                    title: function () {
                        this.$body.append(
                            $('<div class="feedback-welcome-text">').text(modes[settings.get('feedback/mode', 'stars')].title)
                        );
                    },
                    modulesSelect: function () {
                        if (settings.get('feedback/mode', 'stars') !== 'modules') return;

                        var currentApp,
                            apps = _(appApi.getFavorites()).map(function (app) {
                                // suport for edit dialogs
                                if (ox.ui.App.getCurrentApp().get('name').indexOf(app.id) === 0) {
                                    currentApp = app;
                                }
                                return $('<option>').val(app.id).text(/*#, dynamic*/gt.pgettext('app', app.title));
                            });

                        if (settings.get('feedback/showModuleSelect', true)) {
                            //#. used in feedback dialog for general feedback. Would be "Allgemein" in German for example
                            apps.unshift($('<option>').val('general').text(gt('General')));
                            apps.push($('<option>').val('io.ox/settings').text(gt('Settings')));
                            this.$body.append(
                                this.appSelect = $('<select class="form-control">').append(apps)
                            );
                            this.appSelect.val(currentApp.id || apps[0].val());
                            return;
                        }

                        if (currentApp) {
                            this.$body.append(
                                $('<div class="form-control">').text(/*#, dynamic*/gt.pgettext('app', currentApp.title)),
                                this.appSelect = $('<div aria-hidden="true">').val(currentApp.id).hide()
                            );
                            return;
                        }
                        this.$body.append(
                            //#. used in feedback dialog for general feedback. Would be "Allgemein" in German for example
                            $('<div class="form-control">').text(gt('General')),
                            this.appSelect = $('<div aria-hidden="true">').val('general').hide()
                        );
                    },
                    ratingView: function () {
                        this.ratingView = new modes[settings.get('feedback/mode', 'stars')].ratingView({ hover: settings.get('feedback/showHover', true) });

                        this.$body.append(this.ratingView.render().$el);
                    },
                    comment: function () {
                        if (settings.get('feedback/mode', 'stars') === 'nps') return;
                        var guid = _.uniqueId('feedback-note-');
                        this.$body.append(
                            $('<label>').attr('for', guid).text(gt('Comments and suggestions')),
                            $('<textarea class="feedback-note form-control" rows="5">').attr('id', guid)
                        );
                    },
                    infotext: function () {
                        // without comment field infotext makes no sense
                        if (settings.get('feedback/mode', 'stars') === 'nps') return;
                        this.$body.append(
                            $('<div>').text(
                                gt('Please note that support requests cannot be handled via the feedback form. If you have questions or problems please contact our support directly.')
                            )
                        );
                    },
                    supportlink: function () {
                        if (settings.get('feedback/supportlink', '') === '') return;
                        this.$body.append(
                            $('<a>').attr('href', settings.get('feedback/supportlink', ''))
                        );
                    },

                })
                .addCancelButton()
                .addButton({ action: 'send', label: gt('Send') })
                .on('send', function () {

                    var data = {
                        feedback: {
                            rating: this.ratingView.getValue(),
                            text: this.$('.feedback-note').val()
                        },
                        client: {
                            ua: window.navigator.userAgent,
                            browser: _(_.browser).pick(function (val) { return !!val; }),
                            lang: ox.language
                        },
                        meta: {
                            serverVersion: ox.serverConfig.serverVersion,
                            uiVersion: ox.serverConfig.version,
                            productName: ox.serverConfig.productName,
                            path: ox.abs
                        }
                    };
                    if (this.appSelect) {
                        data.feedback.app = this.appSelect.val();
                    }

                    sendFeedback(data)
                        .done(function () {
                            yell('success', gt('Thank you for your feedback'));
                        })
                        .fail(yell);
                })
                .open();
        },

        drawButton: function () {
            $('#io-ox-core').append(
                $('<button type="button" class="feedback-button">')
                .text(gt('Feedback'))
                .addClass(settings.get('feedback/position', 'right') + 'side-button')
                .on('click', this.show)
            );
        }
    };

    ext.point('io.ox/core/topbar/right/dropdown').extend({
        id: 'feedback',
        index: 250,
        draw: function () {
            var currentSetting = settings.get('feedback/show', 'both');
            if (currentSetting === 'both' || currentSetting === 'topbar') {
                this.append(
                    $('<li role="presentation">').append(
                        $('<a href="#" data-action="feedback" role="menuitem" tabindex="-1">').text(gt('Give feedback'))
                    )
                    .on('click', function (e) {
                        e.preventDefault();
                        feedback.show();
                    })
                );
            }
        }
    });

    ext.point('io.ox/core/plugins').extend({
        id: 'feedback',
        draw: function () {
            if (_.device('smartphone')) return;
            var currentSetting = settings.get('feedback/show', 'both');
            if (!(currentSetting === 'both' || currentSetting === 'side')) return;
            feedback.drawButton();
        }
    });

    ext.point('plugins/core/feedback').invoke('initialize', this);

    return feedback;
});
