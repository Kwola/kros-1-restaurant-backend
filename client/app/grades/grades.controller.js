'use strict';

angular.module('newsApp')
  .controller('GradesListCtrl', ['$scope', '$rootScope', '$http', '$location',
    'paginator', 'Grades', '$log',
    function($scope, $rootScope, $http, $location, paginator, Grades, $log) {

      $scope.order = {
        isDirty: false
      };

      $scope.data = {
        records: []
      };

      $scope.fetchGrades = function() {
        // fetch the records
        Grades.get().then(function(response) {
          var body = response.data;
          $scope.data.records = body.result;
        });
      };
      $scope.fetchGrades();

      // listen for app selection
      $rootScope.$on('app:selected', function() {
        $scope.fetchGrades();
      });

      // listen to hide records list update event
      var listUpdatedListener = $rootScope.$on('list_updated',
        function() {
          $scope.fetchGrades();
        });

      $scope.sortableOptions = {
        /*jshint: unused: false */
        update: function(e, ui) {
          $scope.order.isDirty = true;

          console.log('Order updated.');
          console.log('........... e. %o', e);
          console.log('.......... ui. %o', ui);
          console.log('........items. %o', $scope.data.records);
        },
        /*jshint: unused: true */
      };

      var updateRecord = function(id, data) {
        return Grades.update(id, data)
          .then(function onSuccess() {
            $scope.order.isDirty = false;
          }, function onError(response) {
            $log.error('response', response);
          });
      };

      $scope.saveOrder = function() {
        for (var i in $scope.data.records) {
          $scope.data.records[i].weight = i;

          var data = {
            name: $scope.data.records[i].name,
            media: $scope.data.records[i].media,
            weight: $scope.data.records[i].weight
          };

          $scope.order.isDirty = true;

          updateRecord($scope.data.records[i]._id, data);
        }
        console.log('........items. %o', $scope.data.records);
      };

      $scope.cancelOrder = function() {
        $scope.order.isDirty = false;
        // notify the listener when the grade is added
        $scope.$emit('list_updated');
      };

      // unregister the listener to avoid memory leak
      $scope.$on('$destroy', listUpdatedListener);

      $(window).trigger('resize');
    }
  ]);

angular.module('newsApp')
  .controller('GradesItemCtrl', ['$scope', '$log',
    'modalDeleteItem', 'Grades', 'Media', '$state',
    function($scope, $log, modalDeleteItem, Grades, Media, $state) {

      /**
       * Delete item from the list
       */
      $scope.deleteItem = function(record) {
        modalDeleteItem.open(function() {
          var recordID = record._id;

          // Get the record and delete the image associated to it
          Grades
            .findOne(recordID)
            .then(function onSuccess(response) {
              var body = response.data;
              $scope.record = body.result;

              if ($scope.record.media.length > 0) {
                var medias = [];
                for (var i = 0; i < $scope.record.media.length; i++) {
                  medias.push($scope.record.media[i]._id);
                }

                return Media.deleteList(medias);
              }

              return null;
            })
            .then(function onSuccess() {
              return Grades.delete(recordID);
            })
            .then(function onSuccess() {
              // reload the list view
              $state.transitionTo('grades', {}, {
                reload: true
              });
            })
            .catch(function(response) {
              $log.error('An error occured while deleting record', response);
            });
        });
      };
    }
  ]);

angular.module('newsApp')
  .controller('GradesAddFormCtrl', ['$scope', 'Grades',
    '$log', '$timeout', '$state', 'Media', 'ImageUploader',
    function($scope, Grades, $log, $timeout, $state, Media, ImageUploader) {

      $scope.data = {
        // Keeps track of the images
        // that are uploaded while the form is still
        // dirty. These images should be serialized or deleted
        uploadedImages: [],
        // The model the contols are binded to.
        // Its fields are coresponding to our record fields
        model: {}
      };

      $scope.ui = {};
      $scope.ui.progress = 0;
      $scope.ui.inProgress = false;

      /*jshint unused: false */
      function progressStart() {
        $scope.ui.inProgress = true;
      }

      function progressEnd() {
        $scope.ui.inProgress = false;
      }
      /*jshint unused: true */

      /*
       * Listen on file select
       */
      $scope.onFileSelect = ImageUploader.onFileSelectForAdd($scope);

      /*
       * Delete temporary uploaded image
       */
      $scope.deleteImage = function() {
        $scope.data.uploadedImages = [];
        $scope.ui.progress = 0;
      };

      /*
       * Handle the add form submission
       */
      $scope.save = function() {
        // if the form is not valid then cut the flow
        if (!$scope.addForm.$valid) {
          return;
        }

        progressStart();

        function saveGrade(mediaIds) {
          var data = {
            name: $scope.data.model.name,
            media: mediaIds
          };

          Grades.create(data).then(function onSuccess() {

            // notify the listener when the grade is added
            $scope.$emit('list_updated');

            // display the updated form
            $state.transitionTo($state.current, {}, {
              reload: true
            });
          }, function onError() {
            $log.error('failed to add photo');
          });
        }

        function saveMedia() {
            // Move the uploaded images in its final possition
            // and create the related database entry.
            // TODO: a check for an empty array is required
            Media.create($scope.data.uploadedImages[0]).then(
              function onSuccess(responce) {
                console.log(responce);
                // Media is saved.
                // Saving Grade
                var mediaIds = [];
                mediaIds.push(responce.data.result._id);
                saveGrade(mediaIds);
              },

              function onError(responce) {
                console.log(responce);
              }
            );
          } // saveMedia()

        // If a media is given and uploaded, save the media, get its id
        // and proceed with the save of grade
        if ($scope.data.uploadedImages.length > 0) {
          saveMedia();
        } else {
          saveGrade([]);
        }
      };
    }
  ]);

