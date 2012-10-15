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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */
define("io.ox/calendar/edit/recurrence-view", ["io.ox/calendar/model", "io.ox/core/tk/config-sentence", "io.ox/core/date", 'io.ox/core/tk/keys', 'gettext!io.ox/calendar/edit/main'], function (model, ConfigSentence, dateAPI, KeyListener, gt) {
    "use strict";
    
    var DAYS = model.DAYS;
    var RECURRENCE_TYPES = model.RECURRENCE_TYPES;
    
    var CalendarWidgets = {
        dayInMonth: function ($anchor, attribute, options) {
            var self = this;
            var $dayPicker = $('<table>');
            var $row;

            function clickHandler(i) {
                return function () {
                    self[attribute] = i;
                    $anchor.popover("hide");
                    self.trigger("change", self);
                    self.trigger("change:" + attribute, self);
                };
            }

            for (var i = 1; i < 32; i++) {
                if (!$row) {
                    $row = $('<tr>').appendTo($dayPicker);
                }

                $row.append(
                    $('<td>').append(
                        $('<a href="#">').text(i).on('click', clickHandler(i)).css({marginRight: "11px"})
                    )
                );

                if (i % 7 === 0) {
                    $row = null;
                }
            }

            function drawState() {
                $anchor.text(self[attribute]);
                self.trigger("redraw", self);
            }

            $anchor.popover({
                placement: 'top',
                content: function () {
                    return $dayPicker;
                }
            });

            drawState();

            this.on("change:" + attribute, drawState);
        },

        days: function ($anchor, attribute, options) {
            // TODO: Modal close. But how?!?
            var self = this;
            var $dayList = $('<ul class="io-ox-recurrence-day-picker">');
            var nodes = {};

            this[attribute] = 1;

            _(DAYS.values).each(function (day) {
                nodes[day] = $('<li>').append(
                    $('<b>').text(DAYS.i18n[day]).hide(),
                    $('<span>').text(DAYS.i18n[day]).hide()
                ).on("click", function () {
                    var bitmask = self[attribute];
                    bitmask = bitmask ^ DAYS[day];
                    if (bitmask) {
                        self[attribute] = bitmask;
                        self.trigger("change", self);
                        self.trigger("change:" + attribute, self);
                    }
                }).appendTo($dayList);
            });

            $dayList.append($('<li>').append(
                "close",
                $('<i class="icon-remove">')
            ).on("click", function () {
                $anchor.popover('hide');
            }).css({
                marginTop: "11px",
                fontStyle: 'italic'
            }));

            function drawState() {
                var value = DAYS.unpack(self[attribute]);
                _(nodes).each(function (node, day) {
                    if (value[day]) {
                        node.find('b').show();
                        node.find('span').hide();
                    } else {
                        node.find('b').hide();
                        node.find('span').show();
                    }
                });
                var selectedDays = [];
                _(DAYS.values).each(function (day) {
                    if (value[day]) {
                        selectedDays.push(day.toLowerCase());
                    }
                });
                $anchor.text(selectedDays.join(", "));
                self.trigger("redraw", self);
            }

            $anchor.popover({
                placement: 'top',
                content: function () {
                    return $dayList;
                }
            });

            drawState();

            this.on("change:" + attribute, drawState);
        },
        dateFormat: dateAPI.getFormat(dateAPI.DATE).replace(/\by\b/, 'yyyy').toLowerCase(),
        datePicker: function ($anchor, attribute, options) {
            var self = this;
            var originalContent = $anchor.html();
            self[attribute] = options.initial || _.now();

            function renderDate() {
                var value = self[attribute];
                if (value) {
                    var myTime = dateAPI.Local.localTime(parseInt(value, 10));
                    if (_.isNull(myTime)) {
                        value = '';
                    } else {
                        value = new dateAPI.Local(myTime).format(dateAPI.DATE);
                    }
                } else {
                    value = '';
                }
                return value;
            }

            function drawState() {
                var value = renderDate();
                $anchor.text(value);
                self.trigger("redraw", self);
            }

            $anchor.on('click', function () {
                var $dateInput = $('<input type="text" class="input-small">').css({
                    marginBottom: 0
                }).val(renderDate());
                var keys = new KeyListener($dateInput);

                $dateInput.datepicker({format: CalendarWidgets.dateFormat});

                $anchor.after($dateInput);
                $anchor.hide();

                $dateInput.select();
                keys.include();

                // On change
                function updateValue() {
                    var value = dateAPI.Local.parse($dateInput.val(), dateAPI.DATE);
                    if (!_.isNull(value) && value.getTime() !== 0) {
                        self[attribute] = dateAPI.Local.utc(value.getTime());
                        self.trigger("change", self);
                        self.trigger("change:" + attribute, self);
                    }
                    keys.destroy();
                    try {
                        $dateInput.datepicker("hide");
                        $dateInput.remove();
                    } catch (e) { }
                    $anchor.show();

                }
                $dateInput.on("change", function () {
                    updateValue();
                });

                // Enter
                $dateInput.on("enter", function () {
                    updateValue();
                });

                // Escape
                keys.on("esc", function () {
                    $dateInput.val(self[attribute]);
                    keys.destroy();
                    try {
                        $dateInput.remove();
                    } catch (e) { }
                    $anchor.show();
                });
            });

            drawState();

            this.on("change:" + attribute, drawState);
        }
    };
    
    // Mark a few translations, so the buildsystem picks up on them
    gt.ngettext("every day", "every %1$d days", 2);
    gt.ngettext("every week", "every %1$d weeks", 2);
    gt.ngettext("every month", "every %1$d months", 2);
    gt.ngettext("after %1$d appointment", 'after %1$d appointments', 2);
    
    var RecurrenceView = function (options) {
        
        _.extend(this, {
            init: function () {
                var self = this;
                window.$appointment = this.model;

                this.sentence = new ConfigSentence(gt('This appointment <a  data-widget="toggle">is not repeated</a>'), {
                    values: [gt("is not repeated"), gt("is repeated")]
                });

                this.sentences = {
                    daily: new ConfigSentence(gt(' <a href="#"  data-widget="number" data-attribute="interval">every <span class="number-control">2</span> days</a>'), {
                        id: 'daily',
                        singular: gt("every day"),
                        plural: gt("every %1$d days"),
                        initial: 1,
                        gt: gt
                    }),
                    weekly: new ConfigSentence(gt(' <a href="#"  data-widget="number" data-attribute="interval">every <span class="number-control">2</span> weeks</a> on <a href="#"  data-widget="custom" data-attribute="days">monday</a>'), {
                        id: 'weekly',
                        interval: {
                            singular: "every week",
                            plural: "every %1$d weeks",
                            initial: 1,
                            gt: gt
                        },
                        days: CalendarWidgets.days
                    }),
                    monthlyDate: new ConfigSentence(gt(' on day <a href="#"  data-widget="custom" data-attribute="dayInMonth">10</a> <a href="#"  data-widget="number" data-attribute="interval">every <span class="number-control">2</span> months</a>'), {
                        id: 'monthlyDate',
                        interval: {
                            singular: "every month",
                            plural: "every %1$d months",
                            initial: 1,
                            gt: gt
                        },
                        dayInMonth: CalendarWidgets.dayInMonth
                    }),
                    monthlyDay: new ConfigSentence(gt(' the <a href="#" data-widget="options" data-attribute="ordinal">second</a> <a href="#" data-widget="options" data-attribute="day">wednesday</a> <a href="#" data-widget="number" data-attribute="interval">every <span class="number-control">2</span> months</a>'), {
                        id: 'monthlyDay',
                        ordinal: {
                            options: {
                                1: gt("first"),
                                2: gt("second"),
                                3: gt("third"),
                                4: gt("fourth"),
                                5: gt("last")
                            }
                        },
                        day: {
                            options: {
                                1: gt("sunday"),
                                2: gt("monday"),
                                4: gt("tuesday"),
                                8: gt("wednesday"),
                                16: gt("thursday"),
                                32: gt("friday"),
                                64: gt("saturday"),
                                62: gt("day of the week"),
                                65: gt("day of the weekend")
                            },
                            initial: 2
                        },
                        interval: {
                            singular: "every month",
                            plural: "every %1$d months",
                            initial: 1,
                            gt: gt
                        }
                    }),
                    yearlyDate: new ConfigSentence(gt(' every year on day <a href="#"  data-widget="custom" data-attribute="dayInMonth">10</a> of <a href="#" data-widget="options" data-attribute="month">october</a>'), {
                        id: 'yearlyDate',
                        dayInMonth: CalendarWidgets.dayInMonth,
                        month: {
                            options: {
                                0: gt("january"),
                                1: gt("february"),
                                2: gt("march"),
                                3: gt("april"),
                                4: gt("may"),
                                5: gt("june"),
                                6: gt("july"),
                                7: gt("august"),
                                8: gt("september"),
                                9: gt("october"),
                                10: gt("november"),
                                11: gt("december")
                            },
                            initial: 2
                        }
                    }),
                    yearlyDay: new ConfigSentence(gt(' every <a href="#" data-widget="options" data-attribute="ordinal">first</a> <a href="#" data-widget="options" data-attribute="day">wednesday</a> in <a href="#" data-widget="options" data-attribute="month">october</a>'), {
                        id: 'yearlyDay',
                        ordinal: {
                            options: {
                                1: gt("first"),
                                2: gt("second"),
                                3: gt("third"),
                                4: gt("fourth"),
                                5: gt("last")
                            }
                        },
                        day: {
                            options: {
                                1: gt("sunday"),
                                2: gt("monday"),
                                4: gt("tuesday"),
                                8: gt("wednesday"),
                                16: gt("thursday"),
                                32: gt("friday"),
                                64: gt("saturday"),
                                62: gt("day of the week"),
                                65: gt("day of the weekend")
                            },
                            initial: 2
                        },
                        month: {
                            options: {
                                0: gt("january"),
                                1: gt("february"),
                                2: gt("march"),
                                3: gt("april"),
                                4: gt("may"),
                                5: gt("june"),
                                6: gt("july"),
                                7: gt("august"),
                                8: gt("september"),
                                9: gt("october"),
                                10: gt("november"),
                                11: gt("december")
                            },
                            initial: 2
                        }
                    })
                };

                var endingOptions = {
                    options: {
                        1: gt('never ends'),
                        2: gt('ends on a specific date'),
                        3: gt('ends after a certain number of appointments')
                    },
                    chooseLabel: function (value) {
                        return gt('ends');
                    }
                };

                this.ends = {
                    never: new ConfigSentence(gt('The series <a href="#" data-attribute="ending" data-widget="options">never ends</a>.'), {
                        id: 'never',
                        ending: _.extend({}, endingOptions, {
                            chooseLabel: function (value) {
                                return gt('never ends');
                            }
                        })
                    }),
                    date: new ConfigSentence(gt('The series <a href="#" data-attribute="ending" data-widget="options">ends</a> on <a href="#" data-attribute="until" data-widget="custom">11/03/2013</a>.'), {
                        id: 'date',
                        ending: endingOptions,
                        until: CalendarWidgets.datePicker
                    }),
                    after: new ConfigSentence(gt('The series <a href="#" data-attribute="ending" data-widget="options">ends</a> <a href="#" data-attribute="occurrences" data-widget="number">after <span class="number-control">2</span> appointments</a>.'), {
                        id: 'after',
                        ending: endingOptions,
                        occurrences: {
                            singular: 'after %1$d appointment',
                            plural: 'after %1$d appointments',
                            initial: 3,
                            gt: gt
                        }
                    })
                };

                _(this.ends).each(function (sentence) {
                    sentence.on("change:ending", function () {
                        var choice = sentence.ending;
                        _(this.ends).each(function (otherSentence) {
                            if (otherSentence !== sentence) {
                                otherSentence.set('ending', choice);
                            }
                        });
                        switch (choice) {
                        case "1":
                            self.setEnding(self.ends.never);
                            break;
                        case "2":
                            self.setEnding(self.ends.date);
                            break;
                        case "3":
                            self.setEnding(self.ends.after);
                            break;
                        }

                        self.updateEndsSpan();
                    });
                });

                this.endsChoice = null;

                this.nodes = {};

                this.nodes.optionList = $('<dl>');

                function prepareMenuEl(sentence) {
                    var $el = sentence.$el.find("a").first().clone().show();
                    $el.find('*').off();
                    $el.on('mouseenter', function () {
                        var $ghost = sentence.$el.clone();
                        $ghost.css({
                            fontStyle: 'italic'
                        });
                        $el.css({
                            textDecoration: 'underline'
                        });
                        if (self.choice) {
                            self.choice.$el.detach();
                        }
                        self.nodes.recurrenceSpan.empty().append($ghost);
                    });
                    $el.on('mouseleave', function () {
                        self.nodes.recurrenceSpan.empty();
                        self.updateRecurrenceSpan();
                        self.updateOptionListState();

                        $el.css({
                            textDecoration: 'none'
                        });
                    });
                    $el.on('click', function () {
                        self.setChoice(sentence);
                        self.nodes.recurrenceSpan.empty().append(sentence.$el);
                        self.userWantsOptionList = false;
                        self.updateOptionListState();
                        self.updateEndsSpan();
                    });

                    return $el;
                }

                function options() {
                    var $ul = $('<ul class="io-ox-recurrence-type-choice">');
                    _(arguments).each(function (sentence) {
                        var $el = prepareMenuEl(sentence);
                        var $li = $("<li>").append(
                            $el
                        );

                        sentence.on('redraw', function () {
                            $li.empty().append(prepareMenuEl(sentence));
                        });

                        $ul.append(
                            $li
                        );
                    });
                    return $('<dd>').append($ul);
                }

                this.nodes.optionList.append(
                    $('<dt>').text("Daily"),
                    options(this.sentences.daily),
                    $('<dt>').text("Weekly"),
                    options(this.sentences.weekly),
                    $('<dt>').text("Monthly"),
                    options(
                        this.sentences.monthlyDate,
                        this.sentences.monthlyDay
                    ),
                    $('<dt>').text("Yearly"),
                    options(
                        this.sentences.yearlyDate,
                        this.sentences.yearlyDay
                    )
                );
                this.nodes.optionList.hide();
                this.nodes.showMore = $('<a href="#">').text("More");
                this.nodes.showMore.hide();
                this.optionListVisible = false;
                this.userWantsOptionList = false;

                this.nodes.showMore.on('click', function () {
                    self.userWantsOptionList = !self.userWantsOptionList;
                    self.updateOptionListState();
                });

                this.updateOptionListState();

                this.nodes.recurrenceSpan = $('<span>');

                this.sentence.on("change", function () {
                    self.updateRecurrenceSpan();
                    self.updateOptionListState();
                    self.updateEndsSpan();
                });

                this.nodes.endsSpan = $('<span>');
                self.updateEndsSpan();

                _("recurrence_type days month day_in_month interval occurrences until".split(" ")).each(function (attr) {
                    self.observeModel("change:" + attr, self.updateState, self);
                });

                self.observeModel("change:start_date", self.updateSuggestions, self);
                self.updateSuggestions();

            },
            updateSuggestions: function () {
                var self = this;
                var startDate = new dateAPI.Local(dateAPI.Local.utc(this.model.get("start_date")));

                var dayBits = 1 << startDate.getDay();
                var dayInMonth = startDate.getDate();
                var month = startDate.getMonth();
                var ordinal = Math.ceil(startDate.getDate() / 7);

                var canUpdate = function (sentence) {
                    // Don't update the chosen sentence carelessly
                    return sentence !== self.choice;
                };

                if (this.previousStartDate) {
                    var previousAttributes = {
                        dayBits: 1 << this.previousStartDate.getDay(),
                        dayInMonth: this.previousStartDate.getDate(),
                        month: this.previousStartDate.getMonth(),
                        ordinal: Math.ceil(this.previousStartDate.getDate() / 7)
                    };
                    canUpdate = function (sentence) {
                        if (sentence !== self.choice) {
                            // Not the chosen sentence, so update the suggestion
                            return true;
                        }

                        // Update the current choice only if it was similar to the previously chosen date
                        if (!_.isUndefined(sentence.days) && ! (sentence.days & previousAttributes.dayBits)) {
                            return false;
                        }
                        if (!_.isUndefined(sentence.day) &&  (sentence.day !== previousAttributes.dayBits)) {
                            return false;
                        }
                        if (!_.isUndefined(sentence.dayInMonth) && (sentence.dayInMonth !== previousAttributes.dayInMonth)) {
                            return false;
                        }
                        if (!_.isUndefined(sentence.month) && (sentence.month !== previousAttributes.month)) {
                            return false;
                        }
                        if (!_.isUndefined(sentence.ordinal) &&  (sentence.ordinal !== previousAttributes.ordinal)) {
                            return false;
                        }
                        return true;
                    };
                }


                // Weekly

                if (canUpdate(this.sentences.weekly)) {
                    if (! (this.sentences.weekly.days & dayBits)) {
                        this.sentences.weekly.set('days', dayBits);
                    }
                }

                // Monthly
                if (canUpdate(this.sentences.monthlyDay)) {
                    this.sentences.monthlyDay.set('day', dayBits);
                    this.sentences.monthlyDay.set('ordinal', ordinal);
                }

                if (canUpdate(this.sentences.monthlyDate)) {
                    this.sentences.monthlyDate.set('dayInMonth', dayInMonth);
                }

                // Yearly

                if (canUpdate(this.sentences.yearlyDay)) {
                    this.sentences.yearlyDay.set('day', dayBits);
                    this.sentences.yearlyDay.set('ordinal', ordinal);
                    this.sentences.yearlyDay.set('month', month);
                }

                if (canUpdate(this.sentences.yearlyDate)) {
                    this.sentences.yearlyDate.set('dayInMonth', dayInMonth);
                    this.sentences.yearlyDate.set('month', month);
                }

                this.previousStartDate = startDate;

            },
            updateRecurrenceSpan: function () {
                if (this.sentence.value === 0) {
                    this.oldChoice = this.choice;
                    this.setChoice(null);
                } else {
                    if (!this.choice) {
                        this.setChoice(this.oldChoice);
                    }
                }
                if (this.choice) {
                    this.nodes.recurrenceSpan.append(this.choice.$el);
                } else {
                    this.nodes.recurrenceSpan.find("span:first").detach();
                }
            },
            updateOptionListState: function () {
                if (this.sentence.value === 1) {
                    if (!this.choice) {
                        // List, No button
                        this.nodes.optionList.show();
                        this.optionListVisible = true;
                        this.nodes.showMore.hide();
                    } else {
                        if (this.userWantsOptionList) {
                            if (!this.optionListVisible) {
                                this.nodes.optionList.show();
                                this.optionListVisible = true;
                            }
                            this.nodes.showMore.show();
                        } else {
                            if (this.optionListVisible) {
                                this.nodes.optionList.hide();
                                this.optionListVisible = false;
                            }
                            this.nodes.showMore.show();
                        }
                    }
                } else {
                    // No List, No Button
                    this.nodes.optionList.hide();
                    this.optionListVisible = false;
                    this.nodes.showMore.hide();
                }
                if (this.optionListVisible) {
                    this.nodes.showMore.text(gt("Hide options"));
                } else {
                    this.nodes.showMore.text(gt("More options"));
                }
            },
            updateEndsSpan: function () {
                this.nodes.endsSpan.find("span:first").detach();
                if (this.choice) {
                    if (!this.endsChoice) {
                        this.setEnding(this.ends.never);
                    }
                    this.nodes.endsSpan.append(this.endsChoice.$el);
                } else {
                    if (this.endsChoice) {
                        this.setEnding(null);
                    }
                }
            },
            updateState: function () {
                if (this.updatingModel) {
                    return;
                }
                this.updatingState = true;
                var type = this.model.get('recurrence_type');
                if (type === RECURRENCE_TYPES.NO_RECURRENCE) {
                    this.sentence.set('value', 0);
                } else {
                    // Choose and configure the correct type of sentence to represent this recurrence
                    switch (type) {
                    case RECURRENCE_TYPES.DAILY:
                        this.setChoice(this.sentences.daily);
                        this.choice.set('interval', this.model.get('interval'));
                        break;
                    case RECURRENCE_TYPES.WEEKLY:
                        this.setChoice(this.sentences.weekly);
                        this.choice.set('interval', this.model.get('interval'));
                        this.choice.set('days', this.model.get('days'));
                        break;
                    case RECURRENCE_TYPES.MONTHLY:
                        if (this.model.get("days")) {
                            this.setChoice(this.sentences.monthlyDay);
                            this.choice.set("ordinal", this.model.get("day_in_month"));
                            this.choice.set("day", this.model.get("days"));
                            this.choice.set("interval", this.model.get("interval"));
                        } else {
                            this.setChoice(this.sentences.monthlyDate);
                            this.choice.set("dayInMonth", this.model.get("day_in_month"));
                            this.choice.set("interval", this.model.get("interval"));
                        }
                        break;
                    case RECURRENCE_TYPES.YEARLY:
                        if (this.model.get("days")) {
                            this.choice = this.sentences.yearlyDay;
                            this.choice.set("ordinal", this.model.get("day_in_month"));
                            this.choice.set("day", this.model.get("days"));
                            this.choice.set("month", this.model.get("month"));
                        } else {
                            this.setChoice(this.sentences.yearlyDate);
                            this.choice.set("month", this.model.get("month"));
                            this.choice.set("dayInMonth", this.model.get("day_in_month"));
                        }
                        break;

                    }

                    if (this.model.get('occurrences')) {
                        this.setEnding(this.ends.after);
                        this.endsChoice.set('occurrences', this.model.get("occurrences"));
                    } else if (this.model.get('until')) {
                        this.setEnding(this.ends.date);
                        this.endsChoice.set("until", this.model.get("until"));
                    } else {
                        this.setEnding(this.ends.never);
                    }

                    this.sentence.set('value', 1);
                }

                this.updateOptionListState();
                this.updateRecurrenceSpan();
                this.updateEndsSpan();

                this.updatingState = false;
            },
            updateModel: function () {
                if (this.updatingState) {
                    return;
                }
                this.updatingModel = true;
                
                this.model.unset('recurrence_type');
                this.model.unset('interval');
                this.model.unset('days');
                this.model.unset('day_in_month');
                this.model.unset('month');
                this.model.unset('occurrences');
                this.model.unset('until');
                
                if (this.choice) {
                    switch (this.choice.id) {
                    case "daily":
                        var daily =  {
                            recurrence_type: RECURRENCE_TYPES.DAILY,
                            interval: this.choice.interval
                        };
                        this.model.set(daily);
                        break;
                    case "weekly":
                        var weekly =  {
                            recurrence_type: RECURRENCE_TYPES.WEEKLY,
                            interval: this.choice.interval,
                            days: this.choice.days
                        };
                        this.model.set(weekly);
                        break;
                    case "monthlyDay":
                        var monthly =  {
                            recurrence_type: RECURRENCE_TYPES.MONTHLY,
                            day_in_month: this.choice.ordinal,
                            days: this.choice.day,
                            interval: this.choice.interval
                        };
                        this.model.set(monthly);
                        break;
                    case "monthlyDate":
                        var monthly =  {
                            recurrence_type: RECURRENCE_TYPES.MONTHLY,
                            day_in_month: this.choice.dayInMonth,
                            interval: this.choice.interval
                        };
                        this.model.set(monthly);
                        break;
                    case "yearlyDay":
                        var yearly =  {
                            recurrence_type: RECURRENCE_TYPES.YEARLY,
                            day_in_month: this.choice.ordinal,
                            days: this.choice.day,
                            month: this.choice.month,
                            interval: 1
                        };
                        this.model.set(yearly);
                        break;
                    case "yearlyDate":
                        var yearly =  {
                            recurrence_type: RECURRENCE_TYPES.YEARLY,
                            day_in_month: this.choice.dayInMonth,
                            month: this.choice.month,
                            interval: 1
                        };
                        this.model.set(yearly);
                        break;
                    }
                    if (this.endsChoice) {
                        switch (this.endsChoice.id) {
                        case "never":
                            break;
                        case "date":
                            this.model.set({
                                until: this.endsChoice.until
                            });
                            break;
                        case "after":
                            this.model.set({
                                occurrences: this.endsChoice.occurrences
                            });
                            break;
                        }
                    }
                } else {
                    // No Recurrence
                    this.model.set({recurrence_type: RECURRENCE_TYPES.NO_RECURRENCE});
                }

                this.updatingModel = false;
            },
            setChoice: function (sentence) {
                if (this.choice) {
                    this.choice.off("change", this.updateModel, this);
                }
                this.choice = sentence;
                if (this.choice) {
                    this.choice.on("change", this.updateModel, this);
                }
                this.updateModel();
            },
            setEnding: function (sentence) {
                if (this.endsChoice) {
                    this.endsChoice.off("change", this.updateModel, this);
                }
                this.endsChoice = sentence;
                if (this.endsChoice) {
                    this.endsChoice.on("change", this.updateModel, this);
                }
                this.updateModel();
            },
            render: function () {
                var self = this;
                this.$el.append(
                    this.sentence.$el,
                    this.nodes.recurrenceSpan,
                    $.txt(". "),
                    this.nodes.endsSpan,
                    "<br>",
                    $('<small class="muted">').append(
                        this.nodes.showMore
                    )
                );

                this.$el.append($('<small>').append(this.nodes.optionList));

                this.updateState();
            }
        }, options);
        
    };
    
    
    return RecurrenceView;
});