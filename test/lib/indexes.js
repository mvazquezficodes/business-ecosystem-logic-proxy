/*global expect, it, jasmine, describe */

/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var proxyrequire = require("proxyquire"),
    md5 = require("blueimp-md5");

describe("Test index helper library", function () {
    var createSearchMock = function createSearchMock(path, err, extra) {
        var si = {
            add: function (data, ops, cb) {
                if (extra.checkadd) {
                    extra.checkadd(data, ops);
                }

                cb(extra.adderr);
            },
            close: function (cb) {
                cb(extra.closeerr);
            },
            del: function (key, cb) {
                if (extra.checkdel) {
                    extra.checkdel(key);
                }

                cb(extra.delerr);
            },
            search: function (query, cb) {
                if (extra.checksearch) {
                    extra.checksearch(query);
                }
                var data = extra.searchdata;
                if (Array.isArray(extra.searchdata)) {
                    data = extra.searchdata[0];
                    extra.searchdata = extra.searchdata.slice(1);
                }
                cb(extra.searcherr, data || {});
            }
        };

        spyOn(si, "add").and.callThrough();
        spyOn(si, "close").and.callThrough();
        spyOn(si, "del").and.callThrough();
        spyOn(si, "search").and.callThrough();

        return {
            method: function (cfg, f) {
                if (!extra.notpath) {
                    expect(cfg).toEqual({ indexPath: path });
                }

                f(err, si);
            },
            si: si
        };
    };

    var getIndexLib = function getIndexLib(method) {
        if (!method) {
            method = function () {};
        }

        return proxyrequire("../../lib/indexes.js", {
            "search-index": method
        });
    };

    it("should have correct tables", function () {
        var indexes = getIndexLib();
        expect(indexes.siTables.offerings).toEqual("indexes/offerings");
        expect(indexes.siTables.products).toEqual("indexes/products");
        expect(indexes.siTables.catalogs).toEqual("indexes/catalogs");
    });

    var helper = function helper(db, err, extra, f1, success, error) {
        var si = createSearchMock(db, err, extra);
        var indexes = getIndexLib(si.method);
        indexes[f1].apply(this, Array.prototype.slice.call(arguments, 6))
            .then(extra => success(si.si, extra))
            .catch(err => error(si.si, err));
    };

    var helperErrorOpenDB = function helperErrorOpenDB(done, f1, f2) {
        helper(arguments[3], "ERROR", {}, f1, (si, err) => {
            expect("Error, promise resolved instead of rejected!: " + err).toBe(true);
            done();
        }, (si, err) => {
            expect(err).toBe("ERROR");
            expect(si[f2]).not.toHaveBeenCalled();
            expect(si.close).not.toHaveBeenCalled();
            done();
        }, ...Array.prototype.slice.call(arguments, 3));
    };

    var helperErrorInMethod = function helperErrorInMethod(done, f1, f2) {
        var extra = {};
        extra[f2 + "err"] = "ERROR";
        helper("testp", null, extra, f1, (si, data) => {
            expect("Error, promise resolved instead of rejected!: " + data).toBe(true);
            done();
        }, (si, err) => {
            expect(err).toBe("ERROR");
            expect(si[f2]).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, ...Array.prototype.slice.call(arguments, 3));
    };

    it("should reject promise and call close with an error when open database while saving", function (done) {
        helperErrorOpenDB(done, "saveIndex", "add", "testp", [], {});
    });

    it("should reject promise and call close with an error when adding an index while saving", function (done) {
        helperErrorInMethod(done, "saveIndex", "add", "testp", [], {});
    });

    it("should resolve the promise, close index and call save with the correct data", function (done) {
        var testdata = [1, 2, 3];
        var testops = { t: 1 };
        var extra = {
            checkadd: function (data, op) {
                expect(data).toEqual(testdata);
                expect(op).toEqual(testops);
            }
        };

        helper("testp", null, extra, "saveIndex", (si, data) => {
            expect(data).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, "testp", testdata, testops);
    });

    it("should reject promise and call close with an error when open database while removing", function (done) {
        helperErrorOpenDB(done, "removeIndex", "del", "testp", "key");
    });

    it("should reject promise and call close with an error when removing the index", function (done) {
        helperErrorInMethod(done, "removeIndex", "del", "testp", "key");
    });

    it("should resolve the promise, close index and call del with the correct key", function (done) {
        var testkey = "KEY";
        var extra = {
            checkdel: key => {
                expect(key).toEqual(testkey);
            }
        };

        helper("testp", null, extra, "removeIndex", (si, data) => {
            expect(data).toBeUndefined();
            expect(si.del).toHaveBeenCalledWith(testkey, jasmine.any(Function));
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, "testp", testkey);
    });

    it("should create queries correctly", function () {
        var indexes = getIndexLib();
        expect(indexes.createQuery()).toEqual({});
        expect(indexes.createQuery("q")).toEqual({query: "q"});
        expect(indexes.createQuery(null, "o")).toEqual({offset: "o"});
        expect(indexes.createQuery(null, null, "s")).toEqual({pageSize: "s"});
        expect(indexes.createQuery(null, null, null, "s")).toEqual({sort: "s"});

        expect(indexes.createQuery({"*": ["*"]}, 0, 25, ["id", "asc"])).toEqual({
            query: {"*": ["*"]},
            pageSize: 25,
            sort: ["id", "asc"]
        });

        expect(indexes.createQuery({"*": ["*"]}, 2, 0,["id", "asc"])).toEqual({
            query: {"*": ["*"]},
            offset: 2,
            pageSize: 0,
            sort: ["id", "asc"]
        });
    });

    it("should reject promise and call close with an error when open database while searching", function (done) {
        helperErrorOpenDB(done, "search", "search", "testp", {"*": ["*"]});
    });

    it("should reject promise and call close with an error when searching", function (done) {
        helperErrorInMethod(done, "search", "search", "testp", {"*": ["*"]});
    });

    var searchHelper = function searchHelper(done, path, q, d, method) {
        method = method || "search";
        d = {hits: d};
        var sendp = (method === "search") ? path : q;
        var newq = q;
        if (!q.query) {
            newq = {query: q};
        }

        var extra = {
            checksearch: query => {
                expect(query).toEqual(newq);
            },
            searchdata: d
        };

        helper(path, null, extra, method, (si, data) => {
            expect(data).toEqual(d);
            expect(si.search).toHaveBeenCalledWith(newq, jasmine.any(Function));
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, sendp, q);
    };

    it("should resolve the promise, close index and call search with the correct data", function (done) {
        var q = {"*": ["*"]};
        var d = {hits: [1, 2, 3, 4]};
        searchHelper(done, "testp", q, d);
    });

    it("should resolve the promise, close index and call search with the correct data, using full query", function (done) {
        var q = {query: {"*": ["*"]}};
        var d = {hits: [1, 2, 3, 4]};
        searchHelper(done, "testp", q, d);
    });

    it("should use offering index and search correctly", function (done) {
        searchHelper(done, "indexes/offerings", {}, [1], "searchOfferings");
    });

    it("should use products index and search correctly", function (done) {
        searchHelper(done, "indexes/products", {}, [1], "searchProducts");
    });

    it("should use catalogs index and search correctly", function (done) {
        searchHelper(done, "indexes/catalogs", {}, [1], "searchCatalogs");
    });

    it("should fix the user id doing an MD5 hash", function () {
        var indexes = getIndexLib();
        expect(indexes.fixUserId("some-id_")).toEqual(md5("some-id_"));
    });

    it("should search the ID fixing it before", function () {
        var indexes = getIndexLib();
        var f = {
            f: () => {}
        };

        spyOn(f, "f");
        indexes.searchUserId(f.f, "id");

        expect(f.f).toHaveBeenCalledWith({query: {AND: {userId: [md5("id")]}}});
    });

    // CATALOGS

    var catalogData = {
        id: 3,
        href: "http://3",
        lifecycleStatus: "Obsolete",
        name: "Name",
        relatedParty: [{id: "rock"}]
    };

    var catalogExpected = {
        id: "catalog:3",
        originalId: 3,
        sortedId: "000000000003",
        relatedPartyHash: [md5("rock")],
        relatedParty: ["rock"],
        href: "http://3",
        lifecycleStatus: "Obsolete",
        name: "Name"
    };

    it("should convert catalog data correctly", function () {
        var indexes = getIndexLib();
        expect(indexes.convertCatalogData(catalogData)).toEqual(catalogExpected);
    });

    it("should save converted catalog data correctly", function (done) {
        var extra = {
            checkadd: (data, ops) => {
                expect(data).toEqual([catalogExpected]);
                expect(ops).toEqual({});
            }
        };
        helper("indexes/catalogs", null, extra, "saveIndexCatalog", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [catalogData]);
    });

    // PRODUCTS

    var productData = {
        id: 1,
        href: "http://1",
        name: "name",
        brand: "brand",
        lifecycleStatus: "Active",
        isBundle: false,
        productNumber: 12,
        relatedParty: [{id: "rock-8"}, {id: "rock-9"}]
    };

    var productExpected = {
        id: "product:1",
        href: "http://1",
        lifecycleStatus: "Active",
        isBundle: false,
        productNumber: 12,
        originalId: 1,
        sortedId: "000000000001",
        body: ["name", "brand"],
        relatedPartyHash: [md5("rock-8"),  md5("rock-9")],
        relatedParty: ["rock-8", "rock-9"]
    };

    it("should convert product data correctly", function () {
        var indexes = getIndexLib();
        expect(indexes.convertProductData(productData)).toEqual(productExpected);
    });

    it("should save converted product data correctly", function (done) {
        var extra = {
            checkadd: (data, ops) => {
                expect(data).toEqual([productExpected]);
                expect(ops).toEqual({fieldOptions: [{fieldName: "body", filter: true}, {fieldName: "relatedParty", filter: true}]});
            }
        };
        helper("indexes/products", null, extra, "saveIndexProduct", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [productData]);
    });

    // OFFERINGS

    var notBundleOffer = {
        id: 2,
        productSpecification: productData,
        name: "name",
        description: "description",
        href: "http://2",
        lifecycleStatus: "Active",
        isBundle: false
    };

    var bundleOffer = {
        id: 3,
        bundledProductOffering: [{id: 2}],
        name: "name",
        description: "description",
        href: "http://3",
        lifecycleStatus: "Active",
        isBundle: true
    };

    var bundleExpected = {
        id: "offering:3",
        originalId: 3,
        sortedId: "000000000003",
        body: ["name", "description"],
        userId: md5("rock-8"),
        productSpecification: undefined,
        href: "http://3",
        lifecycleStatus: "Active",
        isBundle: true
    };

    var notBundleExpected = {
        id: "offering:2",
        originalId: 2,
        sortedId: "000000000002",
        body: ["name", "description"],
        userId: md5("rock-8"),
        productSpecification: 1,
        href: "http://2",
        lifecycleStatus: "Active",
        isBundle: false
    };

    it('should convert offer without bundle with an explicit user', function (done) {
        var user = {id: "rock-8"};

        helper("indexes/products", null, {}, "convertOfferingData", (si, extra) => {
            expect(extra).toEqual(notBundleExpected);
            expect(si.search).not.toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, notBundleOffer, user);
    });

    it('should convert offer without bundle searching user the user in products index', function(done) {
        var extra = {
            checksearch: query => {
                expect(query).toEqual({query: {AND: {id: ["product:1"]}}});
            },
            searchdata: {
                hits: [{
                    document: {
                        relatedParty: ["rock-8"]
                    }
                }]
            }

        };

        helper("indexes/products", null, extra, "convertOfferingData", (si, extra) => {
            expect(extra).toEqual(notBundleExpected);
            expect(si.search).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, notBundleOffer);
    });

    it('should convert offer with bundle with an explicit user', function(done) {
        var user = {id: "rock-8"};

        helper("indexes/products", null, {}, "convertOfferingData", (si, extra) => {
            expect(extra).toEqual(bundleExpected);
            expect(si.search).not.toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, bundleOffer, user);
    });

    it('should convert offer with bundle searching user in products and offerings index', function(done) {
        var offer = {
            hits: [{
                document: {
                    productSpecification: 1
                }
            }]
        };
        var product = {
            hits: [{
                document: {
                    relatedParty: ["rock-8"]
                }
            }]
        };
        var queries = [{query: {AND: {id: ["product:1"]}}}, {query: {AND: {id: ["offering:2"]}}}];

        var extra = {
            notpath: true,
            checksearch: query => {
                var q = queries.pop();
                expect(query).toEqual(q);
            },
            searchdata: [offer, product]
        };

        helper("indexes/offering", null, extra, "convertOfferingData", (si, extra) => {
            expect(extra).toEqual(bundleExpected);
            expect(si.search).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, bundleOffer);
    });

    it("should save converted offer data correctly", function (done) {
        var user = {id: "rock-8"};

        var extra = {
            checkadd: (data, ops) => {
                expect(data).toEqual([notBundleExpected]);
                expect(ops).toEqual({fieldOptions: [{fieldName: 'body', filter: true}]});
            }
        };
        helper("indexes/offerings", null, extra, "saveIndexOffering", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [notBundleOffer], user);
    });

    it("should save converted bundled offer data correctly", function (done) {
        var user = {id: "rock-8"};

        var extra = {
            checkadd: (data, ops) => {
                expect(data).toEqual([bundleExpected]);
                expect(ops).toEqual({fieldOptions: [{fieldName: 'body', filter: true}]});
            }
        };
        helper("indexes/offerings", null, extra, "saveIndexOffering", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [bundleOffer], user);
    });


    // TODO: Inventory && Orders

    var inventoryData = {
        id: 12,
        productOffering: {
            id: 5
        },
        relatedParty: [{id: "rock"}],
        href: "http://12",
        name: "inventoryName",
        status: "status",
        startDate: 232323232,
        orderDate: 232323231,
        terminationDate: 232323233
    };

    var inventoryExpected = {
        id: "inventory:12",
        originalId: 12,
        sortedId: "000000000012",
        productOffering: 5,
        relatedPartyHash: [md5("rock")],
        relatedParty: ["rock"],
        href: "http://12",
        name: "inventoryName",
        status: "status",
        startDate: 232323232,
        orderDate: 232323231,
        terminationDate: 232323233
    };

    it("should convert inventory data correctly", function () {
        var indexes = getIndexLib();
        expect(indexes.convertInventoryData(inventoryData)).toEqual(inventoryExpected);
    });

    it("should save converted inventory data correctly", function (done) {
        var extra = {
            extraadd: (data, ops) => {
                expect(data).toEqual([inventoryExpected]);
                expect(ops).toEqual({});
            }
        };
        helper("indexes/inventory", null, extra, "saveIndexInventory", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [inventoryData]);
    });

    var orderData = {
        id: 23,
        relatedParty: [{id: "rock"}],
        href: "http://23",
        priority: "prior",
        category: "endofunctor",
        state: "active",
        notificationContact: "m@c.es",
        note: ""
    };

    var orderExpected = {
        id: "order:23",
        originalId: 23,
        sortedId: "000000000023",
        relatedPartyHash: [md5("rock")],
        relatedParty: ["rock"],
        href: "http://23",
        priority: "prior",
        category: "endofunctor",
        state: "active",
        notificationContact: "m@c.es",
        note: ""
    };

    it("should convert order data correctly", function () {
        var indexes = getIndexLib();
        expect(indexes.convertOrderData(orderData)).toEqual(orderExpected);
    });

    it("should save converted order data correctly", function (done) {
        var extra = {
            extraadd: (data, ops) => {
                expect(data).toEqual([orderExpected]);
                expect(ops).toEqual({});
            }
        };
        helper("indexes/orders", null, extra, "saveIndexOrder", (si, extra) => {
            expect(extra).toBeUndefined();
            expect(si.add).toHaveBeenCalled();
            expect(si.close).toHaveBeenCalled();
            done();
        }, (si, err) => {
            expect("Error, promise rejected instead of resolved: " + err).toBe(true);
            done();
        }, [orderData]);
    });

    describe("Request helpers", function () {

        it('should create query correctly', function() {
            var indexes = getIndexLib();

            var fs = {f: () => {}};
            spyOn(fs, "f");
            var req = {query: {}};

            var query = indexes.genericCreateQuery([], "", fs.f, req);

            expect(fs.f).toHaveBeenCalledWith(req, { AND: [] });

            expect(query).toEqual({
                offset: 0,
                pageSize: 25,
                sort: ["sortedId", "asc"],
                query: {
                    AND: []
                }
            });
        });

        it('should create query with extra parameters', function() {
            var indexes = getIndexLib();

            var req = {query: {
                key1: "VALUE1",
                key2: 23,
                notadded: "not"
            }};

            var query = indexes.genericCreateQuery(["key1", "key2", "notextra"], "", null, req);

            expect(query).toEqual({
                offset: 0,
                pageSize: 25,
                sort: ["sortedId", "asc"],
                query: {
                    AND: [
                        { key1: ["value1"] },
                        { key2: [23] }
                    ]
                }
            });
        });

        it('should not execute if GET request', function () {
            var indexes = getIndexLib();

            var req = {
                method: "POST"
            };

            var fs = {
                reg: {test: () => {}},
                createOffer: () => {},
                search: () => {}
            };

            spyOn(fs.reg, "test");
            spyOn(fs, "createOffer");
            spyOn(fs, "search");

            indexes.getMiddleware(fs.reg, fs.createOffer, fs.search, req);
            expect(fs.reg.test).not.toHaveBeenCalled();
            expect(fs.createOffer).not.toHaveBeenCalled();
            expect(fs.search).not.toHaveBeenCalled();
        });

        it("should not execute if regex don't test", function() {
            var indexes = getIndexLib();

            var req = {
                method: "GET",
                apiUrl: "url"
            };

            var fs = {
                reg: {test: () => {}},
                createOffer: () => {},
                search: () => {}
            };

            spyOn(fs.reg, "test").and.callFake(s => new RegExp('noturl').test(s));
            spyOn(fs, "createOffer");
            spyOn(fs, "search");

            indexes.getMiddleware(fs.reg, fs.createOffer, fs.search, req);
            expect(fs.reg.test).toHaveBeenCalledWith("url");
            expect(fs.createOffer).not.toHaveBeenCalled();
            expect(fs.search).not.toHaveBeenCalled();
        });

        it('should not execute if query have explicit id', function() {
            var indexes = getIndexLib();

            var req = {
                method: "GET",
                apiUrl: "url",
                query: {
                    id: "1,2,3"
                }
            };

            var fs = {
                reg: {test: () => {}},
                createOffer: () => {},
                search: () => {}
            };

            spyOn(fs.reg, "test").and.returnValue(true);
            spyOn(fs, "createOffer");
            spyOn(fs, "search");

            indexes.getMiddleware(fs.reg, fs.createOffer, fs.search, req);
            expect(fs.reg.test).toHaveBeenCalledWith("url");
            expect(fs.createOffer).not.toHaveBeenCalled();
            expect(fs.search).not.toHaveBeenCalled();
        });

        it('should execute middleware with default search correctly', function(done) {
            var indexes = getIndexLib();

            var req = {
                method: "GET",
                apiUrl: "url",
                query: {
                    depth: "2",
                    notadd: "not"
                },
                _parsedUrl: {
                    pathname: "path"
                }
            };

            var fs = {
                reg: {test: () => {}},
                createOffer: () => {},
                search: () => {}
            };

            var results = {
                hits: [{document: {originalId: 1}}, {document: {originalId: 2}}]
            };

            var search = {
                offset: 0,
                pageSize: 25,
                sort: ["sortedId", "asc"],
                query: {
                    AND: [{ "*": ["*"]}]
                }
            };

            spyOn(fs.reg, "test").and.returnValue(true);
            spyOn(fs, "createOffer").and.callFake(indexes.genericCreateQuery.bind(this, [], "", null));
            spyOn(fs, "search").and.returnValue(Promise.resolve(results));

            indexes.getMiddleware(fs.reg, fs.createOffer, fs.search, req)
                .then(() => {
                    expect(fs.reg.test).toHaveBeenCalledWith("url");
                    expect(fs.createOffer).toHaveBeenCalled();
                    expect(fs.search).toHaveBeenCalledWith(search);

                    expect(req.apiUrl).toEqual("path?id=1,2&depth=2");
                    done();
                });
        });

        it('should execute middleware search correctly without results', function(done) {
            var indexes = getIndexLib();

            var req = {
                method: "GET",
                apiUrl: "url",
                query: {
                    fields: "value",
                    notadd: "not"
                },
                _parsedUrl: {
                    pathname: "path"
                }
            };

            var results = {
                hits: []
            };
            var search = {
                query: {
                    AND: [{'search': ['value']}]
                }};

            var fs = {
                reg: {test: () => {}},
                createOffer: () => search,
                search: () => {}
            };

            spyOn(fs.reg, "test").and.returnValue(true);
            spyOn(fs, "createOffer").and.callThrough();
            spyOn(fs, "search").and.returnValue(Promise.resolve(results));

            indexes.getMiddleware(fs.reg, fs.createOffer, fs.search, req)
                .then(() => {
                    expect(fs.reg.test).toHaveBeenCalledWith("url");
                    expect(fs.createOffer).toHaveBeenCalled();
                    expect(fs.search).toHaveBeenCalledWith(search);

                    expect(req.apiUrl).toEqual("path?id=&fields=value");
                    done();
                });
        });
    });
});
