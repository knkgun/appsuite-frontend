/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/files/settings/pane',
    ['settings!io.ox/files',
     'io.ox/files/settings/model',
     'dot!io.ox/files/settings/form.html',
     'io.ox/core/extensions',
     'gettext!io.ox/files'
    ], function (settings, filesSettingsModel, tmpl, ext, gt) {

    'use strict';

    var filesSettings =  settings.createModel(filesSettingsModel),
        staticStrings =  {
            TITLE_FILES: gt.pgettext('app', 'Drive'),
            SHOW_HIDDEN: gt('Show hidden files and folders')
        },
        filesViewSettings;

    var FilesSettingsView = Backbone.View.extend({
        tagName: 'div',
        _modelBinder: undefined,
        initialize: function () {
            // create template
            this._modelBinder = new Backbone.ModelBinder();

            this.model.on('change:showHidden', function () {
                require(['io.ox/core/api/folder'], function (folderAPI) {
                    folderAPI.clearCaches();
                    folderAPI.trigger('refresh');
                });
            });
        },
        render: function () {
            var self = this;
            self.$el.empty().append(tmpl.render('io.ox/files/settings', {
                strings: staticStrings
            }));

            var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
            self._modelBinder.bind(self.model, self.el, defaultBindings);

            return self;
        }
    });

    ext.point('io.ox/files/settings/detail').extend({
        index: 200,
        id: 'filessettings',
        draw: function () {
            filesViewSettings = new FilesSettingsView({model: filesSettings});
            var holder = $('<div>').css('max-width', '800px');
            this.append(holder.append(
                filesViewSettings.render().el)
            );
        },

        save: function () {
            filesViewSettings.model.saveAndYell();
        }
    });

});
