'use strict';

var appName = '<%- props.appName %>';

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var del = require('del');
var beep = require('beepbeep');
var express = require('express');
var path = require('path');
var open = require('open');
var stylish = require('jshint-stylish');
var connectLr = require('connect-livereload');
var streamqueue = require('streamqueue');
var runSequence = require('run-sequence');
var merge = require('merge-stream');
var ripple = require('ripple-emulator');
var inject = require('gulp-inject-string');

/**
 * Parse arguments
 */
var args = require('yargs')
    //云后台地址
    .alias('u', 'url')
    //版本管理后台地址
    .alias('s', 'serviceUrl')
    .alias('k', 'key')
    .alias('e', 'emulate')
    .alias('d', 'debug')
    .alias('b', 'build')
    .alias('r', 'run')
    // remove all debug messages (console.logs, alerts etc) from release build
    .alias('release', 'strip-debug')
    .default('key', 'ky')
    .default('build', false)
    .default('debug', false)
    .default('port', 9000)
    .default('strip-debug', false)
    .argv;

var build = !!(args.build || args.emulate || args.run);
var debug = args.debug;
var emulate = args.emulate;
var run = args.run;
var port = args.port;
var key = args.key;
var url = args.url;
var serviceUrl = args.serviceUrl;
var stripDebug = !!args.stripDebug;
var targetDir = path.resolve(build ? 'www' : '.tmp');

// if we just use emualate or run without specifying platform, we assume iOS
// in this case the value returned from yargs would just be true
if (emulate === true) {
    emulate = 'ios';
}
if (run === true) {
    run = 'ios';
}

// global error handler
var errorHandler = function (error) {
    if (build) {
        throw error;
    } else {
        beep(2, 170);
        plugins.util.log(error);
    }
};


// clean target dir
gulp.task('clean', function (done) {
    del([targetDir], done);
});

// precompile .scss and concat with ionic.css
gulp.task('styles', function () {

    var options = (build && (!debug)) ? {style: 'compressed'} : {style: 'expanded'};

    var sassStream = plugins.rubySass('app/styles/main.scss', options)
        .pipe(plugins.autoprefixer('last 1 Chrome version', 'last 3 iOS versions', 'last 3 Android versions'))

    var vendorFiles = require('./vendorCss.json');

    var cssStream = gulp.src(vendorFiles)
        .pipe(plugins.concat('vendor.css'))
        .on('error', errorHandler);
    return streamqueue({objectMode: true}, cssStream, sassStream)
        .pipe(plugins.concat('main.css'))
        .pipe(plugins.if(build && (!debug), plugins.stripCssComments()))
        .pipe(plugins.if(build && (!debug) && !emulate, plugins.rev()))
        .pipe(gulp.dest(path.join(targetDir, 'styles')))
        .on('error', errorHandler);
});


// build templatecache, copy scripts.
// if build: concat, minsafe, uglify and versionize
gulp.task('scripts', ['json'], function () {
    var dest = path.join(targetDir, 'scripts');

    var minifyConfig = {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeComments: true
    };

    // prepare angular template cache from html templates
    // (remember to change appName var to desired module name)
    var templateStream = gulp
        .src('**/*.html', {cwd: 'app/templates'})
        .pipe(plugins.angularTemplatecache('templates.js', {
            root: 'templates/',
            module: appName,
            htmlmin: build && minifyConfig
        }));

    var scriptStream = gulp
        .src(['templates.js', 'app.js', '**/*.js'], {cwd: 'app/scripts'})

        .pipe(plugins.if(!(build && (!debug)), plugins.changed(dest)));

    return streamqueue({objectMode: true}, scriptStream, templateStream)
        .pipe(plugins.if(build && (!debug), plugins.ngAnnotate()))
        .pipe(plugins.if(stripDebug, plugins.stripDebug()))
        .pipe(plugins.if(build && (!debug), plugins.concat('app.js')))
        .pipe(plugins.if(build && (!debug), plugins.uglify()))
        .pipe(plugins.if((build && (!debug)) && !emulate, plugins.rev()))

        .pipe(gulp.dest(dest))

        .on('error', errorHandler);
});

gulp.task('splashImages', function () {
    //copy the splash images
    return gulp.src('./config/' + key + '/splashImage/**/*.*')
        .pipe(gulp.dest('resources'))
        .on('error', errorHandler);
});
gulp.task('logoConfig', function () {
    // copy hospitalConfig and data
    return gulp.src('./config/' + key + '/*.png')
        .pipe(gulp.dest('app/images'))
        .on('error', errorHandler);
});

gulp.task('config', ['splashImages', 'logoConfig'], function () {
    // copy hospitalConfig and data
    return gulp.src('./config/' + key + '/*.json')
        .pipe(gulp.dest('app/config'))
        .on('error', errorHandler);
});

//copy json
gulp.task('json', function () {
    return gulp.src('app/config/*.*')
        .pipe(gulp.dest(path.join(targetDir, 'config')))
        .on('error', errorHandler);
});

// copy fonts
gulp.task('fonts', function () {
    return gulp
        .src(['app/fonts/*.*', 'bower_components/ionic/release/fonts/*.*'])

        .pipe(gulp.dest(path.join(targetDir, 'fonts')))

        .on('error', errorHandler);
});


// copy templates
gulp.task('templates', function () {
    return gulp.src('app/templates/**/*.*')
        .pipe(gulp.dest(path.join(targetDir, 'templates')))

        .on('error', errorHandler);
});

