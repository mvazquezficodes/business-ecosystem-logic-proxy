(function() {
	'use strict';

	angular.module('app').factory('ServiceCategory', [
		'$resource',
		'URLS',
		'LIFECYCLE_STATUS',
		'User',
		ServiceCategoryService
	]);

	function ServiceCategoryService($resource, URLS, LIFECYCLE_STATUS, User) {
		const resource = $resource(URLS.SERVICE_CATALOG + '/serviceCategory?name=:aux', {
			aux: '@aux'
		}, {
			'get': {method: 'GET', isArray: true }
        })

		/*function getServiceCategorys() {
            var deferred = $q.defer();
            var params = {};

            resource.query(params, function(typeList) {
                deferred.resolve(typeList);
            });

            return deferred.promise;
		}*/

		function getServiceCategory(aux) {
			let promise = new Promise(function(resolve, reject) {
				let params = { aux: aux };
				resource.get(params,
					(serviceCategory) => {
						resolve(serviceCategory)
					},
					(response) => {
						reject(response)
					});
			});
			return promise;
		}

		/*function updateServiceCategory(serviceCategoryId, data) {
			let promise = new Promise(function(resolve, reject) {
				resource.update({ serviceCategoryId: serviceCategoryId },
					data,
					(updated) => {
						resolve(updated)
					},
					(response) => {
						reject(response)
					}
				);
			});
			return promise;
		}

		function createServiceCategory(data) {
			let promise = new Promise(function(resolve, reject) {
				resource.save(
					data,
					(created) => {
						resolve(created);
					},
					(response) => {
						reject(response);
					}
				);
			});
			return promise;
		}

		function deleteServiceCategory(serviceCategoryId) {
			let promise = new Promise(function(resolve, reject) {
				resource.delete({ serviceCategoryId: serviceCategoryId },
					() => {
						resolve();
					},
					(response) => {
						reject(response);
					}
				);
			});
			return promise;
		}*/

		function exists(params) {
			let promise = new Promise(function(resolve, _reject) {
				resource.query(params,
					(serviceCategoryList) => {
						resolve(serviceCategoryList)
					}
				);
			});
			return promise;
		}

		function buildInitialData() {
            return {
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                relatedParty: [User.serialize()]
            };
        }

		return {
			//getServiceCategorys: getServiceCategorys,
			getServiceCategory: getServiceCategory,
			/*udpateServiceCategory: updateServiceCategory,
			createServiceCategory: createServiceCategory,
			deleteServiceCategory: deleteServiceCategory,*/
			exists: exists,
			buildInitialData: buildInitialData
		};
	}
})();