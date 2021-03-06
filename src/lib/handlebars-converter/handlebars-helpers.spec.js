// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require('assert');
var constants = require('../constants/constants');
var fs = require('fs');
var helpers = require('./handlebars-helpers').external;
var helperUtils = require('./handlebars-helpers').internal;
var hl7 = require('../hl7v2/hl7v2');
var path = require('path');
var validator = require('validator');
const fse = require('fs-extra');

describe('Handlebars helpers', function() {
    helpers.forEach((h,idx) => {
        it('Function ' + idx + ' should name a name', function(done) {
            if (h.name.length == 0) {
                done(new Error("Length of name for function " + idx + " has zero length name"));
            } else {
                done();
            }            
        });

        it(h.name + ' should have a description', function (done) {
            if (h.description.length == 0) {
                done(new Error("Length of " + h.name + " description is zero"));
            } else {
                done();
            }
        });

        it(h.name + ' should have a function definition', function (done) {
            if (h.func) {
                done();
            } else {
                done(new Error(h.name + " has no function definition"));
            }
        });
    });

    var opTests = [
        {f: 'eq', in: [1,1,{}], out: true},
        {f: 'eq', in: [1,2,{}], out: false},
        {f: 'eq', in: ["foo","foo",{}], out: true},
        {f: 'eq', in: ["foo","bar","foo","abc",{}], out: true},
        {f: 'eq', in: [1,"1","2",3,{}], out: true},
        {f: 'eq', in: [1,"2","2",3,{}], out: false},
        {f: 'ne', in: [1,1,{}], out: false},
        {f: 'ne', in: [1,2,{}], out: true},
        {f: 'ne', in: ["foo","bar",{}], out: true},
        {f: 'ne', in: ["foo","bar","foo",{}], out: false},
        {f: 'ne', in: ["foo","bar","abc","def",{}], out: true},
        {f: 'not', in: [true], out: false},
        {f: 'not', in: [false], out: true},
        {f: 'lt', in: [1,2], out: true},
        {f: 'lt', in: [2,1], out: false},
        {f: 'lt', in: [2,2], out: false},
        {f: 'gt', in: [1,2], out: false},
        {f: 'gt', in: [2,1], out: true},
        {f: 'gt', in: [1,1], out: false},
        {f: 'lte', in: [1,2], out: true},
        {f: 'lte', in: [2,2], out: true},
        {f: 'lte', in: [2,1], out: false},
        {f: 'gte', in: [1,2], out: false},
        {f: 'gte', in: [2,2], out: true},
        {f: 'gte', in: [2,1], out: true},
        {f: 'and', in: [true,true,{}], out: true},
        {f: 'and', in: [true,true,true,false,{}], out: false},
        {f: 'or', in: [true,true,{}], out: true},
        {f: 'or', in: [false,false,true,false,{}], out: true},
        {f: 'or', in: [false,false,{}], out: false},
        {f: 'concat', in: ["foo","bar", {}], out: "foobar"},
        {f: 'concat', in: ["a","b","c", {}], out: "abc"},
        {f: 'elementAt', in: [["a","b","c"],1], out: "b"},
        {f: 'elementAt', in: [["a","b","c"],5], out: undefined},
        {f: 'charAt', in: ["abc",1], out: "b"},
        {f: 'length', in: [["a","b","c"]], out: 3},
        {f: 'length', in: [undefined], out: 0},
        {f: 'strLength', in: [undefined], out: 0},
        {f: 'strLength', in: ["abc"], out: 3},
        {f: 'strSlice', in: ["abcd",1,3], out: "bc"},
        {f: 'strSlice', in: ["abcd",1,10], out: "bcd"},
        {f: 'slice', in: [["a","b","c","d"],1,3], out: ["b","c"]},
        {f: 'split', in: ["a,b,c",","], out: ["a", "b", "c"]},
        {f: 'split', in: ["a,x,b,x,c",",x"], out: ["a", ",b", ",c"]},
        {f: 'replace', in: ["abcdbc","bc","x"], out: "axdx"},
        {f: 'match', in: ["aBcdE","[A-Z]"], out: ["B", "E"]},
        {f: 'base64Encode', in: ['a"b'], out: "YSJi"},
        {f: 'base64Decode', in: ["YSJi"], out: 'a"b'},
        {f: 'assert', in: [true, "abc"], out: ""},
        {f: 'toJsonString', in: [["a", "b"]], out: '["a","b"]'},
        {f: 'addHyphensSSN', in: [undefined], out: ""},
        {f: 'addHyphensDate', in: [undefined], out: ""},
        {f: 'convertDateTimeStringToUTC', in: [undefined], out: ""},
        {f: 'convertDateTimeStringToUTC', in: ["2004062917540000"], out: (new Date(Date.UTC(2004, 05, 29, 17, 54)).toJSON())}, // eslint-disable-line
        {f: 'convertDateTimeStringToUTC', in: ["2004"], out: (new Date(Date.UTC(2004, 00, 00, 00, 00)).toJSON())}, // eslint-disable-line
        {f: 'convertDateTimeStringToUTC', in: ["2004062917540034599999"], out: (new Date(Date.UTC(2004, 05, 29, 17, 54, 0, 345)).toJSON())}, // eslint-disable-line
        {f: 'formatAsDateTime', in: [undefined], out: ""},
        {f: 'formatAsDateTime', in: ["2004062917540000"], out: (new Date(Date.UTC(2004, 05, 29, 17, 54)).toJSON())}, // eslint-disable-line
        {f: 'formatAsDateTime', in: ["2004"], out: (new Date(Date.UTC(2004, 00, 00, 00, 00)).toJSON())}, // eslint-disable-line
        {f: 'formatAsDateTime', in: ["2004062917540034599999"], out: (new Date(Date.UTC(2004, 05, 29, 17, 54, 0, 345)).toJSON())}, // eslint-disable-line
        {f: 'getFieldRepeats', in: [null], out: null},
        {f: 'toLower', in: ["ABCD"], out: "abcd"},
        {f: 'toLower', in: [undefined], out: ""},
        {f: 'toUpper', in: [undefined], out: ""},
        {f: 'toUpper', in: ["abcd"], out: "ABCD"},
        {f: 'isNaN', in: [5], out: false},
        {f: 'isNaN', in: ["A"], out: true}
    ];

    opTests.forEach(t => {
        it(t.f + '(' + t.in.join(',') + ') should return ' + t.out, function(done) {
            var out = getHelper(t.f).func(...t.in);
            if (JSON.stringify(t.out) === JSON.stringify(out))
            {
                done();
            }
            else
            {
                done(new Error(t.f + '(' + t.in.join(',') + ') DOES NOT return ' + t.out + '. Returns: ' + out));
            }
        });
    });

    var opErrorTests = [
        {f: 'evaluate', in: [undefined]},
        {f: 'getFieldRepeats', in: ["a"]},
        {f: 'getFirstSegments', in: [undefined]},
        {f: 'getSegmentLists', in: [undefined, 'PID', 'NK1']},
        {f: 'getRelatedSegmentList', in: [undefined]},
        {f: 'getParentSegment', in: [undefined]},
        {f: 'hasSegments', in: [undefined, 'PID', 'NK1']},
        {f: 'split', in: ["a,x,b,x,c",",(x"]},
        {f: 'slice', in: [undefined, 1,2]},
        {f: 'strSlice', in: [undefined, 1,2]},
        {f: 'charAt', in: [undefined, 2]},
        {f: 'replace', in: ["abcdbc","b[(c","x"]},
        {f: 'match', in: ["aBcdE","[A-Z"]},
        {f: 'base64Encode', in: [undefined]},
        {f: 'base64Decode', in: [undefined]},
        {f: 'escapeSpecialChars', in: [undefined]},
        {f: 'unescapeSpecialChars', in: [undefined]},
    ];

    opErrorTests.forEach(t => {
        it(t.f + '(' + t.in.join(',') + ') should throw error', function(done) {
            try {
                var out = getHelper(t.f).func(...t.in);
                done(new Error(t.f + '(' + t.in.join(',') + ') does not throw. Returns: ' + out));
            }
            catch (err) {
                if (err.toString().includes(t.f)) {
                    done();
                }
                else {
                    done(new Error(`missing funcion name in error message`));
                }
            }
        });
    });

    it('assert should throw correct error message', function() {
        try {
            getHelper('assert').func(false, "abc");
            assert.fail();
        }
        catch (err) {
            assert.equal(err, "abc");
        }
    });

    it('now should return current time', function() {
        var before = new Date();
        var currentString = getHelper('now').func();
        var after = new Date();

        var current = helperUtils.getDate(currentString);

        assert.ok(before <= current);
        assert.ok(current <= after);
    });

    it('toString should return a string when given an array', function() {
        var out = getHelper('toString').func(["foo","bar"]);
        assert.strictEqual(typeof(out), "string");
        assert.strictEqual(out, 'foo,bar');
    });

    it('generateUUID returns the same guid for same URL', function(){
        var f = getHelper('generateUUID').func;
        assert.strictEqual(f('https://localhost/blah'), f('https://localhost/blah'));
    });

    it('generateUUID should return a guid', function() {
        assert(validator.isUUID(getHelper('generateUUID').func('https://localhost/blah')));
    });

    it('addHyphensSSN adds hyphens when passed 9 digits', function() {
        assert.strictEqual('123-45-6789', getHelper('addHyphensSSN').func('123456789'));
    });

    it('addHyphensSSN leaves input unchanged when not 9 digits', function() {
        assert.strictEqual('123', getHelper('addHyphensSSN').func('123'));
        assert.strictEqual('111111111111', getHelper('addHyphensSSN').func('111111111111'));
        assert.strictEqual('123-45-67', getHelper('addHyphensSSN').func('123-45-67'));
    });

    it('addHyphensDate adds hyphens when passed 8 digits', function() {
        assert.strictEqual('2001-01-02', getHelper('addHyphensDate').func('20010102'));
    });

    it('addHyphensDate leaves input unchanged when not 8 digits', function() {
        assert.strictEqual('123', getHelper('addHyphensDate').func('123'));
        assert.strictEqual('111111111111', getHelper('addHyphensDate').func('111111111111'));
        assert.strictEqual('2001-01-', getHelper('addHyphensDate').func('2001-01-'));
    });

    it('getSegmentLists should return a dictionary with segments', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'ADT01-23.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var segments = getHelper('getSegmentLists').func(msg.v2, 'PID', 'NK1', 'IN1', {});
                if (segments.PID.length != 1)
                {
                    done(new Error('Wrong number of PID segments'));
                }
                else if (segments.NK1.length != 1)
                {
                    done(new Error('Wrong number of NK1 segments'));
                }
                else if (segments.IN1.length != 3)
                {
                    done(new Error('Wrong number of IN1 segments'));
                }
                else
                {
                    done();
                }
            }
        });
    });

    it('getFirstSegments should return a dictionary with first instance of segments', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'ADT04-23.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var segments = getHelper('getFirstSegments').func(msg.v2, 'NK1', 'IN1', {});
                if (segments.NK1[0] != 1)
                {
                    done(new Error('Incorrect NK1 segments'));
                }
                else if (segments.IN1[0] != 1)
                {
                    done(new Error('Incorrect IN1 segments'));
                }
                else
                {
                    done();
                }
            }
        });
    });

    it('getFieldRepeats should return correct number of repeats', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'ADT01-28.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var segments = getHelper('getFirstSegments').func(msg.v2, 'PID', {});
                var repeats1 = getHelper('getFieldRepeats').func(segments.PID[0]);
                var repeats2 = getHelper('getFieldRepeats').func(segments.PID[2]);
                if (repeats1.length != 1)
                {
                    done(new Error(`Incorrect repeats for field ${segments.PID[0]}`));
                }
                else if (repeats2.length != 2)
                {
                    done(new Error(`Incorrect repeats for field ${segments.PID[2]}`));
                }
                else
                {
                    done();
                }
            }
        });
    });

    it('hasSegments should return true with valid segments', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'ADT01-23.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('hasSegments').func(msg.v2, 'PID', 'NK1', 'IN1', {});
                if (!result)
                {
                    done(new Error('Expected segments not found'));
                }
                else
                {
                    done();
                }
            }
        });
    });

    it('hasSegments should return false with valid segments', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'ADT01-23.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('hasSegments').func(msg.v2, 'PID', 'NK1', 'ORU', {});
                if (result)
                {
                    done(new Error('ORU segment should not be found'));
                }
                else
                {
                    done();
                }
            }
        });
    });

    it('getParentSegment should find parent', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'LAB-ORU-2.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('getParentSegment').func(msg.v2, 'OBX', 4, 'OBR', {});
                if (result['OBR'])
                {
                    done();
                }
                else
                {
                    done(new Error('OBR segment should be found'));
                }
            }
        });
    });

    it('getParentSegment should not find parent', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'LAB-ORU-2.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('getParentSegment').func(msg.v2, 'OBX', 4, 'FOO', {});
                if (!result['FOO'])
                {
                    done();
                }
                else
                {
                    done(new Error('OBR segment should be found'));
                }
            }
        });
    });

    it('getRelatedSegmentList should find children', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'LAB-ORU-2.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('getRelatedSegmentList').func(msg.v2, 'OBR', '2', 'OBX');
                if (result.OBX.length == 5)
                {
                    done();
                }
                else
                {
                    done(new Error('OBX segments should be found'));
                }
            }
        });
    });

    it('getRelatedSegmentList should not find children', function(done) {
        fs.readFile(path.join(constants.SAMPLE_DATA_LOCATION, 'LAB-ORU-2.hl7'), (err, content) => {
            if (err) {
                done(err);
            }
            else
            {
                var msg = hl7.parseHL7v2(content.toString());
                var result = getHelper('getRelatedSegmentList').func(msg.v2, 'OBR', '2', 'FOO');

                if (result.FOO.length == 0)
                {
                    done();
                }
                else
                {
                    done(new Error('FOO segments should NOT be found'));
                }
            }
        });
    });
});

