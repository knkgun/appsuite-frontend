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

define('io.ox/mail/inplace-reply', [
    'io.ox/backbone/disposable',
    'io.ox/mail/api',
    'io.ox/core/api/account',
    'io.ox/core/yell',
    'gettext!io.ox/mail',
    'settings!io.ox/mail'
], function (DisposableView, api, accountAPI, yell, gt, settings) {

    'use strict';

    // store messages during session. avoid data loss. no dialogs required.
    var drafts = {};

    // helper

    function getFormat() {
        return settings.get('messageFormat', 'html');
    }

    function getProperDisplayName(from) {
        return accountAPI.getSenderAddresses().then(function (addresses) {
            var name, address = from[1];
            // drop display name?
            if (!settings.get('sendDisplayName', true)) {
                // no display name at all
                name = null;
            } else if (settings.get(['customDisplayNames', address, 'overwrite'])) {
                // custom display name
                name = settings.get(['customDisplayNames', address, 'name'], '');
            } else {
                // look for matching sender address
                name = (_(addresses).find(function (item) { return item[1] === address; }) || from)[0];
            }
            return [name, address];
        });
    }

    function transformID(sent) {
        var matches = /^(.+)\D(\d+)$/.exec(sent);
        return _.cid({ folder_id: matches[1], id: matches[2] });
    }

    var InplaceReplyView = DisposableView.extend({

        className: 'inplace-reply',

        events: {
            'input .inplace-editor': 'onChange',
            'keydown': 'onKeyUpDown',
            'keyup': 'onKeyUpDown'
        },

        onSend: function (e) {
            // get reply
            this.busy(true).setProgress(30);
            var cid = this.cid;
            // alternativ also asks for HTML
            var view = getFormat() === 'text' ? 'text' : 'html';
            if ($(e.currentTarget).attr('data-action') === 'sendall') {
                api.replyall(_.cid(this.cid), view)
                    .done(this.onReplyReady.bind(this, $.trim(this.getContent()), cid))
                    .fail(this.onSendFail.bind(this));
            } else {
                api.reply(_.cid(this.cid), view)
                    .done(this.onReplyReady.bind(this, $.trim(this.getContent()), cid))
                    .fail(this.onSendFail.bind(this));
            }
        },

        onReplyReady: function (content, cid, data) {
            var attachment = data.attachments[0];
            // progress
            this.setProgress(70);
            // escape plain text content since we always send HTML
            content = _.escape(content).replace(/\n/g, '<br>');
            // append quoted content of original message
            content += '<br><br>' + (attachment.content_type === 'text/plain' ? attachment.content.replace(/\n/g, '<br>') : attachment.content);
            // pick other stuff we need
            data = _(data).pick('from', 'to', 'cc', 'bcc', 'headers', 'priority', 'vcard', 'subject', 'sendtype', 'csid', 'msgref');
            data.attachments = [{ id: 1, content_type: attachment.content_type, content: content }];
            getProperDisplayName(data.from[0]).done(function (from) {
                data.from[0] = from;
                // go!
                api.send(data)
                    .done(this.onSendComplete.bind(this, cid))
                    .fail(this.onSendFail.bind(this));
            }.bind(this));
        },

        //cid is given as an argument, because this way it survives the dispose event
        onSendComplete: function (cid, response) {
            this.setProgress(100);
            this.trigger('send', transformID(response.data));
            delete drafts[cid];
            setTimeout(function () { this.trigger('close'); }.bind(this), 1000);
        },

        onSendFail: function (e) {
            yell(e);
            this.busy(false);
        },

        onCancel: function () {
            delete drafts[this.cid];
            this.trigger('close');
        },

        onChange: function () {
            var content = $.trim(this.getContent());
            drafts[this.cid] = content;
            this.updateSendButton(content);
        },

        onKeyUpDown: function (e) {
            // keep keyboard stuff local to avoid side-effects
            e.stopPropagation();
            // respond to <esc> if empty
            if (e.which === 27 && $.trim(this.getContent()) === '') this.onCancel();
        },

        busy: function (state) {
            if (this.disposed) return this;
            this.$('textarea').toggle(!state);
            this.$footer.toggle(!state);
            return this;
        },

        setProgress: function (pct) {
            if (this.disposed) return this;
            this.$('.progress').toggle(pct > 0);
            this.$('.progress-bar').width(pct + '%').attr('aria-valuenow', pct);
            return this;
        },

        updateSendButton: function (content) {
            content = content || $.trim(this.getContent());
            var isEmpty = !content.length;
            this.$send.toggleClass('disabled', isEmpty).prop('disabled', isEmpty);
            if (this.$sendall) this.$sendall.toggleClass('disabled', isEmpty).prop('disabled', isEmpty);
        },

        getContent: function () {
            return this.$textarea.val();
        },

        setContent: function (content) {
            return this.$textarea.val(content);
        },

        initialize: function (options) {

            // remember cid
            this.cid = options.cid;

            // store numberOfRecipients to label the button correctly
            this.numberOfRecipients = options.numberOfRecipients;

            this.$send = $();
            this.$textarea = $('<textarea class="inplace-editor form-control">');
            this.$footer = options.$footer;

            // prefill?
            var content = drafts[this.cid] || '';
            if (content !== '') this.setContent(content);
        },

        render: function () {

            var buttons = [
                this.$sendall = $('<button type="button" class="btn btn-primary disabled" data-action="sendall">')
                    .on('click', this.onSend.bind(this))
                    .prop('disabled', true)
                    .text(gt('Reply to all'))
            ];

            if (this.numberOfRecipients > 1) {
                buttons.push(
                    $.txt(' '),
                    this.$send = $('<button type="button" class="btn btn-primary disabled" data-action="send">')
                        .on('click', this.onSend.bind(this))
                        .prop('disabled', true)
                        .text(gt('Reply'))
                );
            }

            this.$el.append(
                // editor
                this.$textarea,
                // progress bar (while sending)
                $('<div class="progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">')
                    .append($('<div class="progress-bar progress-bar-striped active" style="width: 0%">'))
                    .hide()
            );

            this.$footer.append(
                // buttons
                $('<div class="container">').append(
                    buttons,
                    $.txt(' '),
                    $('<button type="button" class="btn btn-default" data-action="cancel">')
                        .on('click', this.onCancel.bind(this))
                        .text(gt('Cancel'))
                )
            );

            this.updateSendButton();

            // defer initial focus ($el is not yet in DOM)
            setTimeout(function (node) { node.focus(); }, 0, this.$textarea);

            return this;
        }
    });

    InplaceReplyView.hasDraft = function (cid) {
        return !!drafts[cid];
    };

    // accessible for debugging
    InplaceReplyView.drafts = drafts;

    // multi instance pattern
    function createInstance() {

        // application object
        var app = ox.ui.createApp({
            closable: true,
            floating: true,
            name: 'io.ox/mail/quickreply',
            title: ''
        });

        // launcher
        return app.setLauncher(function (options) {

            var win = ox.ui.createWindow({
                chromeless: true,
                name: 'io.ox/mail/quickreply',
                toolbar: false,
                closable: true,
                floating: true
            });

            app.cid = 'io.ox/mail/quickreply.' + options.cid;
            app.setWindow(win);
            app.mediate();
            win.show();

            if (ox.debug) console.log('QuickReply', options);
            app.setTitle(gt('Quick reply: %1$s', options.subject));

            win.nodes.outer.addClass('header-bottom')
                .closest('.floating-window').addClass('floating-quick-reply');

            win.nodes.main.append(
                new InplaceReplyView({
                    cid: options.cid,
                    numberOfRecipients: options.numberOfRecipients,
                    $footer: win.nodes.footer
                })
                .on('close', function () {
                    win.close();
                })
                .render().$el
            );
        });
    }

    return {
        getApp: createInstance,
        reuse: function (cid) {
            return ox.ui.App.reuse('io.ox/mail/quickreply.' + cid);
        },
        InplaceReplyView: InplaceReplyView
    };
});
