/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Anne Matthes <anne.matthes@open-xchange.com>
 */

define([
    'io.ox/core/boot/util'
], function (util) {
    var scopeIdentifier = '#io-ox-login-screen';

    describe('Custom css of the login page configuration', function () {
        it('should parse identifier selectors', function () {
            var customCss = '#login-title { text-transform: uppercase; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen #login-title { text-transform: uppercase; }');
        });

        it('should parse element selectors', function () {
            var customCss = 'button { text-transform: uppercase; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen button { text-transform: uppercase; }');
        });

        it('should parse class selectors', function () {
            var customCss = '.login-logo { padding: 10px; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen .login-logo { padding: 10px; }');
        });

        it('should parse * selectors', function () {
            var customCss = '* { color: #ccc }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen * { color: #ccc }');
        });

        it('should parse comma separated selectors', function () {
            var customCss = 'button,#login-title,.lang-label { text-transform: uppercase; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen button,#login-title,.lang-label { text-transform: uppercase; }');
        });

        it('should parse combined selectors', function () {
            var customCss = 'div.username { text-transform: uppercase; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen div.username { text-transform: uppercase; }');
        });

        describe('should parse nested selectors', function () {
            it('should parse nested selectors', function () {
                var customCss = 'button label { text-transform: uppercase; }';
                util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen button label { text-transform: uppercase; }');
            });

            it('should parse direct nested selectors', function () {
                var customCss = '#io-ox-login-toolbar > .login-logo { padding: 10px; }';
                util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen #io-ox-login-toolbar > .login-logo { padding: 10px; }');
            });

            it('should parse direct nested selectors', function () {
                var customCss = '#io-ox-login-toolbar>.login-logo { padding: 10px; }';
                util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen #io-ox-login-toolbar>.login-logo { padding: 10px; }');
            });
        });

        it('should parse attribute selectors', function () {
            var customCss = 'input[type="email"] { border: 1px solid blue }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen input[type="email"] { border: 1px solid blue }');
        });

        it('should parse state selectors', function () {
            var customCss = 'input[type="email"]:focus { border: 1px solid orange }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen input[type="email"]:focus { border: 1px solid orange }');
        });

        it('should parse multiple rules', function () {
            var customCss = 'div.username { text-transform: uppercase; } div.password { text-transform: uppercase; }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen div.username { text-transform: uppercase; } #io-ox-login-screen div.password { text-transform: uppercase; }');
        });

        it('should parse multiple lines', function () {
            var customCss = 'div.username {\r\n\ttext-transform: uppercase;\r\n}\r\ndiv.password {\r\n\ttext-transform: uppercase;\r\n}';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen div.username {\r\n\ttext-transform: uppercase;\r\n}\r\n#io-ox-login-screen div.password {\r\n\ttext-transform: uppercase;\r\n}');
        });

        it('should parse media queries', function () {
            var customCss = '@media smartphone { #login-title { text-transform: uppercase; } }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('@media smartphone { #io-ox-login-screen #login-title { text-transform: uppercase; } }');
        });

        it('should parse media queries with indications', function () {
            var customCss = '@media (max-height: 300px) { #io-ox-language-list { max-height: 100px; } }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('@media (max-height: 300px) { #io-ox-login-screen #io-ox-language-list { max-height: 100px; } }');
        });

        it('should not parse main selector #io-ox-login-screen', function () {
            var customCss = '#io-ox-login-screen { color: #ccc }';
            util.scopeCustomCss(customCss, scopeIdentifier).should.equal('#io-ox-login-screen { color: #ccc }');
        });

        it('should return empty custom css', function () {
            expect(util.scopeCustomCss()).to.be.undefined;
        });
    });
});
