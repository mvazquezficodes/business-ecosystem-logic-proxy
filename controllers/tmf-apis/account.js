/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const async = require('async')
const axios = require('axios')
const config = require('./../../config')
const logger = require('./../../lib/logger').logger.getLogger('TMF')
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')
const path = require('path')

const account = (function() {

    var OWNER_ROLE = config.billingAccountOwnerRole;

    var getAccountPath = function(asset) {
        return url.parse(asset.account.href).pathname;
    };

    var getAccountAPIUrl = function(path) {
        const accountPath = path.replace(`/${config.endpoints.billing.path}/`, '')

        return utils.getAPIURL(
            config.endpoints.billing.appSsl,
            config.endpoints.billing.host,
            config.endpoints.billing.port,
            accountPath
        );
    };


    const retrieveAsset = function(path, callback) {
        const uri = getAccountAPIUrl(path);

        console.log("RetrieveAsset");
        console.log(path);

        console.log(uri.split('/'));


        axios.get(uri).then((response) => {
            if (response.status >= 400) {
                callback({
                    status: response.status
                });
            } else {
                callback(null, {
                    status: response.status,
                    body: response.data
                });
            }
        }).catch((err) => {
            callback({
                status: err.response.status
            });
        })
    };


    var validateRetrieval = function(req, callback) {
        // Check if the request is a list of resources specifications

        if (req.path.endsWith('billingAccount')) {
            return tmfUtils.filterRelatedPartyFields(req, () => tmfUtils.ensureRelatedPartyIncluded(req, callback));
        } else {
            callback(null);
        }
        // validate if a resource specification is returned only by the owner
    };

    var validateRelatedParty = function(req, callback) {
        var relatedPartyField = 'relatedParty';

        // Creation request must include relatedParty field. Otherwise, an error must be arisen

        if (req.method === 'POST' && !(relatedPartyField in req.json)) {
            callback({
                status: 422,
                message: 'Billing Accounts cannot be created without related parties'
            });
        } else {
            // This part only be executed for update requests or for creation requests that include
            // the relatedParty field.

            if (!(relatedPartyField in req.json) || tmfUtils.hasPartyRole(req, req.json.relatedParty, OWNER_ROLE)) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: 'The user making the request and the specified owner are not the same user'
                });
            }
        }
    };

    var validateOwner = function(req, callback) {
        retrieveAsset(req.apiUrl, function(err, response) {
            if (err) {
                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The required billing account does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The required billing account cannot be created/updated'
                    });
                }
            } else {
                if (!tmfUtils.hasPartyRole(req, response.body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
                    callback({
                        status: 403,
                        message: 'Unauthorized to update non-owned/non-seller billing account'
                    });
                }        
                else{
                    callback(null)
                }
            }
        });
    };

    var validators = {
        GET: [utils.validateLoggedIn, validateRetrieval],
        //GET: [utils.validateLoggedIn],
        //POST: [utils.validateLoggedIn, validateCreation, validateAccountAccountNotIncluded],
        POST: [utils.validateLoggedIn, validateRelatedParty],
        //PATCH: [utils.validateLoggedIn, validateUpdateOwner, validateIDNotModified, validateAccountAccountNotIncluded],
        PATCH: [utils.validateLoggedIn, validateRelatedParty/*, validateOwner*/],
        // This method is not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateCreation ],
        DELETE: [utils.validateLoggedIn]
    };

    var checkPermissions = function(req, callback) {
        var pathRegExp = new RegExp(
            '^/' + config.endpoints.billing.path + '?(/(.*))?$'
        );

        var apiPath = url.parse(req.apiUrl).pathname;
        var regExpResult = pathRegExp.exec(apiPath);

        const aux = req.apiUrl;
        console.log("Print body");
        console.log(req.body);
        req.apiUrl = '/' + config.endpoints.billing.path + aux;


        /*const aux = req.apiUrl;
        console.log("Print aux");
        console.log(aux);
        req.apiUrl = '/' + config.endpoints.billing.path + aux;*/

        if (regExpResult) {
            req.isCollection = regExpResult[3] ? false : true;
            req.isAccount = regExpResult[1] ? true : false;

            if (req.method in validators) {
                try {
                    var reqValidators = [];

                    if (req.body && typeof req.body === 'string') {
                        req.json = JSON.parse(req.body);
                    }

                    for (var i in validators[req.method]) {
                        reqValidators.push(validators[req.method][i].bind(this, req));
                    }

                    async.series(reqValidators, callback);
                } catch (e) {
                    callback({
                        status: 400,
                        message: 'Invalid body'
                    });
                }
            } else {
                callback({
                    status: 405,
                    message: 'Method not allowed'
                });
            }
        } else {
            callback({
                status: 403,
                message: 'This API feature is not supported yet'
            });
        }
    };

    var executePostValidation = function(req, callback) {
        if (req.method === 'GET') {
            var account = req.body;

            if (Array.isArray(account)) {
                // checkPermissions ensures that only owned billing accounts are retrieved
                return callback(null);
            } else if (req.apiUrl.indexOf('billingAccount') > -1) {
                // This checks that the user is included in the list of related parties...
                if (tmfUtils.isRelatedParty(req, account.relatedParty)) {
                    return callback(null);
                } else {
                    return callback({
                        status: 403,
                        message: 'Unauthorized to retrieve the specified billing account'
                    });
                }
            } else {
                // Check that the user can retrieve the specified charge
                validateProductCharge(req, account.serviceId[0].id, callback);
            }
        } else {
            return callback(null);
        }
    };
    
    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.account = account;
