// Override nextTick to enable collection of dependencies for concatenation.
(function () {
    var waiting = 0, finalCallback = null;
    require.nextTick = function (fn, finalCb) {
        if (finalCb) finalCallback = finalCb;
        if (!fn && waiting) return;
        waiting++;
        setTimeout(function () {
            if (fn) fn();
            if (--waiting || !finalCallback) return;
            var cb = finalCallback;
            finalCallback = null;
            cb();
        }, 4);
    };
    _.each(require.s.contexts, function(context) {
        context.nextTick = require.nextTick;
    });
}());

// init require.js
require({
    // inject version
    baseUrl: ox.base + "/apps",
    waitSeconds: document.cookie.indexOf("selenium=true") != -1 ? 60 : 15 //_.browser.IE ? 20 : 10
});

// jQuery AMD fix
define('jquery', function () { return $; });

/**
 * Asynchronous define (has same signature than define)
 * Callback must return deferred object.
 */
define.async = (function () {

    var getLoader = function (name, deps, callback) {
            return function (n, req, onLoad, config) {
                // resolve module dependencies
                req(deps, function () {
                    // get module (must return deferred object)
                    var def = callback.apply(null, arguments);
                    if (def && def.done) {
                        def.done(onLoad);
                    } else {
                        console.error('Module "' + name + '" does not return a deferred object!');
                    }
                    name = deps = callback = null;
                });
            };
        };

    return function (name, deps, callback) {
        // use loader plugin to defer module definition
        var wrapper = null;
        if (ox.manifests) {
            wrapper = ox.manifests.wrapperFor(name, deps, callback);
        } else {
            wrapper = {
                dependencies: deps,
                definitionFunction: callback
            };
        }
        if (wrapper.after && wrapper.after.length) {
            (function () {
                var definitionFunction = wrapper.definitionFunction;
                wrapper.definitionFunction = function () {
                    var def = definitionFunction.apply(window, arguments);
                    var allLoaded = $.Deferred();

                    def.done(function (module) {
                        require(wrapper.after).done(function () {
                            allLoaded.resolve(module);
                        });
                    }).fail(allLoaded.reject);

                    return allLoaded;
                };
            }());
        }
        define(name + ':init', { load: getLoader(name, wrapper.dependencies, wrapper.definitionFunction) });
        // define real module - will wait for promise
        define(name, [name + ':init!'], _.identity);
    };
}());

//
// Turn global "ox" into an event hub (now)
//

_.extend(ox, Backbone.Events);

//
// Override define
//
(function () {

    var define = window.define;

    window.define = function (name, deps, callback) {

        // call original define if
        // a) we don't know the name or
        // b) it's io.ox/core/notifications (for whatever reason) or
        // c) if the second argument is string, i.e. provides plain content, or
        // d) or if the second argument is an object, i.e. a plugin definition.
        if (!_.isString(name) || name === 'io.ox/core/notifications' || (!_.isFunction(deps) && !_.isArray(deps))) return define.apply(this, arguments);

        // shift arguments?
        if (arguments.length === 2) {
            callback = deps;
            deps = [];
        }

        // Approach: if we have the manifests at hand, we use them immediately to
        // inject plugins as further dependencies. If not, each module gets a placeholder
        // that tries that again when the module is actually required
        if (ox.manifests) {
            // inject dependencies now
            deps = ox.manifests.withPluginsFor(name, deps);
        } else {
            // inject and define placeholder
            deps.push(name + ':placeholder!');
            define(name + ':placeholder', { load: getPluginLoader(name) });
        }

        return define.call(this, name, deps, callback);
    };

    function getPluginLoader(name) {
        return function loadModulePlugins(n, req, done) {
            // still no manifests? (only applies for very basic modules)
            if (!ox.manifests) return done();
            // try again: require further dependencies
            var deps = ox.manifests.pluginsFor(name);
            if (deps.length) req(deps, done); else done();
        };
    }

    // copy other properties
    _.extend(window.define, define);

})();
