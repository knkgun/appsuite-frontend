/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/chat/views/messages', [
    'io.ox/backbone/views/disposable',
    'io.ox/chat/data',
    'io.ox/chat/views/avatar',
    'io.ox/core/extensions',
    'gettext!io.ox/chat',
    'io.ox/chat/events',
    'io.ox/backbone/mini-views/dropdown'
], function (DisposableView, data, Avatar, ext, gt, events, Dropdown) {

    'use strict';

    var emojiRegex = new RegExp('^[\\u{1f300}-\\u{1f5ff}\\u{1f900}-\\u{1f9ff}\\u{1f600}-\\u{1f64f}\\u{1f680}-\\u{1f6ff}\\u{2600}-\\u{26ff}\\u{2700}-\\u{27bf}\\u{1f1e6}-\\u{1f1ff}\\u{1f191}-\\u{1f251}\\u{1f004}\\u{1f0cf}\\u{1f170}-\\u{1f171}\\u{1f17e}-\\u{1f17f}\\u{1f18e}\\u{3030}\\u{2b50}\\u{2b55}\\u{2934}-\\u{2935}\\u{2b05}-\\u{2b07}\\u{2b1b}-\\u{2b1c}\\u{3297}\\u{3299}\\u{303d}\\u{00a9}\\u{00ae}\\u{2122}\\u{23f3}\\u{24c2}\\u{23e9}-\\u{23ef}\\u{25b6}\\u{23f8}-\\u{23fa}]{1,3}$', 'u');

    function isOnlyEmoji(str) {
        return emojiRegex.test(str);
    }

    ext.point('io.ox/chat/message/menu').extend({
        id: 'edit',
        index: 100,
        draw: function (baton) {
            // we cannot edit pictures or system mesages
            if (baton.model.get('type') !== 'text') return;
            this.append($('<li role="presentation">').append($('<a href="#" role="menuitem" tabindex="-1">').text(gt('Edit message')).on('click', function () {
                baton.view.trigger('editMessage', baton.model);
            })));
        }
    });

    ext.point('io.ox/chat/message/menu').extend({
        id: 'delete',
        index: 200,
        draw: function (baton) {
            this.append($('<li role="presentation">').append($('<a href="#" role="menuitem" tabindex="-1">').text(gt('Delete message')).on('click', function () {
                baton.view.trigger('delete', baton.model);
            })));
        }
    });

    return DisposableView.extend({

        className: 'messages',

        initialize: function (options) {
            this.options = options;

            this.listenTo(this.collection, {
                'expire': this.onExpire,
                'update': this.onAdd,
                'reset': this.onReset,
                'remove': this.onRemove,
                'change:content': this.onChangeBody,
                'change:files': this.onChangeBody,
                'change:time': this.onChangeTime,
                'change:deliveryState': this.onChangeDelivery
            });
            this.listenTo(events, {
                'message:changed': this.onMessageChanged
            });
        },

        render: function () {
            this.$el.empty().append(
                this.collection
                    .chain()
                    .filter(this.options.filter)
                    .last(this.options.limit || Infinity)
                    .map(this.renderMessage, this)
                    .flatten()
                    .value()
            );
            return this;
        },

        renderMessage: function (model) {
            var self = this,
                body = model.getBody(),
                message = $('<div class="message">')
                // here we use cid instead of id, since the id might be unknown
                .attr('data-cid', model.cid)
                .addClass(model.getType())
                .toggleClass('myself', (!model.isSystem() || model.get('deleted')) && model.isMyself())
                .toggleClass('highlight', !!model.get('messageId') && model.get('messageId') === this.messageId)
                .toggleClass('emoji', isOnlyEmoji(body))
                .append(
                    // sender avatar & name
                    this.renderSender(model),
                    // message body
                    $('<div class="content">').append(
                        $('<div class="body">')
                            .html(body)
                            .append(this.renderFoot(model)),
                        // show some indicator dots when a menu is available
                        (function () {
                            if (model.isSystem() || !model.isMyself()) return '';
                            var toggle = $('<button type="button" class="btn btn-link dropdown-toggle actions-toggle" aria-haspopup="true" data-toggle="dropdown">')
                                    .attr('title', gt('Message actions'))
                                    .append($('<i class="fa fa-ellipsis-v">')),
                                menu = $('<ul class="dropdown-menu">'),
                                dropdown = new Dropdown({
                                    className: 'message-actions-dropdown dropdown',
                                    dropup: true,
                                    smart: true,
                                    $toggle: toggle,
                                    $ul: menu
                                });
                            ext.point('io.ox/chat/message/menu').invoke('draw', menu, ext.Baton({ view: self, model: model }));
                            return dropdown.render().$el;
                        })()
                    ),
                    //delivery state
                    $('<div class="fa delivery" aria-hidden="true">').addClass(model.getDeliveryState())
                );

            if (model.get('messageId') === this.messageId) delete this.messageId;

            var date = this.renderDate(model);
            if (date) return [date, message];
            return message;
        },

        onKeydownMenuToggle: function (e) {
            if (!e || !e.which || !this.menu) return;
            switch (e.which) {
                // up arrow
                case 38:
                    this.menu.find('li').last().focus();
                    e.preventDefault();
                    break;
                // enter or down arrow
                case 40:
                case 13:
                    this.menu.find('li').first().focus();
                    e.preventDefault();
                    break;
                // no default
            }
        },

        onKeydownMenuItem: function (e) {
            if (!e || !e.which || !this.menu) return;
            var items = this.menu.find('li'),
                index = items.index(e.target);

            switch (e.which) {
                // up arrow
                case 38:
                    index = (index === 0 ? items.length - 1 : items.index(e.target) - 1);
                    items[index].focus();
                    e.preventDefault();
                    break;
                // down arrow
                case 40:
                    index = (index === items.length - 1 ? 0 : items.index(e.target) + 1);
                    items[index].focus();
                    e.preventDefault();
                    break;
                // enter
                case 13:
                    $(e.target).trigger('click');
                    break;
                // esc
                case 27:
                    e.stopPropagation();
                    this.menu.parent().find('.actions').focus();
                    break;
                // no default
            }
        },

        renderFoot: function (model) {
            return $('<div class="foot">').append(
                // time
                $('<div class="time">').text(model.getTime()),
                // flags
                $('<div class="flags">').append((model.get('edited') && !model.get('deleted')) ? $('<i class="fa fa-pencil">').attr('title', gt('Message was edited')) : '')
            );
        },

        renderSender: function (model) {
            if ((model.isSystem() && !model.get('deleted')) || model.isMyself() || model.hasSameSender(this.options.limit)) return $();
            var user = data.users.getByMail(model.get('sender'));
            return [new Avatar({ model: user }).render().$el, $('<div class="sender">').text(user.getName())];
        },

        renderDate: function (model) {
            var index = model.collection.indexOf(model),
                prev = index === 0 ? undefined : model.collection.at(index - 1),
                start = this.options.limit ? Math.max(0, model.collection.length - this.options.limit) : 0;

            if (index !== start && moment(prev.get('date')).startOf('day').isSameOrAfter(moment(model.get('date')).startOf('day'))) return;

            var date = moment(model.get('date'));

            var formattedDate = date.calendar(null, {
                sameDay: '[' + gt('Today') + ']',
                lastDay: '[' + gt('Yesterday') + ']',
                lastWeek: 'LL',
                sameElse: 'LL'
            });

            return $('<div class="date">').html(formattedDate);
        },

        onExpire: function () {
            this.collection.expired = false;
        },

        onAdd: function (collection, options) {
            var added = options.changes.added;
            if (added.length === 0) return;

            var lastAdded = added[added.length - 1];
            var firstPrev = collection.at(collection.indexOf(lastAdded) + 1);
            if (firstPrev && moment(lastAdded.get('date')).startOf('day').isSame(moment(firstPrev.get('date')).startOf('day'))) {
                var $firstPrev = $('.messages').find('[data-cid=' + firstPrev.cid + ']'),
                    $daylabel = $firstPrev.prev();
                if ($daylabel.hasClass('date')) {
                    $daylabel.remove();
                    $firstPrev.replaceWith(this.renderMessage(firstPrev));
                }
            }

            // special case when there is a limit. calculating diffs is too complicated
            // and it is fast enough to just rerender, if there is a limit
            if (this.options.limit || this.options.filter) return this.render();

            this.trigger('before:add', added);

            added.forEach(function (model) {
                var index = collection.indexOf(model), node = this.renderMessage(model);
                if (index === 0) return this.$el.prepend(node);
                if (index === collection.length - 1) return this.$el.append(node);

                var prev = collection.at(index - 1), sibling = this.$('[data-cid="' + prev.cid + '"]');
                if (sibling.length) return sibling.after(node);
                var next = collection.at(index + 1);
                sibling = this.$('[data-cid="' + next.cid + '"]');
                if (sibling.length) return sibling.before(node);
            }.bind(this));

            this.trigger('after:add', added);
        },

        onReset: function () {
            if (this.disposed) return;
            this.$el.empty();
            var collection = this.collection;
            this.onAdd(collection, { changes: { added: collection.toArray() } });
        },

        onRemove: function (model) {
            this.getMessageNode(model).remove();
        },

        getMessageNode: function (model, selector) {
            return this.$('.message[data-cid="' + model.cid + '"] ' + (selector || ''));
        },

        // currently used when the message changed it's type. We replace the entire node then
        onMessageChanged: function (model) {
            var $message = this.getMessageNode(model);
            if ($message.length) $message.replaceWith(this.renderMessage(model));
        },

        onChangeBody: function (model) {
            var $message = this.getMessageNode(model);
            var $body = $message.find('.body');
            $message
                .removeClass('system text preview')
                .addClass(model.getType())
                .toggleClass('emoji', isOnlyEmoji(model.getBody()));
            $body
                .html(model.getBody())
                .append(this.renderFoot(model));
        },

        onChangeTime: function (model) {
            this.getMessageNode(model, '.time').text(model.getTime());
        },

        onChangeDelivery: function (model) {
            this.getMessageNode(model, '.delivery').attr('class', 'fa delivery ' + model.getDeliveryState());
        }

    });

});
