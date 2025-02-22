/*
 *
 * @copyright Copyright (c) OX Software GmbH, Germany <info@open-xchange.com>
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with OX App Suite. If not, see <https://www.gnu.org/licenses/agpl-3.0.txt>.
 *
 * Any use of the work other than as authorized under this license or copyright law is prohibited.
 *
 */

/// <reference path="../../steps.d.ts" />

Feature('Chat > Layout');

Before(async ({ users }) => {
    await Promise.all([
        users.create(),
        users.create()
    ]);
    await users[0].context.hasCapability('chat');
});

After(async ({ users }) => {
    await users[0].context.doesntHaveCapability('chat');
    await users.removeAll();
});

Scenario('Add chat to favorites', async ({ I, users, chat }) => {
    I.login({ user: users[0] });
    chat.openChat();
    chat.createPrivateChat(users[1].userdata.email1);

    // sticky layout
    I.click('~More actions', '.ox-chat');
    I.waitForElement('.smart-dropdown-container.more-dropdown');
    I.click('Add to favorites', '.smart-dropdown-container.more-dropdown');
    I.click('~Close chat', '.ox-chat');
    I.see('Favorites', '.ox-chat .left-navigation');
    I.click(locate('.ox-chat li').withText('User'));
    I.click('~More actions', '.ox-chat');
    I.waitForElement('.smart-dropdown-container.more-dropdown');
    I.click('Remove from favorites', '.smart-dropdown-container.more-dropdown');
    I.click('~Close chat', '.ox-chat');
    I.dontSee('Favorites', '.ox-chat .left-navigation');

    // floating layout
    I.click('~Detach window', '.ox-chat .chat-leftside');
    I.dontSee('Favorites', '.ox-chat .left-navigation');
    I.click(locate('.ox-chat li').withText('User'));
    I.click('.ox-chat button[title="More actions"]');
    I.waitForElement('.chat-rightside .dropdown.open', 3, '.ox-chat');
    I.click('Add to favorites', '.chat-rightside .dropdown.open');
    I.waitForText('Favorites', 3, '.ox-chat .left-navigation');
    I.waitForElement('.ox-chat .left-navigation li[aria-label="Favorites"] .chat-list li');
});

Scenario('Toggle unread bubble in the app suite toolbar', async ({ I, users, chat }) => {
    await session('Alice', async () => {
        I.login({ user: users[0] });
        chat.openChat();
        chat.createPrivateChat(users[1].userdata.email1);
    });

    await session('Bob', async () => {
        I.login({ user: users[1] });
        chat.openChat();
        I.waitForText('New Chat', 30);
        I.waitForDetached('.indicator.chat-notification.hidden', 3, '#io-ox-toprightbar');
        I.waitForText('User', 30, '.ox-chat');
        I.click(locate('.ox-chat li').withText('User'));
        I.waitForElement('.indicator.chat-notification.hidden', 3, '#io-ox-toprightbar');
    });
});

