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

define('io.ox/calendar/month/perspective', [
    'io.ox/calendar/month/view',
    'io.ox/calendar/api',
    'io.ox/core/extensions',
    'io.ox/core/tk/dialogs',
    'io.ox/core/notifications',
    'io.ox/calendar/view-detail',
    'io.ox/calendar/conflicts/conflictList',
    'io.ox/core/print',
    'io.ox/core/folder/api',
    'io.ox/calendar/util',
    'gettext!io.ox/calendar',
    'less!io.ox/calendar/print-style'
], function (View, api, ext, dialogs, notifications, detailView, conflictView, print, folderAPI, util, gt, printStyle) {

    'use strict';

    var perspective = new ox.ui.Perspective('month'),
        // ensure cid is used in model and collection as idAttribute properly
        MonthAppointment = Backbone.Model.extend({
            idAttribute: 'cid',
            initialize: function () {
                this.cid = this.attributes.cid = _.cid(this.attributes);
                // backward compatibility
                this.id = this.cid;
            }
        }),
        MonthAppointmentCollection = Backbone.Collection.extend({
            model: MonthAppointment
        });

    _.extend(perspective, {

        scaffold:       $(),    // perspective
        pane:           $(),    // scrollpane
        monthInfo:      $(),    //
        tops:           {},     // scrollTop positions of the shown weeks
        firstWeek:      0,      // moment of the first week
        lastWeek:       0,      // moment of the last week
        updateLoad:     8,      // amount of weeks to be loaded on scroll events
        initLoad:       2,      // amount of initial called updates
        scrollOffset:   _.device('smartphone') ? 130 : 250,  // offset space to trigger update event on scroll stop
        collections:    {},     // all week collections of appointments
        current:        null,   // current month as date object
        folder:         null,
        app:            null,   // the current application
        dialog:         $(),    // sidepopup

        /**
         * open sidepopup to show appointment
         * @param  {Event}  e   given click event
         * @param  {Object} obj appointment object (min. id, folder_id, recurrence_position)
         */
        showAppointment: function (e, obj) {
            // open appointment details
            var self = this;
            api.get(obj).done(function (data) {
                self.dialog
                    .show(e, function (popup) {
                        popup
                        .append(detailView.draw(data))
                        .attr({
                            'role': 'complementary',
                            'aria-label': gt('Appointment Details')
                        });
                    });
            });
        },

        /**
         * open create appointment dialog
         * @param  {Event}  e        given event
         * @param  {number} startTS  timestamp of the day
         */
        createAppointment: function (e, start) {
            // add current time to start timestamp
            start = moment(start).add(Math.ceil((moment().hours() * 60 + moment().minutes()) / 30) * 30, 'minutes');
            ext.point('io.ox/calendar/detail/actions/create')
                .invoke('action', this, { app: this.app }, { start_date: start.valueOf(), end_date: start.add(1, 'hour').valueOf() });
        },

        /**
         * open edit dialog
         * @param  {Event}  e   given click event
         * @param  {Object} obj appointment object
         */
        openEditAppointment: function (e, obj) {
            ext.point('io.ox/calendar/detail/actions/edit')
                .invoke('action', this, { data: obj });
        },

        /**
         * update appointment data
         * @param  {Object} obj new appointment data
         */
        updateAppointment: function (obj) {
            var self = this;
            _.each(obj, function (el, i) {
                if (el === null) {
                    delete obj[i];
                }
            });

            var apiUpdate = function (obj) {
                api.update(obj).fail(function (error) {
                    if (!error.conflicts) return notifications.yell(error);

                    ox.load(['io.ox/calendar/conflicts/conflictList']).done(function (conflictView) {
                        conflictView.dialog(error.conflicts)
                            .on('cancel', function () { self.update(); })
                            .on('ignore', function () {
                                obj.ignore_conflicts = true;
                                apiUpdate(obj);
                            });
                    });
                });
            };

            if (obj.recurrence_type > 0) {
                util.getRecurrenceChangeDialog()
                    .show()
                    .done(function (action) {
                        if (action === 'appointment') {
                            apiUpdate(api.removeRecurrenceInformation(obj));
                        } else {
                            self.update();
                        }
                    });
            } else {
                apiUpdate(obj);
            }
        },

        updateWeeks: function (opt, useCache) {
            // fetch appointments
            var self = this,
                weeks = opt.weeks || this.updateLoad,
                apiData = {
                    start: opt.start,
                    end: moment(opt.start).add(weeks, 'weeks').valueOf()
                };
            // do folder magic
            if (this.folder.id !== 'virtual/all-my-appointments') {
                apiData.folder = this.folder.id;
            }

            return api.getAll(apiData, useCache).then(function (list) {
                // update single week view collections
                function appointmentsBetween(start, end) {
                    return list.filter(function (mod) {
                        var tmpStart = mod.full_time ? moment.utc(mod.start_date).local(true).valueOf() : mod.start_date,
                            tmpEnd = mod.full_time ? moment.utc(mod.end_date).local(true).valueOf() : mod.end_date;
                        return (tmpStart >= start && tmpStart < end) || (tmpEnd > start && tmpEnd <= end) || (tmpStart <= start && tmpEnd >= end);
                    }).map(function (obj) {
                        return new MonthAppointment(obj);
                    });
                }
                var start = opt.start;
                for (var i = 0; i < weeks; i++) {
                    var end = moment(start).endOf('week').valueOf(),
                        collection = self.collections[start];
                    if (collection) {
                        collection.reset(appointmentsBetween(start, end));
                    }
                    start = moment(start).add(8, 'd').startOf('week').valueOf();
                    collection = null;
                }
            });
        },

        // re-trigger event on app
        bubble: function (eventname, e, data) {
            this.app.trigger(eventname, e, data, this.name);
        },

        drawWeeks: function (opt) {
            var self = this,
                param = $.extend({
                    up: false,
                    multi: 1
                }, opt),
                views = [],
                weeks = param.multi * self.updateLoad,
                curWeek = param.up ? self.firstWeek.subtract(weeks, 'weeks').clone() : self.lastWeek.clone(),
                start = curWeek.valueOf();

            function createView(options) {
                return new View(options)
                    .on('showAppointment', self.showAppointment, self)
                    .on('showAppointment', _.bind(self.bubble, self, 'showAppointment'))
                    .on('createAppoinment', self.createAppointment, self)
                    .on('createAppoinment', _.bind(self.bubble, self, 'createAppoinment'))
                    .on('openEditAppointment', self.openEditAppointment, self)
                    .on('updateAppointment', self.updateAppointment, self);
            }

            // draw all weeks
            for (var i = 0; i < weeks; i++, curWeek.add(8, 'd').startOf('week')) {
                var day = curWeek.valueOf(),
                    endDate = curWeek.clone().endOf('week'),
                    monthDelimiter = curWeek.clone().endOf('month').isSameOrBefore(endDate);

                // add collection for week
                self.collections[day] = new MonthAppointmentCollection([]);
                // new view
                var view = createView({
                    collection: self.collections[day],
                    day: day,
                    folder: self.folder,
                    pane: this.pane,
                    app: this.app,
                    perspective: this,
                    weekType: monthDelimiter ? 'last' : ''
                });
                views.push(view.render().el);

                // seperate last days if month before and first days of next month
                if (monthDelimiter) {
                    endDate.add(1, 'd').startOf('month');
                    // add an
                    views.push($('<div class="week month-name">').attr('id', endDate.format('YYYY-MM')).append($('<div>').text(gt.noI18n(endDate.format('MMMM YYYY')))));
                    view.$el.addClass('no-border');

                    if (!endDate.clone().startOf('week').isSame(endDate)) {
                        // do not render this, if start of current week is the same as start of current month
                        views.push(createView({
                            collection: self.collections[day],
                            day: day,
                            folder: self.folder,
                            pane: this.pane,
                            app: this.app,
                            perspective: this,
                            weekType: 'first'
                        }).render().el);
                    }
                }
            }

            // add and render view
            if (param.up) {
                var firstWeek = $('.week:first', this.pane),
                    curOffset = firstWeek.offset().top - this.scrollTop();
                this.pane.prepend(views).scrollTop(firstWeek.offset().top - curOffset);
            } else {
                this.lastWeek.add(weeks, 'weeks');
                this.pane.append(views);
            }

            // update first positions
            self.getFirsts();
            this.updateWeeks({
                start: start,
                weeks: weeks
            });
            return $.when();
        },

        /**
         * wrapper for scrollTop funciton
         * @param  {number} top scrollposition
         * @return { number}     new scroll position
         */
        scrollTop: function (top) {
            // scrollTop checks arity, so just passing an undefined top does not work here
            return top === undefined ? this.pane.scrollTop() : this.pane.scrollTop(top);
        },

        updateColor: function (model) {
            if (!model) return;
            $('[data-folder="' + model.get('id') + '"]', this.pane).each(function () {
                this.className = this.className.replace(/color-label-\d{1,2}/, 'color-label-' + (model.get('meta') ? model.get('meta').color_label || '1' : '1'));
            });
        },

        update: function (useCache) {
            var day = $('#' + moment().format('YYYY-M-D'), this.pane);

            if (!day.hasClass('today')) {
                $('.day.today', this.pane).removeClass('today');
                day.addClass('today');
            }

            this.updateWeeks({
                start: this.firstWeek.valueOf(),
                weeks: this.lastWeek.diff(this.firstWeek, 'week')
            }, useCache);

            if (this.folderModel) {
                this.folderModel.off('change:meta', this.updateColor);
            }
            this.folderModel = folderAPI.pool.getModel(this.folder.id);
            this.folderModel.on('change:meta', this.updateColor, this);
        },

        /**
         * update global 'tops' object with current positions of all first days of all months
         */
        getFirsts: function () {
            if (!this.pane) return;

            var self = this;
            this.tops = {};

            $('.day.first', this.pane).each(function (i, el) {
                var elem = $(el);
                // >> 0 parses a floating point number to an integer
                self.tops[($(el).position().top - elem.height() / 2 + self.pane.scrollTop()) >> 0] = elem;
            });
        },

        /**
         * Called after the perspective is shown.
         */
        afterShow: function () {
            // See Bug 36417 - calendar jumps to wrong month with IE10
            // If month perspectice is rendered the first time after another perspective was already rendered, the tops will all be 0.
            // That happens, because the perspective is made visible after rendering but only when there was already another calendar perspective rendered;
            if (_.keys(this.tops).length <= 1) this.getFirsts();
        },

        /**
         * scroll to given month
         * @param  {object} opt
         *          string|LocalDate date: date target as LocalDate or string (next|prev|today)
         *          number           duration: duration of the scroll animation
         */
        gotoMonth: function (target) {
            var self = this,
                isPrev;

            target = target || self.app.refDate || moment();

            if (typeof target === 'string') {
                if (target === 'today') {
                    target = moment();
                } else if (target === 'prev') {
                    isPrev = true;
                    target = moment(self.previous);
                } else {
                    target = moment(self.current).add(1, 'month');
                }
            }

            // we cannot use target.month() + 1 or we might get month 13 in 2015 instead of month 1 in 2016
            var nextMonth = moment(target).add(1, 'month'),
                firstDay = $('#' + target.format('YYYY-MM'), self.pane),
                nextFirstDay = $('#' + nextMonth.format('YYYY-MM'), self.pane),
                // don't scroll to the first shown month (causes infinte scrolling because the scrollpos cannot be reached), draw a previous month first
                isFirst = isPrev && $('.month-name', self.pane).first().attr('id') === target.format('YYYY-MM'),
                scrollToDate = function () {
                    // scroll to position
                    if (firstDay.length === 0) return;
                    firstDay.get(0).scrollIntoView();
                };

            if (!isFirst && firstDay.length > 0 && nextFirstDay.length > 0) {
                scrollToDate();
            } else if (isFirst || target.valueOf() < self.current.valueOf()) {
                this.drawWeeks({ up: true }).done(function () {
                    firstDay = $('#' + target.format('YYYY-MM'), self.pane);
                    scrollToDate();
                });
            } else {
                this.drawWeeks().done(function () {
                    firstDay = $('#' + target.format('YYYY-MM'), self.pane);
                    scrollToDate();
                });
            }
        },

        /**
         * get current folder data
         * @return { Deferred} Deferred with folder data on resolve
         */
        getFolder: function () {
            var self = this,
                def = $.Deferred();
            self.app.folder.getData().done(function (data) {
                self.folder = data;
                def.resolve(data);
            });
            return def;
        },

        /**
         * perspective restore function. will be triggered on show
         */
        restore: function () {
            // goto current date position
            if (this.folder) {
                this.gotoMonth();
            }
        },

        /**
         * print current month
         */
        print: function () {
            var win, data = null,
                folderID = this.folder.id || this.folder.folder,
                styleNode = $('<style type="text/css">').text(printStyle);

            if (folderID && folderID !== 'virtual/all-my-appointments') {
                data = { folder_id: folderID };
            }
            win = print.open('printCalendar', data, {
                template: 'cp_monthview_table_appsuite.tmpl',
                start: moment(this.current).utc(true).valueOf(),
                end: moment(this.current).add(1, 'month').utc(true).valueOf()
            });

            if (this.app.props.get('colorScheme') === 'custom') {
                // apply custom colors
                win.onload = function () {
                    $(win.document.head).append(styleNode);
                    $(win.document.body).addClass('print-view-custom-colors');
                    win.onload = null;
                };
            }

            // firefox opens every window with about:blank, then loads the url. If we are to fast we will just print a blank page(see bug 33415)
            if (_.browser.firefox) {
                var limit = 50,
                    counter = 0,
                    interval;
                // onLoad does not work with firefox on mac, so ugly polling is used
                interval = setInterval(function () {
                    if (++counter === limit || win.location.pathname === (ox.apiRoot + '/printCalendar')) {
                        clearInterval(interval);
                        // add another extra delay for firefox (see bug 48949)
                        setTimeout(function () { win.print(); }, 300);
                    }
                }, 100);
            } else {
                win.print();
            }
        },

        refresh: function () {
            var self = this;
            this.getFolder().done(function () {
                self.update();
            });
        },

        render: function (app) {

            var self = this;
            this.app = app;
            this.current = moment(app.refDate || moment()).startOf('month');
            this.previous = moment(this.current).subtract(1, 'month');
            this.firstWeek = moment(this.previous).startOf('week');
            this.lastWeek = this.firstWeek.clone();

            this.main
                .addClass('month-view')
                .empty()
                .attr({
                    'role': 'main',
                    'aria-label': gt('Calendar Month View')
                })
                .append(this.scaffold = View.drawScaffold());

            var refresh = function () {
                self.refresh();
            };

            var reload = function () {
                self.getFolder().done(function () {
                    self.update(false);
                });
            };

            this.pane = $('.scrollpane', this.scaffold);

            if (_.device('!smartphone')) {
                var toolbarNode = $('<div>')
                    .addClass('controls-container')
                    .append(
                        $('<a href="#" role="button" class="control prev">').attr('title', gt('Previous')).append(
                            $('<i class="fa fa-chevron-left" aria-hidden="true">')
                        )
                        .on('click', $.proxy(function (e) {
                            e.preventDefault();
                            this.gotoMonth('prev');
                        }, this)),
                        $('<a href="#" role="button" class="control next">').attr('title', gt('Next')).append(
                            $('<i class="fa fa-chevron-right" aria-hidden="true">')
                        )
                        .on('click', $.proxy(function (e) {
                            e.preventDefault();
                            this.gotoMonth('next');
                        }, this))
                    );

                // prepend toolbar to month view
                this.scaffold.prepend(toolbarNode);
            }

            this.pane
                .on('scroll', $.proxy(function (e) {
                    if (e.target.offsetHeight + e.target.scrollTop >= e.target.scrollHeight - this.scrollOffset) {
                        this.drawWeeks();
                    }
                    if (this.scrollTop() <= this.scrollOffset) {
                        this.drawWeeks({ up: true });
                    }
                }, this))
                .on('scrollstop', $.proxy(function () {
                    var month = false,
                        prevMonth = 0,
                        scrollTop = this.scrollTop(),
                        height = this.pane.height();

                    // find first visible month on scroll-position
                    for (var y in this.tops) {
                        y = y >> 0;
                        if ((y + this.tops[y].height()) > scrollTop && (scrollTop + height / 3) > y) {
                            // select month where title is in upper half of the screen
                            month = this.tops[y].data('date');
                            break;
                        } else if (y > scrollTop + height / 3) {
                            // on first element, which is not in the upper visible third, stop.
                            break;
                        }

                        prevMonth = this.tops[y].data('date');
                        month = this.tops[y].data('date');
                    }

                    if (prevMonth !== this.previous.valueOf()) {
                        this.previous = moment(prevMonth);
                    }

                    if (month !== this.current.valueOf()) {
                        this.current = moment(month);
                        self.app.refDate.year(this.current.year()).month(this.current.month());
                    }
                }, this));

            $(window).on('resize', this.getFirsts);

            self.getFolder().done(function () {
                self.folderModel = folderAPI.pool.getModel(self.folder.id);
                self.folderModel.on('change:meta', self.updateColor, self);

                self.drawWeeks({ multi: self.initLoad }).done(function () {
                    self.gotoMonth();
                });
            });

            if (_.keys(this.tops).length <= 1) {
                // when this page is shown for the first time and has no tops (means it is invisible) we have to wait until it is show and afterwards select the month
                // this requires special handling since gotoMonth uses scrollIntoView() which needs the page to be visible.
                self.app.pages.getPageObject(self.name).$el.one('animationstart', function () {
                    self.gotoMonth();
                });
            }

            this.main
                .on('keydown', function (e) {
                    switch (e.which) {
                        case 37:
                            // left
                            self.gotoMonth('prev');
                            break;
                        case 39:
                            // right
                            self.gotoMonth('next');
                            break;
                        case 13:
                            // enter
                            $(e.target).click();
                            break;
                        case 32:
                            // space
                            e.preventDefault();
                            $(e.target).click();
                            break;
                        // no default
                    }
                });

            // define default sidepopup dialog
            this.dialog = new dialogs.SidePopup({ tabTrap: true, preserveOnAppchange: true })
                .on('close', function () {
                    $('.appointment', this.main).removeClass('opac current');
                });

            // watch for api refresh
            api.on('create update refresh.all', refresh)
                .on('delete', function () {
                    // Close dialog after delete
                    self.dialog.close();
                    refresh();
                });
            app.on('folder:change', refresh)
                .on('folder:delete', reload)
                .getWindow()
                .on('show', refresh)
                .on('show', $.proxy(this.restore, this))
                .on('beforehide', $.proxy(this.save, this))
                .on('change:perspective', function () {
                    self.dialog.close();
                });
        },

        // called when an appointment detail-view opens the according appointment
        selectAppointment: function (obj) {
            this.gotoMonth(moment(obj.start_date));
        },

        getStartDate: function () {
            return this.current.valueOf();
        }
    });

    return perspective;
});
