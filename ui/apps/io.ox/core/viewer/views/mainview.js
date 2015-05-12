/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/mainview', [
    'io.ox/core/viewer/views/toolbarview',
    'io.ox/core/viewer/views/displayerview',
    'io.ox/core/viewer/views/sidebarview',
    'io.ox/backbone/disposable',
    'io.ox/core/tk/nodetouch',
    'io.ox/core/viewer/util',
    'io.ox/core/viewer/settings',
    'less!io.ox/core/viewer/style'
], function (ToolbarView, DisplayerView, SidebarView, DisposableView, NodeTouch, Util, Settings) {

    'use strict';

    /**
     * The MainViewer is the base view for the OX Viewer.
     * This view imports, manage and  renders these children views:
     * - ToolbarView
     * - DisplayerView
     * - SidebarView
     */
    var MainView = DisposableView.extend({

        className: 'io-ox-viewer abs',

        events: {
            'keydown': 'onKeydown'
        },

        initialize: function (options) {
            _.extend(this, options);
            // apps with 'simple window' class (Portal) scrolls behind the viewer.
            // Hide it for the moment as a workaround.
            // TODO find a better solution
            if (!this.standalone) {
                this.$el.parent().find('.simple-window').hide();
            }
            // create the event aggregator of this view.
            this.mainEvents = _.extend({}, Backbone.Events);
            // create children views
            var childViewParams = { collection: this.collection, mainEvents: this.mainEvents, standalone: this.standalone };
            this.toolbarView = new ToolbarView(childViewParams);
            this.displayerView = new DisplayerView(childViewParams);
            this.sidebarView = new SidebarView(childViewParams);
            // close viewer on events
            this.listenTo(this.mainEvents, 'viewer:close', this.closeViewer);
            this.listenTo(this.mainEvents, 'viewer:toggle:sidebar', this.onToggleSidebar);
            // bind toggle side bar handler
            this.listenTo(this.mainEvents, 'viewer:sidebar:change:state', this.onSideBarToggled);
            // TODO this is not valid anymore if we want to open couple viewer apps in parallel
            if (!ox.debug) {
                this.listenTo(ox, 'app:start app:resume', this.closeViewer);
            }
            // handle DOM events
            $(window).on('resize.viewer', this.onWindowResize.bind(this));
            // clean stuff on dispose event from core/commons.js
            this.on('dispose', this.disposeView.bind(this));
            // display the selected file initially
            var startIndex = this.collection.getStartIndex(),
                startModel = this.collection.at(startIndex);
            this.render(startModel);
        },

        /**
         * Renders this MainView with the supplied model.
         *
         *  @param {Object} model
         *   The file model object.
         *
         * @returns {MainView}
         */
        render: function (model) {
            var state = Settings.getSidebarOpenState();
            if (!model) {
                console.error('Core.Viewer.MainView.render(): no file to render');
                return;
            }
            // make this main view focusable and prevent focus from leaving the viewer.
            this.$el.attr('tabindex', -1);
            // set device type
            Util.setDeviceClass(this.$el);
            // append toolbar view
            this.$el.append(
                this.sidebarView.render(model).el,
                this.toolbarView.render(model).el,
                this.displayerView.render(model).el
            );
            // set initial sidebar state
            this.sidebarView.toggleSidebar(state);
            return this;
        },

        // handler for keyboard events on the viewer
        onKeydown: function (event) {
            var viewerRootEl = this.$el;
            // manual TAB traversal handler. 'Traps' TAB traversal inside the viewer root component.
            function tabHandler(event) {
                var tabableActions = viewerRootEl.find('[tabindex]:not([tabindex^="-"]):visible'),
                    tabableActionsCount = tabableActions.length;
                // quit immediately if no tabable actions are found
                if (tabableActionsCount === 0) { return; }
                var focusedElementIndex = tabableActions.index(document.activeElement),
                    traversalStep = event.shiftKey ? -1 : 1,
                    nextElementIndex = focusedElementIndex + traversalStep;
                // prevent default TAB traversal
                event.preventDefault();
                // traverse to prev/next action
                if (nextElementIndex >= tabableActionsCount) {
                    nextElementIndex = 0;
                }
                // focus next action candidate
                tabableActions.eq(nextElementIndex).focus();
            }
            switch (event.which || event.keyCode) {
                case 9: // TAB key
                    tabHandler(event);
                    break;
                case 27: // ESC key
                    var escTarget = $(event.target),
                        isDropdownMenuItem = escTarget.parents('.dropdown-menu').length > 0,
                        isDropdownToggler = escTarget.attr('data-toggle') === 'dropdown';
                    // close the viewer only if user is not on a dropdown menu, or a dropdown menu item
                    if ( !isDropdownMenuItem && !isDropdownToggler ) {
                        this.remove();
                    }
                    break;
                case 37: // left arrow
                    this.displayerView.swiper.slidePrev();
                    this.displayerView.$el.find('.swiper-slide-active').focus();
                    break;
                case 39: // right arrow
                    this.displayerView.swiper.slideNext();
                    this.displayerView.$el.find('.swiper-slide-active').focus();
                    break;
            }
        },

        // refresh view sizes and broadcast window resize event
        onWindowResize: function () {
            this.refreshViewSizes();
        },

        // toggle sidebar after the sidebar button is clicked
        onToggleSidebar: function () {
            this.sidebarView.toggleSidebar();
        },

        // handle sidebar toggle
        onSideBarToggled: function (/*state*/) {
            this.refreshViewSizes();
        },

        // recalculate view dimensions after e.g. window resize events
        refreshViewSizes: function () {
            var rightOffset = this.sidebarView.opened ? this.sidebarView.$el.outerWidth() : 0,
                displayerEl = this.displayerView.$el,
                activeSlide = displayerEl.find('.swiper-slide-active'),
                activeSlideIndex = activeSlide.index(),
                swiper = this.displayerView.swiper;

            displayerEl.css({ width: window.innerWidth - rightOffset });
            activeSlide.find('.viewer-displayer-item').css({ maxWidth: window.innerWidth - rightOffset });
            if (swiper) {
                swiper.onResize();
                // workaround for a possible bug from swiper plugin that happens sporadically:
                // After an on resize call, the plugin 'resets' the active slide to the beginning.
                this.displayerView.swiper.slideTo(activeSlideIndex);
            }
        },

        /**
         * Viewer close handler. Hides viewer DOM first and then do cleanup.
         */
        closeViewer: function () {
            // save sidebar state
            Settings.setSidebarOpenState(this.sidebarView.opened);
            if (!this.standalone) {
                this.$el.parent().find('.simple-window').show();
            }
            this.$el.hide();
            this.remove();
        },

        disposeView: function () {
            this.toolbarView.remove();
            this.displayerView.remove();
            this.sidebarView.remove();
            this.collection.off().stopListening().each(function (model) {
                model.off().stopListening();
            });
            this.collection = null;
            this.toolbarView = null;
            this.displayerView = null;
            this.sidebarView = null;
            $(window).off('resize.viewer');
            if (!this.standalone && this.app) {
                this.app.quit();
                this.app = null;
            }
            return this;
        }
    });
    return MainView;
});
