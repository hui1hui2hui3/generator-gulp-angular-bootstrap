'use strict';
angular.module('MedicalTrain', ['ui.router'])
    .config(['$stateProvider', '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {
            $stateProvider
                .state('home', {
                    url: '/home',
                    views: {
                        '': {
                            templateUrl: 'views/home.html'
                        },
                        '@home': {
                            templateUrl: 'views/homeContent.html'
                        }
                    }
                })
                .state('componentsTest', {
                    url: '/componentsTest',
                    templateUrl: 'views/componentsTest.html',
                    parent: 'home'
                });
            $urlRouterProvider.otherwise('home');
        }
    ]);
