const async = require('async')
const axios = require('axios')
const config = require('./../../config')
const utils = require('./../../lib/utils')
const tmfUtils = require('./../../lib/tmfUtils')
const storeClient = require('./../../lib/store').storeClient

const serviceCatalog = (function() {

    const serviceSpecificationPattern = new RegExp('/serviceSpecification/?$');
    const serviceCandidatePattern = new RegExp('/serviceCandidate/?$');


	const validateRetrieving = function(req, callback) {
        // Check if the request is a list of service specifications
        if (req.path.endsWith('serviceSpecification')) {
            return tmfUtils.filterRelatedPartyFields(req, () => tmfUtils.ensureRelatedPartyIncluded(req, callback));
        } else {
            callback(null);
        }
        // validate if a service specification is returned only by the owner
    };

    const validateCandidate = function(req, updatedCategory, oldCategory, action, callback) {
        // Candidates can only be created when Specification and Category are created
        // Igual la validación que está dando problemas se puede hace aquí
        if (!utils.hasRole(req.user, config.oauth2.roles.admin)) {
            callback({
                status: 403,
                message: 'Only administrators can ' + action + ' categories'
            });
        }
    };

    const createHandler = function(req, resp, callback) {
        if (tmfUtils.isOwner(req, resp)) {
            callback(null);
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
    };

    const validateCreation = function(req, callback) {
        let body;
        let flag = false;

        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });

            return; // EXIT
        }

        for (let i = 0; i < body.specCharacteristic.length; i++){
            if(body.specCharacteristic[i].name === "asset type"){
                flag = true;
                break;
            }
        }

        if (flag){
            if (serviceCandidatePattern.test(req.apiUrl)) {
                validateCandidate(req, body, null, 'create', callback);
            } else {
                // Check that the user has the seller role or is an admin
                if (!utils.hasRole(req.user, config.oauth2.roles.seller)) {
                    callback({
                        status: 403,
                        message: 'You are not authorized to create resources'
                    });
    
                    return; // EXIT
                }
    
                if (serviceSpecificationPattern.test(req.apiUrl)) {
                    createHandler(req, body, function(err) {
                        if (err) {
                            return callback(err);
                        }
    
                        // Check that the product specification contains a valid product
                        // according to the charging backend
                        storeClient.validateSpecification(body, req.user, callback);
                    });
                } else {
                    callback(null);
                    //createHandler(req, body, callback);
                }
            }
        } else {
            console.log("Sale por el else");
            callback(null);
            return;
        }
    };

    var getResourceAPIUrl = function(path) {
        const resPath = path.replace(`/${config.endpoints.service.path}/`, '')

        return utils.getAPIURL(
            config.endpoints.service.appSsl,
            config.endpoints.service.host,
            config.endpoints.service.port,
            resPath
        );
    };

    const retrieveAsset = function(path, callback) {
        const uri = getResourceAPIUrl(path);

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

    const validateOwnerSeller = function(req, callback) {
        retrieveAsset(req.apiUrl, function(err, response) {
            if (err) {
                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The required service does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The required service cannot be created/updated'
                    });
                }
            } else {
                if (!tmfUtils.hasPartyRole(req, response.body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
                    callback({
                        status: 403,
                        message: 'Unauthorized to update non-owned/non-seller services'
                    });
                } else {
                    callback(null)
                }
            }
        });
    };

	const validateOwnerSellerPost = function(req, callback) {
        let body;
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });

            return; // EXIT
        }

        if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
            callback({
                status: 403,
                message: 'Unauthorized to create non-owned/non-seller service specs'
            });
        } else {
            callback(null)
        }
    };

	const validators = {
		GET: [utils.validateLoggedIn, validateRetrieving],
		POST: [utils.validateLoggedIn, validateOwnerSellerPost, validateCreation],
		PATCH: [utils.validateLoggedIn, validateOwnerSeller],
		PUT: [utils.validateLoggedIn, validateOwnerSeller],
		DELETE: [utils.validateLoggedIn, validateOwnerSeller]
	};

	const checkPermissions = function(req, callback) {
		const reqValidators = [];

		for (let i in validators[req.method]) {
			reqValidators.push(validators[req.method][i].bind(this, req));
		}

		async.series(reqValidators, callback);
	};

	const executePostValidation = function(response, callback) {
		const body = response.body

        // Check if the user is allowed to retrieve the requested resource specification
        if (!Array.isArray(body) && !tmfUtils.hasPartyRole(response, body.relatedParty, 'owner')) {
            callback({
                status: 403,
                message: 'You are not authorized to retrieve the specified service specification from the catalog'
            });
        } else {
            callback(null);
        }
	};

	const handleAPIError = function(res, callback) {
		callback(null);
	};

	return {
		checkPermissions: checkPermissions,
		executePostValidation: executePostValidation,
		handleAPIError: handleAPIError
	}
})();

exports.serviceCatalog = serviceCatalog;
