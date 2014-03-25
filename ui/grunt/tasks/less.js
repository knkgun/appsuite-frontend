/* This file has been generated by ox-ui-module generator.
 * Please only apply minor changes (better no changes at all) to this file
 * if you want to be able to run the generator again without much trouble.
 *
 * If you really have to change this file for whatever reason, try to contact
 * the core team and describe your use-case. May be, your changes can be
 * integrated into the templates to be of use for everybody.
 */
'use strict';

module.exports = function (grunt) {
    ['default'].concat(grunt.file.expand({cwd: 'apps/themes/'}, '*/definitions.less')).forEach(function (file) {
        var themeName = file.replace(/\/definitions.less$/, '');
        var theme = {};
        theme[themeName] = {
            options: {
                compress: true,
                cleancss: true,
                ieCompat: false,
                syncImport: true,
                strictMath: false,
                strictUnits: false,
                relativeUrls: false,
                paths: [
                    'apps/themes',
                    'lib/appsuite/apps/themes',
                    'bower_components/bootstrap/less',
                    'bower_components/font-awesome/less'
                ],
                imports: {
                    reference: [
                        'variables.less',
                        'mixins.less'
                    ],
                    less: [
                        'definitions.less',
                        themeName + '/definitions.less'
                    ]
                }
            },
            files: [
                {
                    src: ['apps/themes/style.less'],
                    expand: true,
                    rename: function (dest) { return dest; },
                    dest: 'build/apps/themes/' + themeName + '/common.css'
                },
                {
                    src: [
                        'bower_components/bootstrap/less/bootstrap.less',
                        'bower_components/bootstrap-datepicker/less/datepicker3.less',
                        'bower_components/font-awesome/less/font-awesome.less',
                        'apps/themes/' + themeName + '/style.less'
                    ],
                    expand: true,
                    rename: function (dest) { return dest; },
                    dest: 'build/apps/themes/' + themeName + '/style.css'
                },
                {
                    src: ['**/*.less', '!themes/**/*.less', '!themes/*.less'],
                    expand: true,
                    ext: '.css',
                    cwd: 'apps/',
                    dest: 'build/apps/themes/' + themeName + '/'
                }
            ]
        };
        grunt.config.extend('less', theme);
    });

    grunt.loadNpmTasks('assemble-less');
};
