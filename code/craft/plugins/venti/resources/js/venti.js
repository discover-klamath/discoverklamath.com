/*!
 * rrule.js - Library for working with recurrence rules for calendar dates.
 * https://github.com/jakubroztocil/rrule
 *
 * Copyright 2010, Jakub Roztocil and Lars Schoning
 * Licenced under the BSD licence.
 * https://github.com/jakubroztocil/rrule/blob/master/LICENCE
 *
 * Based on:
 * python-dateutil - Extensions to the standard Python datetime module.
 * Copyright (c) 2003-2011 - Gustavo Niemeyer <gustavo@niemeyer.net>
 * Copyright (c) 2012 - Tomi Pieviläinen <tomi.pievilainen@iki.fi>
 * https://github.com/jakubroztocil/rrule/blob/master/LICENCE
 *
 */
(function(root){

var serverSide = typeof module !== 'undefined' && module.exports;


var getnlp = function() {
    if (!getnlp._nlp) {
        if (serverSide) {
            // Lazy, runtime import to avoid circular refs.
            getnlp._nlp = require('./nlp')
        } else if (!(getnlp._nlp = root._RRuleNLP)) {
            throw new Error(
                'You need to include rrule/nlp.js for fromText/toText to work.'
            )
        }
    }
    return getnlp._nlp;
};


//=============================================================================
// Date utilities
//=============================================================================

/**
 * General date-related utilities.
 * Also handles several incompatibilities between JavaScript and Python
 *
 */
var dateutil = {

    MONTH_DAYS: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],

    /**
     * Number of milliseconds of one day
     */
    ONE_DAY: 1000 * 60 * 60 * 24,

    /**
     * @see: <http://docs.python.org/library/datetime.html#datetime.MAXYEAR>
     */
    MAXYEAR: 9999,

    /**
     * Python uses 1-Jan-1 as the base for calculating ordinals but we don't
     * want to confuse the JS engine with milliseconds > Number.MAX_NUMBER,
     * therefore we use 1-Jan-1970 instead
     */
    ORDINAL_BASE: new Date(1970, 0, 1),

    /**
     * Python: MO-SU: 0 - 6
     * JS: SU-SAT 0 - 6
     */
    PY_WEEKDAYS: [6, 0, 1, 2, 3, 4, 5],

    /**
     * py_date.timetuple()[7]
     */
    getYearDay: function(date) {
        var dateNoTime = new Date(
            date.getFullYear(), date.getMonth(), date.getDate());
        return Math.ceil(
            (dateNoTime - new Date(date.getFullYear(), 0, 1))
            / dateutil.ONE_DAY) + 1;
    },

    isLeapYear: function(year) {
        if (year instanceof Date) {
            year = year.getFullYear();
        }
        return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
    },

    /**
     * @return {Number} the date's timezone offset in ms
     */
    tzOffset: function(date) {
         return date.getTimezoneOffset() * 60 * 1000
    },

    /**
     * @see: <http://www.mcfedries.com/JavaScript/DaysBetween.asp>
     */
    daysBetween: function(date1, date2) {
        // The number of milliseconds in one day
        // Convert both dates to milliseconds
        var date1_ms = date1.getTime() - dateutil.tzOffset(date1);
        var date2_ms = date2.getTime() - dateutil.tzOffset(date2);
        // Calculate the difference in milliseconds
        var difference_ms = Math.abs(date1_ms - date2_ms);
        // Convert back to days and return
        return Math.round(difference_ms / dateutil.ONE_DAY);
    },

    /**
     * @see: <http://docs.python.org/library/datetime.html#datetime.date.toordinal>
     */
    toOrdinal: function(date) {
        return dateutil.daysBetween(date, dateutil.ORDINAL_BASE);
    },

    /**
     * @see - <http://docs.python.org/library/datetime.html#datetime.date.fromordinal>
     */
    fromOrdinal: function(ordinal) {
        var millisecsFromBase = ordinal * dateutil.ONE_DAY;
        return new Date(dateutil.ORDINAL_BASE.getTime()
                        - dateutil.tzOffset(dateutil.ORDINAL_BASE)
                        +  millisecsFromBase
                        + dateutil.tzOffset(new Date(millisecsFromBase)));
    },

    /**
     * @see: <http://docs.python.org/library/calendar.html#calendar.monthrange>
     */
    monthRange: function(year, month) {
        var date = new Date(year, month, 1);
        return [dateutil.getWeekday(date), dateutil.getMonthDays(date)];
    },

    getMonthDays: function(date) {
        var month = date.getMonth();
        return month == 1 && dateutil.isLeapYear(date)
            ? 29
            : dateutil.MONTH_DAYS[month];
    },

    /**
     * @return {Number} python-like weekday
     */
    getWeekday: function(date) {
        return dateutil.PY_WEEKDAYS[date.getDay()];
    },

    /**
     * @see: <http://docs.python.org/library/datetime.html#datetime.datetime.combine>
     */
    combine: function(date, time) {
        time = time || date;
        return new Date(
            date.getFullYear(), date.getMonth(), date.getDate(),
            time.getHours(), time.getMinutes(), time.getSeconds()
        );
    },

    clone: function(date) {
        var dolly = new Date(date.getTime());
        dolly.setMilliseconds(0);
        return dolly;
    },

    cloneDates: function(dates) {
        var clones = [];
        for (var i = 0; i < dates.length; i++) {
            clones.push(dateutil.clone(dates[i]));
        }
        return clones;
    },

    /**
     * Sorts an array of Date or dateutil.Time objects
     */
    sort: function(dates) {
        dates.sort(function(a, b){
            return a.getTime() - b.getTime();
        });
    },

    timeToUntilString: function(time) {
        var date = new Date(time);
        var comp, comps = [
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            'T',
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            'Z'
        ];
        for (var i = 0; i < comps.length; i++) {
            comp = comps[i];
            if (!/[TZ]/.test(comp) && comp < 10) {
                comps[i] = '0' + String(comp);
            }
        }
        return comps.join('');
    },

    untilStringToDate: function(until) {
        var re = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z)?$/;
        var bits = re.exec(until);
        if (!bits) {
            throw new Error('Invalid UNTIL value: ' + until)
        }
        return new Date(
            Date.UTC(bits[1],
            bits[2] - 1,
            bits[3],
            bits[5] || 0,
            bits[6] || 0,
            bits[7] || 0
        ));
    }

};

dateutil.Time = function(hour, minute, second) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
};

dateutil.Time.prototype = {
    getHours: function() {
        return this.hour;
    },
    getMinutes: function() {
        return this.minute;
    },
    getSeconds: function() {
        return this.second;
    },
    getTime: function() {
        return ((this.hour * 60 * 60)
                 + (this.minute * 60)
                 + this.second)
               * 1000;
    }
};


//=============================================================================
// Helper functions
//=============================================================================


/**
 * Simplified version of python's range()
 */
var range = function(start, end) {
    if (arguments.length === 1) {
        end = start;
        start = 0;
    }
    var rang = [];
    for (var i = start; i < end; i++) {
        rang.push(i);
    }
    return rang;
};
var repeat = function(value, times) {
    var i = 0, array = [];
    if (value instanceof Array) {
        for (; i < times; i++) {
            array[i] = [].concat(value);
        }
    } else {
        for (; i < times; i++) {
            array[i] = value;
        }
    }
    return array;
};


/**
 * closure/goog/math/math.js:modulo
 * Copyright 2006 The Closure Library Authors.
 * The % operator in JavaScript returns the remainder of a / b, but differs from
 * some other languages in that the result will have the same sign as the
 * dividend. For example, -1 % 8 == -1, whereas in some other languages
 * (such as Python) the result would be 7. This function emulates the more
 * correct modulo behavior, which is useful for certain applications such as
 * calculating an offset index in a circular list.
 *
 * @param {number} a The dividend.
 * @param {number} b The divisor.
 * @return {number} a % b where the result is between 0 and b (either 0 <= x < b
 *     or b < x <= 0, depending on the sign of b).
 */
var pymod = function(a, b) {
  var r = a % b;
  // If r and b differ in sign, add b to wrap the result to the correct sign.
  return (r * b < 0) ? r + b : r;
};


/**
 * @see: <http://docs.python.org/library/functions.html#divmod>
 */
var divmod = function(a, b) {
    return {div: Math.floor(a / b), mod: pymod(a, b)};
};


/**
 * Python-like boolean
 * @return {Boolean} value of an object/primitive, taking into account
 * the fact that in Python an empty list's/tuple's
 * boolean value is False, whereas in JS it's true
 */
var plb = function(obj) {
    return (obj instanceof Array && obj.length == 0)
        ? false
        : Boolean(obj);
};


/**
 * Return true if a value is in an array
 */
var contains = function(arr, val) {
    return arr.indexOf(val) != -1;
};


//=============================================================================
// Date masks
//=============================================================================

// Every mask is 7 days longer to handle cross-year weekly periods.

var M365MASK = [].concat(
    repeat(1, 31),  repeat(2, 28),  repeat(3, 31),
    repeat(4, 30),  repeat(5, 31),  repeat(6, 30),
    repeat(7, 31),  repeat(8, 31),  repeat(9, 30),
    repeat(10, 31), repeat(11, 30), repeat(12, 31),
    repeat(1, 7)
);
var M366MASK = [].concat(
    repeat(1, 31),  repeat(2, 29),  repeat(3, 31),
    repeat(4, 30),  repeat(5, 31),  repeat(6, 30),
    repeat(7, 31),  repeat(8, 31),  repeat(9, 30),
    repeat(10, 31), repeat(11, 30), repeat(12, 31),
    repeat(1, 7)
);

var
    M28 = range(1, 29),
    M29 = range(1, 30),
    M30 = range(1, 31),
    M31 = range(1, 32);
var MDAY366MASK = [].concat(
    M31, M29, M31,
    M30, M31, M30,
    M31, M31, M30,
    M31, M30, M31,
    M31.slice(0, 7)
);
var MDAY365MASK = [].concat(
    M31, M28, M31,
    M30, M31, M30,
    M31, M31, M30,
    M31, M30, M31,
    M31.slice(0, 7)
);

M28 = range(-28, 0);
M29 = range(-29, 0);
M30 = range(-30, 0);
M31 = range(-31, 0);
var NMDAY366MASK = [].concat(
    M31, M29, M31,
    M30, M31, M30,
    M31, M31, M30,
    M31, M30, M31,
    M31.slice(0, 7)
);
var NMDAY365MASK = [].concat(
    M31, M28, M31,
    M30, M31, M30,
    M31, M31, M30,
    M31, M30, M31,
    M31.slice(0, 7)
);

var M366RANGE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366];
var M365RANGE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

var WDAYMASK = (function() {
    for (var wdaymask = [], i = 0; i < 55; i++) {
        wdaymask = wdaymask.concat(range(7));
    }
    return wdaymask;
}());


//=============================================================================
// Weekday
//=============================================================================

var Weekday = function(weekday, n) {
    if (n === 0) {
        throw new Error('Can\'t create weekday with n == 0');
    }
    this.weekday = weekday;
    this.n = n;
};

Weekday.prototype = {

    // __call__ - Cannot call the object directly, do it through
    // e.g. RRule.TH.nth(-1) instead,
    nth: function(n) {
        return this.n == n ? this : new Weekday(this.weekday, n);
    },

    // __eq__
    equals: function(other) {
        return this.weekday == other.weekday && this.n == other.n;
    },

    // __repr__
    toString: function() {
        var s = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][this.weekday];
        if (this.n) {
            s = (this.n > 0 ? '+' : '') + String(this.n) + s;
        }
        return s;
    },

    getJsWeekday: function() {
        return this.weekday == 6 ? 0 : this.weekday + 1;
    }

};


//=============================================================================
// RRule
//=============================================================================

/**
 *
 * @param {Object?} options - see <http://labix.org/python-dateutil/#head-cf004ee9a75592797e076752b2a889c10f445418>
 *        The only required option is `freq`, one of RRule.YEARLY, RRule.MONTHLY, ...
 * @constructor
 */
