var gulp = require('gulp'),
    connect = require('gulp-connect'),
    open = require('open');

gulp.task('serve', function() {
    connect.server({
        root: ['src'],
        port: 9000,
        livereload: true
    });
    open("http://localhost:9000/index.html");
});

gulp.task('default', ['serve']);
