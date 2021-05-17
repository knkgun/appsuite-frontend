/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2021 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/contacts/enterprisepicker/dialog', [
    'io.ox/backbone/views/modal',
    'io.ox/backbone/mini-views/common',
    'io.ox/backbone/views/disposable',
    'io.ox/contacts/api',
    'io.ox/contacts/util',
    'gettext!io.ox/contacts',
    'less!io.ox/contacts/enterprisepicker/style'
], function (ModalDialog, Mini, DisposableView, api, util, gt) {

    'use strict';

    var mockData = {};

    var ContactListView = DisposableView.extend({

        tagName: 'ul',
        className: 'contact-list-view list-unstyled',

        events: {
            'click li': 'updateSelection'
        },

        initialize: function () {
            this.model.get('contacts').on('add reset remove', this.render.bind(this));
        },

        dispose: function () {
            this.model.get('contacts').off('add reset remove');
        },

        renderContact: function (contact) {
            var node = $('<li>').attr('data-id', contact.get('id')).append(
                $('<input type="checkbox">').attr('checked', this.model.get('selectedContacts').indexOf(contact.get('id')) > -1),
                $('<div class="contact-picture" aria-hidden="true">').css('background-image', 'url(' + util.getImage(contact.attributes) + ')'),
                $('<div class="contact-container">').append(
                    $('<div class="name" aria-hidden="true">').text(util.getFullName(contact.attributes, false)),
                    $('<div class="department" aria-hidden="true">').text(contact.get('department'))
                ),
                $('<div class="contact-container">').append(
                    $('<div class="telephone" aria-hidden="true">').text(
                        // try to find a phone number, there are still more phone number fields. Not sure if we need all
                        contact.get('telephone_business1') ||
                        contact.get('telephone_business2') ||
                        contact.get('telephone_company') ||
                        contact.get('cellular_telephone1') ||
                        contact.get('cellular_telephone2') ||
                        contact.get('telephone_home1') ||
                        contact.get('telephone_home2') ||
                        contact.get('telephone_other')),
                    $('<div class="position" aria-hidden="true">').text(contact.get('position'))
                ),
                $('<div class="contact-container">').append(
                    $('<div class="mail" aria-hidden="true">').text(util.getMail(contact.attributes)),
                    $('<div class="room" aria-hidden="true">').text(contact.get('room_number'))
                )
            );
            this.$el.append(node);
        },

        render: function () {
            this.$el.empty();
            var contacts = this.model.get('contacts');
            if (contacts.length === 0) {
                contacts = this.model.get('lastContacts');
                if (contacts.length === 0) return this;
                //#. This is followed by a list of contacts from the address book
                this.$el.append($('<div class="last-searched-label">').text(gt('Last searched for')));
            }
            contacts.each(this.renderContact.bind(this));
            return this;
        },

        updateSelection: function (e) {
            e.stopPropagation();
            var target = e.currentTarget,
                id = target.getAttribute('data-id'),
                isSelected = this.model.get('selectedContacts').indexOf(id) > -1;

            if (isSelected) {
                this.model.set('selectedContacts', _(this.model.get('selectedContacts')).without(id));
            } else {
                this.model.get('selectedContacts').push(id);
            }

            $(e.currentTarget).find('input').attr('checked', !isSelected);
        }
    });

    var open = function (callback) {
        // use our gab to generate mock data for now
        return api.getAll({ columns: '20,1,101,500,501,502,505,519,520,521,522,524,543,555,556,557,569,602,606,607,616,617,5,2' }, false).then(function (data) {

            mockData = _(data).groupBy('department');
            var lists = _(_(mockData).keys().sort()).map(function (department) {
                // later on this is folder name and id, but since this is mock data...
                return { label: department, value: department };
            });

            lists.unshift({ label: gt('Choose address list'), value: 'no-list-selected' });

            var model = new Backbone.Model({
                searchQuery: '',
                filterQuery: '',
                selectedList: 'no-list-selected',
                selectedContacts: [],
                contacts: new Backbone.Collection(),
                lastContacts: new Backbone.Collection(_(data).sample(3)),
                addressLists: lists
            });

            model.on('change:selectedList', function (model, selectedList) {
                model.get('contacts').reset(mockData[selectedList] || []);
            });

            return new ModalDialog({
                point: 'io.ox/contacts/enterprisepicker-dialog',
                help: 'ox.appsuite.user.sect.email.send.enterpriserpicker.html',
                title: gt('Global address list')
            })
            .extend({
                addClass: function () {
                    this.$el.addClass('enterprise-picker');
                },
                header: function () {
                    var listSelectBox = new Mini.SelectView({ name: 'selectedList', model: model, list: model.get('addressLists') }).render().$el;

                    model.on('change:filterQuery', function () {
                        var query = model.get('filterQuery').trim().toLowerCase(),
                            options = listSelectBox.find('option');
                        if (!query) return options.show();

                        _(listSelectBox.find('option')).each(function (option) {
                            // never hide the placeholder option
                            if ($(option).val() === 'no-list-selected') return;
                            $(option).toggle(option.text.toLowerCase().indexOf(query) !== -1);
                        });
                    });

                    this.$('.modal-header').append(
                        $('<div class="top-bar">').append(
                            $('<label>').text(gt('Search')).append(
                                $('<div class="input-group">').append(
                                    new Mini.InputView({ name: 'searchQuery', model: model }).render().$el
                                        .attr('placeholder', gt('Search for name, department, position')),
                                    $('<span class="input-group-btn">').append(
                                        $('<button type="button" class="search-button btn btn-default">')
                                            //#. used as a verb
                                            .attr({ title: gt('Search') })
                                            .append($.icon('fa-search'))
                                    )
                                )
                            ),
                            $('<label>').text(gt('Filter')).append(
                                $('<div class="input-group">').append(
                                    new Mini.InputView({ name: 'filterQuery', model: model }).render().$el
                                        .attr('placeholder', gt('Filter address lists')),
                                    $('<span class="input-group-btn">').append(
                                        $('<button type="button" class="filter-button btn btn-default">')
                                            .attr({ title: gt('Filter address lists') })
                                            .append($.icon('fa-filter'))
                                    )
                                )
                            ),
                            $('<label>').text(gt('Address list')).append(
                                listSelectBox
                            )
                        )
                    );
                },
                body: function () {
                    this.$('.modal-body').append(new ContactListView({ model: model }).render().$el);
                }
            })
            .on({
                'select': function () {
                    var selection = [];
                    if (_.isFunction(callback)) callback(selection);
                }
            })
            .addCancelButton()
            //#. Context: Add selected contacts; German "Auswählen", for example
            .addButton({ label: gt('Select'), action: 'select' })
            .open();
        });
    };

    // use same names as default addressbook picker, to make it easier to switch between the two
    return {
        open: open
    };

});