var RRule = function(options, noCache) {

    // RFC string
    this._string = null;

    options = options || {};

    this._cache = noCache ? null : {
        all: false,
        before: [],
        after: [],
        between: []
    };

    // used by toString()
    this.origOptions = {};

    var invalid = [],
        keys = Object.keys(options),
        defaultKeys = Object.keys(RRule.DEFAULT_OPTIONS);

    // Shallow copy for origOptions and check for invalid
    keys.forEach(function(key) {
        this.origOptions[key] = options[key];
        if (!contains(defaultKeys, key)) invalid.push(key);
    }, this);

    if (invalid.length) {
        throw new Error('Invalid options: ' + invalid.join(', '))
    }

    if (!RRule.FREQUENCIES[options.freq] && options.byeaster === null) {
        throw new Error('Invalid frequency: ' + String(options.freq))
    }

    // Merge in default options
    defaultKeys.forEach(function(key) {
        if (!contains(keys, key)) options[key] = RRule.DEFAULT_OPTIONS[key];
    });

    var opts = this.options = options;

    if (opts.byeaster !== null) {
        opts.freq = RRule.YEARLY;
    }

    if (!opts.dtstart) {
        opts.dtstart = new Date();
        opts.dtstart.setMilliseconds(0);
    }

    if (opts.wkst === null) {
        opts.wkst = RRule.MO.weekday;
    } else if (typeof opts.wkst == 'number') {
        // cool, just keep it like that
    } else {
        opts.wkst = opts.wkst.weekday;
    }

    if (opts.bysetpos !== null) {
        if (typeof opts.bysetpos == 'number') {
            opts.bysetpos = [opts.bysetpos];
        }
        for (var i = 0; i < opts.bysetpos.length; i++) {
            var v = opts.bysetpos[i];
            if (v == 0 || !(-366 <= v && v <= 366)) {
                throw new Error(
                    'bysetpos must be between 1 and 366,' +
                        ' or between -366 and -1'
                );
            }
        }
    }

    if (!(plb(opts.byweekno) || plb(opts.byyearday)
        || plb(opts.bymonthday) || opts.byweekday !== null
        || opts.byeaster !== null))
    {
        switch (opts.freq) {
            case RRule.YEARLY:
                if (!opts.bymonth) {
                    opts.bymonth = opts.dtstart.getMonth() + 1;
                }
                opts.bymonthday = opts.dtstart.getDate();
                break;
            case RRule.MONTHLY:
                opts.bymonthday = opts.dtstart.getDate();
                break;
            case RRule.WEEKLY:
                opts.byweekday = dateutil.getWeekday(
                                            opts.dtstart);
                break;
        }
    }

    // bymonth
    if (opts.bymonth !== null
        && !(opts.bymonth instanceof Array)) {
        opts.bymonth = [opts.bymonth];
    }

    // byyearday
    if (opts.byyearday !== null
        && !(opts.byyearday instanceof Array)) {
        opts.byyearday = [opts.byyearday];
    }

    // bymonthday
    if (opts.bymonthday === null) {
        opts.bymonthday = [];
        opts.bynmonthday = [];
    } else if (opts.bymonthday instanceof Array) {
        var bymonthday = [], bynmonthday = [];

        for (i = 0; i < opts.bymonthday.length; i++) {
            var v = opts.bymonthday[i];
            if (v > 0) {
                bymonthday.push(v);
            } else if (v < 0) {
                bynmonthday.push(v);
            }
        }
        opts.bymonthday = bymonthday;
        opts.bynmonthday = bynmonthday;
    } else {
        if (opts.bymonthday < 0) {
            opts.bynmonthday = [opts.bymonthday];
            opts.bymonthday = [];
        } else {
            opts.bynmonthday = [];
            opts.bymonthday = [opts.bymonthday];
        }
    }

    // byweekno
    if (opts.byweekno !== null
        && !(opts.byweekno instanceof Array)) {
        opts.byweekno = [opts.byweekno];
    }

    // byweekday / bynweekday
    if (opts.byweekday === null) {
        opts.bynweekday = null;
    } else if (typeof opts.byweekday == 'number') {
        opts.byweekday = [opts.byweekday];
        opts.bynweekday = null;

    } else if (opts.byweekday instanceof Weekday) {

        if (!opts.byweekday.n || opts.freq > RRule.MONTHLY) {
            opts.byweekday = [opts.byweekday.weekday];
            opts.bynweekday = null;
        } else {
            opts.bynweekday = [
                [opts.byweekday.weekday,
                 opts.byweekday.n]
            ];
            opts.byweekday = null;
        }

    } else {
        var byweekday = [], bynweekday = [];

        for (i = 0; i < opts.byweekday.length; i++) {
            var wday = opts.byweekday[i];

            if (typeof wday == 'number') {
                byweekday.push(wday);
            } else if (!wday.n || opts.freq > RRule.MONTHLY) {
                byweekday.push(wday.weekday);
            } else {
                bynweekday.push([wday.weekday, wday.n]);
            }
        }
        opts.byweekday = plb(byweekday) ? byweekday : null;
        opts.bynweekday = plb(bynweekday) ? bynweekday : null;
    }

    // byhour
    if (opts.byhour === null) {
        opts.byhour = (opts.freq < RRule.HOURLY)
            ? [opts.dtstart.getHours()]
            : null;
    } else if (typeof opts.byhour == 'number') {
        opts.byhour = [opts.byhour];
    }

    // byminute
    if (opts.byminute === null) {
        opts.byminute = (opts.freq < RRule.MINUTELY)
            ? [opts.dtstart.getMinutes()]
            : null;
    } else if (typeof opts.byminute == 'number') {
        opts.byminute = [opts.byminute];
    }

    // bysecond
    if (opts.bysecond === null) {
        opts.bysecond = (opts.freq < RRule.SECONDLY)
            ? [opts.dtstart.getSeconds()]
            : null;
    } else if (typeof opts.bysecond == 'number') {
        opts.bysecond = [opts.bysecond];
    }

    if (opts.freq >= RRule.HOURLY) {
        this.timeset = null;
    } else {
        this.timeset = [];
        for (i = 0; i < opts.byhour.length; i++) {
            var hour = opts.byhour[i];
            for (var j = 0; j < opts.byminute.length; j++) {
                var minute = opts.byminute[j];
                for (var k = 0; k < opts.bysecond.length; k++) {
                    var second = opts.bysecond[k];
                    // python:
                    // datetime.time(hour, minute, second,
                    // tzinfo=self._tzinfo))
                    this.timeset.push(new dateutil.Time(hour, minute, second));
                }
            }
        }
        dateutil.sort(this.timeset);
    }

};
//}}}

// RRule class 'constants'

RRule.FREQUENCIES = [
    'YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY',
    'HOURLY', 'MINUTELY', 'SECONDLY'
];

RRule.YEARLY   = 0;
RRule.MONTHLY  = 1;
RRule.WEEKLY   = 2;
RRule.DAILY    = 3;
RRule.HOURLY   = 4;
RRule.MINUTELY = 5;
RRule.SECONDLY = 6;

RRule.MO = new Weekday(0);
RRule.TU = new Weekday(1);
RRule.WE = new Weekday(2);
RRule.TH = new Weekday(3);
RRule.FR = new Weekday(4);
RRule.SA = new Weekday(5);
RRule.SU = new Weekday(6);

RRule.DEFAULT_OPTIONS = {
    freq:        null,
    dtstart:     null,
    interval:    1,
    wkst:        RRule.MO,
    count:      null,
    until:      null,
    bysetpos:    null,
    bymonth:     null,
    bymonthday:  null,
    byyearday:   null,
    byweekno:    null,
    byweekday:   null,
    byhour:      null,
    byminute:    null,
    bysecond:    null,
    byeaster:    null
};



RRule.parseText = function(text, language) {
    return getnlp().parseText(text, language)
};

RRule.fromText = function(text, language) {
    return getnlp().fromText(text, language)
};

RRule.optionsToString = function(options) {
    var key, keys, defaultKeys, value, strValues, pairs = [];

    keys = Object.keys(options);
    defaultKeys = Object.keys(RRule.DEFAULT_OPTIONS);

    for (var i = 0; i < keys.length; i++) {

        if (!contains(defaultKeys, keys[i])) continue;

        key = keys[i].toUpperCase();
        value = options[keys[i]];
        strValues = [];

        if (value === null || value instanceof Array && !value.length) {
            continue;
        }

        switch (key) {
            case 'FREQ':
                value = RRule.FREQUENCIES[options.freq];
                break;
            case 'WKST':
                value = value.toString();
                break;
            case 'BYWEEKDAY':
                /*
                NOTE: BYWEEKDAY is a special case.
                RRule() deconstructs the rule.options.byweekday array
                into an array of Weekday arguments.
                On the other hand, rule.origOptions is an array of Weekdays.
                We need to handle both cases here.
                It might be worth change RRule to keep the Weekdays.

                Also, BYWEEKDAY (used by RRule) vs. BYDAY (RFC)

                */
                key = 'BYDAY';
                if (!(value instanceof Array)) {
                    value = [value];
                }
                for (var wday, j = 0; j < value.length; j++) {
                    wday = value[j];
                    if (wday instanceof Weekday) {
                        // good
                    } else if (wday instanceof Array) {
                        wday = new Weekday(wday[0], wday[1]);
                    } else {
                        wday = new Weekday(wday);
                    }
                    strValues[j] = wday.toString();
                }
                value = strValues;
                break;
            case'DTSTART':
            case'UNTIL':
                value = dateutil.timeToUntilString(value);
                break;
            default:
                if (value instanceof Array) {
                    for (var j = 0; j < value.length; j++) {
                        strValues[j] = String(value[j]);
                    }
                    value = strValues;
                } else {
                    value = String(value);
                }

        }
        pairs.push([key, value]);
    }

    var strings = [];
    for (var i = 0; i < pairs.length; i++) {
        var attr = pairs[i];
        strings.push(attr[0] + '=' + attr[1].toString());
    }
    return strings.join(';');

};

