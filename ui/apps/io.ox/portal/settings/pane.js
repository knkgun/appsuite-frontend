/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Markus Bode <markus.bode@open-xchange.com>
 */
define('io.ox/portal/settings/pane',
      ['io.ox/core/extensions',
       'io.ox/settings/utils',
       'io.ox/portal/settings/plugin/model',
       'io.ox/core/tk/dialogs',
       'settings!io.ox/portal',
       'text!io.ox/portal/settings/tpl/listbox.html',
       'text!io.ox/portal/settings/tpl/plugin.html',
       'gettext!io.ox/portal/settings',
       'apps/io.ox/core/jqueryui/jquery-ui-1.8.23.interactions.min.js'], function (ext, utils, PluginModel, dialogs, settings, tmplListBox, tmplPlugin, gt) {

    'use strict';

    var staticStrings =  {
        ACTIVATE_PLUGIN: gt('Activate Plugin'),
        PLUGIN_SETTINGS: gt('Properties'),
        SAVE:            gt('Save'),
        PORTAL:          gt('Portal'),
        PORTAL_PLUGINS:  gt('Portal Plugins'),
        PROPERTIES:      gt('Properties')
    };

    var plugins = [];

    var pluginSettings = settings.get('pluginSettings') || {};

    _.each(ext.getPlugins({ prefix: 'plugins/portal/', name: 'portal', nameOnly: true }), function (pluginName) {
        var index = 9999;
        var isActive = false;
        if (pluginSettings[pluginName]) {
            if (!pluginSettings[pluginName].index) {
                pluginSettings[pluginName].index = 9999;
            }

            if (!pluginSettings[pluginName].id) {
                pluginSettings[pluginName].id = pluginName;
            }

            if (!pluginSettings[pluginName].isActive) {
                pluginSettings[pluginName].isActive = false;
            }

            index = pluginSettings[pluginName].index;
            isActive = pluginSettings[pluginName].active;
        }
        var plugin = {id: pluginName, name: gt(pluginName), active: isActive, index: index};
        plugins.push(plugin);
    });

    plugins.sort(function (a, b) {
        return a.index - b.index;
    });

    var collection,
        changePluginState = function (id, state) {
            pluginSettings[id].active = state;

            settings.set('pluginSettings', pluginSettings);
            settings.save();

            var plugins = ext.getPlugins({ prefix: 'plugins/portal/', name: 'portal' });
            var activePlugins = _.filter(pluginSettings || {}, function (obj) { return obj.active; });
            var allActivePlugins = _.map(activePlugins, function (obj) {
                return 'plugins/portal/' + obj.id + '/register';
            });

            plugins = _.intersection(plugins, allActivePlugins);

            // Load all active plugins
            require(plugins).pipe(function () {
                // Enable or Disable all plugins
                var extensions = ext.point('io.ox/portal/widget').all();
                _.chain(extensions).each(function (extension) {
                        var eid = extension.id;

                        var isActive = _.find(activePlugins, function (plugin) {
                            var pluginLength = plugin.id.length;
                            return (eid.length >= pluginLength && eid.substring(0, pluginLength) === plugin.id);
                        });

                        if (!isActive) {
                            ext.point("io.ox/portal/widget").disable(eid);
                        } else {
                            ext.point("io.ox/portal/widget").enable(eid);
                        }
                    }
                );

                ox.trigger("refresh^");
            });
        },
        PluginSelectView = Backbone.View.extend({
            _modelBinder: undefined,
            initialize: function (options) {
                this.template = doT.template(tmplPlugin);
                this._modelBinder = new Backbone.ModelBinder();
            },
            renderState: function () {
                var star = this.$el.find('#state');
                if (star) {
                    if (this.model.get('active')) {
                        star.attr('class', 'icon-star');
                    } else {
                        star.attr('class', 'icon-star-empty');
                    }
                }
            },
            render: function () {
                var self = this;

                self.$el.empty().append(self.template({
                    id: this.model.get('id')
                }));

                this.renderState();

                // Used by jquery ui sortable
                self.$el.attr('id', this.model.get('id'));

                var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
                self._modelBinder.bind(self.model, self.el, defaultBindings);

                return self;
            },
            events: {
                'click .deletable-item': 'onSelect',
                'click #state': 'changeState'
            },
            changeState: function (e) {
                var active = !this.model.get('active');
                this.model.set('active', active);
                changePluginState(this.model.get('id'), active);
                this.renderState();
                e.stopPropagation();
            },
            onSelect: function () {
                this.$el.parent().find('div[selected="selected"]').attr('selected', null);
                this.$el.find('.deletable-item').attr('selected', 'selected');
            }
        }),

        PluginSettingsView = Backbone.View.extend({
            initialize: function (options) {
                this.plugin = options.plugin;
                this.deferred = new $.Deferred();
                this.strings = staticStrings;

                var that = this;
                var req = ['text!io.ox/portal/settings/tpl/pluginsettings.html'];
                var response = $.ajax({
                    url: ox.base + '/apps/plugins/portal/' + this.plugin.id + '/settings/plugin.js',
                    type: 'HEAD',
                    async: false
                }).status;

                if (response === 200) {
                    req.push('plugins/portal/' + this.plugin.id + '/settings/plugin');
                }

                require(req, function (tmplPluginSettings, pluginFeatures) {
                    that.template = doT.template(tmplPluginSettings);
                    that.pluginFeatures = pluginFeatures;
                    that.deferred.resolve();
                });
            },
            render: function () {
                var that = this;

                this.deferred.done(function () {
                    that.$el.empty().append(that.template({
                        active: that.plugin.get('active'),
                        id: that.plugin.get('id'),
                        strings: that.strings
                    }));

                    if (that.pluginFeatures) {
                        if (that.pluginFeatures.renderSettings) {
                            that.$el.append(that.pluginFeatures.renderSettings());
                        }
                    }
                });

                return that;
            },
            events: {
                'click .save': 'onSave'
            },
            onSave: function () {
                var active = this.$el.find('input#plugin-active').is(':checked');
                this.plugin.set('active', active);
                changePluginState(this.plugin.get('id'), active);
                this.dialog.close();
            }
        });

    ext.point("io.ox/portal/settings/detail").extend({
        index: 200,
        id: "portalsettings",
        draw: function (data) {
            var that = this;

            collection = new Backbone.Collection(plugins);

            var PluginsView = Backbone.View.extend({
                initialize: function () {
                    this.template = doT.template(tmplListBox);
                    _.bindAll(this);
                    this.collection = collection;
                },
                redraw: function ($listbox) {
                    if (!$listbox) {
                        $listbox = this.$el.find('.listbox');
                    }
                    $listbox.empty();

                    this.collection.each(function (item) {
                        $listbox.append(new PluginSelectView({ model: item }).render().el);
                    });
                },
                render: function () {
                    var self = this,
                        $listbox;

                    self.$el.empty().append(self.template({strings: staticStrings}));

                    $listbox = self.$el.find('.listbox');

                    this.redraw($listbox);

                    $listbox.sortable({
                        update: function (event, ui) {
                            var index = 100;

                            _.each($(this).sortable('toArray'), function (value) {
                                if (!pluginSettings[value]) {
                                    pluginSettings[value] = {};
                                }

                                pluginSettings[value].index = index;
                                index += 100;
                            });

                            settings.set('pluginSettings', pluginSettings);
                            settings.save();
                        }
                    });

                    return this;
                },
                events: {
                    'click [data-action="prop"]': 'onShowProperties'
                },
                onShowProperties: function (e) {
                    var $sel = this.$el.find('[selected]');

                    e.data = {id: $sel.data('id'), node: this.el};
                    e.target = $sel;

                    var view = new PluginSettingsView({
                        plugin: collection.get([e.data.id])
                    });

                    var d = view.dialog = new dialogs.SidePopup().show(e, function (popup) {
                        popup.append(view.render().el);
                    });

                    var self = this;
                    d.on('close', function () {
                        self.redraw();
                    });
                }
            });

            var view = new PluginsView();
            that.append(view.render().el);
        }
    });

    return {};
});