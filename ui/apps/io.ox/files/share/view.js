/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/files/share/view', [
    'io.ox/core/extensions',
    'io.ox/files/share/model',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/contacts/api',
    'io.ox/contacts/util',
    'io.ox/core/tk/tokenfield',
    'io.ox/core/date',
    'gettext!io.ox/files',
    'less!io.ox/files/share/style'
], function (ext, ShareModel, miniViews, Dropdown, contactsAPI, contactsUtil, Tokenfield, date, gt) {

    'use strict';

    var INDEX = 0,
        POINT = 'io.ox/files/share',
        trans = {
            invite: gt('Invite people via email. Every recipient will get an individual link to access the shared files.'),
            link: gt('Create a link to copy and paste in an email, instant messenger or social network. Please note that anyone who gets the link can access the share.')
        };

    /*
     * extension point share type
     */
    ext.point(POINT + '/fields').extend({
        id: 'type-dropdown',
        index: INDEX += 100,
        draw: function (baton) {
            var typeTranslations = {
                invite: gt('Invite people'),
                link: gt('Get a link')
            };

            var dropdown = new Dropdown({ model: baton.model, label: typeTranslations[baton.model.get('type')], caret: true })
                .option('type', 'invite', typeTranslations.invite)
                .option('type', 'link', typeTranslations.link)
                .listenTo(baton.model, 'change:type', function (model, type) {
                    this.$el.find('.dropdown-label').text(typeTranslations[type]);
                });

            this.append(
                dropdown.render().$el
            );
        }
    });

    /*
     * extension point descriptive text
     */
    ext.point(POINT + '/fields').extend({
        id: 'description',
        index: INDEX += 100,
        draw: function (baton) {
            this.append(
                baton.nodes.default.description = $('<p>').addClass('form-group description').text(trans[baton.model.get('type', 'invite')])
            );
        }
    });

    /*
     * extension point for share link
     */
    ext.point(POINT + '/fields').extend({
        id: 'link',
        index: INDEX += 100,
        draw: function (baton) {
            var link = baton.model.get('link', '');
            this.append(
                baton.nodes.link.link = $('<p>').addClass('link').append(
                    $('<a>').attr({ href: link, tabindex: 1, target: '_blank' }).text(link)
                ).hide()
            );
            baton.model.on('change:link', function (model, val) {
                baton.nodes.link.link.find('a').text(val).attr('href', val);
            });
        }
    });

    /*
     * extension point for contact picture in autocomplete dropdown
     */
    ext.point(POINT +  '/autoCompleteItem').extend({
        id: 'contactPicture',
        index: 100,
        draw: function (baton) {
            this.append(
                $('<div class="contact-image">')
                    .attr('data-original', baton.participantModel.getImageURL({ width: 42, height: 42, scaleType: 'contain' }))
                    .css('background-image', 'url(' + ox.base + '/apps/themes/default/dummypicture.png)')
            );
        }
    });

    /*
     * extension point for display name in autocomplete dropdown
     */
    ext.point(POINT +  '/autoCompleteItem').extend({
        id: 'displayName',
        index: 100,
        draw: function (baton) {
            this.append(
                $('<div class="recipient-name">').text(baton.participantModel.getDisplayName())
            );
        }
    });

    /*
     * extension point for email in autocomplete dropdown
     */
    ext.point(POINT +  '/autoCompleteItem').extend({
        id: 'emailAddress',
        index: 100,
        draw: function (baton) {
            var model = baton.participantModel;
            this.append(
                $('<div class="ellipsis email">').append(
                    $.txt(model.getTarget() + ' '),
                    model.getFieldName() !== '' ?
                        $('<span style="color: #888;">').text('(' + model.getFieldName() + ')') : model.getTypeString()
                )
            );
        }
    });

    /*
     * extension point for recipients autocomplete input field
     */
    ext.point(POINT + '/fields').extend({
        id: 'recipients-tokenfield',
        index: INDEX += 100,
        draw: function (baton) {
            var guid = _.uniqueId('form-control-label-');

            // add autocomplete
            var tokenfieldView = new Tokenfield({
                id: guid,
                apiOptions: {
                    contacts: true,
                    users: true,
                    groups: true
                },
                maxResults: 20,
                draw: function (token) {
                    baton.participantModel = token.model;
                    ext.point(POINT + '/autoCompleteItem').invoke('draw', this, baton);
                },
                lazyload: 'div.contact-image'
            });

            this.append(
                baton.nodes.invite.autocomplete = $('<div class="form-group">').append(
                    $('<label>').attr({ for: guid }).addClass('sr-only').text(gt('Add recipients ...')),
                    tokenfieldView.$el.attr({ placeholder: gt('Add recipients ...') })
                )
            );

            tokenfieldView.render();

            // bind collection to share model
            tokenfieldView.collection.on('change add remove sort', function () {
                var recipients = this.map(function (model) {
                    return model;
                });
                baton.model.set('recipients', recipients, { silent: true });
            });
        }
    });

    /*
     * extension point for message textarea
     */
    ext.point(POINT + '/fields').extend({
        id: 'message',
        index: INDEX += 100,
        draw: function (baton) {
            var guid = _.uniqueId('form-control-label-');
            this.append(
                baton.nodes.invite.message = $('<div>').addClass('form-group').append(
                    $('<label>').addClass('control-label sr-only').text(gt('Message (optional)')).attr({ for: guid }),
                    new miniViews.TextView({
                        name: 'message',
                        model: baton.model
                    }).render().$el.attr({
                        id: guid,
                        rows: 3,
                        //#. placeholder text in share dialog
                        placeholder: gt('Message (optional)')
                    })
                )
            );
        }
    });

    /*
     * extension point for share options
     */
    ext.point(POINT + '/fields').extend({
        id: 'defaultOptions',
        index: INDEX += 100,
        draw: function (baton) {
            var optionGroup = $('<div>').addClass('shareoptions').hide(),
                icon = $('<i>').addClass('fa fa-caret-right fa-fw');
            ext.point(POINT + '/options').invoke('draw', optionGroup, baton);
            this.append(
                $('<a href="#" tabindex=1>').append(
                    icon,
                    $('<span>').text(gt('Advanced options'))
                ).click(function () {
                    optionGroup.toggle();
                    icon.toggleClass('fa-caret-right fa-caret-down');
                }),
                optionGroup
            );
        }
    });

    /*
     * extension point for write permissions checkbox
     */
    ext.point(POINT + '/options').extend({
        id: 'write-permissions',
        index: INDEX += 100,
        draw: function (baton) {
            this.append(
                $('<div>').addClass('form-group').append(
                    $('<div>').addClass('checkbox').append(
                        $('<label>').addClass('control-label').text(gt('Recipients can edit')).prepend(
                            new miniViews.CheckboxView({ name: 'edit', model: baton.model }).render().$el
                        )
                    )
                )
            );
        }
    });

    /*
     * extension point for password protection
     */
    ext.point(POINT + '/options').extend({
        id: 'secured',
        index: INDEX += 100,
        draw: function (baton) {
            var guid = _.uniqueId('form-control-label-'), passInput;
            this.append(
                $('<div>').addClass('form-inline passwordgroup').append(
                    $('<div>').addClass('form-group').append(
                        $('<div>').addClass('checkbox-inline').append(
                            $('<label>').addClass('control-label').text(gt('Password required')).prepend(
                                new miniViews.CheckboxView({ name: 'secured', model: baton.model }).render().$el
                            )
                        )
                    ),
                    $.txt(' '),
                    $('<div>').addClass('form-group').append(
                        $('<label>').addClass('control-label sr-only').text(gt('Enter Password')).attr({ for: guid }),
                        passInput = new miniViews.PasswordView({ name: 'password', model: baton.model })
                            .render().$el
                            .attr({ id: guid, placeholder: gt('Enter Password') })
                            .prop('disabled', !baton.model.get('secured'))
                    )
                )
            );
            baton.model.on('change:secured', function (model, val) {
                passInput.prop('disabled', !val);
            });
        }
    });

    /*
     * extension point for expires dropdown
     */
    ext.point(POINT + '/options').extend({
        id: 'temporary',
        index: INDEX += 100,
        draw: function (baton) {

            //#. options for terminal element of a sentence starts with "Expires in"
            var typeTranslations = {
                0: gt('one day'),
                1: gt('one week'),
                2: gt('one month'),
                3: gt('three months'),
                4: gt('six months'),
                5: gt('one year')
            };

            var dropdown = new Dropdown({ model: baton.model, label: typeTranslations[baton.model.get('expires')], caret: true })
                .listenTo(baton.model, 'change:expires', function (model, expires) {
                    this.$el.find('.dropdown-label').text(typeTranslations[expires]);
                });

            _(typeTranslations).each(function (val, key) {
                dropdown.option('expires', parseInt(key, 10), val);
            });

            this.append(
                $('<div>').addClass('form-inline').append(
                    $('<div>').addClass('checkbox-inline').append(
                        $('<label>').text(gt('Expires in')).prepend(
                            new miniViews.CheckboxView({ name: 'temporary', model: baton.model }).render().$el
                        ),
                        $.txt(' '),
                        dropdown.render().$el.addClass('inline dropup')
                    )
                )
            );

            baton.model.on('change:expires', function (model) {
                model.set('temporary', true);
            });

        }
    });

    /*
     * main view
     */
    var ShareView = Backbone.View.extend({

        tagName: 'form',

        className: 'share-view',

        initialize: function (options) {
            var self = this;
            this.model = new ShareModel({ files: options.files });
            this.baton = ext.Baton({
                model: this.model,
                view: this,
                nodes: {
                    invite: {},
                    link: {},
                    default: {}
                }
            });

            this.listenTo(this.model, 'change:type', function (model, val) {
                // toggle autocomplete and message input
                _(self.baton.nodes.invite).each(function (el) {
                    el.toggle(val === 'invite');
                });
                _(self.baton.nodes.link).each(function (el) {
                    el.toggle(val === 'link');
                });

                self.baton.nodes.default.description.text(trans[val]);

                // generate link if empty
                if (val === 'link' && model.get('link') === '' ) {
                    model.save().then(function (url) {
                        model.set('link', url);
                    });
                }
            });

        },

        render: function () {

            this.$el.attr({
                role: 'form'
            });

            // draw all extensionpoints
            ext.point(POINT + '/fields').invoke('draw', this.$el, this.baton);

            return this;
        },

        share: function () {
            this.model.save();
        },

        cancel: function () {
            this.model.destroy();
        }

    });

    return ShareView;
});
