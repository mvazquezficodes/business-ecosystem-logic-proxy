(function() {
	'use strict';

	angular.module('app').factory('ServiceCandidate', [
		'$resource',
		'URLS',
		'LIFECYCLE_STATUS',
		'User',
		ServiceCandidateService
	]);

	function ServiceCandidateService($resource, URLS, LIFECYCLE_STATUS, User) {
		const resource = $resource(URLS.SERVICE_CATALOG + '/serviceCandidate/:serviceCandidateId', {
			serviceCandidateId: '@serviceCandidateId'
		}, {
            update: { method: 'PATCH' }
        })

		function getServiceCandidates(search) {
			let params = {}

			if (search.offset >= 0) {
				params.offset = search.offset
			}

			if (search.limit >= 0) {
				params.limit = search.limit
			}

			if (search.lifecycleStatus) {
				params.lifecycleStatus = search.lifecycleStatus
			}

			let promise = new Promise(function(resolve, reject) {
				resource.query(
					params,
					(itemList) => {
						resolve(itemList);
					},
					(reponse) => {
						reject(reponse);
					});
			});
			return promise;
		}

		function getServiceSpecficiation(serviceCandidateId) {
			let promise = new Promise(function(resolve, reject) {
				let params = { serviceCandidateId: serviceCandidateId };
				resource.get(params,
					(serviceCandidate) => {
						resolve(serviceCandidate)
					},
					(response) => {
						reject(response)
					});
			});
			return promise;
		}

		function updateServiceCandidate(serviceCandidateId, data) {
			let promise = new Promise(function(resolve, reject) {
				resource.update({ serviceCandidateId: serviceCandidateId },
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

		function createServiceCandidate(data) {
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

		function deleteServiceCandidate(serviceCandidateId) {
			let promise = new Promise(function(resolve, reject) {
				resource.delete({ serviceCandidateId: serviceCandidateId },
					() => {
						resolve();
					},
					(response) => {
						reject(response);
					}
				);
			});
			return promise;
		}

		function exists(params) {
			let promise = new Promise(function(resolve, _reject) {
				resource.query(params,
					(serviceCandidateList) => {
						resolve(serviceCandidateList)
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
			getServiceCandidates: getServiceCandidates,
			getServiceSpecficiation: getServiceSpecficiation,
			udpateServiceCandidate: updateServiceCandidate,
			createServiceCandidate: createServiceCandidate,
			deleteServiceCandidate: deleteServiceCandidate,
			exists: exists,
			buildInitialData: buildInitialData
		};
	}
})();