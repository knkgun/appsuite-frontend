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
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/tk/component/component',
    ['io.ox/core/event',
     'io.ox/office/tk/utils',
     'io.ox/office/tk/dropdown/dropdown',
     'io.ox/office/tk/control/group',
     'io.ox/office/tk/control/label',
     'io.ox/office/tk/control/button'
    ], function (Events, Utils, DropDown, Group, Label, Button) {

    'use strict';

    var // shortcut for the KeyCodes object
        KeyCodes = Utils.KeyCodes;

    // class Component ========================================================

    /**
     * Base class for view components that can be registered at a controller.
     * Contains instances of Group objects (controls or groups of controls),
     * receives UI update events from the controller to update the state of the
     * control groups, and forwards change actions from the control groups to
     * the controller.
     *
     * Instances of this class trigger the following events:
     * - 'change': If a control has been activated. The event handler receives
     *  the key and value of the activated control. The value depends on the
     *  type of the activated control.
     * - 'cancel': When the focus needs to be returned to the application (e.g.
     *  when the Escape key is pressed, or when a click on a drop-down button
     *  closes the opened drop-down menu).
     *
     * @constructor
     *
     * @param {ox.ui.Window} appWindow
     *  The application window object.
     *
     * @param {Function} [insertGroupHandler]
     *  A handler function that will be called for every inserted group.
     *  Receives the root element of the group (as jQuery object) as first
     *  parameter, and must insert the element into this view component. Will
     *  be called in the context of this view component instance. If omitted,
     *  all groups will be inserted directly into the root node of this view
     *  component.
     */
    function Component(appWindow, insertGroupHandler) {

        var // self reference
            self = this,

            // create the DOM root element representing the view component
            node = $('<div>').addClass('io-ox-view-component'),

            // all control groups, as plain array
            groups = [],

            // all control groups, mapped by key
            groupsByKey = {},

            // group initializer waiting for the first window 'show' event
            deferredInit = $.Deferred(),

            // whether the application window has been shown at least once
            windowShown = false;

        // private methods ----------------------------------------------------

        /**
         * Resolves the deferred initializer, if this view component and the
         * application window are both visible.
         */
        function initialize() {
            if (windowShown && (node.css('display') !== 'none')) {
                deferredInit.resolve();
            }
        }

        /**
         * Inserts the passed control group into this view component, either by
         * calling the handler function passed to the constructor, or by
         * appending the root node of the group to the children of the own root
         * node.
         */
        function insertGroup(group, key) {

            // remember the group object
            groups.push(group);

            // forward group events to listeners of this view component
            if (_.isString(key)) {
                (groupsByKey[key] || (groupsByKey[key] = [])).push(group);
                group.on('change cancel', function (event, value) {
                    self.trigger(event.type, key, value);
                });
            }

            // insert the group into this view component
            if (_.isFunction(insertGroupHandler)) {
                insertGroupHandler.call(self, group.getNode());
            } else {
                node.append(group.getNode());
            }
        }

        /**
         * Returns all visible and enabled group objects as array.
         */
        function getEnabledGroups() {
            return _(groups).filter(function (group) { return group.isVisible() && group.isEnabled() && group.hasFocusableControls(); });
        }

        /**
         * Moves the focus to the previous or next enabled control in the view
         * component. Triggers a 'blur:key' event at the currently focused
         * control, and a 'focus:key' event at the new focused control.
         *
         * @param {Boolean} forward
         *  If set to true, moves focus forward, otherwise backward.
         */
        function moveFocus(forward) {

            var // all visible and enabled group objects
                enabledGroups = getEnabledGroups(),
                // extract all focusable controls from all visible and enabled groups
                controls = _(enabledGroups).reduce(function (controls, group) { return controls.add(group.getFocusableControls()); }, $()),
                // focused control
                control = Utils.getFocusedControl(controls),
                // index of focused control in all enabled controls
                index = controls.index(control);

            // move focus to next/previous control
            if ((controls.length > 1) && (0 <= index) && (index < controls.length)) {
                control.trigger('blur:key');
                if (forward) {
                    index = (index + 1) % controls.length;
                } else {
                    index = (index === 0) ? (controls.length - 1) : (index - 1);
                }
                controls.eq(index).focus().trigger('focus:key');
            }
        }

        /**
         * Keyboard handler for the entire view component.
         *
         * @param {jQuery.Event} event
         *  The jQuery keyboard event object.
         *
         * @returns {Boolean}
         *  True, if the event has been handled and needs to stop propagating.
         */
        function keyHandler(event) {

            var // distinguish between event types (ignore keypress events)
                keydown = event.type === 'keydown';

            switch (event.keyCode) {
            case KeyCodes.TAB:
                if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                    if (keydown) { moveFocus(!event.shiftKey); }
                    return false;
                }
                break;
            case KeyCodes.LEFT_ARROW:
                if (keydown) { moveFocus(false); }
                return false;
            case KeyCodes.RIGHT_ARROW:
                if (keydown) { moveFocus(true); }
                return false;
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Returns the root element containing this view component as jQuery
         * object.
         */
        this.getNode = function () {
            return node;
        };

        /**
         * Displays this view component, if it is currently hidden.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.show = function () {
            node.show();
            initialize();
            return this;
        };

        /**
         * Hides this view component, if it is currently visible.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.hide = function () {
            node.hide();
            return this;
        };

        /**
         * Returns whether this view component contains the control that is
         * currently focused. Searches in all registered group objects.
         */
        this.hasFocus = function () {
            return _(groups).any(function (group) { return group.hasFocus(); });
        };

        /**
         * Sets the focus to the first enabled group object in this view
         * component, unless it already contains a focused group.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.grabFocus = function () {

            var // all visible and enabled group objects
                enabledGroups = null;

            // set focus to first enabled group, if no group is focused
            if (!this.hasFocus()) {
                enabledGroups = getEnabledGroups();
                if (enabledGroups.length) {
                    enabledGroups[0].grabFocus();
                }
            }

            return this;
        };

        /**
         * Adds separation space following the last inserted group.
         */
        this.addSeparator = function () {
            var group = new Group();
            group.getNode().addClass('separator');
            insertGroup(group);
            return this;
        };

        /**
         * Adds the passed control group to this view component. Calls to the
         * method Component.update() will be forwarded to all registered
         * groups.
         *
         * @param {String} key
         *  The unique key of this group.
         *
         * @param {Group} group
         *  The control group object to be inserted.
         */
        this.addGroup = function (key, group) {
            insertGroup(group, key);
            return this;
        };

        /**
         * Creates a new dynamic label control, and inserts it into this view component. The label text will be updated according to calls
         * of the method ToolBar.update().
         *
         * @param {String} key
         *  The unique key of the label.
         *
         * @param {Object} [options]
         *  A map of options to control the properties of the new label
         *  element. Supports all generic formatting options (see method
         *  Utils.createLabel() for details.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.addLabel = function (key, options) {
            return this.addGroup(key, new Label(options));
        };

        /**
         * Creates a new push button or toggle button, and inserts it to this
         * view component.
         *
         * @param {String} key
         *  The unique key of the button.
         *
         * @param {Object} [options]
         *  A map of options to control the properties of the new button.
         *  Supports all options of the Button class constructor.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.addButton = function (key, options) {
            return this.addGroup(key, new Button(options));
        };

        this.addMenu = function (component, options) {
            var group = new Group(options);
            DropDown.call(group, options);
            insertGroup(group);
            return this;
        };

        /**
         * Enables or disables the specified group of this view component.
         *
         * @param {String} key
         *  The key of the control group to be enabled or disabled.
         *
         * @param {Boolean} [state=true]
         *  If omitted or set to true, the control group will be enabled.
         *  Otherwise, it will be disabled.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.enable = function (key, state) {
            if (key in groupsByKey) {
                _(groupsByKey[key]).invoke('enable', state);
            }
            return this;
        };

        /**
         * Disables the specified group of this view component. Has the same
         * effect as calling Component.enable(key, false).
         *
         * @param {String} key
         *  The key of the control group to be disabled.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.disable = function (key) {
            return this.enable(key, false);
        };

        /**
         * Updates the specified control group with the specified value.
         *
         * @param {String} key
         *  The key of the control group to be updated.
         *
         * @param value
         *  The new value to be displayed in the control.
         *
         * @returns {Component}
         *  A reference to this view component.
         */
        this.update = function (key, value) {
            if (key in groupsByKey) {
                _(groupsByKey[key]).invoke('update', value);
            }
            return this;
        };

        /**
         * Calls the destroy methods of all child objects, and removes this
         * view component from the page.
         */
        this.destroy = function () {
            this.events.destroy();
            node.off().remove();
            self = node = groups = groupsByKey = deferredInit = null;
        };

        // initialization -----------------------------------------------------

        // add event hub
        Events.extend(this);

        // wait for the first window 'show' event and trigger an 'init' event at all groups
        appWindow.one('show', function () { windowShown = true; initialize(); });

        // listen to key events for keyboard focus navigation
        node.on('keydown keypress keyup', keyHandler);

    } // class Component

    // exports ================================================================

    return _.makeExtendable(Component);

});
