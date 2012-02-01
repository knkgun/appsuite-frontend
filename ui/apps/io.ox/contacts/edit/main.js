/**
 *
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
 *
 */

define('io.ox/contacts/edit/main',
    ['io.ox/contacts/api',
     'io.ox/core/cache',
     'io.ox/contacts/edit/view-form',
     'io.ox/contacts/model',
     'less!io.ox/contacts/style.css'
     ], function (api, cache, ContactEditView, ContactModel) {

    'use strict';

    // multi instance pattern
    function createInstance(data) {
        var app;

        app = ox.ui.createApp({
            name: 'io.ox/contacts/edit',
            title: 'Edit Contact'
        });

        app.setLauncher(function () {
            var win,
                container;

            win = ox.ui.createWindow({
                title: 'Edit Contact',
                toolbar: true,
                close: true
            });

            app.setWindow(win);

            container = win.nodes.main
                .css({ backgroundColor: '#fff' })
                .scrollable()
                .css({ maxWidth: '600px', margin: '20px auto 20px auto' });

            var cont = function (data) {
                win.show(function () {
                    var myModel = new ContactModel({data: data}),
                        myView = new ContactEditView({model: myModel});

                    $(myView).on('save', function () {
                        var consistency;
                        if (!myModel.isDirty()) {
                            return;
                        }
                        consistency = myModel.checkConsistency();
                        if (consistency !== true || consistency.constructor.toString().indexOf('ConsistencyError') !== -1) {
                            return console.error(consistency);
                        }

                        // TODO: replace image upload with a field in formsjs method
                        var image = $('#contactUploadImage').find("input[type=file]").get(0);
                        var data = null;
                        if (image.files && image.files[0]) {
                            data = myModel.getChanges();
                            data.id = myModel.getData().id;
                            data.folderId = myModel.getData().folder_id;
                            data.timestamp = _.now();
                            api.editNewImage(JSON.stringify(data), image.files[0])
                            .done(function () {
                                myModel.dirty = false;
                            });
                        } else {
                            api.edit({
                                id: myModel.getData().id,
                                folder: myModel.getData().folder_id,
                                timestamp: _.now(),
                                data: myModel.getChanges()
                            }).done(function () {
                                myModel.dirty = false;
                            });
                        }
                    });

                    window.model = myModel;
                    window.view = myView;

                    container.append(myView.draw(app).node);
                    container.find('input[type=text]:visible').eq(0).focus();
                });
            };

            if (data) {
                // hash support
                app.setState({ folder: data.folder_id, id: data.id });
                cont(data);
            } else {
                api.get(app.getState()).done(cont);
            }
        });
        return app;
    }

    return {
        getApp: createInstance
    };

});
