/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Benedikt Kroening <benedikt.kroening@open-xchange.com>
 */

/// <reference path="../../steps.d.ts" />

Feature('General > Inline Help');

Before(async (users) => {
    await users.create();
});

After(async (users) => {
    await users.removeAll();
});

Scenario('[C274424] Inline Help', async (I) => {
    I.login();

    await verifyHelp(I, 'Mail', '5.1. The E-Mail Components');
    await verifyHelp(I, 'Calendar', '7.1. The Calendar Components');
    await verifyHelp(I, 'Address Book', '6.1. The Address Book Components');
    await verifyHelp(I, 'Drive', '9.1. The Drive Components');
    await verifyHelp(I, 'Tasks', '8.1. The Tasks Components');
    await verifyHelp(I, 'Portal', '4.1. The Portal Components');
});

async function verifyHelp(I, appName, expectedHelp) {
    I.openApp(appName);
    I.wait(3);
    I.click('.io-ox-context-help');
    await within({ frame: '.floating-window .inline-help-iframe' }, async () => {
        I.see(expectedHelp);
        I.click('Table Of Contents');
        I.wait(1);
        I.see('User Guide');
    });
    I.click('.floating-window [data-action="close"]');
}