angular.module('newsApp')
  .controller('GradesUpdateFormCtrl', [
    '$scope', '$rootScope', 'Grades', '$log',
    '$stateParams', '$state', '$location', 'Media', 'ImageUploader',
    function($scope, $rootScope, Grades, $log, $stateParams,
      $state, $location, Media, ImageUploader) {

      // When the user removes an image we are placing it in our thrash bin.
      // The content of this bin will be used during the from's save process.
      $scope.trashbin = [];

      $scope.data = {
        // Keeps track of the images
        // that are uploaded while the form is still
        // dirty. These images should be serialized or deleted
        uploadedImages: [],
        // The model the controllers are binded to.
        // Its fields are coresponding to our record fields
        model: {}
      };

      $scope.ui = {};
      $scope.ui.progress = 0;
      $scope.ui.inProgress = false;

      function progressStart() {
        $scope.ui.inProgress = true;
      }

      function progressEnd() {
        $scope.ui.inProgress = false;
      }

      // fetch single document
      Grades.findOne($stateParams.id).then(function(response) {
        var body = response.data;
        $scope.data.model = body.result;

        // fetch the image
        if ($scope.data.model.media.length > 0) {
          $scope.data.model.picture = $scope.data.model.media[0].uri;
        }
      });

      /**
       * Listen on file select
       */
      $scope.onFileSelect = ImageUploader.onFileSelectForUpdate($scope);

      function deleteImage() {
        // Store the media id in order to delete
        // this entry in the future
        var mediaID;
        if ($scope.data.model.media.length > 0) {
          mediaID = $scope.data.model.media[0]._id;

          $scope.trashbin.push(mediaID);
          // Remove the image reference for the grades object
          $scope.data.model.media.splice(0, 1);
        }

        // Remove the image preview
        $scope.data.model.picture = '';
        // Set the progress bar
        $scope.ui.progress = 0;
      }

      /**
       * Delete the current image
       */
      $scope.deleteImage = function() {
        deleteImage();
      };

      /*
       * Handle the form submission
       */
      $scope.update = function() {
        // if the form is not valid then cut the flow
        if (!$scope.updateForm.$valid) {
          return;
        }

        progressStart();

        var toBeUpdateGradeId = $scope.data.model._id;

        function saveGrade(mediaIds) {
          var existingIds = $scope.data.model.media;
          var mergedIds = existingIds.concat(mediaIds);

          var data = {
            name: $scope.data.model.name,
            weight: $scope.data.model.weight,
            media: mergedIds
          };

          Grades.update($scope.data.model._id, data)
            .then(function onSuccess() {
              progressEnd();
              // notify the listener when the grade is added
              $rootScope.$emit('list_updated');
              // display the updated form
              $state.transitionTo('grades.details', {
                id: toBeUpdateGradeId
              }, {
                reload: true
              });
            }, function onError(response) {
              $log.error('response', response);
              progressEnd();
            });
        }

        function saveMedia() {
            // Move the uploaded images in its final possition
            // and create the related database entry.
            // TODO: a check for an empty array is required
            Media.create($scope.data.uploadedImages[0]).then(
              function onSuccess(responce) {
                console.log(responce);
                // Media is saved.
                // Saving Grade
                var mediaIds = [];
                mediaIds.push(responce.data.result._id);
                saveGrade(mediaIds);
              },

              function onError(responce) {
                console.log(responce);
                progressEnd();
              }
            );
          } // saveMedia()

        // If a media is given and uploaded, save the media, get its id
        // and proceed with the save of grade
        if ($scope.data.uploadedImages.length > 0) {
          saveMedia();
        } else {
          saveGrade([]);
        }

        // Clean up media placed in the trash bin
        function deleteMedia(id) {
          Media.delete(id).then(
            function onSuccess(responce) {
              console.log(responce);
            },

            function onError(responce) {
              console.log(responce);
            }
          );
        }

        for (var key in $scope.trashbin) {
          deleteMedia($scope.trashbin[key]);
        }

      };
    }
  ]);

angular.module('newsApp')
  .controller('GradesDetailsCtrl', ['$scope', '$stateParams',
    'Grades',
    function($scope, $stateParams, Grades) {
      // hold the details data
      $scope.data = {
        model: {}
      };

      // fetch single grade
      Grades.findOne($stateParams.id).then(function(response) {
        var body = response.data;
        $scope.data.model = body.result;

        // fetch the image
        if ($scope.data.model.media.length > 0) {
          $scope.data.model.picture = $scope.data.model.media[0].uri;
        }

      });
    }
  ]);
