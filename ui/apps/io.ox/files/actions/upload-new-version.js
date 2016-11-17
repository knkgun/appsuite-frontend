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
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */

define('io.ox/files/actions/upload-new-version', [
    'io.ox/files/api',
    'io.ox/core/folder/api',
    'io.ox/core/tk/dialogs',
    'io.ox/core/tk/attachments',
    'gettext!io.ox/files'
], function (FilesAPI, folderApi, Dialogs, Attachments, gt) {

    'use strict';

    return function (data) {

        /**
         * notifications lazy load
         */
        function notify() {
            var self = this, args = arguments;
            require(['io.ox/core/yell'], function (yell) {
                yell.apply(self, args);
            });
        }

        /**
         * Process the upload of the new version.
         *
         * @param { File } file
         *  The file object to upload.
         * @param { String } [comment = '']
         *  The version comment (optional).
         * @return { jQuery.Promise }
         *  The upload result promise.
         */
        function process(file, comment) {
            if (!file) { return $.Deferred().reject(); }

            var obj = {
                file: file,
                id: data.id,
                folder: data.folder_id
            };

            if (folderApi.pool.getModel(data.folder_id).supports('extended_metadata')) {
                obj.version_comment = comment || '';
            }
            return FilesAPI.versions.upload(obj)
            .fail(notify);
        }

        var $input = Attachments.fileUploadWidget({
                multi: false,
                buttontext: gt('Select file')
            }),
            filename = $('<div class="form-group">').css('font-size', '14px').hide();

        new Dialogs.ModalDialog({ async: true })
            .header(
                $('<h4>').text(gt('Upload new version'))
            )
            .append(
                $input.on('change', function () {
                    if ($input.find('input[type="file"]')[0].files.length === 0) {
                        filename.text('').hide();
                    } else {
                        filename.text($input.find('input[type="file"]')[0].files[0].name).show();
                    }
                }),
                filename,
                folderApi.pool.getModel(data.folder_id).supports('extended_metadata') ? $('<textarea rows="6" class="form-control">') : ''
            )
            .addPrimaryButton('upload', gt('Upload'), 'upload', { 'tabIndex': '1' })
            .addButton('cancel', gt('Cancel'), 'cancel', { 'tabIndex': '1' })
            .on('upload', function () {
                var $node = this.getContentNode(),
                    files = $node.find('input[type="file"]')[0].files,
                    comment = (folderApi.pool.getModel(data.folder_id).supports('extended_metadata') ? $node.find('textarea').val() : '');

                process(_.first(files), comment).then(this.close, this.idle)
                .fail(function () {
                    if (files.length === 0) {
                        notify('info', gt('You have to select a file to upload.'));
                    }
                    _.defer(function () { $node.focus(); });
                });
            })
            .show(function () {
                // focus the file upload widget
                this.find('.btn-file').focus();
            });

    };
});