Scenario('Increasing unreadCounter that gets reset on opening the chats', async ({ I, users, contexts, chat, dialogs }) => {
    const context = await contexts.create();
    context.hasCapability('chat');
    const alice = await users.create(users.getRandom(), context);
    const bob = await users.create(users.getRandom(), context);
    const charlie = await users.create(users.getRandom(), context);

    const groupTitle = 'Test Group';
    const channelTitle = 'Test Channel';
    const emails = [bob.userdata.email1, charlie.userdata.email1];

    await session('Alice', async () => {
        I.login({ user: alice });
        chat.openChat();
        // create a private chat
        chat.createPrivateChat(bob.userdata.email1);
        chat.sendMessage('Second message');
        I.click('~Close chat', '.ox-chat');

        // create a group chat
        I.waitForText('New Chat', 30);
        I.click('New Chat');
        I.clickDropdown('Group chat');
        chat.fillNewGroupForm(groupTitle, emails);
        I.click(locate({ css: 'button' }).withText('Create chat'), '.ox-chat-popup');
        I.waitForDetached('.modal-dialog');
        chat.sendMessage('Hey group!');
        chat.sendMessage('Second message');
        chat.sendMessage('Third message');
        I.click('~Close chat', '.ox-chat');

        // create a channel
        I.waitForText('New Chat', 30);
        I.click('New Chat');
        I.clickDropdown('Channel');
        chat.fillNewChannelForm(channelTitle);
        dialogs.clickButton('Create channel');
        I.waitForDetached('.modal-dialog');
        chat.sendMessage('First message');
    });

    await session('Bob', async () => {
        I.login({ user: bob });
        chat.openChat();
        I.waitForText('New Chat', 30);
        // join channel
        I.waitForElement(locate('button').withText('All channels'), 30, '.ox-chat');
        I.click(locate({ css: 'button' }).withText('All channels'), '.ox-chat');
        I.waitForText(channelTitle, 3, '.ox-chat');
        I.click({ css: 'button.join' }, '.ox-chat');
        I.waitForElement('~Close chat', 3, '.ox-chat');
        I.click('~Close chat', '.ox-chat');
    });

    await session('Alice', async () => {
        chat.sendMessage('Another channel message');
    });

    await session('Bob', async () => {
        // check all counters
        I.waitForElement(locate('.unread-count').withText('1'), 3, '.ox-chat .left-navigation');
        I.waitForElement(locate('.unread-count').withText('5'), 3, '.ox-chat .left-navigation');
        I.waitForElement(locate('.unread-count').withText('2'), 3, '.ox-chat .left-navigation');

        // open all chats and check again
        I.click(locate('.unread-count').withText('1'), '.ox-chat .left-navigation');
        I.click('~Close chat', '.ox-chat');
        I.waitForDetached(locate('.unread-count').withText('1'), 3, '.ox-chat .left-navigation');
        I.waitForElement(locate('.unread-count').withText('5'), 3, '.ox-chat .left-navigation');
        I.waitForElement(locate('.unread-count').withText('2'), 3, '.ox-chat .left-navigation');

        I.click(locate('.unread-count').withText('5'), '.ox-chat .left-navigation');
        I.click('~Close chat', '.ox-chat');
        I.waitForDetached(locate('.unread-count').withText('5'), 3, '.ox-chat .left-navigation');
        I.waitForElement(locate('.unread-count').withText('2'), 3, '.ox-chat .left-navigation');

        I.click(locate('.unread-count').withText('2'), '.ox-chat .left-navigation');
        I.click('~Close chat', '.ox-chat');
        I.waitForDetached(locate('.unread-count').withText('2'), 3, '.ox-chat .left-navigation');
    });

    await session('Alice', async () => {
        chat.sendMessage('Hello again');
    });

    await session('Bob', async () => {
        I.waitForElement(locate('.unread-count').withText('1'), 3, '.ox-chat .left-navigation');
    });

    await context.remove();
});

