/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 * 
 * This file belongs to the bbusiness-ecosystem-logic-proxy of the
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

/*
 * Igual podemos hacer que el asset en si sea el service Candiate,
 * y así todo me tendría más sentido. Creo que la idea sería crear
 * el service category, lanzar el cádidate después, y con la info 
 */

(function() {
	'use strict';

	const LOADING = 'LOADING';
	const LOADED = 'LOADED';
	const ERROR = 'ERROR';

	angular
		.module('app')
		.controller('ServiceSpecificationListCtrl', [
            '$scope',
			'$state',
            '$rootScope',
			'ServiceSpecification',
			'DATA_STATUS',
			'Utils',
            'EVENTS',
            'LIFECYCLE_STATUS',
			ServiceSpecificationListController
		])
		.controller('ServiceSpecificationCreateCtrl', [
			'$state',
			'$rootScope',
			'DATA_STATUS',
			'EVENTS',
			'ServiceSpecification',
            'Asset', 
            'AssetType',
			'Utils',
			ServiceSpecificationCreateController
		])
        //Este vai ser o controlador
        .controller('ServiceCandidateCreateCtrl', [
			'$state',
			'$rootScope',
			'DATA_STATUS',
			'EVENTS',
			'ServiceCandidate',
            'Asset', 
            'AssetType',
			'Utils',
			ServiceCandidateCreateController
		])
		.controller('ServiceSpecificationUpdateCtrl', [
			'$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ServiceSpecification',
			'Utils',
            'EVENTS',
			ServiceSpecificationUpdateController
		])
        .controller('AssetController', [
            '$scope', 
            '$rootScope', 
            'Asset', 
            'ProductSpec', 
            'Utils', 
            'EVENTS', 
            AssetController
        ]);

	function ServiceSpecificationListController($scope, $state, $rootScope, ServiceSpecification, DATA_STATUS, Utils, EVENTS, LIFECYCLE_STATUS) {
		var vm = this;

		vm.STATUS = DATA_STATUS
		vm.list = [];
		vm.offset = -1;
		vm.limit = -1;
		vm.sidebarInput = '';
		vm.updateList = updateList;
		vm.getElementsLength = getElementsLength;
        vm.showFilters = showFilters;

		function getElementsLength() {
			return Promise.resolve(10)
		}

		function updateList() {
			vm.list.status = LOADING;

			if (vm.offset >= 0) {
                const params = $state.params;
				const page = {
					offset: vm.offset,
					limit: vm.limit,
					body: vm.sidebarInput
				};

                if (params.status) {
                    page.lifecycleStatus = params.status
                }

				ServiceSpecification.getServiceSpecifications(page).then((itemList) => {
					angular.copy(itemList, vm.list);
					vm.list.status = LOADED;
				}).catch((response) => {
					vm.error = Utils.parseError(response, 'It was impossible to load the list of service specifications');
					vm.list.status = ERROR;
				})
			}
		}

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        // -
		$scope.$watch(() => {
            return vm.offset;
        }, updateList);
	}

	function characteristicsController() {
        const buildCharTemplate = () => {
            return angular.copy({
                id: `urn:ngsi-ld:characteristic:${uuid.v4()}`,
                name: '',
                description: '',
                valueType: this.VALUE_TYPES.STRING,
                configurable: false,
                characteristicValueSpecification: []
            })
        }

        const characteristicValue = {
            isDefault: false,
            unitOfMeasure: '',
            value: '',
            valueFrom: '',
            valueTo: ''
        }

        this.VALUE_TYPES = {
            STRING: 'string',
            NUMBER: 'number',
            NUMBER_RANGE: 'number range'
        }

        this.characteristicEnabled = false
        this.characteristic = buildCharTemplate()

        this.characteristics = []

        this.createCharacteristic = () => {
            this.characteristics.push(this.characteristic);
            this.characteristic = buildCharTemplate()

            this.characteristicValue = angular.copy(characteristicValue);
            this.characteristicEnabled = false;
            return true;
        }

        this.createCharacteristicValue = () => {
            this.characteristicValue.isDefault = this.getDefaultValueOf(this.characteristic) == null;
            this.characteristic.characteristicValueSpecification.push(this.characteristicValue);
            this.characteristicValue = angular.copy(characteristicValue);

            if (this.characteristic.characteristicValueSpecification.length > 1) {
                this.characteristic.configurable = true;
            }

            return true;
        }

        this.getFormattedValueOf = (characteristic, characteristicValue) => {
            let result;

            switch (characteristic.valueType) {
                case this.VALUE_TYPES.STRING:
                    result = characteristicValue.value;
                    break;
                case this.VALUE_TYPES.NUMBER:
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case this.VALUE_TYPES.NUMBER_RANGE:
                    result =
                        characteristicValue.valueFrom +
                        ' - ' +
                        characteristicValue.valueTo +
                        ' ' +
                        characteristicValue.unitOfMeasure;
            }

            return result;
        }

        this.getDefaultValueOf = (characteristic) => {
            let i, defaultValue;

            for (i = 0; i < characteristic.characteristicValueSpecification.length; i++) {
                if (characteristic.characteristicValueSpecification[i].isDefault) {
                    defaultValue = characteristic.characteristicValueSpecification[i];
                }
            }

            return defaultValue;
        }

        this.setDefaultValue = (index) => {
            let value = this.getDefaultValueOf(this.characteristic);

            if (value != null) {
                value.isDefault = false;
            }

            this.characteristic.characteristicValueSpecification[index].isDefault = true;
        }

        this.removeCharacteristic = (index) => {
            this.characteristics.splice(index, 1);
        }

        this.resetCharacteristicValue = () => {
            this.characteristicValue = angular.copy(characteristicValue);
            this.characteristic.characteristicValueSpecification.length = 0;
        }

        this.removeCharacteristicValue = (index) => {
            let value = this.characteristic.characteristicValueSpecification[index];
            this.characteristic.characteristicValueSpecification.splice(index, 1);

            if (value.isDefault && this.characteristic.characteristicValueSpecification.length) {
                this.characteristic.characteristicValueSpecification[0].isDefault = true;
            }

            if (this.characteristic.characteristicValueSpecification.length <= 1) {
                this.characteristic.configurable = false;
            }
        }
    }

	function ServiceSpecificationCreateController(
        $state, 
        $rootScope, 
        DATA_STATUS, 
        EVENTS, 
        ServiceSpecification,
        Asset,
        AssetType,
        Utils
    ) {
		var vm = this;

		const charCtl = characteristicsController.bind(this)

		this.stepList = [
            {
                title: 'General',
                templateUrl: 'stock/service-specification/create/general'
            },
            {
                title: 'Assets',
                templateUrl: 'stock/product/create/assets'
            },
            {
                title: 'Characteristics',
                templateUrl: 'stock/service-specification/create/characteristics'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/service-specification/create/finish'
            }
        ];

        vm.getAssetTypes = getAssetTypes;

		this.STATUS = DATA_STATUS;
		this.status = null;

		this.data = ServiceSpecification.buildInitialData();

		this.create = create;

        function getAssetTypes() {
            return AssetType.search();
        }

		function create() {
			vm.status = vm.STATUS.PENDING;
			this.data.specCharacteristic = this.characteristics
	
			ServiceSpecification.createServiceSpecification(this.data).then((spec) => {
				vm.status = vm.STATUS.LOADED;
				$state.go('stock.service.update', {
					serviceId: spec.id
				});
				$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
					resource: 'service specification',
					name: vm.data.name
				});
			}).catch((response) => {
				vm.status = vm.STATUS.ERROR;
				const defaultMessage =
					'There was an unexpected error that prevented the system from creating a new IDP';
				const error = Utils.parseError(response, defaultMessage);

				$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
					error: error
				});
			});
		}

		charCtl();
	}

	function ServiceSpecificationUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ServiceSpecification, Utils, EVENTS) {
		this.STATUS = DATA_STATUS
        this.status = DATA_STATUS.LOADING

        this.updateStatus = DATA_STATUS.LOADED

        this.data = {}
        this.item = {}

        ServiceSpecification.getServiceSpecficiation($state.params.serviceId).then((spec) => {
            this.data = angular.copy(spec);

            this.item = spec
            this.status = this.STATUS.LOADED
        }).catch((response) => {
            this.errorMessage = Utils.parseError(response, 'It was impossible to load the service specification')
            this.status = this.STATUS.ERROR
        })

        this.formatCharacteristicValue = (characteristic, characteristicValue) => {
            let result;

            switch (characteristic.valueType) {
                case "string":
                    result = characteristicValue.value;
                    break;
                case "number":
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case "number range":
                    result = characteristicValue.valueFrom + ' - ' + characteristicValue.valueTo;
                    result += ' ' + characteristicValue.unitOfMeasure;
                    break;
            }

            return result;
        }

        /********************/

        function loadPictureController() {
            buildPictureController(vm, $scope, vm.stepList[4].form, Asset);
        }

        function loadFileController() {
            buildFileController(vm, $scope, vm.stepList[4].form, Asset);
        }

        /********************/

        this.updateStatus = (status) => {
            this.data.lifecycleStatus = status
        }

        this.update = () => {
            const dataUpdated = {};
            ["name", "description", "lifecycleStatus"].forEach((attr) => {
                if (!angular.equals(this.item[attr], this.data[attr])) {
                    dataUpdated[attr] = this.data[attr];
                }
            });

            this.updateStatus = DATA_STATUS.PENDING
            ServiceSpecification.udpateServiceSpecification(this.data.id, dataUpdated).then((updated) => {
                this.updateStatus = DATA_STATUS.LOADED
                $state.go(
                    'stock.service.update',
                    {
                        serviceId: updated.id
                    },
                    {
                        reload: true
                    }
                );
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'service spec',
                    name: updated.name
                });
            }).catch((response) => {
                this.updateStatus = DATA_STATUS.LOADED
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the service spec.')
                });
            });
		}
	}

    /***********************************/
    // Cambios Marcos
    /*
        Solo se conecta coa base de datos local para garda a imaxe e o archivo
        Entendo que entonces no chargin non necesito crear o specification
        Porque se crea directamente aquí.
        Igual a idea ahora é porbar a crear o asset aquí, crear o form onde 
        se garda a imaxe e probar a subir a info ao charging
        E tamén se chamaría nos assets
        Esta imaxe crease nos Attachments
        O resto de info debería ir directa á api de tmforums
    */

    function buildPictureController(vm, $scope, pictureForm, Asset) {
        vm.clearFileInput = clearFileInput;

        function clearFileInput() {
            if (!pictureForm.pictureFile) {
                pictureForm.pictureFile = {};
            } else {
                // Reset possible previous errors
                pictureForm.pictureFile.$invalid = false;
                pictureForm.pictureFile.$error = {};
            }
        }

        $scope.$watch(
            function watchFile() {
                return vm.pictureFile;
            },
            function() {
                // Check that the new file is a valid image
                if (vm.pictureFile) {
                    vm.clearFileInput();
                    pictureForm.pictureFile.$dirty = true;

                    if (
                        vm.pictureFile.type != 'image/gif' &&
                        vm.pictureFile.type != 'image/jpeg' &&
                        vm.pictureFile.type != 'image/png' &&
                        vm.pictureFile.type != 'image/bmp'
                    ) {
                        // Set input error
                        pictureForm.pictureFile.$invalid = true;
                        pictureForm.pictureFile.$error = {
                            format: true
                        };
                        return;
                    }

                    var scope = vm.data.name.replace(/ /g, '');

                    if (scope.length > 10) {
                        scope = scope.substr(0, 10);
                    }
                    // Upload the file to the server when it is included in the input
                    Asset.uploadAsset(
                        vm.pictureFile,
                        scope,
                        null,
                        vm.pictureFile.type,
                        true,
                        null,
                        function(result) {
                            vm.data.attachment[0].url = result.content;
                        },
                        function() {
                            // The picture cannot be uploaded set error in input
                            pictureForm.pictureFile.$invalid = true;
                            pictureForm.pictureFile.$error = {
                                upload: true
                            };
                        }
                    );
                }
            }
        );
        clearFileInput();
    }

    function buildFileController(vm, $scope, form, Asset) {
        function clearFileInput() {
            if (!form.extraFile) {
                form.extraFile = {};
            } else {
                // Reset possible previous errors
                form.extraFile.$invalid = false;
                form.extraFile.$error = {};
            }
        }

        vm.removeExtraFile = function(index) {
            vm.extraFiles.splice(index, 1);
        };

        $scope.$watch(
            function() {
                return vm.extraFile;
            },
            function() {
                // Check that the new file is a valid image
                if (vm.extraFile) {
                    clearFileInput();
                    form.extraFile.$dirty = true;

                    var prefix = vm.data.name.replace(/ /g, '');

                    if (prefix.length > 10) {
                        prefix = prefix.substr(0, 10);
                    }

                    // Upload the file to the server when it is included in the input
                    Asset.uploadAsset(
                        vm.extraFile,
                        prefix,
                        null,
                        vm.extraFile.type,
                        true,
                        null,
                        function(result) {
                            vm.extraFiles.push({
                                name: vm.extraFile.name,
                                type: vm.extraFile.type,
                                href: result.content
                            });
                        },
                        function() {
                            // The picture cannot be uploaded set error in input
                            form.extraFile.$invalid = true;
                            form.extraFile.$error = {
                                upload: true
                            };
                        }
                    );
                }
            }
        );

        clearFileInput();
    }

    /***********************************/
    
    function AssetController($scope, $rootScope, Asset, ProductSpec, Utils, EVENTS) {
        var controller = $scope.vm;
        var form = null;

        var vm = this;

        vm.assetTypes = [];
        vm.digitalChars = [];
        vm.meta = {};
        vm.status = LOADING;

        vm.isSelected = isSelected;
        vm.setCurrentType = setCurrentType;
        vm.getCurrentForm = getCurrentForm;
        vm.initMediaType = initMediaType;
        vm.setForm = setForm;
        /* Meta info management */
        vm.getMetaLabel = getMetaLabel;

        function isSelected(format) {
            return vm.currFormat === format;
        }

        function getMetaLabel(id) {
            return typeof vm.currentType.form[id].label !== 'undefined' ? vm.currentType.form[id].label : id;
        }

        function initMetaData() {
            // Evaluate form field in order to include default values
            if (typeof vm.currentType.form !== 'undefined') {
                for (var id in vm.currentType.form) {
                    if (typeof vm.currentType.form[id].default !== 'undefined') {
                        vm.meta[id] = vm.currentType.form[id].default;
                    }
                }
            }
        }

        function setCurrentType() {
            var i,
                found = false;
            var assetType = vm.digitalChars[0].productSpecCharacteristicValue[0].value;

            for (i = 0; i < vm.assetTypes.length && !found; i++) {
                if (assetType === vm.assetTypes[i].name) {
                    found = true;
                    vm.currentType = vm.assetTypes[i];
                    vm.meta = {};
                    initMetaData();
                }
            }
            vm.currFormat = vm.currentType.formats[0];
        }

        function getCurrentForm() {
            let formFields = [];
            if (vm.currentType.formOrder.length > 0) {
                vm.currentType.formOrder.forEach((key) => {
                    vm.currentType.form[key].id = key;
                    formFields.push(vm.currentType.form[key]);
                })
            } else {
                for (key in vm.currentType.form) {
                    vm.currentType.form[key].id = key;
                    formFields.push(vm.currentType.form[key]);
                }
            }
            return formFields;
        }

        function showAssetError(response) {
            var defaultMessage =
                'There was an unexpected error that prevented your ' + 'digital asset to be registered';
            var error = Utils.parseError(response, defaultMessage);

            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                error: error
            });
        }

        function save(uploadM, registerM, assetId, scope, callback) {
            var meta = null;

            if (Object.keys(vm.meta).length) {
                meta = vm.meta;
            }

            if (vm.currFormat === 'FILE') {
                // If the format is file, upload it to the asset manager
                uploadM(
                    vm.assetFile,
                    scope,
                    vm.digitalChars[0].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[1].productSpecCharacteristicValue[0].value,
                    false,
                    meta,
                    function(result) {
                        // Set file location
                        vm.digitalChars[2].productSpecCharacteristicValue[0].value = result.content;
                        vm.digitalChars[3].productSpecCharacteristicValue[0].value = result.id;
                        callback();
                    },
                    (response) => showAssetError(response),
                    assetId
                );
            } else if (controller.isDigital && vm.currFormat === 'URL') {
                if(meta !== null && meta !== undefined && meta.idPattern !== undefined){
                    var entity_id = "<entity_id>"
                    var entity_type = ""
                    var idPattern = meta.idPattern.split(":")
                    if (idPattern.length > 6){
                        entity_id = idPattern[6]
                    }
                    entity_type = idPattern[2]
                    var end_point = vm.digitalChars[2].productSpecCharacteristicValue[0].value + "/v2/entities/" + entity_id + "/attrs/" + "<attribute>?type=" + entity_type
                    vm.digitalChars[2].productSpecCharacteristicValue[0].value = end_point
                }
                registerM(
                    vm.digitalChars[2].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[0].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[1].productSpecCharacteristicValue[0].value,
                    meta,
                    (result) => {
                        vm.digitalChars[3].productSpecCharacteristicValue[0].value = result.id;
                        callback();
                    },
                    (response) => showAssetError(response),
                    assetId
                );
            }
        }

        var saveAsset = save.bind(this, Asset.uploadAsset, Asset.registerAsset, null);

        function upgradeAsset(scope, callback) {
            // Get asset id using product id
            Asset.searchByProduct(controller.data.id).then(
                (assetInfo) => {
                    save(Asset.upgradeAsset, Asset.upgradeRegisteredAsset, assetInfo[0].id, scope, callback);
                },
                (err) => {
                    showAssetError(err);
                }
            );
        }

        function getDigitalChars() {
            return vm.digitalChars;
        }

        function getMetaInfo() {
            return vm.meta;
        }

        function initMediaType() {
            if (vm.currentType.mediaTypes.length > 0) {
                vm.digitalChars[1].productSpecCharacteristicValue[0].value = vm.currentType.mediaTypes[0];
            } else {
                vm.digitalChars[1].productSpecCharacteristicValue[0].value = '';
            }
        }

        function setForm(modelForm) {
            form = modelForm;
        }

        function isValidAsset() {
            return form !== null && form.$valid;
        }

        // Inject handler for creating asset
        controller.assetCtl = {
            saveAsset: saveAsset,
            upgradeAsset: upgradeAsset,
            getDigitalChars: getDigitalChars,
            getMetaInfo: getMetaInfo,
            isValidAsset: isValidAsset
        };

        // Get the asset types related to the current scope
        controller.getAssetTypes().then(
            function(typeList) {
                angular.copy(typeList, vm.assetTypes);

                if (typeList.length) {
                    // Initialize digital asset characteristics
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Asset type',
                            description: 'Type of the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[0].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            isDefault: true,
                            value: typeList[0].name
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Media type',
                            description: 'Media type of the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[1].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            isDefault: true
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Location',
                            description: 'URL pointing to the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[2].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            isDefault: true
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Asset',
                            description: 'ID of the asset being offered as registered in the BAE'
                        })
                    );
                    vm.digitalChars[3].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            isDefault: true
                        })
                    );
                    vm.currentType = typeList[0];
                    vm.currFormat = vm.currentType.formats[0];
                }

                vm.status = LOADED;
            },
            function() {
                vm.errMsg = 'There has been an error trying to retrieve asset type info';
                vm.status = ERROR;
            }
        );
    }
    

    /***********************************/

})();