describe('Helper "evaluate" test', function() {
    var tempPath = path.join(__dirname, 'test-helpers');
    const oldTemplateLocation = constants.TEMPLATE_FILES_LOCATION;
    const childTemplateName = 'helpersTestChild.hbs';

    before(function () {
        fse.removeSync(tempPath);
        fse.ensureDirSync(tempPath);
        constants.TEMPLATE_FILES_LOCATION = tempPath;
    });

    after(function () {
        fse.removeSync(tempPath);
        constants.TEMPLATE_FILES_LOCATION = oldTemplateLocation;
    });

    it('evaluate() should work when invoked with template path and obj', function (done) {
        var obj = {};
        obj.hash = { x1 : "1", x2 : "2"};

        fse.writeFileSync(path.join(tempPath, childTemplateName), '{"a":"{{x1}}", "b":"{{x2}}"}');
        var result = getHelper('evaluate').func(childTemplateName, obj);

        if (result['a'] == "1") {
            // 2nd iteration to test cache by assigning incorrect path to template location
            constants.TEMPLATE_FILES_LOCATION = "";
            result = getHelper('evaluate').func(childTemplateName, obj);

            if (result['b'] == "2") {
                done();
            }
            else {
                done(new Error('Incorrect output'));
            }
        }
        else {
            done(new Error('Incorrect output'));
        }
    });
});

function getHelper(helperName)
{
    for (var i = 0; i < helpers.length; i++)
    {
        if (helpers[i].name === helperName)
        {
            return helpers[i];
        }
    }
}
