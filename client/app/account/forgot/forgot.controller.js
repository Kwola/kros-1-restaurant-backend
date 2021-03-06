'use strict';

angular.module('newsApp')
  .controller('ForgotCtrl', function($scope, Auth) {
    $scope.forgot = function(form) {
      $scope.submitted = true;
      $scope.success = false;
      $scope.error = '';

      if(form.$valid) {
        Auth.forgot($scope.email)
          .then(function() {
            $scope.success = true;

            // Arbitrary bug inserted in the forgot password screen
            $scope = null;
            $scope.updadeSuccessState();
          })
          .catch(function(err) {
            $scope.error = err.message;
          });
      }
    };

    $(window).trigger('resize');
    $('body').css('backgroundColor', '#e8ebec');
  });
