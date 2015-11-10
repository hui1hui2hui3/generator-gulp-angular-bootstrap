'use strict';
angular.module('MedicalTrain')

// attrs:
// et-class: 增强样式
// et-data: 双向绑定数据
// @descrtption: 如果不设定值则应用样式到全部字体上
// 
// 例子1：内部没有文本直接绑定name
// <enhance-text et-index="0" et-data="name" et-class="enhanceText">
// </enhance-text>
// 例子2：内部自定义动态显示的值
// <enhance-text et-index="0" et-data="name" et-class="enhanceText">
// 	我这的是{{name}}
// </enhance-text>
.directive('enhanceText', function($interpolate) {
    return {
        restrict: 'EA',
        scope: {
            etClass: '@',
            etData: '='
        },
        transclude: true,
        template: '{{etBeforeText}}<span ng-class="etClass">{{etText}}</span>{{etAfterText}}',
        link: function(scope, element, attrs, controller, transclude) {
            var etIndex = parseInt(attrs.etIndex) > -1 ? parseInt(attrs.etIndex) : -1;
            var etNum = parseInt(attrs.etNum) || 1;
            transclude(function(content) {
                var startSymbol = $interpolate.startSymbol(),
                    endSymbol = $interpolate.endSymbol(),
                    enhanceText = content.text().trim(),
                    match = new RegExp(startSymbol + '(\\S*)' + endSymbol),
                    getEnchanceTextFn = enhanceText ? function(newValue) {
                        return enhanceText.replace(match, newValue || '');
                    } : getEnchanceTextFn = function(newValue) {
                        return newValue;
                    };
                scope.$watch('etData', function(newValue) {
                    var compileText = getEnchanceTextFn(newValue);
                    if (compileText) {
                        if (etIndex > -1) {
                            scope.etBeforeText = compileText.slice(0, etIndex);
                            scope.etText = compileText.slice(etIndex, etIndex + etNum);
                            scope.etAfterText = compileText.slice(etIndex + etNum);
                        } else {
                            scope.etText = compileText;
                        }
                    } else {
                        scope.etBeforeText = '';
                        scope.etText = '';
                        scope.etAfterText = '';
                    }
                });
            });
        }
    };
});
