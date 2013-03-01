/**
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
 * @author Martin Holzhauer <martin.holzhauer@open-xchange.com>
 */

define('io.ox/mail/write/main',
    ['io.ox/mail/api',
     'io.ox/mail/util',
     'io.ox/core/extensions',
     'io.ox/core/config',
     'io.ox/contacts/api',
     'io.ox/contacts/util',
     'io.ox/core/api/user',
     'io.ox/core/api/account',
     'io.ox/core/tk/upload',
     'io.ox/mail/model',
     'io.ox/mail/write/view-main',
     'io.ox/core/notifications',
     'settings!io.ox/mail',
     'gettext!io.ox/mail',
     'less!io.ox/mail/style.css',
     'less!io.ox/mail/write/style.css'], function (mailAPI, mailUtil, ext, config, contactsAPI, contactsUtil, userAPI, accountAPI, upload, MailModel, WriteView, notifications, settings, gt) {

    'use strict';

    var ACTIONS = 'io.ox/mail/write/actions';

    // actions (define outside of multi-instance app)
    ext.point(ACTIONS + '/send').extend({
        action: function (baton) {
            baton.app.send();
        }
    });

    // actions (define outside of multi-instance app)
    ext.point(ACTIONS + '/draft').extend({
        action: function (baton) {
            baton.app.saveDraft();
        }
    });

    ext.point(ACTIONS + '/discard').extend({
        action: function (baton) {
            baton.app.quit();
        }
    });

    var UUID = 1;

    // multi instance pattern
    function createInstance() {

        var app, win,
            editor,
            editorHash = {},
            currentSignature = '',
            editorMode,
            messageFormat = settings.get('messageFormat', 'html'),
            composeMode,
            view,
            model,
            previous;

        if (Modernizr.touch) messageFormat = 'text'; // See Bug 24802


        function getDefaultEditorMode() {
            return messageFormat === 'text' ? 'text' : 'html';
        }

        function getEditorMode(mode) {
            return mode === 'text' ? 'text' : 'html';
        }

        function getContentType(mode) {
            if (mode === 'text') {
                return 'text/plain';
            } else {
                return messageFormat === 'html' ? 'text/html' : 'alternative';
            }
        }

        app = ox.ui.createApp({
            name: 'io.ox/mail/write',
            title: 'Compose',
            userContent: true
        });

        model = new MailModel();
        view = new WriteView({ model: model, app: app });

        view.ID = 'YEAH #' + (UUID++);

        app.getView = function () {
            return view;
        };

        window.newmailapp = function () { return app; };

        view.signatures = _(config.get('gui.mail.signatures') || []).map(function (obj) {
            obj.signature_name = _.noI18n(obj.signature_name);
            return obj;
        });

        app.setSignature = function (e) {

            var index = e.data.index,
                signature, text,
                ed = this.getEditor(),
                isHTML = !!ed.removeBySelector,
                modified = isHTML ? $('<root></root>').append(ed.getContent()).find('p.io-ox-signature').text() !== currentSignature.replace(/(\r\n|\n|\r)/gm, '') : false;

            // remove current signature from editor
            if (isHTML) {
                //only remove class if user modified content of signature paragraph block
                if (modified) {
                    ed.removeClassBySelector('.io-ox-signature', 'io-ox-signature');
                } else {
                    ed.removeBySelector('.io-ox-signature');
                }
            } else {
                if (currentSignature) {
                    ed.replaceParagraph(currentSignature, '');
                    currentSignature = '';
                }
            }

            // add signature?
            if (index < view.signatures.length) {
                signature = view.signatures[index];
                text = $.trim(signature.content);
                if (_.isString(signature.misc)) { signature.misc = JSON.parse(signature.misc); }

                if (isHTML) {
                    if (signature.misc && signature.misc.insertion === 'below') {
                        ed.appendContent('<p class="io-ox-signature">' + ed.ln2br(text) + '</p>');
                        ed.scrollTop('bottom');
                    } else {
                        ed.prependContent('<p class="io-ox-signature">' + ed.ln2br(text) + '</p>');
                        ed.scrollTop('top');
                    }
                } else {
                    if (signature.misc && signature.misc.insertion === 'below') {
                        ed.appendContent(text);
                        ed.scrollTop('bottom');
                    } else {
                        ed.prependContent(text);
                        ed.scrollTop('top');
                    }
                }
                currentSignature = text;
            }

            ed.focus();
        };

        function focus(name) {
            app.getWindowNode().find('input[name="' + name + '"], input[data-type="' + name + '"]').focus().select();
        }

        // launcher
        app.setLauncher(function () {

            win = ox.ui.createWindow({
                name: 'io.ox/mail/write',
                chromeless: true
            });

            // due to tinyMCE's iframe
            win.detachable = false;

            app.setWindow(win);
            view.render();

            // add panels to windows
            win.nodes.main
            .addClass('io-ox-mail-write')
            .append(
                view.form = $('<form>', {
                    name: 'compose',
                    method: 'post',
                    enctype: 'multipart/form-data'
                })
                .addClass('form-inline')
                .append(
                    $('<input>', { type: 'hidden', name: 'msgref', value: '' }),
                    $('<input>', { type: 'hidden', name: 'sendtype', value: mailAPI.SENDTYPE.NORMAL }),
                    $('<input>', { type: 'hidden', name: 'headers', value: '' }),
                    view.leftside,
                    view.rightside
                )
            );

            if (_.browser.IE === undefined || _.browser.IE > 9) {
                var dropZone = upload.dnd.createDropZone({'type': 'single'});
                dropZone.on('drop', function (e, file) {
                    view.form.find('input[type=file]').last()
                        .prop('file', file)
                        .trigger('change');
                    view.showSection('attachments');
                });
            }

            win.on('show', function () {
                if (app.getEditor()) {
                    app.getEditor().handleShow();
                }
                if (dropZone) {dropZone.include(); }
            });

            win.on('hide', function () {
                if (app && app.getEditor()) {
                    app.getEditor().handleHide();
                }
                if (dropZone) { dropZone.remove(); }
            });
        });

        /**
         * Setters
         */
        app.setFormat = (function () {

            function load(mode, content) {
                var editorSrc = 'io.ox/core/tk/' + (mode === 'html' ? 'html-editor' : 'text-editor');
                return require([editorSrc]).pipe(function (Editor) {
                    return (editorHash[mode] = new Editor(view.textarea))
                        .done(function () {
                            app.setEditor(editorHash[mode]);
                            app.getEditor().setPlainText(content);
                            app.getEditor().handleShow();
                        });
                });
            }

            function reuse(mode, content) {
                app.setEditor(editorHash[mode]);
                app.getEditor().setPlainText(content);
                app.getEditor().handleShow();
                return $.when();
            }

            function changeMode(mode) {
                // be busy
                view.textarea.attr('disabled', 'disabled').busy();
                if (app.getEditor()) {
                    var content = app.getEditor().getPlainText();
                    app.getEditor().clear();
                    app.getEditor().handleHide();
                    if (app.getEditor().tinymce) {
                        // changing from HTML to TEXT
                        if (!editorHash.text) {
                            // load TEXT editor for the first time
                            return load('text', content);
                        } else {
                            // reuse TEXT editor
                            return reuse('text', content);
                        }
                    } else {
                        // changing from TEXT to HTML
                        if (!editorHash.html) {
                            // load HTML editor for the first time
                            return load('html', content);
                        } else {
                            // reuse HTML editor
                            return reuse('html', content);
                        }
                    }
                } else {
                    // initial editor
                    return load(mode);
                }
            }

            return _.queued(function (mode) {
                // change?
                mode = getEditorMode(mode);
                return (mode === editorMode ?
                    $.when() :
                    changeMode(mode || editorMode).done(function () {
                        editorMode = mode || editorMode;
                    })
                );
            });
        }());

        app.setSubject = function (str) {
            view.subject.val(str || '');
        };

        app.setRawBody = function (str) {
            app.getEditor().setContent(str);
        };

        app.getPrimaryAddressFromFolder = function (data) {

            var folder_id = 'folder_id' in data ? data.folder_id : 'default0/INBOX',
                accountID = data.account_id || mailAPI.getAccountIDFromFolder(folder_id);

            return accountAPI.get(accountID).pipe(function (data) {
                var primary_address = null;
                // TODO: don’t handle default user separately
                if (accountID === "0") {
                    primary_address = settings.get('defaultSendAddress');
                }
                return {'displayname'    : data.personal,
                        'primaryaddress' : primary_address || data.primary_address};
            });
        };

        app.getFrom = function () {
            var from_field = view.leftside.find('.fromselect-wrapper select > :selected');
            return [from_field.data('displayname'), from_field.data('primaryaddress')];
        };

        app.setFrom = function (data) {
            return this.getPrimaryAddressFromFolder(data).done(function (from) {
                if (data.from) {
                    from = {displayname: data.from[0], primaryaddress: data.from[1]};
                }
                view.leftside.find('.fromselect-wrapper select').val(mailUtil.formatSender(from.displayname, from.primaryaddress));
            });
        };

        app.setBody = function (str) {
            // get default signature
            var ds = _(view.signatures)
                    .find(function (o) {
                        return o.id === settings.get('defaultSignature');
                    }),
                content = $.trim(str);

            // set signature?
            if (ds) {

                var ln2br = function (str) {
                    return String(str || '').replace(/\r/g, '')
                      .replace(new RegExp('\\n', 'g'), '<br>'); // '\n' is for IE
                };

                if (_.isString(ds.misc)) { ds.misc = JSON.parse(ds.misc); }

                var signature = ds ? $.trim(ds.content) : '',
                pos = ds ? ds.misc && ds.misc.insertion || 'below' : 'below';
                // remember as current signature
                currentSignature = signature;
                // yep
                if (editorMode === 'html') {
                    // prepare signature for html
                    signature = '<p class="io-ox-signature">' + ln2br(signature) + '</p>';
                    // text/html
                    content = '<p></p>' + (pos === 'above' ? signature + content : content + signature);
                } else {
                    // text/plain
                    content = pos === 'above' ?
                        '\n\n' + signature + (content !== '' ? '\n\n' + content : '') :
                        '\n\n' + (content !== '' ? content + '\n\n' : '') + signature;
                }
            } else {
                // no signature
                content = content !== '' ? (editorMode === 'html' ? '<p></p>' : '\n\n') + content : '';
            }
            app.getEditor().setContent(content);
        };

        app.setTo = function (list) {
            view.addRecipients('to', list || []);
        };

        app.setCC = function (list) {
            view.addRecipients('cc', list || []);
            if (list && list.length) {
                view.showSection('cc', false);
            }
        };

        app.setBCC = function (list) {
            view.addRecipients('bcc', list || []);
            if (list && list.length) {
                view.showSection('bcc', false);
            }
        };

        app.setReplyTo = function (value) {
            if (config.get('ui.mail.replyTo.configurable', false) === false) return;
            view.form.find('input#writer_field_replyTo').val(value);
        };

        app.setAttachments = function (list) {
            // look for real attachments
            var found = false;
            _(list || []).each(function (attachment) {
                if (attachment.disp === 'attachment') {
                    // add as linked attachment
                    attachment.type = 'file';
                    found = true;
                    view.form.find('input[type=file]').last()
                        .prop('attachment', attachment)
                        .trigger('change');
                }
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.setNestedMessages = function (list) {
            var found = false;
            _(list || []).each(function (obj) {
                found = true;
                view.form.find('input[type=file]').last()
                    .prop('nested', { message: obj, name: obj.subject, content_type: 'message/rfc822' })
                    .trigger('change');
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.addFiles = function (list) {
            var found = false;
            _(list || []).each(function (obj) {
                found = true;
                view.form.find('input[type=file]').last()
                    .prop('file', obj)
                    .trigger('change');
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.setPriority = function (prio) {
            // be robust
            prio = parseInt(prio, 10) || 3;
            prio = prio < 3 ? 1 : prio;
            prio = prio > 3 ? 5 : prio;
            // set
            view.form.find('input[name=priority][value=' + prio + ']')
                .prop('checked', true);
            // high priority?
            if (prio === 1) {
                view.priorityOverlay.addClass('high');
            }
        };

        app.setAttachVCard = function (bool) {
            // set
            view.form.find('input[name=vcard]').prop('checked', !!bool);
        };

        app.setMsgRef = function (ref) {
            view.form.find('input[name=msgref]').val(ref || '');
        };

        app.setSendType = function (type) {
            view.form.find('input[name=sendtype]').val(type || mailAPI.SENDTYPE.NORMAL);
        };


        /**
         * store headers data in form
         * @param {object} header key/value pairs
         * @returns {undefined}
         */
        app.setHeaders = function (headers) {
            view.form.find('input[name=headers]').val(JSON.stringify(headers) || '{}');
        };

        var windowTitles = {
            compose: gt('Compose new mail'),
            replyall: gt('Reply all'),
            reply: gt('Reply'),
            forward: gt('Forward')
        };

        app.dirty = function (flag) {
            if (flag === true) {
                previous = null; // always dirty this way
                return this;
            } else if (flag === false) {
                previous = app.getMail();
                return this;
            } else {
                return !_.isEqual(previous, app.getMail());
            }
        };

        app.setMail = function (mail) {
            // be robust
            mail = mail || {};
            mail.data = mail.data || {};
            mail.mode = mail.mode || 'compose';
            mail.format = mail.format || getDefaultEditorMode();
            mail.initial = mail.initial || false;

            //config settings
            mail.data.vcard = settings.get('appendVcard');

            // call setters
            var data = mail.data;

            this.setFrom(data);
            this.setSubject(data.subject);
            this.setTo(data.to);
            this.setCC(data.cc);
            this.setBCC(data.bcc);
            this.setReplyTo(data.headers && data.headers['Reply-To']);
            this.setAttachments(data.attachments);
            this.setNestedMessages(data.nested_msgs);
            this.setPriority(data.priority || 3);
            this.setAttachVCard(data.vcard !== undefined ? data.vcard : config.get('mail.vcard', false));
            this.setMsgRef(data.msgref);
            this.setSendType(data.sendtype);
            this.setHeaders(data.headers);
            // add files (from file storage)
            this.addFiles(data.infostore_ids);
            // add files (from contacts)
            this.addFiles(data.contacts_ids);
            // app title
            var title = windowTitles[composeMode = mail.mode];
            win.nodes.main.find('h1.title').text(title);
            title = data.subject ? _.noI18n(data.subject) : title;
            app.setTitle(title);
            // set signature
            currentSignature = mail.signature || '';
            // set format
            return app.setFormat(mail.format).done(function () {
                // set body
                var content = data.attachments && data.attachments.length ? (data.attachments[0].content || '') : '';
                if (mail.format === 'text') {
                    content = content.replace(/<br>\n?/g, '\n');
                    // backend sends html entities, these need to be transformed into plain text
                    content = $('<div />').html(content).text();
                }
                // image URL fix
                if (editorMode === 'html') {
                    content = content.replace(/(<img[^>]+src=")\/ajax/g, '$1' + ox.apiRoot);
                }
                app[mail.initial ? 'setBody' : 'setRawBody'](content);

                // remember this state for dirty check
                previous = app.getMail();
            });
        };

        app.failSave = function () {
            var mail = app.getMail();
            delete mail.files;
            return {
                module: 'io.ox/mail/write',
                description: gt('Mail') + ': ' + (mail.data.subject || gt('No subject')),
                point: mail
            };
        };

        app.failRestore = function (point) {
            var def = $.Deferred();
            win.busy().show(function () {
                _.url.hash('app', 'io.ox/mail/write:' + point.mode);
                app.setMail(point).done(function () {
                    app.dirty(true);
                    app.getEditor().focus();
                    win.idle();
                    def.resolve();
                });
            });
            return def;
        };

        /**
         * Compose new mail
         */
        app.compose = function (data) {

            // register mailto!
            // only for browsers != firefox due to a bug in firefox
            // https://bugzilla.mozilla.org/show_bug.cgi?id=440620
            // maybe this will be fixed in the future by mozilla
            if (navigator.registerProtocolHandler && !_.browser.Firefox) {
                var l = location, $l = l.href.indexOf('#'), url = l.href.substr(0, $l);
                navigator.registerProtocolHandler(
                    'mailto', url + '#app=io.ox/mail/write:compose&mailto=%s', ox.serverConfig.productNameMail
                );
            }

            var mailto, tmp, params, def = $.Deferred();

            // triggerd by mailto?
            if (data === undefined && (mailto = _.url.hash('mailto'))) {
                tmp = mailto.split(/\?/, 2);
                params = _.deserialize(tmp[1]);
                tmp = tmp[0].split(/\:/, 2);
                // save data
                data = {
                    to: [['', tmp[1]]],
                    subject: params.subject,
                    attachments: [{ content: params.body || '' }]
                };
                // clear hash
                _.url.hash('mailto', null);
            }

            _.url.hash('app', 'io.ox/mail/write:compose');

            win.busy().show(function () {
                app.setMail({ data: data, mode: 'compose', initial: true })
                .done(function () {
                    // set data again, to use correct sender field
                    // fixes a timing problem because select field is not fully
                    // drawn, when setMail is called
                    app.setFrom(data || {});
                    if (mailto) {
                        app.getEditor().focus();
                    } else if (data && data.to) {
                        focus('subject');
                    } else {
                        focus('to');
                    }
                    win.idle();
                    def.resolve();
                })
                .fail(function () {
                    notifications.yell('error', gt('An error occured. Please try again.'));
                    app.dirty(false).quit();
                    def.reject();
                });
            });

            return def;
        };

        /**
         * Reply (all)
         */
        function reply(type) {

            return function (obj) {

                var def = $.Deferred();
                _.url.hash('app', 'io.ox/mail/write:' + type);

                app.cid = 'io.ox/mail:' + type + '.' + _.cid(obj);

                function cont(obj) {
                    win.busy().show(function () {
                        mailAPI[type](obj, getDefaultEditorMode())
                        .done(function (data) {
                            data.sendtype = mailAPI.SENDTYPE.REPLY;
                            app.setMail({ data: data, mode: type, initial: true })
                            .done(function () {
                                var ed = app.getEditor();
                                ed.setCaretPosition(0);
                                ed.focus();
                                view.scrollpane.scrollTop(0);
                                win.idle();
                                def.resolve();
                            });
                        })
                        .fail(function () {
                            notifications.yell('error', gt('An error occured. Please try again.'));
                            app.dirty(false).quit();
                            def.reject();
                        });
                    });
                }

                if (obj === undefined) {
                    cont({ folder: _.url.hash('folder'), id: _.url.hash('id') });
                } else {
                    cont(obj);
                }

                return def;
            };
        }

        app.replyall = reply('replyall');
        app.reply = reply('reply');

        /**
         * Forward
         */
        app.forward = function (obj) {

            var def = $.Deferred();
            _.url.hash('app', 'io.ox/mail/write:forward');

            app.cid = 'io.ox/mail:forward.' + _.cid(obj);

            win.busy().show(function () {
                mailAPI.forward(obj, getDefaultEditorMode())
                .done(function (data) {
                    data.sendtype = mailAPI.SENDTYPE.FORWARD;
                    app.setMail({ data: data, mode: 'forward', initial: true })
                    .done(function () {
                        var ed = app.getEditor();
                        ed.setCaretPosition(0);
                        focus('to');
                        win.idle();
                        def.resolve();
                    });
                })
                .fail(function () {
                    notifications.yell('error', gt('An error occured. Please try again.'));
                    app.dirty(false).quit();
                    def.reject();
                });
            });
            return def;
        };

        // edit draft
        app.edit = function (data) {

            var def = $.Deferred();

            _.url.hash('app', 'io.ox/mail/write:compose'); // yep, edit is same as compose

            app.cid = 'io.ox/mail:edit.' + _.cid(data); // here, for reuse it's edit!
            data.msgref = data.folder_id + '/' + data.id;

            win.busy().show(function () {
                app.setMail({ data: data, mode: 'compose', initial: false })
                .done(function () {
                    app.setFrom(data || {});
                    app.getEditor().focus();
                    win.idle();
                    def.resolve();
                })
                .fail(function () {
                    notifications.yell('error', gt('An error occured. Please try again.'));
                    app.dirty(false).quit();
                    def.reject();
                });
            });

            return def;
        };

        /**
         * Get mail
         */
        app.getMail = function () {
            var // get relevant fields
                fields = view.form
                    .find(':input[name]')
                    .filter('textarea, [type=text], [type=hidden], [type=radio]:checked, [type=checkbox]:checked'),
                // get raw data
                data = _(fields).inject(function (obj, field) {
                    var key = field.name, pre = obj[key], val = $(field).val();
                    if (pre !== undefined) {
                        // make array or push to array
                        (_.isArray(pre) ? pre : (obj[key] = [pre])).push(val);
                    } else {
                        obj[key] = val;
                    }
                    return obj;
                }, {}),
                content,
                mail,
                files = [],
                parse = function (list) {
                    return _(mailUtil.parseRecipients([].concat(list).join(', ')))
                        .map(function (recipient) {
                            return ['"' + recipient[0] + '"', recipient[1]];
                        });
                },
                replyTo = parse(data.replyTo)[0] || [];

            data.from = this.getFrom();

            // get content
            if (editorMode === 'html') {
                content = {
                    content: (app.getEditor() ? app.getEditor().getContent() : '')
                        // reverse img fix
                        .replace(/(<img[^>]+src=")(\/appsuite\/)?api\//g, '$1/ajax/')
                };
            } else {
                content = {
                    content: (app.getEditor() ? app.getEditor().getContent() : '')
                        .replace(/</g, '&lt;') // escape <
                        .replace(/\n/g, '<br>\n') // escape line-breaks
                };
            }

            content.content_type = getContentType(editorMode);

            mail = {
                from: [data.from] || [],
                to: parse(data.to),
                cc: parse(data.cc),
                bcc: parse(data.bcc),
                headers: JSON.parse(data.headers) || {},
                reply_to: mailUtil.formatSender(replyTo[0], replyTo[1]),
                subject: data.subject + '',
                priority: parseInt(data.priority, 10) || 3,
                vcard: parseInt(data.vcard, 10) || 0,
                attachments: [content],
                nested_msgs: []
            };
            // add msgref?
            if (data.msgref) {
                mail.msgref = data.msgref;
            }
            // sendtype
            mail.sendtype = data.sendtype || mailAPI.SENDTYPE.NORMAL;
            // get files
            view.form.find(':input[name][type=file]').each(function () {
                // link to existing attachments (e.g. in forwards)
                var attachment = $(this).prop('attachment'),
                    // get file via property (DND) or files array and add to list
                    file = $(this).prop('file'),
                    // get nested messages
                    nested = $(this).prop('nested');
                if (attachment) {
                    // add linked attachment
                    mail.attachments.push(attachment);
                } else if (nested) {
                    // add nested message (usually multiple mail forward)
                    mail.nested_msgs.push(nested.message);
                } else if ('File' in window && file instanceof window.File) {
                    // add dropped file
                    files.push(file);
                } else if (file && ('id' in file) && ('size' in file)) {
                    // infostore id
                    (mail.infostore_ids = (mail.infostore_ids || [])).push(file);
                } else if (file && ('id' in file) && ('display_name' in file)) {
                    // contacts id
                    (mail.contacts_ids = (mail.contacts_ids || [])).push(file);
                } else if (this.files && this.files.length) {
                    // process normal upload
                    _(this.files).each(function (file) {
                        files.push(file);
                    });
                }
            });
            // return data, file references, mode, format
            return {
                data: mail,
                mode: composeMode,
                format: editorMode,
                signature: currentSignature,
                files: files
            };
        };

        /**
         * Send mail
         */
        app.send = function () {
            // get mail
            var mail = this.getMail(), def = $.Deferred();
            // get flat ids for data.infostore_ids
            if (mail.data.infostore_ids) {
                mail.data.infostore_ids = _(mail.data.infostore_ids).pluck('id');
            }
            // get flat cids for data.contacts_ids
            if (mail.data.contacts_ids) {
                mail.data.contacts_ids = _(mail.data.contacts_ids).map(function (o) { return _.pick(o, 'folder_id', 'id'); });
            }
            // move nested messages into attachment array
            _(mail.data.nested_msgs).each(function (obj) {
                mail.data.attachments.push({
                    id: mail.data.attachments.length + 1,
                    filemname: obj.subject,
                    content_type: 'message/rfc822',
                    msgref: obj.msgref
                });
            });
            delete mail.data.nested_msgs;

            function cont() {
                // start being busy
                win.busy();
                // close window now (!= quit / might be reopened)
                win.preQuit();
                // send!
                mailAPI.send(mail.data, mail.files, view.form.find('.oldschool')).always(function (result) {
                    if (result.error && !result.warnings) {
                        win.idle().show();
                        // TODO: check if backend just says "A severe error occured"
                        notifications.yell(result);
                    } else {
                        if (result.warnings)
                            //warnings
                            notifications.yell('warning', result.warnings.error);
                        else
                            notifications.yell('success', gt('Mail has been sent'));
                        // update base mail
                        var isReply = mail.data.sendtype === mailAPI.SENDTYPE.REPLY,
                            isForward = mail.data.sendtype === mailAPI.SENDTYPE.FORWARD,
                            sep = mailAPI.separator,
                            base, folder, id;
                        if (isReply || isForward) {
                            base = _(mail.data.msgref.split(sep));
                            folder = base.initial().join(sep);
                            id = base.last();
                            mailAPI.get({ folder: folder, id: id }).done(function (data) {
                                // update answered/forwarded flag
                                if (isReply) data.flags |= 1;
                                if (isForward) data.flags |= 256;
                                $.when(mailAPI.caches.list.merge(data), mailAPI.caches.get.merge(data)).done(function () {
                                    mailAPI.trigger('refresh.list');
                                });
                            });
                        }
                        app.dirty(false);
                        app.quit();
                    }
                    def.resolve(result);
                });
            }

            // ask for empty subject
            if ($.trim(mail.data.subject) === '') {
                // show dialog
                require(["io.ox/core/tk/dialogs"], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt("Mail has empty subject. Send it anyway?"))
                        .addPrimaryButton("send", gt('Yes, send without subject'))
                        .addButton("subject", gt('Add subject'))
                        .show(function () {
                            def.notify('empty subject');
                        })
                        .done(function (action) {
                            if (action === 'send') {
                                cont();
                            } else {
                                focus('subject');
                                def.reject();
                            }
                        });
                });
            } else {
                cont();
            }

            return def;
        };

        app.saveDraft = function () {

            // get mail
            var mail = this.getMail(),
                def = new $.Deferred();

            // get flat ids for data.infostore_ids
            if (mail.data.infostore_ids) {
                mail.data.infostore_ids = _(mail.data.infostore_ids).pluck('id');
            }
            // get flat cids for data.contacts_ids
            if (mail.data.contacts_ids) {
                mail.data.contacts_ids = _(mail.data.contacts_ids).map(function (o) { return _.pick(o, 'folder_id', 'id'); });
            }
            // send!
            mail.data.sendtype = mailAPI.SENDTYPE.DRAFT;

            if (_(mail.data.flags).isUndefined()) {
                mail.data.flags = mailAPI.FLAGS.DRAFT;
            } else if (mail.data.flags & 4 === 0) {
                mail.data.flags += mailAPI.FLAGS.DRAFT;
            }

            mailAPI.send(mail.data, mail.files)
                .always(function (result) {
                    if (result.error) {
                        notifications.yell(result);
                        def.reject(result);
                    } else {
                        app.setMsgRef(result.data);
                        app.dirty(false);
                        notifications.yell('success', gt('Mail saved as draft'));
                        def.resolve(result);
                    }
                });

            return def;
        };

        /**
         * Get editor
         */
        app.getEditor = function () {
            return editor;
        };

        app.setEditor = function (e) {
            editor = e;
        };

        // destroy
        app.setQuit(function () {

            var def = $.Deferred();

            var clean = function () {
                // mark as not dirty
                app.dirty(false);
                // clean up editors
                for (var id in editorHash) {
                    editorHash[id].destroy();
                }
                // clear all private vars
                app = win = editor = currentSignature = editorHash = null;
            };

            if (app.dirty()) {
                require(["io.ox/core/tk/dialogs"], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt("Do you really want to discard this mail?"))
                        .addPrimaryButton("delete", gt('Discard'))
                        .addAlternativeButton('savedraft', gt("Save as draft"))
                        .addButton("cancel", gt('Cancel'))
                        .show()
                        .done(function (action) {
                            if (action === 'delete') {
                                clean(); // clean before resolve, otherwise tinymce gets half-destroyed (ugly timing)
                                def.resolve();
                            } else if (action === 'savedraft') {
                                app.saveDraft().done(function (mail) {
                                    clean();
                                    def.resolve();
                                }).fail(function (e) {
                                    def.reject(e);
                                });
                            } else {
                                def.reject();
                            }
                        });
                });
            } else {
                clean();
                def.resolve();
            }

            return def;
        });

        return app;
    }

    return {

        getApp: createInstance,

        reuse: function (type, data) {
            if (type === 'reply') {
                return ox.ui.App.reuse('io.ox/mail:reply.' + _.cid(data));
            }
            if (type === 'replyall') {
                return ox.ui.App.reuse('io.ox/mail:replyall.' + _.cid(data));
            }
            if (type === 'forward') {
                return ox.ui.App.reuse('io.ox/mail:forward.' + _.cid(data));
            }
            if (type === 'edit') {
                return ox.ui.App.reuse('io.ox/mail:edit.' + _.cid(data));
            }
        }
    };

});