Scenario('Check layouts: compact, standard and detailed', async ({ I, users, contexts, chat, dialogs }) => {
    const context = await contexts.create();
    context.hasCapability('chat');
    const alice = await users.create(users.getRandom(), context);
    const bob = await users.create(users.getRandom(), context);
    const charlie = await users.create(users.getRandom(), context);

    const groupTitle = 'Test Group';
    const channelTitle = 'Test Channel';
    const emails = [bob.userdata.email1, charlie.userdata.email1];

    I.login({ user: alice });
    chat.openChat();
    // create a private chat
    chat.createPrivateChat(bob.userdata.email1);
    chat.sendMessage('Second message');
    I.click('~Close chat', '.ox-chat');

    // create a group chat
    I.waitForText('New Chat', 30);
    I.click('New Chat');
    I.clickDropdown('Group chat');
    chat.fillNewGroupForm(groupTitle, emails);
    I.click(locate({ css: 'button' }).withText('Create chat'), '.ox-chat-popup');
    I.waitForDetached('.modal-dialog');
    chat.sendMessage('Hey group!');
    chat.sendMessage('Second message');
    chat.sendMessage('Third message');
    I.click('~Close chat', '.ox-chat');

    // create a channel
    I.waitForText('New Chat', 30);
    I.click('New Chat');
    I.clickDropdown('Channel');
    chat.fillNewChannelForm(channelTitle);
    dialogs.clickButton('Create channel');
    I.waitForDetached('.modal-dialog');

    chat.sendMessage('First message');

    // open settings
    I.click('~Settings');
    I.clickDropdown('Settings');
    I.waitForElement('.folder.virtual.open[data-model="virtual/settings/main"]');
    I.click({ css: 'li[data-id="virtual/settings/io.ox/chat"]' });
    I.waitForText('View options', 3, '.scrollable-pane');

    // check density 'Compact'
    I.selectOption('#settings-density', 'Compact');
    I.waitForElement('.density-compact', 3, '.ox-chat');
    I.waitForElement('.simple-avatar', 3, '.ox-chat');
    I.waitForElement('.chats-row .title', 3, '.ox-chat');
    I.dontSee('.chats-row .last-message', '.ox-chat');
    I.dontSee('.chats-row .last-modified', '.ox-chat');
    I.dontSee('.avatar', '.ox-chat');
    I.click('~Detach window', '.ox-chat .chat-rightside');
    I.selectOption('#settings-density', 'Compact');
    I.waitForElement('.density-compact', 3, '.ox-chat');
    I.waitForElement('.simple-avatar', 3, '.ox-chat');
    I.waitForElement('.chats-row .title', 3, '.ox-chat');
    I.dontSee('.chats-row .last-message', '.ox-chat');
    I.dontSee('.chats-row .last-modified', '.ox-chat');
    I.dontSee('.avatar', '.ox-chat');
    I.click('~Stick to the right side');

    // check density 'Default'
    I.selectOption('#settings-density', 'Default');
    I.waitForElement('.density-default', 3, '.ox-chat');
    I.waitForElement('.avatar', 3, '.ox-chat');
    I.waitForElement('.chats-row .title', 3, '.ox-chat');
    I.dontSee('.simple-avatar', '.ox-chat');
    I.dontSee('.chats-row .last-message', '.ox-chat');
    I.dontSee('.chats-row .last-modified', '.ox-chat');
    I.click('~Detach window', '.ox-chat .chat-rightside');
    I.waitForElement('.density-default', 3, '.ox-chat');
    I.waitForElement('.avatar', 3, '.ox-chat');
    I.waitForElement('.chats-row .title', 3, '.ox-chat');
    I.dontSee('.simple-avatar', '.ox-chat');
    I.dontSee('.chats-row .last-message', '.ox-chat');
    I.dontSee('.chats-row .last-modified', '.ox-chat');
    I.click('~Stick to the right side');

    // check density 'Detailed'
    I.selectOption('#settings-density', 'Detailed');
    I.waitForElement('.density-detailed ', 3, '.ox-chat');
    I.waitForElement('.avatar', 3, '.ox-chat');
    I.waitForElement('.chat-list', 3, '.ox-chat');
    I.waitForElement('.chats-row .last-message', 3, '.ox-chat');
    I.waitForElement('.chats-row .last-modified', 3, '.ox-chat');
    I.dontSee('.simple-avatar', '.ox-chat');
    I.click('~Detach window', '.ox-chat .chat-rightside');
    I.waitForElement('.density-detailed ', 3, '.ox-chat');
    I.waitForElement('.avatar', 3, '.ox-chat');
    I.waitForElement('.chat-list', 3, '.ox-chat');
    I.waitForElement('.chats-row .last-message', 3, '.ox-chat');
    I.waitForElement('.chats-row .last-modified', 3, '.ox-chat');
    I.dontSee('.simple-avatar', '.ox-chat');
});
