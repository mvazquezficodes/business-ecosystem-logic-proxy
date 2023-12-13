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
			udpateServiceCandidate: updateServiceCandidate,
			createServiceCandidate: createServiceCandidate,
			deleteServiceCandidate: deleteServiceCandidate,
			exists: exists,
			buildInitialData: buildInitialData
		};
	}
})();