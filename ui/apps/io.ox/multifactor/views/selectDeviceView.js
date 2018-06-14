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
 * @author Greg Hill <greg.hill@open-xchange.com>
 */

define('io.ox/multifactor/views/selectDeviceView', [
    'io.ox/backbone/views',
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/views/modal',
    'io.ox/multifactor/factorRenderer',
    'io.ox/multifactor/deviceAuthenticator',
    'gettext!multifactor'
], function (views, ext, mini, ModalView, renderer, deviceAuthenticator, gt) {

    'use strict';

    var POINT = 'multifactor/views/selectDeviceView',
        INDEX = 0;

    var dialog;
    var def;

    function open(device, _def) {
        dialog = openModalDialog(device);
        def = _def;
        return dialog;
    }

    function openModalDialog(devices) {

        return new ModalView({
            async: true,
            point: POINT,
            title: gt('Select Multifactor Device'),
            width: 640,
            model: new Backbone.Model({ 'devices': devices })
        })
        .build(function () {
        })
        .addButton()
        .on('cancel', function () {
            def.reject();
        })
        .open();
    }

    ext.point(POINT).extend(
        {
            index: INDEX += 100,
            id: 'header',
            render: function () {
                var label = $('<label>').append(gt('Please select a device to use for additional authentication'))
                .append('<br>');
                this.$body.append(
                    label
                );
            }
        },
        {
            index: INDEX += 100,
            id: 'selection',
            render: function (baton) {
                var selection = $('<div class="multifactorSelector">')
                .append(renderer.render(baton.model.get('devices')));
                selection.find('.multifactordevice')
                .on('click', function () {
                    deviceAuthenticator.doAuth($(this).attr('data-provider'), $(this).attr('data-provider'), def);
                    dialog.close();
                });
                this.$body.append(selection);
            }
        }

    );

    return {
        open: open
    };

});
