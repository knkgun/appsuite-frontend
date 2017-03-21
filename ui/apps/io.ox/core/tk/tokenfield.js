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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/core/tk/tokenfield', [
    'io.ox/core/extensions',
    'io.ox/core/tk/typeahead',
    'io.ox/participants/model',
    'io.ox/participants/views',
    'io.ox/contacts/api',
    'io.ox/core/http',
    'io.ox/core/util',
    'gettext!io.ox/core',
    'static/3rd.party/bootstrap-tokenfield/js/bootstrap-tokenfield.js',
    'css!3rd.party/bootstrap-tokenfield/css/bootstrap-tokenfield.css',
    'less!io.ox/core/tk/tokenfield',
    'static/3rd.party/jquery-ui.min.js'
], function (ext, Typeahead, pModel, pViews, contactAPI, http, util, gt) {

    'use strict';

    // http://sliptree.github.io/bootstrap-tokenfield/

    $.fn.tokenfield.Constructor.prototype.getTokensList = function (delimiter, beautify, active) {
        delimiter = delimiter || this._firstDelimiter;
        beautify = (typeof beautify !== 'undefined' && beautify !== null) ? beautify : this.options.beautify;

        var separator = delimiter + (beautify && delimiter !== ' ' ? ' ' : ''), self = this;
        return $.map(this.getTokens(active), function (token) {
            if (token.model) {
                var displayname = token.model.getDisplayName({ isMail: self.options.isMail }),
                    email = token.model.getEmail ? token.model.getEmail() : undefined;
                // make sure the displayname contains no outer quotes
                return displayname === email ? email : '"' + util.removeQuotes(displayname) + '" <' + email + '>';
            }
            return token.value;
        }).join(separator);
    };

    $.fn.tokenfield.Constructor.prototype.setTokens = function (tokens, add, triggerChange) {
        if (!tokens) return;

        if (!add) this.$wrapper.find('.token').remove();

        if (typeof triggerChange === 'undefined') {
            triggerChange = true;
        }

        if (typeof tokens === 'string') {
            if (this._delimiters.length) {
                // Split at delimiter; ignore delimiters in quotes
                // delimiters are: comma, semi-colon, tab, newline
                tokens = util.getAddresses(tokens);
            } else {
                tokens = [tokens];
            }
        }

        var _self = this;
        $.each(tokens, function (i, attrs) {
            _self.createToken(attrs, triggerChange);
        });

        return this.$element.get(0);
    };

    var Tokenfield = Typeahead.extend({

        className: 'test',

        events: {
            'dispose': 'dispose'
        },

        initialize: function (options) {
            var self = this;

            options = _.extend({}, {
                // defines tokendata
                harmonize: function (data) {
                    return _(data).map(function (m) {
                        var model = new pModel.Participant(m);
                        return {
                            value: model.getTarget({ fallback: true }),
                            // fallback when firstname and lastname are empty strings
                            label: model.getDisplayName({ isMail: options.isMail }).trim() || model.getEmail(),
                            model: model
                        };
                    });
                },
                // autoselect also when enter was hit before dropdown was drawn
                delayedautoselect: false,
                // tokenfield default
                allowEditing: true,
                createTokensOnBlur: true,
                // dnd sort
                dnd: true,
                // no html by default
                html: false,
                // dont't call init function in typeahead view
                init: false,
                // activate to prevent creation of an participant model in tokenfield:create handler
                customDefaultModel: false,
                extPoint: 'io.ox/core/tk/tokenfield',
                leftAligned: false
            }, options);

            /*
             * extension point for a token
             */
            ext.point(options.extPoint + '/token').extend({
                id: 'token',
                index: 100,
                draw: function (model) {
                    // add contact picture
                    $(this).prepend(
                        contactAPI.pictureHalo(
                            $('<div class="contact-image" aria-hidden="true">'),
                            model.toJSON(),
                            { width: 16, height: 16, scaleType: 'contain' }
                        )
                    );
                }
            });

            ext.point(options.extPoint + '/autoCompleteItem').extend({
                id: 'view',
                index: 100,
                draw: function (data) {
                    var pview = new pViews.ParticipantEntryView({
                        model: data.model,
                        closeButton: false,
                        halo: false,
                        isMail: options.isMail
                    });
                    this.append(pview.render().$el);
                }
            });

            ext.point(options.extPoint + '/tokenfield/customize').invoke('customize', this, options);

            // call super constructor
            Typeahead.prototype.initialize.call(this, options);
            var Participants = Backbone.Collection.extend({
                model: pModel.Participant
            });

            // initialize collection
            this.collection = options.collection || new Participants();

            // update comparator function
            this.collection.comparator = function (model) {
                return model.index || null;
            };

            // lock for redraw action
            this.redrawLock = false;

            // 100 to be not perceivable for the user (see bugs 49951, 50412)
            this.listenTo(this.collection, 'reset change:display_name', _.throttle(self.redrawTokens.bind(self), 100));
        },

        dispose: function () {
            // clean up tokenfield
            this.$el.tokenfield('destroy');
            this.stopListening();
            this.collection = null;
            this.api = null;
        },

        register: function () {
            var self = this;
            // register custom event when token is clicked
            this.$el.tokenfield().parent().delegate('.token', 'click mousedown', function (e) {
                // create new event set attrs property like it's used in the non-custom events
                var evt = $.extend(true, {}, e, {
                    type: 'tokenfield:clickedtoken',
                    attrs:  $(e.currentTarget).data().attrs,
                    originalEvent: e
                });
                self.$el.tokenfield().trigger(evt);
            });

            // delayed autoselect
            if (this.options.delayedautoselect) {
                // use hash to 'connect' enter click and query string
                self.autoselect = {};
                self.model.on('change:query', function (model, query) {
                    // trigger delayed enter click after dropdown was drawn
                    if (self.autoselect[query]) {
                        // trigger enter key press event
                        self.input.trigger(
                            $.Event('keydown', { keyCode: 13, which: 13 })
                        );
                        // remove from hash
                        delete self.autoselect[query];
                    }

                });
            }

            // aria live: reset message
            var tokenfield = this.$el.parent();
            tokenfield.find('.token-input').on('typeahead:close typeahead:closed', function () {
                self.$el.trigger('aria-live-update', '');
            });
            // aria live: set message
            this.on('typeahead-custom:dropdown-rendered', function (dropdown) {
                var numberOfResults = dropdown.find('.tt-suggestions').children().length,
                    message;

                if (numberOfResults === 0) message = gt('No autocomplete entries found');
                if (!message) {
                    message = gt.format(
                        //#. %1$d is the number of search results in the autocomplete field
                        //#, c-format
                        gt.ngettext('One autocomplete entry found', '%1$d autocomplete entries found', numberOfResults),
                        gt.noI18n(numberOfResults)
                    );
                }

                self.$el.trigger('aria-live-update', message);
            });

            this.$el.tokenfield().on({
                'tokenfield:createtoken': function (e) {
                    if (self.redrawLock) return;
                    // prevent creation of default model
                    if (self.options.customDefaultModel && !e.attrs.model) {
                        e.preventDefault();
                        return false;
                    }

                    // edit
                    var inputData = self.getInput().data(),
                        newAttrs;
                    if (inputData.edit === true) {
                        // edit mode
                        newAttrs = /^"(.*?)"\s*(<\s*(.*?)\s*>)?$/.exec(e.attrs.value);
                        if (_.isArray(newAttrs)) {
                            // this is a mail address
                            e.attrs.label = util.removeQuotes(newAttrs[1]);
                        } else {
                            newAttrs = ['', e.attrs.value, '', e.attrs.value];
                        }
                        /**
                         * TODO: review
                         * model values aren't updated so consumers
                         * have to use lable/value not the model
                         * wouldn't it be more robust we create a new model instead
                         */
                        // save new token data to model
                        e.attrs.model = inputData.editModel.set('token', {
                            label: newAttrs[1],
                            value: newAttrs[3]
                        });
                        // save cid to token value
                        e.attrs.value = e.attrs.model.cid;
                        // stop edit mode (see bug 47182)
                        inputData.edit = false;
                        return;
                    }

                    // create model for unknown participants
                    if (!e.attrs.model) {
                        newAttrs = /^"(.*?)"\s*(<\s*(.*?)\s*>)?$/.exec(e.attrs.value);
                        if (_.isArray(newAttrs)) {
                            // this is a mail address
                            e.attrs.label = util.removeQuotes(newAttrs[1]);
                            e.attrs.value = newAttrs[3];
                        } else {
                            newAttrs = ['', e.attrs.value, '', e.attrs.value];
                        }
                        // add external participant
                        e.attrs.model = new pModel.Participant({
                            type: 5,
                            display_name: newAttrs[1],
                            email1: newAttrs[3]
                        });
                    }

                    // distribution lists
                    if (e.attrs.model.has('distribution_list')) {
                        // create a model/token for every member with an email address
                        // bundle and delay the pModel fetch calls
                        http.pause();

                        var models = _.chain(e.attrs.model.get('distribution_list'))
                            .filter(function (m) { return !!m.mail; })
                            .map(function (m) {
                                m.type = 5;
                                var model = new pModel.Participant({
                                    type: 5,
                                    display_name: m.display_name,
                                    email1: m.mail
                                });
                                return model.set('token', {
                                    label: m.display_name,
                                    value: m.mail
                                }, { silent: true });
                            })
                            .value();

                        var name = e.attrs.model.get('display_name'),
                            members  = _(models).map(function (m) { return [m.get('token').label + ', ' + m.get('token').value]; });

                        self.$el.trigger('aria-live-update',
                            members.length === 1 ?
                                gt('Added distribution list %s with %s member. The only member of the distribution list is %s.', name, members.length, members.join(', ')) :
                                gt('Added distribution list %s with %s members. Members of the distribution list are %s.', name, members.length, members.join(', '))
                        );

                        self.collection.add(models);
                        self.redrawTokens();
                        // clean input
                        self.input.data('ttTypeahead').input.$input.val('');

                        http.resume();
                        return false;
                    }

                    // create token data
                    e.attrs.model.set('token', {
                        label: e.attrs.label,
                        value: e.attrs.value
                    }, { silent: true });
                    e.attrs.value = e.attrs.model.cid;
                    //#. %1$s is the display name of an added user or mail recipient
                    //#. %2$s is the email address of the user or mail recipient
                    self.$el.trigger('aria-live-update', gt('Added %1$s, %2$s.', e.attrs.model.get('display_name'), e.attrs.model.value));
                    // add model to the collection and save cid to the token
                    self.collection.add(e.attrs.model);
                },
                'tokenfield:createdtoken': function (e) {
                    if (e.attrs) {
                        var model = e.attrs.model || self.getModelByCID(e.attrs.value),
                            node = $(e.relatedTarget),
                            label = node.find('.token-label');
                        // remove wrongly calculated max-width
                        if (label.css('max-width') === '0px') label.css('max-width', 'none');

                        if (_.device('smartphone') && label.css('max-width') !== 'none') {
                            // subtract size of right-aligned control (mail compose).
                            label.css('max-width', label.width() - 16 + 'px');
                        }
                        // a11y: set title
                        node.attr('title', function () {
                            var token = model.get('token'),
                                title = token.label;
                            if (token.label !== token.value) {
                                title = token.label ? token.label + ' <' + token.value + '>' : token.value;
                            }
                            return title;
                        });
                        // customize token
                        ext.point(self.options.extPoint + '/token').invoke('draw', e.relatedTarget, model, e);
                    }
                },
                'tokenfield:edittoken': function (e) {
                    if (e.attrs && e.attrs.model) {
                        var token = e.attrs.model.get('token');
                        // save cid to input
                        self.getInput().data('editModel', e.attrs.model);
                        // build edit string
                        e.attrs.value = token.label;
                        if (token.value !== token.label) {
                            // token.label might have quotes, so we need to clean up again
                            e.attrs.value = token.label ? '"' + util.removeQuotes(token.label) + '" <' + token.value + '>' : token.value;
                        }
                        self.getInput().one('blur', function () {
                            // see if there is a token with the cid
                            var tokens = self.$el.parent().find('.token'),
                                cid = self.getInput().data().editModel.cid,
                                found = false;
                            for (var i = 0; i < tokens.length; i++) {
                                if ($(tokens[i]).data('attrs').value === cid) {
                                    found = true;
                                    return;
                                }
                            }
                            // user tries to remove token by clearing the token in editmode
                            // token was removed but it's still in the collection, so we need to remove it correctly
                            if (!found) {
                                self.collection.remove(self.getModelByCID(cid));
                            }
                        });
                    }
                },
                'tokenfield:removetoken': function (e) {
                    _([].concat(e.attrs)).each(function (el) {
                        var model = self.getModelByCID(el.value);
                        if (!model) return;
                        //#. %1$s is the display name of a removed user or mail recipient
                        //#. %2$s is the email address of the user or mail recipient
                        self.$el.trigger('aria-live-update', gt('Removed %1$s, %2$s.', model.get('display_name'), model.value));
                        self.collection.remove(model);
                    });
                }
            });
        },

        render: function () {

            var o = this.options, self = this;

            this.$el
                .addClass('tokenfield')
                .tokenfield({
                    createTokensOnBlur: o.createTokensOnBlur,
                    minLength: o.minLength,
                    allowEditing: o.allowEditing,
                    typeahead: self.typeaheadOptions,
                    html: this.options.html || false,
                    inputType: this.options.inputtype || 'email',
                    isMail: o.isMail
                });

            this.register();

            // save original typeahead input
            this.input = $(this.$el).data('bs.tokenfield').$input;
            // call typehead render
            Typeahead.prototype.render.call({
                $el: this.input,
                model: this.model,
                options: this.options
            });

            // add non-public api;
            this.hiddenapi = this.input.data('ttTypeahead');

            // calculate postion for typeahead dropdown (tt-dropdown-menu)
            if (_.device('smartphone') || o.leftAligned) {
                // non-public api of typeahead
                this.hiddenapi.dropdown._show = function () {
                    var width = 'auto', left = 0;
                    if (_.device('smartphone')) {
                        left = self.input.offset().left * -1;
                        width = window.innerWidth;
                    } else if (o.leftAligned) {
                        left = self.input.position().left;
                        left = Math.round(left) * -1 + 17;
                    }
                    this.$menu.css({ left: left, width: width }).show();
                };
            }

            // custom callback function
            this.hiddenapi.input._callbacks.enterKeyed.sync[0] = function onEnterKeyed(type, $e) {
                var cursorDatum = this.dropdown.getDatumForCursor(),
                    topSuggestionDatum = this.dropdown.getDatumForTopSuggestion(),
                    hint = this.input.getHint();

                // if the hint is not empty the user is just hovering over the cursorDatum and has not really selected it. Use topSuggestion (the hint value) instead.See Bug 48542
                if (cursorDatum && _.isEmpty(hint)) {
                    this._select(cursorDatum);
                    $e.preventDefault();
                } else if (this.autoselect && topSuggestionDatum) {
                    this._select(topSuggestionDatum);
                    $e.preventDefault();
                }
            }.bind(this.hiddenapi);

            // workaround: register handler for delayed autoselect
            if (this.options.delayedautoselect) {
                this.input.on('keydown', function (e) {
                    var enter = e.which === 13,
                        validquery = !!self.input.val() && self.input.val().length >= o.minLength,
                        runningrequest = self.model.get('query') !== self.input.val();
                    // clear dropdown when query changes
                    if (runningrequest && !enter) {
                        self.hiddenapi.dropdown.empty();
                        self.hiddenapi.dropdown.close();
                    }
                    // flag query string when enter was hit before drowdown was drawn
                    if (enter && validquery && runningrequest) {
                        self.autoselect[self.input.val()] = true;
                    }
                });
            }

            this.$el.parent().addClass(this.options.className);

            // init drag 'n' drop sort
            if (this.options.dnd) {
                this.$el.closest('div.tokenfield').sortable({
                    items: '> .token',
                    connectWith: 'div.tokenfield',
                    cancel: 'a.close',
                    placeholder: 'token placeholder',
                    revert: 0,
                    forcePlaceholderSize: true,
                    // update: _.bind(this.resort, this),
                    stop: function () {
                        self.resort();
                    },
                    receive: function (e, ui) {
                        var tokenData = ui.item.data();
                        self.collection.add(tokenData.attrs.model);
                        self.resort();
                    },
                    remove: function (e, ui) {
                        var tokenData = ui.item.data();
                        self.collection.remove(tokenData.attrs.model);
                        self.resort();
                    }
                }).droppable({
                    hoverClass: 'drophover'
                });
            }

            this.$el.closest('div.tokenfield').on('copy', function (e) {
                // value might contain more than one id so split
                var values = e.target.value.split(', ');

                // copy actual email adress instead of model cid to clipboard
                var result = '';
                _(values).each(function (value) {
                    var model = self.collection.get(value);
                    if (model) {
                        result = result + (result === '' ? '' : ', ') + model.value;
                    }
                });

                if (result !== '') {
                    e.originalEvent.clipboardData.setData('text/plain', result);
                    e.preventDefault();
                }
            }).on('keydown', function (e) {
                //Remove on cut
                if ((e.ctrlKey || e.metaKey) && e.which === 88) {
                    $(this).find('.token.active').each(function () {
                        self.collection.remove($(this).data().attrs.model);
                    });
                    self.redrawTokens();
                }
            });

            return this;
        },

        getModelByCID: function (cid) {
            return this.collection.get({ cid: cid });
        },

        redrawTokens: function () {
            var tokens = [], self = this;
            this.redrawLock = true;
            this.collection.each(function (model) {
                tokens.push({
                    label: model.getDisplayName({ isMail: self.options.isMail }),
                    value: model.cid,
                    model: model
                });
            });
            this.$el.tokenfield('setTokens', tokens, false);
            this.redrawLock = false;
        },

        resort: function () {
            var col = this.collection;
            _(this.$el.tokenfield('getTokens')).each(function (token, index) {
                col.get({ cid: token.value }).index = index;
            });
            col.sort();
            this.redrawTokens();
        },

        getInput: function () {
            return this.input;
        },

        setFocus: function () {
            var tokenfield = this.$el.parent();
            tokenfield.find('.token-input').focus();
        }
    });

    return Tokenfield;
});