// generate iconfont
gulp.task('iconfont', function () {
    return gulp.src('app/icons/*.svg', {
        buffer: false
    })
        .pipe(plugins.iconfontCss({
            fontName: 'ownIconFont',
            path: 'app/icons/own-icons-template.css',
            targetPath: '../styles/own-icons.css',
            fontPath: '../fonts/'
        }))
        .pipe(plugins.iconfont({
            fontName: 'ownIconFont'
        }))
        .pipe(gulp.dest(path.join(targetDir, 'fonts')))
        .on('error', errorHandler);
});

// copy images
gulp.task('images', function () {
    return gulp.src('app/images/**/*.*')
        .pipe(gulp.dest(path.join(targetDir, 'images')))

        .on('error', errorHandler);
});

// copy emr and temperatureChart data
gulp.task('asset', function () {
    return gulp.src('app/asset/**/*.*')
        .pipe(gulp.dest(path.join(targetDir, 'asset')))

        .on('error', errorHandler);
});


// lint js sources based on .jshintrc ruleset
gulp.task('jsHint', function (done) {
    return gulp
        .src('app/scripts/**/*.js')
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter(stylish))

        .on('error', errorHandler);
    done();
});

// concatenate and minify vendor sources
gulp.task('vendor', function () {
    var vendorFiles = require('./vendor.json');

    return gulp.src(vendorFiles)
        .pipe(plugins.concat('vendor.js'))
        .pipe(plugins.if(build, plugins.uglify()))
        .pipe(plugins.if(build, plugins.rev()))

        .pipe(gulp.dest(targetDir))

        .on('error', errorHandler);
});
// inject the files in index.html
gulp.task('index', ['jsHint', 'scripts'], function () {

    // build has a '-versionnumber' suffix
    var cssNaming = 'styles/main*';

    // injects 'src' into index.html at position 'tag'
    var _inject = function (src, tag) {
        return plugins.inject(src, {
            starttag: '<!-- inject:' + tag + ':{{ext}} -->',
            read: false,
            addRootSlash: false
        });
    };

    // get all our javascript sources
    // in development mode, it's better to add each file seperately.
    // it makes debugging easier.
    var _getAllScriptSources = function () {
        var scriptStream = gulp.src(['scripts/app.js', 'scripts/**/*.js'], {cwd: targetDir});
        return streamqueue({objectMode: true}, scriptStream);
    };

    return gulp.src('app/index.html')
        .pipe(inject.before('//url', url ? 'localStorage.Url = "' + url + '";' : ''))
        .pipe(inject.before('//versionUrl', serviceUrl ? 'localStorage.versionServiceUrl = "' + serviceUrl + '";' : ''))
        // inject css
        .pipe(_inject(gulp.src(cssNaming, {cwd: targetDir}), 'app-styles'))
        // inject vendor.js
        .pipe(_inject(gulp.src('vendor*.js', {cwd: targetDir}), 'vendor'))
        // inject app.js (build) or all js files indivually (dev)
        .pipe(plugins.if(build && (!debug),
            _inject(gulp.src('scripts/app*.js', {cwd: targetDir}), 'app'),
            _inject(_getAllScriptSources(), 'app')
        ))

        .pipe(gulp.dest(targetDir))
        .on('error', errorHandler);
});

// start local express server
gulp.task('serve', function () {
    express()
        .use(!build ? connectLr() : function () {
        })
        .use(express.static(targetDir))
        .listen(port);
    open('http://localhost:' + port + '/');
});

// ionic emulate wrapper
gulp.task('ionic:emulate', plugins.shell.task([
    'ionic emulate ' + emulate + ' --livereload --consolelogs'
]));

// ionic run wrapper
gulp.task('ionic:run', plugins.shell.task([
    'ionic run ' + run
]));

// ionic resources wrapper
gulp.task('icon', plugins.shell.task([
    'ionic resources --icon'
]));
gulp.task('splash', plugins.shell.task([
    'ionic resources --splash'
]));
gulp.task('resources', plugins.shell.task([
    'ionic resources'
]));

// select emulator device
gulp.task('select', plugins.shell.task([
    './helpers/emulateios'
]));

// ripple emulator
gulp.task('ripple', ['scripts', 'styles', 'watchers'], function () {

    var options = {
        keepAlive: false,
        open: true,
        port: 4400
    };

    // Start the ripple server
    ripple.emulate.start(options);

    open('http://localhost:' + options.port + '?enableripple=true');
});


// start watchers
gulp.task('watchers', function () {
    plugins.livereload.listen();
    gulp.watch('app/styles/**/*.scss', ['styles']);
    gulp.watch('app/fonts/**', ['fonts']);
    gulp.watch('app/icons/**', ['iconfont']);
    gulp.watch('app/images/**', ['images']);
    gulp.watch('app/asset/**/*.*', ['asset']);
    gulp.watch('app/scripts/**/*.js', ['index']);
    gulp.watch('./vendor.json', ['vendor']);
    gulp.watch('app/templates/**/*.html', ['index']);
    gulp.watch('app/index.html', ['index']);
    gulp.watch(targetDir + '/**')
        .on('change', plugins.livereload.changed)
        .on('error', errorHandler);
});

// no-op = empty function
gulp.task('noop', function () {
});

// our main sequence, with some conditional jobs depending on params
gulp.task('default', function (done) {
    runSequence(
        'clean',
        'iconfont',
        [
            'fonts',
            'templates',
            'styles',
            'images',
            'asset',
            'vendor'
        ],
        'index',
        build ? 'noop' : 'watchers',
        build ? 'noop' : 'serve',
        emulate ? ['ionic:emulate', 'watchers'] : 'noop',
        run ? 'ionic:run' : 'noop',
        done);
});
