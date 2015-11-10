'use strict';
var gulp = require('gulp'),
    path = require('path'),
    del = require('del'),
    open = require('open'),
    runSequence = require('run-sequence'),
    streamqueue = require('streamqueue'),
    plugins = require('gulp-load-plugins')();

var args = require('yargs')
    .alias('b', 'build')
    .default('build', false)
    .default('port', 9000)
    .argv;

var appName = 'MedicalTrain';
var build = !!args.build;
var port = args.port;
var targetDir = path.resolve(build ? 'www' : '.tmp');

/**
 * 本地测试服务
 * @param  {[type]} 
 * @return {[type]}   [description]
 */
gulp.task('serve', function() {
    plugins.connect.server({
        root: [targetDir],
        port: port,
        livereload: true
    });
    open('http://localhost:' + port + '/index.html');
});

/**
 * 编译SCSS文件到指定目录
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('styles', function() {
    var sassOptions = build ? {
        style: 'compressed'
    } : {
        style: 'expanded'
    };
    return plugins.rubySass('src/styles/main.scss', sassOptions)
        .pipe(plugins.autoprefixer({ browsers: ['last 5 version']}))
        .pipe(plugins.concat('main.css'))
        .pipe(plugins.if(build, plugins.rev()))
        .pipe(gulp.dest(path.join(targetDir, 'styles')));
});

/**
 * 连接生成第三方js文件
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('vendor', function() {
    var vendorFiles = require('./vendor.json');

    return gulp.src(vendorFiles)
        .pipe(plugins.concat('vendor.js'))
        .pipe(plugins.if(build, plugins.uglify()))
        .pipe(plugins.if(build, plugins.rev()))
        .pipe(gulp.dest(targetDir));
});

/**
 * 生成templates的view到angular的templateCache,然后和项目的js合并
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('scripts', function() {
    var dest = path.join(targetDir, 'scripts');

    var minifyConfig = {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeComments: true
    };

    var templateStream = gulp
        .src('**/*.html', {
            cwd: 'src/views'
        })
        .pipe(plugins.angularTemplatecache('templates.js', {
            root: 'views/',
            module: appName,
            htmlmin: build && minifyConfig
        }));

    var scriptStream = gulp
        .src(['templates.js', 'app.js', '**/*.js'], {
            cwd: 'src/scripts'
        })
        .pipe(plugins.if(!build, plugins.changed(dest)));

    return streamqueue({
            objectMode: true
        }, scriptStream, templateStream)
        .pipe(plugins.if(build, plugins.ngAnnotate()))
        .pipe(plugins.if(build, plugins.stripDebug()))
        .pipe(plugins.if(build, plugins.concat('app.js')))
        .pipe(plugins.if(build, plugins.uglify()))
        .pipe(plugins.if(build, plugins.rev()))
        .pipe(gulp.dest(dest));
});

/**
 * 字体复制
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('fonts', function() {
    return gulp
        .src(['app/fonts/*.*', 'bower_components/bootstrap-sass/assets/fonts/bootstrap/*.*'])
        .pipe(gulp.dest(path.join(targetDir, 'fonts/bootstrap')));
});

/**
 * 注入样式、第三方js、项目js到index.html中
 * @param  {String}
 * @return {[type]}   [description]
 */
gulp.task('inject', ['fonts', 'styles', 'vendor', 'scripts'], function() {
    var cssNaming = 'styles/main*';
    var _inject = function(src, tag) {
        return plugins.inject(src, {
            starttag: '<!-- inject:' + tag + ':{{ext}} -->',
            read: false,
            addRootSlash: false
        });
    };

    var _getAllScriptSources = function() {
        var scriptStream = gulp.src(['scripts/app.js', 'scripts/**/*.js'], {
            cwd: targetDir
        });
        return streamqueue({
            objectMode: true
        }, scriptStream);
    };

    return gulp.src('src/index.html')
        .pipe(_inject(gulp.src(cssNaming, {
            cwd: targetDir
        }), 'app-styles'))
        .pipe(_inject(gulp.src('vendor*.js', {
            cwd: targetDir
        }), 'vendor'))
        .pipe(plugins.if(build,
            _inject(gulp.src('scripts/app*.js', {
                cwd: targetDir
            }), 'app'),
            _inject(_getAllScriptSources(), 'app')))
        .pipe(gulp.dest(targetDir));
});

/**
 * 监听文件变化实时更新页面
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('watchers', function() {
    plugins.livereload.listen();
    gulp.watch('src/styles/**/*.scss', ['styles']);
    gulp.watch('src/fonts/**', ['fonts']);
    gulp.watch('src/scripts/**/*.js', ['scripts']);
    gulp.watch('./vendor.json', ['vendor']);
    gulp.watch('src/views/**/*.html', ['scripts']);
    gulp.watch('src/index.html', ['inject']);
    gulp.watch(targetDir + '/**')
        .on('change', plugins.livereload.changed);
});

/**
 * 删除编译目录
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('clean', function(done) {
    return del([targetDir], done);
});

/**
 * 空任务
 * @param  {[type]}
 * @return {[type]}   [description]
 */
gulp.task('noop', function() {});

/**
 * 默认任务
 * @param  {[type]}
 * @return {[type]}       [description]
 */
gulp.task('default', function(done) {
    runSequence(
        'clean',
        'inject',
        build ? 'noop' : 'watchers',
        build ? 'noop' : 'serve',
        done);
});