RRule.prototype = {

    /**
     * @param {Function} iterator - optional function that will be called
     *                   on each date that is added. It can return false
     *                   to stop the iteration.
     * @return Array containing all recurrences.
     */
    all: function(iterator) {
        if (iterator) {
            return this._iter(new CallbackIterResult('all', {}, iterator));
        } else {
            var result = this._cacheGet('all');
            if (result === false) {
                result = this._iter(new IterResult('all', {}));
                this._cacheAdd('all', result);
            }
            return result;
        }
    },

    /**
     * Returns all the occurrences of the rrule between after and before.
     * The inc keyword defines what happens if after and/or before are
     * themselves occurrences. With inc == True, they will be included in the
     * list, if they are found in the recurrence set.
     * @return Array
     */
    between: function(after, before, inc, iterator) {
        var args = {
                before: before,
                after: after,
                inc: inc
            }

        if (iterator) {
            return this._iter(
                new CallbackIterResult('between', args, iterator));
        } else {
            var result = this._cacheGet('between', args);
            if (result === false) {
                result = this._iter(new IterResult('between', args));
                this._cacheAdd('between', result, args);
            }
            return result;
        }
    },

    /**
     * Returns the last recurrence before the given datetime instance.
     * The inc keyword defines what happens if dt is an occurrence.
     * With inc == True, if dt itself is an occurrence, it will be returned.
     * @return Date or null
     */
    before: function(dt, inc) {
        var args = {
                dt: dt,
                inc: inc
            },
            result = this._cacheGet('before', args);
        if (result === false) {
            result = this._iter(new IterResult('before', args));
            this._cacheAdd('before', result, args);
        }
        return result;
    },

    /**
     * Returns the first recurrence after the given datetime instance.
     * The inc keyword defines what happens if dt is an occurrence.
     * With inc == True, if dt itself is an occurrence, it will be returned.
     * @return Date or null
     */
    after: function(dt, inc) {
        var args = {
                dt: dt,
                inc: inc
            },
            result = this._cacheGet('after', args);
        if (result === false) {
            result = this._iter(new IterResult('after', args));
            this._cacheAdd('after', result, args);
        }
        return result;
    },

    /**
     * Returns the number of recurrences in this set. It will have go trough
     * the whole recurrence, if this hasn't been done before.
     */
    count: function() {
        return this.all().length;
    },

    /**
     * Converts the rrule into its string representation
     * @see <http://www.ietf.org/rfc/rfc2445.txt>
     * @return String
     */
    toString: function() {
        return RRule.optionsToString(this.origOptions);
    },

	/**
	* Will convert all rules described in nlp:ToText
	* to text.
	*/
	toText: function(gettext, language) {
        return getnlp().toText(this, gettext, language);
	},

    isFullyConvertibleToText: function() {
        return getnlp().isFullyConvertible(this)
    },

    /**
     * @param {String} what - all/before/after/between
     * @param {Array,Date} value - an array of dates, one date, or null
     * @param {Object?} args - _iter arguments
     */
    _cacheAdd: function(what, value, args) {

        if (!this._cache) return;

        if (value) {
            value = (value instanceof Date)
                        ? dateutil.clone(value)
                        : dateutil.cloneDates(value);
        }

        if (what == 'all') {
                this._cache.all = value;
        } else {
            args._value = value;
            this._cache[what].push(args);
        }

    },

    /**
     * @return false - not in the cache
     *         null  - cached, but zero occurrences (before/after)
     *         Date  - cached (before/after)
     *         []    - cached, but zero occurrences (all/between)
     *         [Date1, DateN] - cached (all/between)
     */
    _cacheGet: function(what, args) {

        if (!this._cache) {
            return false;
        }

        var cached = false;

        if (what == 'all') {
            cached = this._cache.all;
        } else {
            // Let's see whether we've already called the
            // 'what' method with the same 'args'
            loopItems:
            for (var item, i = 0; i < this._cache[what].length; i++) {
                item = this._cache[what][i];
                for (var k in args) {
                    if (args.hasOwnProperty(k)
                        && String(args[k]) != String(item[k])) {
                        continue loopItems;
                    }
                }
                cached = item._value;
                break;
            }
        }

        if (!cached && this._cache.all) {
            // Not in the cache, but we already know all the occurrences,
            // so we can find the correct dates from the cached ones.
            var iterResult = new IterResult(what, args);
            for (var i = 0; i < this._cache.all.length; i++) {
                if (!iterResult.accept(this._cache.all[i])) {
                    break;
                }
            }
            cached = iterResult.getValue();
            this._cacheAdd(what, cached, args);
        }

        return cached instanceof Array
            ? dateutil.cloneDates(cached)
            : (cached instanceof Date
                ? dateutil.clone(cached)
                : cached);
    },

    /**
     * @return a RRule instance with the same freq and options
     *          as this one (cache is not cloned)
     */
    clone: function() {
        return new RRule(this.origOptions);
    },

    _iter: function(iterResult) {

        /* Since JavaScript doesn't have the python's yield operator (<1.7),
           we use the IterResult object that tells us when to stop iterating.

        */

        var dtstart = this.options.dtstart;

        var
            year = dtstart.getFullYear(),
            month = dtstart.getMonth() + 1,
            day = dtstart.getDate(),
            hour = dtstart.getHours(),
            minute = dtstart.getMinutes(),
            second = dtstart.getSeconds(),
            weekday = dateutil.getWeekday(dtstart),
            yearday = dateutil.getYearDay(dtstart);

        // Some local variables to speed things up a bit
        var
            freq = this.options.freq,
            interval = this.options.interval,
            wkst = this.options.wkst,
            until = this.options.until,
            bymonth = this.options.bymonth,
            byweekno = this.options.byweekno,
            byyearday = this.options.byyearday,
            byweekday = this.options.byweekday,
            byeaster = this.options.byeaster,
            bymonthday = this.options.bymonthday,
            bynmonthday = this.options.bynmonthday,
            bysetpos = this.options.bysetpos,
            byhour = this.options.byhour,
            byminute = this.options.byminute,
            bysecond = this.options.bysecond;

        var ii = new Iterinfo(this);
        ii.rebuild(year, month);

        var getdayset = {};
        getdayset[RRule.YEARLY]   = ii.ydayset;
        getdayset[RRule.MONTHLY]  = ii.mdayset;
        getdayset[RRule.WEEKLY]   = ii.wdayset;
        getdayset[RRule.DAILY]    = ii.ddayset;
        getdayset[RRule.HOURLY]   = ii.ddayset;
        getdayset[RRule.MINUTELY] = ii.ddayset;
        getdayset[RRule.SECONDLY] = ii.ddayset;

        getdayset = getdayset[freq];

        var timeset;
        if (freq < RRule.HOURLY) {
            timeset = this.timeset;
        } else {
            var gettimeset = {};
            gettimeset[RRule.HOURLY]   = ii.htimeset;
            gettimeset[RRule.MINUTELY] = ii.mtimeset;
            gettimeset[RRule.SECONDLY] = ii.stimeset;
            gettimeset = gettimeset[freq];
            if ((freq >= RRule.HOURLY   && plb(byhour)   && !contains(byhour, hour)) ||
                (freq >= RRule.MINUTELY && plb(byminute) && !contains(byminute, minute)) ||
                (freq >= RRule.SECONDLY && plb(bysecond) && !contains(bysecond, minute)))
            {
                timeset = [];
            } else {
                timeset = gettimeset.call(ii, hour, minute, second);
            }
        }

        var filtered, total = 0, count = this.options.count;

        var iterNo = 0;

        var i, j, k, dm, div, mod, tmp, pos, dayset, start, end, fixday;

        while (true) {

            // Get dayset with the right frequency
            tmp = getdayset.call(ii, year, month, day);
            dayset = tmp[0]; start = tmp[1]; end = tmp[2];

            // Do the "hard" work ;-)
            filtered = false;
            for (j = start; j < end; j++) {

                i = dayset[j];

                if ((plb(bymonth) && !contains(bymonth, ii.mmask[i])) ||
                    (plb(byweekno) && !ii.wnomask[i]) ||
                    (plb(byweekday) && !contains(byweekday, ii.wdaymask[i])) ||
                    (plb(ii.nwdaymask) && !ii.nwdaymask[i]) ||
                    (byeaster !== null && !contains(ii.eastermask, i)) ||
                    (
                        (plb(bymonthday) || plb(bynmonthday)) &&
                        !contains(bymonthday, ii.mdaymask[i]) &&
                        !contains(bynmonthday, ii.nmdaymask[i])
                    )
                    ||
                    (
                        plb(byyearday)
                        &&
                        (
                            (
                                i < ii.yearlen &&
                                !contains(byyearday, i + 1) &&
                                !contains(byyearday, -ii.yearlen + i)
                            )
                            ||
                            (
                                i >= ii.yearlen &&
                                !contains(byyearday, i + 1 - ii.yearlen) &&
                                !contains(byyearday, -ii.nextyearlen + i - ii.yearlen)
                            )
                        )
                    )
                )
                {
                    dayset[i] = null;
                    filtered = true;
                }
            }

            // Output results
            if (plb(bysetpos) && plb(timeset)) {

                var daypos, timepos, poslist = [];

                for (i, j = 0; j < bysetpos.length; j++) {
                    var pos = bysetpos[j];
                    if (pos < 0) {
                        daypos = Math.floor(pos / timeset.length);
                        timepos = pymod(pos, timeset.length);
                    } else {
                        daypos = Math.floor((pos - 1) / timeset.length);
                        timepos = pymod((pos - 1), timeset.length);
                    }

                    try {
                        tmp = [];
                        for (k = start; k < end; k++) {
                            var val = dayset[k];
                            if (val === null) {
                                continue;
                            }
                            tmp.push(val);
                        }
                        if (daypos < 0) {
                            // we're trying to emulate python's aList[-n]
                            i = tmp.slice(daypos)[0];
                        } else {
                            i = tmp[daypos];
                        }

                        var time = timeset[timepos];

                        var date = dateutil.fromOrdinal(ii.yearordinal + i);
                        var res = dateutil.combine(date, time);
                        // XXX: can this ever be in the array?
                        // - compare the actual date instead?
                        if (!contains(poslist, res)) {
                            poslist.push(res);
                        }
                    } catch (e) {}
                }

                dateutil.sort(poslist);

                for (j = 0; j < poslist.length; j++) {
                    var res = poslist[j];
                    if (until && res > until) {
                        this._len = total;
                        return iterResult.getValue();
                    } else if (res >= dtstart) {
                        ++total;
                        if (!iterResult.accept(res)) {
                            return iterResult.getValue();
                        }
                        if (count) {
                            --count;
                            if (!count) {
                                this._len = total;
                                return iterResult.getValue();
                            }
                        }
                    }
                }

            } else {
                for (j = start; j < end; j++) {
                    i = dayset[j];
                    if (i !== null) {
                        var date = dateutil.fromOrdinal(ii.yearordinal + i);
                        for (k = 0; k < timeset.length; k++) {
                            var time = timeset[k];
                            var res = dateutil.combine(date, time);
                            if (until && res > until) {
                                this._len = total;
                                return iterResult.getValue();
                            } else if (res >= dtstart) {
                                ++total;
                                if (!iterResult.accept(res)) {
                                    return iterResult.getValue();
                                }
                                if (count) {
                                    --count;
                                    if (!count) {
                                        this._len = total;
                                        return iterResult.getValue();
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Handle frequency and interval
            fixday = false;
            if (freq == RRule.YEARLY) {
                year += interval;
                if (year > dateutil.MAXYEAR) {
                    this._len = total;
                    return iterResult.getValue();
                }
                ii.rebuild(year, month);
            } else if (freq == RRule.MONTHLY) {
                month += interval;
                if (month > 12) {
                    div = Math.floor(month / 12);
                    mod = pymod(month, 12);
                    month = mod;
                    year += div;
                    if (month == 0) {
                        month = 12;
                        --year;
                    }
                    if (year > dateutil.MAXYEAR) {
                        this._len = total;
                        return iterResult.getValue();
                    }
                }
                ii.rebuild(year, month);
            } else if (freq == RRule.WEEKLY) {
                if (wkst > weekday) {
                    day += -(weekday + 1 + (6 - wkst)) + interval * 7;
                } else {
                    day += -(weekday - wkst) + interval * 7;
                }
                weekday = wkst;
                fixday = true;
            } else if (freq == RRule.DAILY) {
                day += interval;
                fixday = true;
            } else if (freq == RRule.HOURLY) {
                if (filtered) {
                    // Jump to one iteration before next day
                    hour += Math.floor((23 - hour) / interval) * interval;
                }
                while (true) {
                    hour += interval;
                    dm = divmod(hour, 24);
                    div = dm.div;
                    mod = dm.mod;
                    if (div) {
                        hour = mod;
                        day += div;
                        fixday = true;
                    }
                    if (!plb(byhour) || contains(byhour, hour)) {
                        break;
                    }
                }
                timeset = gettimeset.call(ii, hour, minute, second);
            } else if (freq == RRule.MINUTELY) {
                if (filtered) {
                    // Jump to one iteration before next day
                    minute += Math.floor(
                        (1439 - (hour * 60 + minute)) / interval) * interval;
                }
                while(true) {
                    minute += interval;
                    dm = divmod(minute, 60);
                    div = dm.div;
                    mod = dm.mod;
                    if (div) {
                        minute = mod;
                        hour += div;
                        dm = divmod(hour, 24);
                        div = dm.div;
                        mod = dm.mod;
                        if (div) {
                            hour = mod;
                            day += div;
                            fixday = true;
                            filtered = false;
                        }
                    }
                    if ((!plb(byhour) || contains(byhour, hour)) &&
                        (!plb(byminute) || contains(byminute, minute))) {
                        break;
                    }
                }
                timeset = gettimeset.call(ii, hour, minute, second);
            } else if (freq == RRule.SECONDLY) {
                if (filtered) {
                    // Jump to one iteration before next day
                    second += Math.floor(
                        (86399 - (hour * 3600 + minute * 60 + second))
                        / interval) * interval;
                }
                while (true) {
                    second += interval;
                    dm = divmod(second, 60);
                    div = dm.div;
                    mod = dm.mod;
                    if (div) {
                        second = mod;
                        minute += div;
                        dm = divmod(minute, 60);
                        div = dm.div;
                        mod = dm.mod;
                        if (div) {
                            minute = mod;
                            hour += div;
                            dm = divmod(hour, 24);
                            div = dm.div;
                            mod = dm.mod;
                            if (div) {
                                hour = mod;
                                day += div;
                                fixday = true;
                            }
                        }
                    }
                    if ((!plb(byhour) || contains(byhour, hour)) &&
                        (!plb(byminute) || contains(byminute, minute)) &&
                        (!plb(bysecond) || contains(bysecond, second)))
                    {
                        break;
                    }
                }
                timeset = gettimeset.call(ii, hour, minute, second);
            }

            if (fixday && day > 28) {
                var daysinmonth = dateutil.monthRange(year, month - 1)[1];
                if (day > daysinmonth) {
                    while (day > daysinmonth) {
                        day -= daysinmonth;
                        ++month;
                        if (month == 13) {
                            month = 1;
                            ++year;
                            if (year > dateutil.MAXYEAR) {
                                this._len = total;
                                return iterResult.getValue();
                            }
                        }
                        daysinmonth = dateutil.monthRange(year, month - 1)[1];
                    }
                    ii.rebuild(year, month);
                }
            }
        }
    }

};


RRule.parseString = function(rfcString) {
    rfcString = rfcString.replace(/^\s+|\s+$/, '');
    if (!rfcString.length) {
        return null;
    }

    var i, j, key, value, attr,
        attrs = rfcString.split(';'),
        options = {};

    for (i = 0; i < attrs.length; i++) {
        attr = attrs[i].split('=');
        key = attr[0];
        value = attr[1];
        switch (key) {
            case 'FREQ':
                options.freq = RRule[value];
                break;
            case 'WKST':
                options.wkst = RRule[value];
                break;
            case 'COUNT':
            case 'INTERVAL':
            case 'BYSETPOS':
            case 'BYMONTH':
            case 'BYMONTHDAY':
            case 'BYYEARDAY':
            case 'BYWEEKNO':
            case 'BYHOUR':
            case 'BYMINUTE':
            case 'BYSECOND':
                if (value.indexOf(',') != -1) {
                    value = value.split(',');
                    for (j = 0; j < value.length; j++) {
                        if (/^[+-]?\d+$/.test(value[j])) {
                            value[j] = Number(value[j]);
                        }
                    }
                } else if (/^[+-]?\d+$/.test(value)) {
                    value = Number(value);
                }
                key = key.toLowerCase();
                options[key] = value;
                break;
            case 'BYDAY': // => byweekday
                var n, wday, day, days = value.split(',');
                options.byweekday = [];
                for (j = 0; j < days.length; j++) {
                    day = days[j];
                    if (day.length == 2) { // MO, TU, ...
                        wday = RRule[day]; // wday instanceof Weekday
                        options.byweekday.push(wday);
                    } else { // -1MO, +3FR, 1SO, ...
                        day = day.match(/^([+-]?\d)([A-Z]{2})$/);
                        n = Number(day[1]);
                        wday = day[2];
                        wday = RRule[wday].weekday;
                        options.byweekday.push(new Weekday(wday, n));
                    }
                }
                break;
            case 'DTSTART':
                options.dtstart = dateutil.untilStringToDate(value);
                break;
            case 'UNTIL':
                options.until = dateutil.untilStringToDate(value);
                break;
            case 'BYEASTER':
                options.byeaster = Number(value);
                break;
            default:
                throw new Error("Unknown RRULE property '" + key + "'");
        }
    }
    return options;
};


RRule.fromString = function(string) {
    return new RRule(RRule.parseString(string));
};


//=============================================================================
// Iterinfo
//=============================================================================

var Iterinfo = function(rrule) {
    this.rrule = rrule;
    this.lastyear = null;
    this.lastmonth = null;
    this.yearlen = null;
    this.nextyearlen = null;
    this.yearordinal = null;
    this.yearweekday = null;
    this.mmask = null;
    this.mrange = null;
    this.mdaymask = null;
    this.nmdaymask = null;
    this.wdaymask = null;
    this.wnomask = null;
    this.nwdaymask = null;
    this.eastermask = null;
};

Iterinfo.prototype.easter = function(y, offset) {
    offset = offset || 0;

    var a = y % 19,
        b = Math.floor(y / 100),
        c = y % 100,
        d = Math.floor(b / 4),
        e = b % 4,
        f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3),
        h = Math.floor(19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4),
        k = c % 4,
        l = Math.floor(32 + 2 * e + 2 * i - h - k) % 7,
        m = Math.floor((a + 11 * h + 22 * l) / 451),
        month = Math.floor((h + l - 7 * m + 114) / 31),
        day = (h + l - 7 * m + 114) % 31 + 1,
        date = Date.UTC(y, month - 1, day + offset),
        yearStart = Date.UTC(y, 0, 1);

    return [ Math.ceil((date - yearStart) / (1000 * 60 * 60 * 24)) ];
}

Iterinfo.prototype.rebuild = function(year, month) {

    var rr = this.rrule;

    if (year != this.lastyear) {

        this.yearlen = dateutil.isLeapYear(year) ? 366 : 365;
        this.nextyearlen = dateutil.isLeapYear(year + 1) ? 366 : 365;
        var firstyday = new Date(year, 0, 1);

        this.yearordinal = dateutil.toOrdinal(firstyday);
        this.yearweekday = dateutil.getWeekday(firstyday);

        var wday = dateutil.getWeekday(new Date(year, 0, 1));

        if (this.yearlen == 365) {
            this.mmask = [].concat(M365MASK);
            this.mdaymask = [].concat(MDAY365MASK);
            this.nmdaymask = [].concat(NMDAY365MASK);
            this.wdaymask = WDAYMASK.slice(wday);
            this.mrange = [].concat(M365RANGE);
        } else {
            this.mmask = [].concat(M366MASK);
            this.mdaymask = [].concat(MDAY366MASK);
            this.nmdaymask = [].concat(NMDAY366MASK);
            this.wdaymask = WDAYMASK.slice(wday);
            this.mrange = [].concat(M366RANGE);
        }

        if (!plb(rr.options.byweekno)) {
            this.wnomask = null;
        } else {
            this.wnomask = repeat(0, this.yearlen + 7);
            var no1wkst, firstwkst, wyearlen;
            no1wkst = firstwkst = pymod(
                7 - this.yearweekday + rr.options.wkst, 7);
            if (no1wkst >= 4) {
                no1wkst = 0;
                // Number of days in the year, plus the days we got
                // from last year.
                wyearlen = this.yearlen + pymod(
                    this.yearweekday - rr.options.wkst, 7);
            } else {
                // Number of days in the year, minus the days we
                // left in last year.
                wyearlen = this.yearlen - no1wkst;
            }
            var div = Math.floor(wyearlen / 7);
            var mod = pymod(wyearlen, 7);
            var numweeks = Math.floor(div + (mod / 4));
            for (var n, i, j = 0; j < rr.options.byweekno.length; j++) {
                n = rr.options.byweekno[j];
                if (n < 0) {
                    n += numweeks + 1;
                } if (!(0 < n && n <= numweeks)) {
                    continue;
                } if (n > 1) {
                    i = no1wkst + (n - 1) * 7;
                    if (no1wkst != firstwkst) {
                        i -= 7-firstwkst;
                    }
                } else {
                    i = no1wkst;
                }
                for (var k = 0; k < 7; k++) {
                    this.wnomask[i] = 1;
                    i++;
                    if (this.wdaymask[i] == rr.options.wkst) {
                        break;
                    }
                }
            }

            if (contains(rr.options.byweekno, 1)) {
                // Check week number 1 of next year as well
                // orig-TODO : Check -numweeks for next year.
                var i = no1wkst + numweeks * 7;
                if (no1wkst != firstwkst) {
                    i -= 7 - firstwkst;
                }
                if (i < this.yearlen) {
                    // If week starts in next year, we
                    // don't care about it.
                    for (var j = 0; j < 7; j++) {
                        this.wnomask[i] = 1;
                        i += 1;
                        if (this.wdaymask[i] == rr.options.wkst) {
                            break;
                        }
                    }
                }
            }

            if (no1wkst) {
                // Check last week number of last year as
                // well. If no1wkst is 0, either the year
                // started on week start, or week number 1
                // got days from last year, so there are no
                // days from last year's last week number in
                // this year.
                var lnumweeks;
                if (!contains(rr.options.byweekno, -1)) {
                    var lyearweekday = dateutil.getWeekday(
                        new Date(year - 1, 0, 1));
                    var lno1wkst = pymod(
                        7 - lyearweekday + rr.options.wkst, 7);
                    var lyearlen = dateutil.isLeapYear(year - 1) ? 366 : 365;
                    if (lno1wkst >= 4) {
                        lno1wkst = 0;
                        lnumweeks = Math.floor(
                            52
                            + pymod(
                                lyearlen + pymod(
                                    lyearweekday - rr.options.wkst, 7), 7)
                            / 4);
                    } else {
                        lnumweeks = Math.floor(
                            52 + pymod(this.yearlen - no1wkst, 7) / 4);
                    }
                } else {
                    lnumweeks = -1;
                }
                if (contains(rr.options.byweekno, lnumweeks)) {
                    for (var i = 0; i < no1wkst; i++) {
                        this.wnomask[i] = 1;
                    }
                }
            }
        }
    }

    if (plb(rr.options.bynweekday)
        && (month != this.lastmonth || year != this.lastyear)) {
        var ranges = [];
        if (rr.options.freq == RRule.YEARLY) {
            if (plb(rr.options.bymonth)) {
                for (j = 0; j < rr.options.bymonth.length; j++) {
                    month = rr.options.bymonth[j];
                    ranges.push(this.mrange.slice(month - 1, month + 1));
                }
            } else {
                ranges = [[0, this.yearlen]];
            }
        } else if (rr.options.freq == RRule.MONTHLY) {
            ranges = [this.mrange.slice(month - 1, month + 1)];
        }
        if (plb(ranges)) {
            // Weekly frequency won't get here, so we may not
            // care about cross-year weekly periods.
            this.nwdaymask = repeat(0, this.yearlen);

            for (var j = 0; j < ranges.length; j++) {
                var rang = ranges[j];
                var first = rang[0], last = rang[1];
                last -= 1;
                for (var k = 0; k < rr.options.bynweekday.length; k++) {
                    var wday = rr.options.bynweekday[k][0],
                        n = rr.options.bynweekday[k][1];
                    if (n < 0) {
                        i = last + (n + 1) * 7;
                        i -= pymod(this.wdaymask[i] - wday, 7);
                    } else {
                        i = first + (n - 1) * 7;
                        i += pymod(7 - this.wdaymask[i] + wday, 7);
                    }
                    if (first <= i && i <= last) {
                        this.nwdaymask[i] = 1;
                    }
                }
            }

        }

        this.lastyear = year;
        this.lastmonth = month;
    }

    if (rr.options.byeaster !== null) {
        this.eastermask = this.easter(year, rr.options.byeaster);
    }
};

Iterinfo.prototype.ydayset = function(year, month, day) {
    return [range(this.yearlen), 0, this.yearlen];
};

Iterinfo.prototype.mdayset = function(year, month, day) {
    var set = repeat(null, this.yearlen);
    var start = this.mrange[month-1];
    var end = this.mrange[month];
    for (var i = start; i < end; i++) {
        set[i] = i;
    }
    return [set, start, end];
};

Iterinfo.prototype.wdayset = function(year, month, day) {

    // We need to handle cross-year weeks here.
    var set = repeat(null, this.yearlen + 7);
    var i = dateutil.toOrdinal(
        new Date(year, month - 1, day)) - this.yearordinal;
    var start = i;
    for (var j = 0; j < 7; j++) {
        set[i] = i;
        ++i;
        if (this.wdaymask[i] == this.rrule.options.wkst) {
            break;
        }
    }
    return [set, start, i];
};

Iterinfo.prototype.ddayset = function(year, month, day) {
    var set = repeat(null, this.yearlen);
    var i = dateutil.toOrdinal(
        new Date(year, month - 1, day)) - this.yearordinal;
    set[i] = i;
    return [set, i, i + 1];
};

Iterinfo.prototype.htimeset = function(hour, minute, second) {
    var set = [], rr = this.rrule;
    for (var i = 0; i < rr.options.byminute.length; i++) {
        minute = rr.options.byminute[i];
        for (var j = 0; j < rr.options.bysecond.length; j++) {
            second = rr.options.bysecond[j];
            set.push(new dateutil.Time(hour, minute, second));
        }
    }
    dateutil.sort(set);
    return set;
};

Iterinfo.prototype.mtimeset = function(hour, minute, second) {
    var set = [], rr = this.rrule;
    for (var j = 0; j < rr.options.bysecond.length; j++) {
        second = rr.options.bysecond[j];
        set.push(new dateutil.Time(hour, minute, second));
    }
    dateutil.sort(set);
    return set;
};

Iterinfo.prototype.stimeset = function(hour, minute, second) {
    return [new dateutil.Time(hour, minute, second)];
};


//=============================================================================
// Results
//=============================================================================

/**
 * This class helps us to emulate python's generators, sorta.
 */
var IterResult = function(method, args) {
    this.init(method, args)
};

IterResult.prototype = {

    init: function(method, args) {
        this.method = method;
        this.args = args;

        this._result = [];

        this.minDate = null;
        this.maxDate = null;

        if (method == 'between') {
            this.maxDate = args.inc
                ? args.before
                : new Date(args.before.getTime() - 1);
            this.minDate = args.inc
                ? args.after
                : new Date(args.after.getTime() + 1);
        } else if (method == 'before') {
            this.maxDate = args.inc ? args.dt : new Date(args.dt.getTime() - 1);
        } else if (method == 'after') {
            this.minDate = args.inc ? args.dt : new Date(args.dt.getTime() + 1);
        }
    },

    /**
     * Possibly adds a date into the result.
     *
     * @param {Date} date - the date isn't necessarly added to the result
     *                      list (if it is too late/too early)
     * @return {Boolean} true if it makes sense to continue the iteration;
     *                   false if we're done.
     */
    accept: function(date) {
        var tooEarly = this.minDate && date < this.minDate,
            tooLate = this.maxDate && date > this.maxDate;

        if (this.method == 'between') {
            if (tooEarly)
                return true;
            if (tooLate)
                return false;
        } else if (this.method == 'before') {
            if (tooLate)
                return false;
        } else if (this.method == 'after') {
            if (tooEarly)
                return true;
            this.add(date);
            return false;
        }

        return this.add(date);

    },

    /**
     *
     * @param {Date} date that is part of the result.
     * @return {Boolean} whether we are interested in more values.
     */
    add: function(date) {
        this._result.push(date);
        return true;
    },

    /**
     * 'before' and 'after' return only one date, whereas 'all'
     * and 'between' an array.
     * @return {Date,Array?}
     */
    getValue: function() {
        switch (this.method) {
            case 'all':
            case 'between':
                return this._result;
            case 'before':
            case 'after':
                return this._result.length
                    ? this._result[this._result.length - 1]
                    : null;
        }
    }

};


/**
 * IterResult subclass that calls a callback function on each add,
 * and stops iterating when the callback returns false.
 */
var CallbackIterResult = function(method, args, iterator) {
    var allowedMethods = ['all', 'between'];
    if (!contains(allowedMethods, method)) {
        throw new Error('Invalid method "' + method
            + '". Only all and between works with iterator.');
    }
    this.add = function(date) {
        if (iterator(date, this._result.length)) {
            this._result.push(date);
            return true;
        }
        return false;

    };

    this.init(method, args);

};
CallbackIterResult.prototype = IterResult.prototype;


//=============================================================================
// Export
//=============================================================================

if (serverSide) {
    module.exports = {
        RRule: RRule
        // rruleset: rruleset
    }
}
if (typeof ender === 'undefined') {
    root['RRule'] = RRule;
    // root['rruleset'] = rruleset;
}

if (typeof define === "function" && define.amd) {
    /*global define:false */
    define("rrule", [], function () {
        return RRule;
    });
}

}(this));

/*!
 * rrule.js - Library for working with recurrence rules for calendar dates.
 * https://github.com/jakubroztocil/rrule
 *
 * Copyright 2010, Jakub Roztocil and Lars Schoning
 * Licenced under the BSD licence.
 * https://github.com/jakubroztocil/rrule/blob/master/LICENCE
 *
 */

/**
 *
 * Implementation of RRule.fromText() and RRule::toText().
 *
 *
 * On the client side, this file needs to be included
 * when those functions are used.
 *
 */
(function (root){


var serverSide = typeof module !== 'undefined' && module.exports;
var RRule;


if (serverSide) {
    RRule = require('./rrule').RRule;
} else if (root.RRule) {
    RRule = root.RRule;
} else if (typeof require !== 'undefined') {
    if (!RRule) {RRule = require('rrule');}
} else {
    throw new Error('rrule.js is required for rrule/nlp.js to work')
}


//=============================================================================
// Helper functions
//=============================================================================

/**
 * Return true if a value is in an array
 */
var contains = function(arr, val) {
    return arr.indexOf(val) != -1;
};


//=============================================================================
// ToText
//=============================================================================


/**
 *
 * @param {RRule} rrule
 * Optional:
 * @param {Function} gettext function
 * @param {Object} language definition
 * @constructor
 */
var ToText = function(rrule, gettext, language) {

    this.gettext = gettext || function(id) {return id};
    this.language = language || ENGLISH;
    this.text = '';

    this.rrule = rrule;
    this.freq = rrule.options.freq;
    this.options = rrule.options;
    this.origOptions = rrule.origOptions;

    if (this.origOptions.bymonthday) {
        var bymonthday = [].concat(this.options.bymonthday);
        var bynmonthday = [].concat(this.options.bynmonthday);
        bymonthday.sort();
        bynmonthday.sort();
        bynmonthday.reverse();
        // 1, 2, 3, .., -5, -4, -3, ..
        this.bymonthday = bymonthday.concat(bynmonthday);
        if (!this.bymonthday.length) {
            this.bymonthday = null;
        }
    }

    if (this.origOptions.byweekday) {
        var byweekday = !(this.origOptions.byweekday instanceof Array)
                            ? [this.origOptions.byweekday]
                            : this.origOptions.byweekday;
        var days = String(byweekday);
        this.byweekday = {
            allWeeks:byweekday.filter(function (weekday) {
                return !Boolean(weekday.n);
            }),
            someWeeks:byweekday.filter(function (weekday) {
                return Boolean(weekday.n);
            }),
            isWeekdays:(
                days.indexOf('MO') != -1 &&
                    days.indexOf('TU') != -1 &&
                    days.indexOf('WE') != -1 &&
                    days.indexOf('TH') != -1 &&
                    days.indexOf('FR') != -1 &&
                    days.indexOf('SA') == -1 &&
                    days.indexOf('SU') == -1
                )
        };


        var sortWeekDays = function(a, b) {
            return a.weekday - b.weekday;
        };

        this.byweekday.allWeeks.sort(sortWeekDays);
        this.byweekday.someWeeks.sort(sortWeekDays);

        if (!this.byweekday.allWeeks.length) {
            this.byweekday.allWeeks = null;
        }
        if (!this.byweekday.someWeeks.length) {
            this.byweekday.someWeeks = null;
        }
    }
    else {
        this.byweekday = null;
    }

};


ToText.IMPLEMENTED = [];
var common = [
    'count', 'until', 'interval',
    'byweekday', 'bymonthday', 'bymonth'
];
ToText.IMPLEMENTED[RRule.DAILY]   = common;
ToText.IMPLEMENTED[RRule.WEEKLY]  = common;
ToText.IMPLEMENTED[RRule.MONTHLY] = common;
ToText.IMPLEMENTED[RRule.YEARLY]  = ['byweekno', 'byyearday'].concat(common);

/**
 * Test whether the rrule can be fully converted to text.
 * @param {RRule} rrule
 * @return {Boolean}
 */
ToText.isFullyConvertible = function(rrule) {
    var canConvert = true;

    if (!(rrule.options.freq in ToText.IMPLEMENTED)) {
        return false;
    }
    if (rrule.origOptions.until && rrule.origOptions.count) {
        return false;
    }
    for (var key in rrule.origOptions) {
        if (contains(['dtstart', 'wkst', 'freq'], key)) {
            return true;
        }
        if (!contains(ToText.IMPLEMENTED[rrule.options.freq], key)) {
            canConvert = false;
            return false;
        }
    }

    return canConvert;
};


ToText.prototype = {


    isFullyConvertible: function() {
        return ToText.isFullyConvertible(this.rrule);
    },


    /**
     * Perform the conversion. Only some of the frequencies are supported.
     * If some of the rrule's options aren't supported, they'll
     * be omitted from the output an "(~ approximate)" will be appended.
     * @return {*}
     */
    toString: function() {

        var gettext = this.gettext;

        if (!(this.options.freq in ToText.IMPLEMENTED)) {
            return gettext(
                'RRule error: Unable to fully convert this rrule to text');
        }

        this.text = [gettext('every')];

        this[RRule.FREQUENCIES[this.options.freq]]();

        if (this.options.until) {
            this.add(gettext('until'));
            var until = this.options.until;
            this.add(this.language.monthNames[until.getMonth()])
                .add(until.getDate() + ',')
                .add(until.getFullYear());
        } else if (this.options.count) {
            this.add(gettext('for'))
                .add(this.options.count)
                .add(this.plural(this.options.count)
                        ? gettext('times')
                        : gettext('time'));
        }

        if (!this.isFullyConvertible()) {
            this.add(gettext('(~ approximate)'));
        }
        return this.text.join('');
    },

    DAILY: function() {
        var gettext = this.gettext;
        if (this.options.interval != 1) {
            this.add(this.options.interval);
        }

        if (this.byweekday && this.byweekday.isWeekdays) {
            this.add(this.plural(this.options.interval)
                         ? gettext('weekdays')
                         : gettext('weekday'));
        } else {
            this.add(this.plural(this.options.interval)
                ? gettext('days') :  gettext('day'));
        }

        if (this.origOptions.bymonth) {
            this.add(gettext('in'));
            this._bymonth();
        }

        if (this.bymonthday) {
            this._bymonthday();
        } else if (this.byweekday) {
            this._byweekday();
        }

    },

    WEEKLY: function() {
        var gettext = this.gettext;
        if (this.options.interval != 1) {
            this.add(this.options.interval).add(
                this.plural(this.options.interval)
                    ? gettext('weeks')
                    :  gettext('week'));
        }

        if (this.byweekday && this.byweekday.isWeekdays) {

            if (this.options.interval == 1) {
                this.add(this.plural(this.options.interval)
                    ? gettext('weekdays')
                    : gettext('weekday'));
            } else {
                this.add(gettext('on')).add(gettext('weekdays'));
            }

        } else {

            if (this.options.interval == 1) {
                this.add(gettext('week'))
            }

            if (this.origOptions.bymonth) {
                this.add(gettext('in'));
                this._bymonth();
            }

            if (this.bymonthday) {
                this._bymonthday();
            } else if (this.byweekday) {
                this._byweekday();
            }
        }

    },

    MONTHLY: function() {
        var gettext = this.gettext;
        if (this.origOptions.bymonth) {
            if (this.options.interval != 1) {
                this.add(this.options.interval).add(gettext('months'));
                if (this.plural(this.options.interval)) {
                    this.add(gettext('in'));
                }
            } else {
                //this.add(gettext('MONTH'));
            }
            this._bymonth();
        } else {
            if (this.options.interval != 1) {
                this.add(this.options.interval);
            }
            this.add(this.plural(this.options.interval)
                ? gettext('months')
                :  gettext('month'));
        }
        if (this.bymonthday) {
            this._bymonthday();
        } else if (this.byweekday && this.byweekday.isWeekdays) {
            this.add(gettext('on')).add(gettext('weekdays'));
        } else if (this.byweekday) {
            this._byweekday();
        }
    },

    YEARLY: function() {
        var gettext = this.gettext;
        if (this.origOptions.bymonth) {
            if (this.options.interval != 1) {
                this.add(this.options.interval);
                this.add(gettext('years'));
            } else {
                // this.add(gettext('YEAR'));
            }
            this._bymonth();
        } else {
            if (this.options.interval != 1) {
                this.add(this.options.interval);
            }
            this.add(this.plural(this.options.interval)
                ? gettext('years')
                :  gettext('year'));
        }


        if (this.bymonthday) {
            this._bymonthday();
        } else if (this.byweekday) {
            this._byweekday();
        }


        if (this.options.byyearday) {
            this.add(gettext('on the'))
                .add(this.list(this.options.byyearday,
                     this.nth, gettext('and')))
                .add(gettext('day'));
        }

        if (this.options.byweekno) {
            this.add(gettext('in'))
                .add(this.plural(this.options.byweekno.length)
                        ? gettext('weeks') :  gettext('week'))
                .add(this.list(this.options.byweekno, null, gettext('and')));
        }
    },

    _bymonthday: function() {
        var gettext = this.gettext;
        if (this.byweekday && this.byweekday.allWeeks) {
            this.add(gettext('on'))
                .add(this.list(this.byweekday.allWeeks,
                     this.weekdaytext, gettext('or')))
                .add(gettext('the'))
                .add(this.list(this.bymonthday, this.nth, gettext('or')));
        } else {
            this.add(gettext('on the'))
                .add(this.list(this.bymonthday, this.nth, gettext('and')));
        }
        //this.add(gettext('DAY'));
    },

    _byweekday: function() {
        var gettext = this.gettext;
        if (this.byweekday.allWeeks && !this.byweekday.isWeekdays) {
            this.add(gettext('on'))
                .add(this.list(this.byweekday.allWeeks, this.weekdaytext));
        }

        if (this.byweekday.someWeeks) {

            if (this.byweekday.allWeeks) {
                this.add(gettext('and'));
            }

            this.add(gettext('on the'))
                .add(this.list(this.byweekday.someWeeks,
                               this.weekdaytext,
                               gettext('and')));
        }
    },

    _bymonth: function() {
        this.add(this.list(this.options.bymonth,
                           this.monthtext,
                           this.gettext('and')));
    },

    nth: function(n) {
        var nth, npos, gettext = this.gettext;

        if (n == -1) {
            return gettext('last');
        }

        npos = Math.abs(n);

        switch(npos) {
            case 1:
            case 21:
            case 31:
                nth = npos + gettext('st');
                break;
            case 2:
            case 22:
                nth = npos + gettext('nd');
                break;
            case 3:
            case 23:
                nth = npos + gettext('rd');
                break;
            default:
                nth = npos + gettext('th');
        }

        return  n < 0 ? nth + ' ' + gettext('last') : nth;

    },

    monthtext: function(m) {
        return this.language.monthNames[m - 1];
    },

    weekdaytext: function(wday) {
        return (wday.n ? this.nth(wday.n) + ' ' : '')
            + this.language.dayNames[wday.getJsWeekday()];
    },

    plural: function(n) {
        return n % 100 != 1;
    },

    add: function(s) {
        this.text.push(' ');
        this.text.push(s);
        return this;
    },

    list: function(arr, callback, finalDelim, delim) {

        var delimJoin = function (array, delimiter, finalDelimiter) {
            var list = '';
            for(var i = 0; i < array.length; i++) {
                if (i != 0) {
                    if (i == array.length - 1) {
                        list += ' ' + finalDelimiter + ' ';
                    } else {
                        list += delimiter + ' ';
                    }
                }
                list += array[i];
            }
            return list;
        };

        delim = delim || ',';
        callback = callback || (function(o){return o;});
        var self = this;
        var realCallback = function(arg) {
            return callback.call(self, arg);
        };

        if (finalDelim) {
            return delimJoin(arr.map(realCallback), delim, finalDelim);
        } else {
            return arr.map(realCallback).join(delim + ' ');
        }


    }


};


//=============================================================================
// fromText
//=============================================================================
/**
 * Will be able to convert some of the below described rules from
 * text format to a rule object.
 *
 *
 * RULES
 *
 * Every ([n])
 * 		  day(s)
 * 		| [weekday], ..., (and) [weekday]
 * 		| weekday(s)
 * 		| week(s)
 * 		| month(s)
 * 		| [month], ..., (and) [month]
 * 		| year(s)
 *
 *
 * Plus 0, 1, or multiple of these:
 *
 * on [weekday], ..., (or) [weekday] the [monthday], [monthday], ... (or) [monthday]
 *
 * on [weekday], ..., (and) [weekday]
 *
 * on the [monthday], [monthday], ... (and) [monthday] (day of the month)
 *
 * on the [nth-weekday], ..., (and) [nth-weekday] (of the month/year)
 *
 *
 * Plus 0 or 1 of these:
 *
 * for [n] time(s)
 *
 * until [date]
 *
 * Plus (.)
 *
 *
 * Definitely no supported for parsing:
 *
 * (for year):
 * 		in week(s) [n], ..., (and) [n]
 *
 * 		on the [yearday], ..., (and) [n] day of the year
 * 		on day [yearday], ..., (and) [n]
 *
 *
 * NON-TERMINALS
 *
 * [n]: 1, 2 ..., one, two, three ..
 * [month]: January, February, March, April, May, ... December
 * [weekday]: Monday, ... Sunday
 * [nth-weekday]: first [weekday], 2nd [weekday], ... last [weekday], ...
 * [monthday]: first, 1., 2., 1st, 2nd, second, ... 31st, last day, 2nd last day, ..
 * [date]:
 * 		[month] (0-31(,) ([year])),
 * 		(the) 0-31.(1-12.([year])),
 * 		(the) 0-31/(1-12/([year])),
 * 		[weekday]
 *
 * [year]: 0000, 0001, ... 01, 02, ..
 *
 * Definitely not supported for parsing:
 *
 * [yearday]: first, 1., 2., 1st, 2nd, second, ... 366th, last day, 2nd last day, ..
 *
 * @param {String} text
 * @return {Object, Boolean} the rule, or null.
 */
var fromText = function(text, language) {
    return new RRule(parseText(text, language))
};

var parseText = function(text, language) {

    var ttr = new Parser((language || ENGLISH).tokens);

    if(!ttr.start(text)) {
        return null;
    }

    var options = {};

    S();
    return options;

    function S() {
        ttr.expect('every');

        // every [n]
        var n;
        if(n = ttr.accept('number'))
            options.interval = parseInt(n[0]);

        if(ttr.isDone())
            throw new Error('Unexpected end');

        switch(ttr.symbol) {
        case 'day(s)':
            options.freq = RRule.DAILY;
            if (ttr.nextSymbol()) {
                ON();
                F();
            }
            break;

            // FIXME Note: every 2 weekdays != every two weeks on weekdays.
            // DAILY on weekdays is not a valid rule
        case 'weekday(s)':
            options.freq = RRule.WEEKLY;
            options.byweekday = [
                RRule.MO,
                RRule.TU,
                RRule.WE,
                RRule.TH,
                RRule.FR
            ];
            ttr.nextSymbol();
            F();
            break;

        case 'week(s)':
            options.freq = RRule.WEEKLY;
            if (ttr.nextSymbol()) {
                ON();
                F();
            }
            break;

        case 'month(s)':
            options.freq = RRule.MONTHLY;
            if (ttr.nextSymbol()) {
                ON();
                F();
            }
            break;

        case 'year(s)':
            options.freq = RRule.YEARLY;
            if (ttr.nextSymbol()) {
                ON();
                F();
            }
            break;

        case 'monday':
        case 'tuesday':
        case 'wednesday':
        case 'thursday':
        case 'friday':
        case 'saturday':
        case 'sunday':
            options.freq = RRule.WEEKLY;
            options.byweekday = [RRule[ttr.symbol.substr(0, 2).toUpperCase()]];

            if(!ttr.nextSymbol())
                return;

            // TODO check for duplicates
            while (ttr.accept('comma')) {
                if(ttr.isDone())
                    throw new Error('Unexpected end');

                var wkd;
                if(!(wkd = decodeWKD())) {
                    throw new Error('Unexpected symbol ' + ttr.symbol
                        + ', expected weekday');
                }

                options.byweekday.push(RRule[wkd]);
                ttr.nextSymbol();
            }
            MDAYs();
            F();
            break;

        case 'january':
        case 'february':
        case 'march':
        case 'april':
        case 'may':
        case 'june':
        case 'july':
        case 'august':
        case 'september':
        case 'october':
        case 'november':
        case 'december':
            options.freq = RRule.YEARLY;
            options.bymonth = [decodeM()];

            if(!ttr.nextSymbol())
                return;

            // TODO check for duplicates
            while (ttr.accept('comma')) {
                if(ttr.isDone())
                    throw new Error('Unexpected end');

                var m;
                if(!(m = decodeM())) {
                    throw new Error('Unexpected symbol ' + ttr.symbol
                        + ', expected month');
                }

                options.bymonth.push(m);
                ttr.nextSymbol();
            }

            ON();
            F();
            break;

        default:
            throw new Error('Unknown symbol');

        }
    }

    function ON() {

        var on = ttr.accept('on');
        var the = ttr.accept('the');
        if(!(on || the)) {
            return;
        }

        do {

            var nth, wkd, m;

            // nth <weekday> | <weekday>
            if(nth = decodeNTH()) {
                //ttr.nextSymbol();

                if (wkd = decodeWKD()) {
                    ttr.nextSymbol();
                    if (!options.byweekday) {
                        options.byweekday = [];
                    }
                    options.byweekday.push(RRule[wkd].nth(nth));
                } else {
                    if(!options.bymonthday) {
                        options.bymonthday = [];
                    }
                    options.bymonthday.push(nth);
                    ttr.accept('day(s)');
                }

                // <weekday>
            } else if(wkd = decodeWKD()) {
                ttr.nextSymbol();
                if(!options.byweekday)
                    options.byweekday = [];
                options.byweekday.push(RRule[wkd]);
            } else if(ttr.symbol == 'weekday(s)') {
                ttr.nextSymbol();
                if(!options.byweekday)
                    options.byweekday = [];
                options.byweekday.push(RRule.MO);
                options.byweekday.push(RRule.TU);
                options.byweekday.push(RRule.WE);
                options.byweekday.push(RRule.TH);
                options.byweekday.push(RRule.FR);
            } else if(ttr.symbol == 'week(s)') {
                ttr.nextSymbol();
                var n;
                if(!(n = ttr.accept('number'))) {
                    throw new Error('Unexpected symbol ' + ttr.symbol
                        + ', expected week number');
                }
                options.byweekno = [n[0]];
                while(ttr.accept('comma')) {
                    if(!(n = ttr.accept('number'))) {
                        throw new Error('Unexpected symbol ' + ttr.symbol
                            + '; expected monthday');
                    }
                    options.byweekno.push(n[0]);
                }

            } else if(m = decodeM()) {
                ttr.nextSymbol();
                if(!options.bymonth)
                    options.bymonth = [];
                options.bymonth.push(m);
            } else {
                return;
            }

        } while (ttr.accept('comma') || ttr.accept('the') || ttr.accept('on'));
    }

    function decodeM() {
        switch(ttr.symbol) {
        case 'january':
            return 1;
        case 'february':
            return 2;
        case 'march':
            return 3;
        case 'april':
            return 4;
        case 'may':
            return 5;
        case 'june':
            return 6;
        case 'july':
            return 7;
        case 'august':
            return 8;
        case 'september':
            return 9;
        case 'october':
            return 10;
        case 'november':
            return 11;
        case 'december':
            return 12;
        default:
            return false;
        }
    }

    function decodeWKD() {
        switch(ttr.symbol) {
        case 'monday':
        case 'tuesday':
        case 'wednesday':
        case 'thursday':
        case 'friday':
        case 'saturday':
        case 'sunday':
            return ttr.symbol.substr(0, 2).toUpperCase();
            break;

        default:
            return false;
        }
    }

    function decodeNTH() {

        switch(ttr.symbol) {
        case 'last':
            ttr.nextSymbol();
            return -1;
        case 'first':
            ttr.nextSymbol();
            return 1;
        case 'second':
            ttr.nextSymbol();
            return ttr.accept('last') ? -2 : 2;
        case 'third':
            ttr.nextSymbol();
            return ttr.accept('last') ? -3 : 3;
        case 'nth':
            var v = parseInt(ttr.value[1]);
            if(v < -366 || v > 366)
                throw new Error('Nth out of range: ' + v);

            ttr.nextSymbol();
            return ttr.accept('last') ? -v : v;

        default:
            return false;
        }
    }

    function MDAYs() {

        ttr.accept('on');
        ttr.accept('the');

        var nth;
        if(!(nth = decodeNTH())) {
            return;
        }

        options.bymonthday = [nth];
        ttr.nextSymbol();

        while(ttr.accept('comma')) {

            if (!(nth = decodeNTH())) {
                throw new Error('Unexpected symbol ' + ttr.symbol
                        + '; expected monthday');
            }

            options.bymonthday.push(nth);

            ttr.nextSymbol();
        }
    }

    function F() {

        if(ttr.symbol == 'until') {

            var date = Date.parse(ttr.text);

            if (!date) {
                throw new Error('Cannot parse until date:' + ttr.text);
            }
            options.until = new Date(date);
        } else if(ttr.accept('for')){

            options.count = ttr.value[0];
            ttr.expect('number');
            /* ttr.expect('times') */
        }
    }
};


//=============================================================================
// Parser
//=============================================================================

var Parser = function(rules) {
   this.rules = rules;
};

Parser.prototype.start = function(text) {
   this.text = text;
   this.done = false;
   return this.nextSymbol();
};

Parser.prototype.isDone = function() {
   return this.done && this.symbol == null;
};

Parser.prototype.nextSymbol = function() {
   var p = this, best, bestSymbol;

   this.symbol = null;
   this.value = null;
   do {
       if(this.done) {
           return false;
       }

       best = null;

       var match, rule;
       for (var name in this.rules) {
           rule = this.rules[name];
           if(match = rule.exec(p.text)) {
               if(best == null || match[0].length > best[0].length) {
                   best = match;
                   bestSymbol = name;
               }
           }

       }

       if(best != null) {
           this.text = this.text.substr(best[0].length);

           if(this.text == '') {
               this.done = true;
           }
       }

       if(best == null) {
           this.done = true;
           this.symbol = null;
           this.value = null;
           return;
       }
   } while(bestSymbol == 'SKIP');

   this.symbol = bestSymbol;
   this.value = best;
   return true;
};

Parser.prototype.accept = function(name) {
   if(this.symbol == name) {
       if(this.value) {
           var v = this.value;
           this.nextSymbol();
           return v;
       }

       this.nextSymbol();
       return true;
   }

   return false;
};

Parser.prototype.expect = function(name) {
   if(this.accept(name)) {
       return true;
   }

   throw new Error('expected ' + name + ' but found ' + this.symbol);
};


//=============================================================================
// i18n
//=============================================================================

var ENGLISH = {
    dayNames: [
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday"
    ],
    monthNames: [
        "January", "February", "March", "April", "May",
        "June", "July", "August", "September", "October",
        "November", "December"
    ],
    tokens: {
        'SKIP': /^[ \r\n\t]+|^\.$/,
        'number': /^[1-9][0-9]*/,
        'numberAsText': /^(one|two|three)/i,
        'every': /^every/i,
        'day(s)': /^days?/i,
        'weekday(s)': /^weekdays?/i,
        'week(s)': /^weeks?/i,
        'month(s)': /^months?/i,
        'year(s)': /^years?/i,
        'on': /^(on|in)/i,
        'the': /^the/i,
        'first': /^first/i,
        'second': /^second/i,
        'third': /^third/i,
        'nth': /^([1-9][0-9]*)(\.|th|nd|rd|st)/i,
        'last': /^last/i,
        'for': /^for/i,
        'time(s)': /^times?/i,
        'until': /^(un)?til/i,
        'monday': /^mo(n(day)?)?/i,
        'tuesday': /^tu(e(s(day)?)?)?/i,
        'wednesday': /^we(d(n(esday)?)?)?/i,
        'thursday': /^th(u(r(sday)?)?)?/i,
        'friday': /^fr(i(day)?)?/i,
        'saturday': /^sa(t(urday)?)?/i,
        'sunday': /^su(n(day)?)?/i,
        'january': /^jan(uary)?/i,
        'february': /^feb(ruary)?/i,
        'march': /^mar(ch)?/i,
        'april': /^apr(il)?/i,
        'may': /^may/i,
        'june': /^june?/i,
        'july': /^july?/i,
        'august': /^aug(ust)?/i,
        'september': /^sep(t(ember)?)?/i,
        'october': /^oct(ober)?/i,
        'november': /^nov(ember)?/i,
        'december': /^dec(ember)?/i,
        'comma': /^(,\s*|(and|or)\s*)+/i
    }
};


//=============================================================================
// Export
//=============================================================================

var nlp = {
    fromText: fromText,
    parseText: parseText,
    isFullyConvertible: ToText.isFullyConvertible,
    toText: function(rrule, gettext, language) {
        return new ToText(rrule, gettext, language).toString();
    }
};

if (serverSide) {
    module.exports = nlp
} else {
  root['_RRuleNLP'] = nlp;
}

if (typeof define === "function" && define.amd) {
    /*global define:false */
    define("rrule", [], function () {
        return RRule;
    });
}

})(this);

// JSLint settings:
/*global
    clearTimeout,
    console,
    jQuery,
    setTimeout
*/

/*
 * Author: Adam Randlett
 * adam@tippingmedia.com
 *
 *
*/




var EVRP = (function($, evrp, window, document, undefined){

        evrp.Helpers = {};
        evrp.Ajax    = {};
        evrp.Cms     = {};


        /**
         * EVRP VARIABLES.
         */

        var _html = $("html"),
            _body = $('body');


        /* --------------------------------------------- *\
                HELPERS.
        \*  -------------------------------------------- */

        evrp.Helpers.is_int = function(value){
            if((parseFloat(value) == parseInt(value)) && !isNaN(value)){
                return true;
            } else {
                return false;
            }
        }


        // If you use console when IE doesn't have the "F12"
        // tools open, throws a "console not defined" error.
        evrp.log = function() {
            // Safely log things, if need be.
            if (console && typeof console.log === 'function') {
                for (var i = 0, ii = arguments.length; i < ii; i++) {
                    console.log(arguments[i]);
                }
            }
        };


        //evrp.log("EVRP --");
        return evrp;

// jQuery, evrp, window, document, undefined
}(jQuery, EVRP || {}, this, this.document));


/*
 * Author: Adam Randlett
 * adam@randlett.net
 *
 *
*/

EVRP.mdl = (function ($, mdl, window, document, undefined){

    var _body = $('body');
    mdl.Modal = {};

    mdl.Modal.init = function(){
        var fieldName = $('[data-field-name]').data('field-name'),
            fieldRule = $('#fields-rRule').attr('value'),
            // provide current toggled locale to modal
            locale = $('[name=locale]').val(),
            params = {
                'name' : fieldName,
                'rrule': fieldRule,
                'locale' : locale
            };

        //get Modal html from Events_AjaxController.php
        //append to overlay we already added to document
        Craft.postActionRequest('venti/ajax/modal', params, function(data){
            _body.append(data);
            mdl.Modal.mod = $("[data-modal]");
            mdl.Modal.overlay = $("[data-events-overlay]");
            mdl.Modal.events();
        });

    };




    /* --------------------------------------------- *\
                EVENT SETUP.
    \*  -------------------------------------------- */

    mdl.Modal.events = function () {

        _body.on('click', '[data-events-click],[data-events-edit]', function (e) {
            var $this = $(this),
                modalId = $this.data('venti-modal');

            if($this.is("input")){
                if($this.prop("checked")){
                    mdl.Modal.open( $("#" + modalId) );
                }
                //If there is a repeat event values in hidden fields, clear all.
                if($('[data-rrule]').attr("value") !== ""){
                    mdl.Widget.clearSummary();
                }
            }
            if($this.is("a")){
                mdl.Modal.open( $("#" + modalId) );
                e.preventDefault();
            }
        });

        _body.on('click', '.evrp_modal_close', function (ev) {
            ev.preventDefault();
            mdl.Modal.close();
            /* If no previous repeat event then uncheck
                 if there is a repeat event we need to leave
                 it check the user just canceled the window. */
            if($('[data-rrule]').attr("value") === ""){
                $('[data-events-click]').removeAttr("checked");
            }
        });

    };





    /* --------------------------------------------- *\
                MODEL OPEN.
    \*  -------------------------------------------- */

     mdl.Modal.open = function (modal) {
        mdl.Modal.overlay.fadeIn('fast');
        //sets widget starts on input
        modal.find(".venti-frequency--select").focus();
        mdl.Widget.setStartsOn();
    };




    /* --------------------------------------------- *\
            MODAL CLOSE.
    \*  -------------------------------------------- */

    mdl.Modal.close = function(){
        mdl.Modal.overlay.fadeOut('fast');
    };


    mdl.Modal.init();
    return mdl;

}($, EVRP || {}, this, this.document));


/*
 * Author: Adam Randlett
 * adam@tippingmedia.com
 *
 *
*/

EVRP.rul = (function ($, rul, window, document, undefined){

    var _body = $('body');
    rul.RRule = {};
    rul.RRule.context = {
        "repeats": [
            "Every day",
            "Every weekday",
            "Every Monday, Wednesday, Friday",
            "Every Tuesday, Thursday",
            "Every week",
            "Every month",
            "Every year"
         ],
        "dow":{
            "MO":"Monday",
            "TU":"Tuesday",
            "WE":"Wednesday",
            "TH":"Thursday",
            "FR":"Friday",
            "SA":"Saturday",
            "SU":"Sunday"
        }
    };


    /**
     * RUL.RRULE INITIALIZE.
     */

    rul.RRule.init = function(){
        //rul.log("EVRP.RRULE.INIT --");
    };





    /**
     * RULE STRING.
        Generate Rule Text Based On Repeat
        Event Input Selections
     */

    rul.RRule.getRuleString = function(obj,callback){
        var pof = parseInt(obj["repeats"]),
                ruleString = [];

        try {

            if(pof === 0){ // Daily
                if(parseInt(obj["repeatsevery"]) === 1){
                    ruleString[0] = "Every day";
                }else{
                    ruleString[0] = "Every " + obj["repeatsevery"] + " days";
                }
            }

            if(pof === 1){ // Every Weekday
                ruleString[0] = "Every weekday";
            }

            if(pof === 2){ // Every week on Monday, Wednesday and Friday
                ruleString[0] = "Every week on Monday, Wednesday, Friday,";
            }

            if(pof === 3){ // Every week on Tuesday and Thursday
                ruleString[0] = "Every week on Tuesday, and Thursday,";
            }

            if(pof === 4){ // Weekly + days of weeks if selected
                var dowArry = obj["repeatson"].map(function(){
                    return rul.RRule.context["dow"][this];
                }).get().join(", ");

                if(dowArry.length > 0){
                    if(parseInt(obj["repeatsevery"]) > 1){
                        ruleString[0] = "Every " + obj["repeatsevery"] + " weeks on " + dowArry;  // Every 5 weeks on Monday, Wednesday, Saturday
                    }else{
                        ruleString[0] = "Every week on " + dowArry;  // Every week on Monday, Wednesday, Saturday
                    }
                }else{
                    ruleString[0] = "Every week"; // Every week
                }
            }

            if(pof === 5){ // Every month
                var sD = rul.Widget.getStartDate(); // sD = startDate

                if(parseInt(obj["repeatsby"]) === 0){ // Every month on the 17th
                    ruleString[0] = "Every month on the " + sD.getDate() + sD.getDaySuffix();
                }

                if(parseInt(obj["repeatsby"]) === 1){ // Every month on the fifth Friday
                    //console.log(sD.nthDay());
                    ruleString[0] = "Every month on the " + rul.getNthDaySuffix(sD.nthDay()) + " " + sD.dayOfWeek();
                }
            }

            if(pof === 6){ // Every year
                if(parseInt(obj["repeatsevery"]) === 1){
                    ruleString[0] = "Every year";
                }else{
                    ruleString[0] = "Every " + obj["repeatsevery"] + obj["repeatsevery"].getNumberSuffix()  + " year";  // Every 3rd year
                }
            }


            // Ends On by occurrence or date
            if(parseInt(obj["endson"]) > 0){
                var endson = parseInt(obj["endson"]);

                if(endson === 1 && obj["occur"] !== undefined){
                    ruleString[1] = "for " + obj["occur"] + " times";
                }

                if(endson === 2 && obj["endsondate"] !== undefined){
                    ruleString[1] = "until " + obj["endsondate"];
                }
            };

        response = ruleString.join(" ");
        callback(response);

        } catch(e) {
             callback(false);
        }

    };




    /**
     * RRULE OPTIONS.
        Generates RRULE.js Options Object.
     */

    rul.RRule.getRRuleOptions = function(rulestr){
        var ruleString = rulestr,
                options = RRule.parseText(ruleString);
        //setting dtstart was ruining everything.
        //options.dtstart = rul.Widget.getStartDate();
        var output = RRule.optionsToString(options);
        return output;
    };





    /**
     * RRULE DATES.
            Generates Array Of Dates Based On
            Repeat Date Criteria
     */

    rul.RRule.getRRuleInstances = function(rulestr,callback){
        try{
            var rule = new RRule(RRule.parseString(rulestr));
            response = rule.all();
            callback(response);
        } catch(e) {
            callback(false);
        }
        //console.log(rule.all());
    }





    /**
     * HELPERS.
     */

    Date.prototype.nthDay = function(){
        return Math.ceil(this.getDate()/7);
    };


    Date.prototype.getDaySuffix = function(utc) {
        var n = utc ? this.getUTCDate() : this.getDate();
        // If not the 11th and date ends at 1
        if (n != 11 && (n + '').match(/1$/)){
            return 'st';
        }
        // If not the 12th and date ends at 2
        else if (n != 12 && (n + '').match(/2$/)){
            return 'nd';
        }
        // If not the 13th and date ends at 3
        else if (n != 13 && (n + '').match(/3$/)){
            return 'rd';
        }
        else{
            return 'th';
        }
    };

    String.prototype.getNumberSuffix = function(){
        var n = parseInt(this);
        if (n != 11 && (n + '').match(/1$/)){
            return 'st';
        }
        // If not the 12th and date ends at 2
        else if (n != 12 && (n + '').match(/2$/)){
            return 'nd';
        }
        // If not the 13th and date ends at 3
        else if (n != 13 && (n + '').match(/3$/)){
            return 'rd';
        }
        else{
            return 'th';
        }
    }


    Date.prototype.dayOfWeek = function(){
        var dowArry = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
            ];

        return dowArry[this.getDay()];
    };


    rul.getNthDaySuffix = function(num){
        var suffix = [
            "1st",
            "2nd",
            "3rd",
            "4th",
            "5th"
        ],
        //subtract 1 to get proper item from suffix array;
        idx = parseInt(num) - 1;
        return suffix[idx];
    };


    // Parses 'FREQ=WEEKLY;DTSTART=20140124T070000Z;COUNT=10;BYDAY=MO,TU,WE,TH,FR' type string.

    rul.getRuleParams = function(str){
        if (str !== undefined) {
            var ret = {},
                seg = str.split(';'),
                len = seg.length, i = 0, s;
            for (;i<len;i++) {
                if (!seg[i]) { continue; }
                s = seg[i].split('=');
                ret[s[0]] = s[1];
                 
                if(ret['BYDAY']){
                    var idx = ret['BYDAY'].indexOf(',');
                    if(idx != -1){
                        ret['BYDAY'] = ret['BYDAY'].split(',');
                    }else{
                        ret['BYDAY'] = ret['BYDAY'];
                    }
                }
            }
            return ret;
        }else{
            return false;
        }
    };


    //rul.RRule.init();
    return rul;

}($, EVRP || {}, this, this.document));


/*
 * Author: Adam Randlett
 * adam@randlett.net
 * Tipping Media LLC
 *
*/

EVRP.erw = (function ($, erw, window, document, undefined){

    var _body = $('body');
    erw.Widget = {};

    erw.Widget.labels = {
        "everytext":[
            "days",
            "weeks",
            "months",
            "years"
        ]
    }



    erw.Widget.init = function(){
        var ruleInp = $("[data-rrule]");
        erw.Widget.events();
    };



    /**
     * START DATE METHODS.
     */

    // Sets the Start On day from the event Start Date
    erw.Widget.setStartsOn = function () {
        $("#er_starts").attr("value",$("#fields-eventStartDate-date").val());
    };


    erw.Widget.getStartDate = function () {
        var sdate = document.querySelector("#fields-eventStartDate-date").value;
        var time = erw.Widget.convert12to24(document.querySelector("#fields-eventStartDate-time").value),
            timeArry = time.split(':'),
            dateArry = sdate.split('/'),
            start = new Date(dateArry[2],dateArry[0]-1,dateArry[1],timeArry[0],timeArry[1],"00"); // used Date.UTC

        // If no start date use today formatted M/D/YYYY
        if(start === ""){
            var date = new Date();
            start = erw.formatDate(date);
        }

        return start;
    };


    erw.Widget.convert12to24 = function (timeStr) {
        var meridian = timeStr.substr(timeStr.length-2).toLowerCase();;
        var hours =  timeStr.substr(0, timeStr.indexOf(':'));
        var minutes = timeStr.substring(timeStr.indexOf(':')+1, timeStr.indexOf(' '));
        if (meridian=='pm')
        {
            if (hours!=12)
            {
                hours=hours*1+12;
            }
            else
            {
                hours = (minutes!='00') ? '0' : '24' ;
            }
        }

        return hours+':'+minutes;
    }

    //Format Date 08/14/2014
    erw.Widget.formatDate = function (date) {
        var day = date.getDate(),
                month = date.getMonth() + 1,
                year = date.getFullYear();
        return start = month + "/" + day + "/" + year;
    };


    /**
     * EVENTS.
     */

    erw.Widget.events = function () {

        var datesSaved = false,
            savedValues = {
                startTime: '',
                endTime: ''
            };

        // Done button click
        _body.on("click",".venti_modal-done", function (evt) {
            evt.preventDefault();
            var parentModal = $(this).parents('.venti_modal');
            $("[data-events-edit]").show();
            erw.Widget.done(parentModal);
        });


        // Ends On Radio Set click
        _body.on("click",".evrp_modal [type=radio], .evrp_modal [type=checkbox]", function () {
            var $this = $(this);
            if($this.is('[name*=endsOn]')){
                erw.Widget.repeatEnds($this);
            }
        });

        $('.evrp_field').on('click','input[name*=allDay]', function (evt) {
            var $this = $(this),
                parent = $(evt.delegateTarget),
                startDateTime = parent.find('#fields-eventStartDate-time'),
                endDateTime = parent.find('#fields-eventEndDate-time');

            if ($this.is(':checked')) {
                parent.addClass('allDay');
                if (!datesSaved) {
                    savedValues.startTime = startDateTime.val();
                    savedValues.endTime = endDateTime.val();
                    startDateTime.val("12:00 AM");
                    endDateTime.val("12:59 PM");
                    datesSaved = true;
                }else{
                    startDateTime.val("12:00 AM");
                    endDateTime.val("12:59 PM");
                }
            }else{
                parent.removeClass('allDay');
                if(datesSaved){
                    startDateTime.val(savedValues.startTime);
                    endDateTime.val(savedValues.endTime);
                };
            };
            
        });

        _body.on("change",".evrp_modal select, .evrp_modal input", function (ev) {
            var $this = $(ev.currentTarget),
                el = ev.currentTarget;

            //Ends Radio Buttons and Associated Inputs
            if(el.classList.contains('venti-frequency--select')){
                var value = (parseInt(el.value) + 1);
                $('.evrp_modal').attr('data-state', value);
            }
        });


        _body.on('click','.venti_modal_tabs a',erw.Widget.tabs);

        /*
         * On Exclude/Include Date change highlight add button.
         */
        _body.on('change keyup','.venti_datefield', function (evt) {

            var parentTab = $(this).parents('.venti_modal_tab_content'),
                addDate = parentTab.find('.venti_adddate');
            if ($(this).val() != "") {
                addDate.addClass('ready');
            } else {
                addDate.removeClass('ready');
            }
        });


        _body.on('click','.venti_adddate', function (evt) {
            var parentTab = $(this).parent(),
                input = parentTab.find('.venti_datefield'),
                date = input.val(),
                tempClass = parentTab.data('element-template'),
                temp = parentTab.find(tempClass).text(),
                output = parentTab.find('.venti_elements'),
                element = $(temp);

            if(date.trim() != ""){
                element.find("input").attr("value",date);
                element.find(".title").append(date);
                output.append(element);
                input.val('');
                $(this).removeClass('ready');
            }
        });

        _body.on('click','.venti_elements .delete',function () {
            var $this = $(this);
            $this.parent().fadeOut( function (){
                $(this).remove();
            });
        });


        /**
        * Observe change in Start Date input to set End Date as same if there is not value.
        */

        var intID,
            startDateInputField = $('#fields-eventStartDate-date'),
            endDateInputField = $('#fields-eventEndDate-date');

        function ObserveStartDateInput() {
            if (endDateInputField.val() == "") {
                endDateInputField.val(startDateInputField.val());
                window.clearInterval(intID);
            };
        }

        startDateInputField.on('focusin',function(){
            intID = window.setInterval(function() { ObserveStartDateInput(); }, 100);
        });

        startDateInputField.on('focusout',function(){
            window.clearInterval(intID);
        });

    };



    erw.Widget.tabs = function(e){
        var $this = $(this),
            parentNav = $this.parents('.venti_modal_tabs'),
            id = $this.attr("href");

            parentNav.find(".sel").removeClass('sel');
            $this.addClass('sel');
            $(id).siblings().hide();
            $(id).show();
            e.preventDefault();
    };

    erw.Widget.repeatEnds = function(elm){
        var $this = $(elm);

        if($this.is("#er_endsnever")){
            $("#er_endson_rdio").next('label').find("input").attr("disabled","disabled");
            $("#er_endsafter").next('label').find("input").attr("disabled","disabled");
        }

        if($this.is("#er_endsafter")){
            $this.next("label").find('input').removeAttr('disabled');
            $("#er_endson_rdio").next('label').find("input").attr("disabled","disabled");
        }

        if($this.is("#er_endson_rdio")){
            $this.next("label").find('input').removeAttr('disabled');
            $("#er_endsafter").next('label').find("input").attr("disabled","disabled");
        }
    };


    /**
     * SUMMARY TEXT & HIDDEN INPUTS.
     */

    erw.Widget.setSummary = function(txt){
        var text = txt ? txt.capitalize() : txt;
            
        $(".evrp_summary,.rrule_human_text").html(text);
        $("[data-summary]").attr("value",text);
        if($("[data-events-edit]:hidden")){
            $("[data-events-edit]:hidden").show();
        }
    };



    /**
     * CLEAR SUMMARY
     */

    erw.Widget.clearSummary = function(){
        // clears rRule & summary hidden input as well as text holders next
        // too repeat checkbox and event modal summary box.
        $(".evrp_summary,.rrule_human_text").html("");
        $("[data-summary],[data-rrule]").attr("value","");
        $("#fields-rRule").attr("data-rule-string","");

        if($("[data-events-edit]:visible")){
            $("[data-events-edit]:visible").hide();
        }

    };


    // Convert date back to original format (8/25/2014) from 20140825T000000Z
    erw.strToDateUTC = function(date){
        var re = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?$/;
        var bits = re.exec(date),
                year = "",
                month = "",
                day = "";
        if (!bits) {
                throw new Error('Invalid DATE value: ' + date)
        }
        year = bits[1];

        if(bits[2].charAt(0) === "0"){
            month = bits[2].replace("0","");
        }else{
            month = bits[2];
        }
        if(bits[3].charAt(0) === "0"){
            day = bits[3].replace("0","");
        }else{
            day = bits[3];
        }
        var datetxt = month + "/" + day + "/" + year;
        return datetxt;
    };




    erw.stringToDate = function(until){
        // Barrowed from RRULE.js to reconvert datestring: Dateutil.untilStringToDate
        var re = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z)?$/;
        var bits = re.exec(until);
        if (!bits) {
            throw new Error('Invalid UNTIL value: ' + until)
        }
        return new Date(
            Date.UTC(
                bits[1],
                bits[2] - 1,
                bits[3],
                bits[5] || 0,
                bits[6] || 0,
                bits[7] || 0
            )
        );
    }




    /**
     * DONE.
     */

    erw.Widget.done = function (modal) {
        var formData = modal.find(".evrp_modal-form").serialize();
        Craft.postActionRequest('venti/ajax/getRuleString', formData, function(data){
            erw.Widget.saveRuleOptions(data);
        });
    };



    erw.Widget.saveRuleOptions = function(response){
        if(response){
            $("[data-rrule]").attr("value",response.rrule);
            erw.Widget.setSummary(response.readable);
            erw.Modal.close();
        }
    };


    erw.objectsAreSame = function(x, y) {
        var objectsAreSame = true;
        for(var propertyName in x) {
            if(x[propertyName] !== y[propertyName]) {
                 objectsAreSame = false;
                 break;
            }
        }
        return objectsAreSame;
    }

    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }


    erw.Widget.init();
    return erw;

}($, EVRP || {}, this, this.document));
