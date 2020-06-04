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

define('io.ox/switchboard/settings/pane', [
    'io.ox/core/extensions',
    'io.ox/core/settings/util',
    'io.ox/backbone/views/extensible',
    'io.ox/backbone/views/disposable',
    'io.ox/switchboard/api',
    'io.ox/switchboard/zoom',
    'io.ox/contacts/util',
    'settings!io.ox/switchboard',
    'gettext!io.ox/switchboard'
], function (ext, util, ExtensibleView, DisposableView, api, zoom, contactsUtil, settings, gt) {

    'use strict';

    ext.point('io.ox/switchboard/settings/detail').extend({
        index: 100,
        id: 'view',
        draw: function () {
            this.append(
                new ExtensibleView({ point: 'io.ox/switchboard/settings/detail/view', model: settings })
                .build(function () {
                    this.listenTo(settings, 'change', function () {
                        settings.saveAndYell();
                    });
                })
                .render().$el
            );
        }
    });

    var INDEX = 100;

    ext.point('io.ox/switchboard/settings/detail/view').extend(
        {
            id: 'header',
            index: INDEX += 100,
            render: function () {
                this.$el.append(
                    util.header(gt('Zoom Integration'))
                );
            }
        },
        {
            id: 'account',
            index: INDEX += 100,
            render: function () {
                this.$el.append(
                    new AccountView().render().$el
                );
            }
        },
        {
            id: 'checkboxes',
            index: INDEX += 100,
            render: function () {
                this.$el.append(
                    util.fieldset(
                        gt('Options'),
                        util.checkbox('zoom/addMeetingPassword', gt('Always add a random meeting password'), settings),
                        util.checkbox('zoom/showNativeNotifications', gt('Use native notifications'), settings),
                        util.checkbox('zoom/useRingtones', gt('Play ringtone on incoming call'), settings)
                    )
                );
            }
        }
    );

    var AccountView = DisposableView.extend({
        className: 'conference-account-view',
        events: {
            'click [data-action="add"]': 'onAdd',
            'click [data-action="remove"]': 'onRemove'
        },
        initialize: function () {
            this.listenTo(ox, 'zoom:tokens:added', this.render);
        },
        render: function () {
            this.$el.empty().append(this.$account);
            zoom.getAccount().then(
                this.renderAccount.bind(this),
                this.renderMissingAccount.bind(this)
            );
            return this;
        },
        renderMissingAccount: function () {
            this.$el.empty().append(
                $('<p>').text(
                    gt('You have not linked your Zoom account. In order to use Zoom-specific features, you must have an account.')
                ),
                // add button
                $('<button type="button" class="btn btn-primary" data-action="add">').text(
                    gt('Add Zoom account')
                )
            );
        },
        renderAccount: function (data) {
            var name = contactsUtil.getFullName(data);
            var pmi = data.pmi && ('https://zoom.us/j/' + String(data.pmi).replace(/\D+/g, ''));
            this.$el.empty().append(
                $('<p>').text(
                    gt('You have linked the following Zoom account:')
                ),
                $('<div class="conference-account">').append(
                    // name
                    name && $('<div class="name">').text(name),
                    // email
                    data.email && $('<div>').append(
                        $('<a target="_blank" rel="noopener">')
                        .attr('href', 'mailto:' + data.email)
                        .text(data.email)
                    ),
                    // personal meeting
                    pmi && $('<div>').append(
                        $.txt(gt('Personal Meeting ID:') + ' '),
                        $('<a target="_blank" rel="noopener">')
                        .attr('href', pmi)
                        .text(data.pmi)
                    ),
                    // remove button
                    $('<button type="button" class="btn btn-link" data-action="remove">')
                        .attr('aria-label', gt('Remove account'))
                        .append('<i class="fa fa-trash">')
                )
            );
        },
        onAdd: function () {
            zoom.startOAuthHandshake();
        },
        onRemove: function () {
            zoom.removeAccount().then(this.renderMissingAccount.bind(this));
        }
    });
});
