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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/boot/locale', ['gettext', 'io.ox/core/boot/util', 'io.ox/core/locale/meta'], function (gettext, util, meta) {

    'use strict';

    var selectedLocale;

    var exports = {

        change: function (locale) {
            // if the user sets a language on the login page, it will be used for the rest of the session, too
            var language = meta.deriveSupportedLanguageFromLocale(locale);
            gettext.setLanguage(language).done(function () {
                $('html').attr('lang', language.split('_')[0]);
                gettext.enable();
                // get all nodes
                $('[data-i18n]').each(function () {
                    var node = $(this),
                        val = util.gt(node.attr('data-i18n')),
                        target = (node.attr('data-i18n-attr') || 'text').split(',');
                    _.each(target, function (el) {
                        switch (el) {
                            case 'value':
                                node.val(val);
                                break;
                            case 'text':
                                node.text(val);
                                break;
                            case 'label':
                                node.contents().get(-1).nodeValue = val;
                                break;
                            default:
                                node.attr(el, val);
                                break;
                        }
                    });
                });
                ox.locale = locale;
                ox.language = language;
                _.setCookie('locale', locale);
                ox.trigger('language', language, util.gt);
            });
        },

        getCurrentLocale: function () {
            return selectedLocale || ox.locale || 'en_US';
        },

        getSelectedLocale: function () {
            return selectedLocale;
        },

        setDefaultLocale: function () {
            return this.change(meta.getValidDefaultLocale());
        },

        changeByUser: function (id) {
            if (!id) return;
            this.change(id);
            selectedLocale = id;
        },

        render: function () {

            var locales = meta.getSupportedLocales(),
                node = $('#io-ox-languages'),
                count = _.size(locales),
                maxCount = 100,
                languageToTag = function (language) { return language.replace(/_/, '-'); };

            // show languages if more than one
            if (count > 1) {

                util.debug('Render locales', locales);

                var changeByUser = this.changeByUser.bind(this),
                    defaultLocale = meta.getValidDefaultLocale(),
                    toggle, list, label;

                // Display native select box for locales if there are up to 'maxLang' locales
                if (count < maxCount && !_.url.hash('language-select') && _.device('!smartphone')) {

                    node.append(
                        label = $('<a href="#" role="button" class="lang-label" id="io-ox-languages-label" data-i18n="Language" data-i18n-attr="text" aria-hidden="true" tabindex="-1">'),
                        $('<div class="dropdown">').append(
                            toggle = $('<a href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">').append(
                                $('<span class="sr-only" data-i18n="Language:" data-i18n-attr="text">'),
                                $('<span class="toggle-text">').attr('lang', languageToTag(defaultLocale)).text(meta.getLocaleName(defaultLocale)),
                                $('<span class="caret">')
                            ),
                            list = $('<ul id="io-ox-language-list" class="dropdown-menu" role="menu" data-i18n="Languages" data-i18n-attr="aria-label">')
                        )
                    );

                    list.append(
                        _(locales).map(function (locale) {
                            return $('<li role="presentation">').append(
                                $('<a href="#" role="menuitem">').attr({
                                    'lang': languageToTag(locale.id),
                                    'data-value': locale.id
                                })
                                .text(locale.name)
                            );
                        })
                    );

                    list.on('click', 'a', function (e) {
                        var node = $(e.currentTarget), value = node.attr('data-value');
                        e.preventDefault();
                        changeByUser(value);
                        $(e.delegateTarget).parent().find('.toggle-text').text(meta.getLocaleName(value)).attr('lang', languageToTag(value));
                    });

                    label.on('click', function (e) { e.preventDefault(); toggle.focus(); });

                    // init dropdown
                    toggle.dropdown();
                } else {
                    var updateWidth = function () {
                        $('#language-spacer').text($('#language-select')[0].selectedOptions[0].text);
                        var width = ($('#language-spacer').width() + 24) + 'px';
                        $('#language-select').css('width', width);
                    };

                    node.append(
                        $('<label for="language-select" class="lang-label" data-i18n="Languages" data-i18n-attr="text">'),
                        $('<div style="display: inline-block; position: relative;">').append(
                            $('<select id="language-select">')
                                .on('change', function () {
                                    exports.changeByUser($(this).val());
                                    updateWidth();
                                })
                                .append(
                                    _(locales).map(function (locale) {
                                        return $('<option>').attr({
                                            'lang': languageToTag(locale.id),
                                            'data-value': locale.id,
                                            'value': locale.id
                                        }).text(locale.name);
                                    })
                                )
                                .val(defaultLocale),
                            $('<div style="position: absolute; top: 0; left: 0; pointer-events: none;">').append(
                                $('<span id="language-spacer" style="visibility: hidden; white-space: nowrap;">'),
                                $('<span class="caret" style="margin-left: 8px">')
                            )
                        )
                    );
                    updateWidth();
                }
            } else {
                node.remove();
            }
        }
    };

    return exports;

});
