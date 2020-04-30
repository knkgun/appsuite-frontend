/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Anne Matthes <anne.matthes@open-xchange.com>
 */

/// <reference path="../../../steps.d.ts" />

Feature('Settings');

Before(async function (users) {
    await users.create();
});

After(async function (users) {
    await users.removeAll();
});

Scenario('[C7874] Set notification for new/modified/deleted', async function (I, users, tasks, dialogs) {
    await users.create();

    function createAndModifyTask(subject) {
        tasks.newTask();

        I.waitForElement('.io-ox-tasks-edit');
        within('.io-ox-tasks-edit', () => {
            I.waitForElement({ css: 'input.title-field' });
            I.fillField('Subject', subject);
            I.fillField('Description', 'do something very important');
            I.click('Expand form');
            I.click('~Select contacts');
        });
        I.waitForElement('.modal-dialog');
        within('.modal-dialog', () => {
            I.waitForFocus('.search-field');
            I.fillField('Search', users[0].userdata.sur_name);
            I.waitForText(users[0].userdata.sur_name, 5, '.last_name');
            I.click(users[0].userdata.sur_name, '.last_name');
            I.waitForElement('.list-item.token');
            dialogs.clickButton('Select');
        });
        I.waitForText(users[0].userdata.sur_name, '.io-ox-tasks-edit .participantsrow');
        tasks.create();

        I.wait(40);
        I.triggerRefresh();

        I.waitForText('Edit', 5, '.classic-toolbar');
        I.retry(5).click('Edit', '.classic-toolbar');
        I.waitForElement('.io-ox-tasks-edit');
        within('.io-ox-tasks-edit', () => {
            I.waitForElement({ css: 'input.title-field' });
            I.fillField('Subject', `${subject} edited`);
            I.fillField('Description', 'do something else');
        });
        tasks.save();

        I.wait(40);
        I.triggerRefresh();

        I.clickToolbar('Delete');
        dialogs.clickButton('Delete');
    }

    session('Alice', () => {
        I.login('app=io.ox/settings');
        I.waitForElement('~Tasks', '.tree-container');
        I.click('~Tasks', '.tree-container');
        I.waitForElement('.checkbox');
        I.retry(5).seeCheckboxIsChecked('notifyNewModifiedDeleted');
    });

    session('Bob', () => {
        I.login('app=io.ox/tasks', { user: users[1] });
        tasks.waitForApp();
        createAndModifyTask('task 1');
    });

    session('Alice', () => {
        I.openApp('Mail');

        I.waitForText('New task: task 1', 5, '.list-view.visible-selection');
        I.waitForText('Task changed: task 1', 5, '.list-view.visible-selection');
        I.waitForText('Task deleted: task 1 edited', 5, '.list-view.visible-selection');

        I.openApp('Settings');
        I.uncheckOption('notifyNewModifiedDeleted');
        I.retry(5).dontSeeCheckboxIsChecked('notifyNewModifiedDeleted');
    });

    session('Bob', () => {
        createAndModifyTask('task 2');
    });

    session('Alice', () => {
        I.triggerRefresh();
        I.dontSee('New task: task 2', '.list-view.visible-selection');
        I.dontSee('Task changed: task 2', '.list-view.visible-selection');
        I.dontSee('Task deleted: task 2 edited', '.list-view.visible-selection');
    });
});
