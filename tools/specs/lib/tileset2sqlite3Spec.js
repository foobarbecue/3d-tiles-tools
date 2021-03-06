'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var sqlite3 = require('sqlite3');
var zlib = require('zlib');
var fileExists = require('../../lib/fileExists');
var isGzipped = require('../../lib/isGzipped');
var tileset2sqlite3 = require('../../lib/tileset2sqlite3');

var fsExtraReadJson = Promise.promisify(fsExtra.readJson);
var fsExtraRemove = Promise.promisify(fsExtra.remove);
var zlibGunzip = Promise.promisify(zlib.gunzip);

var getStringFromTypedArray = Cesium.getStringFromTypedArray;

var inputDirectory = './specs/data/TilesetOfTilesets/';
var tilesetJsonFile = './specs/data/TilesetOfTilesets/tileset.json';
var outputFile = './specs/data/TilesetOfTilesets.3dtiles';

describe('tileset2sqlite3', function() {
    afterEach(function (done) {
        fsExtraRemove(outputFile)
            .then(function() {
                done();
            });
    });

    it('creates a sqlite database from a tileset', function(done) {
        expect(tileset2sqlite3(inputDirectory, outputFile)
            .then(function() {
                var db;
                return fileExists(outputFile)
                    .then(function(exists) {
                        expect(exists).toEqual(true);
                    }).then(function() {
                        db = new sqlite3.Database(outputFile);
                        var dbAll = Promise.promisify(db.all, {context : db});
                        return dbAll("SELECT * FROM media WHERE key='tileset.json'");
                    }).then(function(rows) {
                        expect(rows.length).toEqual(1);

                        var content = rows[0].content;
                        expect(isGzipped(content)).toEqual(true);

                        return Promise.all([
                            zlibGunzip(content),
                            fsExtraReadJson(tilesetJsonFile)
                        ]).then(function(data) {
                            var jsonStr = getStringFromTypedArray(data[0]);
                            var dbTilesetJson = JSON.parse(jsonStr);
                            var tilesetJson = data[1];
                            expect(dbTilesetJson).toEqual(tilesetJson);
                        });
                    }).finally(function() {
                        db.close();
                    });
            }), done).toResolve();
    });

    it('throws an error if no input directory is provided', function() {
        expect(function() {
            tileset2sqlite3(undefined, outputFile);
        }).toThrowError('inputDirectory is required.');
    });

    it('throws an error if no output file is provided', function() {
        expect(function() {
            tileset2sqlite3(inputDirectory, undefined);
        }).toThrowError('outputFile is required.');
    });
});
