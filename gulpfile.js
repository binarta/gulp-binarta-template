var template = require('gulp-template'),
    data = require('gulp-data'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    del = require('del'),
    minimist = require('minimist'),
    bower = require('gulp-bower'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    less = require('gulp-less'),
    LessAutoprefix = require('less-plugin-autoprefix'),
    LessPluginCleanCSS = require('less-plugin-clean-css'),
    lessPluginGlob = require('less-plugin-glob'),
    path = require('path'),
    gulpif = require('gulp-if'),
    extend = require('gulp-extend'),
    nodeExtend = require('node.extend'),
    minifyHtml = require('gulp-minify-html'),
    minifyInline = require('gulp-minify-inline'),
    templateCache = require('gulp-angular-templatecache'),
    fs = require('fs'),
    browserSync = require('browser-sync').create(),
    historyApiFallback = require('connect-history-api-fallback'),
    protractor = require('gulp-protractor').protractor,
    webdriver_update = require('gulp-protractor').webdriver_update,
    version = new Date().getTime(),
    glob = require('glob'),
    workingDir = process.cwd(),
    binartaModulesPathPrefix = 'bower_components/binarta*/';

module.exports = function (gulp) {
    var knownOptions = {
        string: 'env',
        boolean: 'html5',
        boolean: 'about',
        boolean: 'testimonials',
        boolean: 'approach',
        boolean: 'gallery',
        boolean: 'catalog',
        boolean: 'blog',
        boolean: 'shop',
        boolean: 'paypal',
        string: 'subscription',
        string: 'port',
        default: {
            env: process.env.NODE_ENV || 'dev'
        }
    };

    var minifyHtmlOpts = {
        empty: true,
        cdata: true,
        conditionals: true,
        spare: true,
        quotes: true
    };

    var options = minimist(process.argv.slice(2), knownOptions);

    var context = require(workingDir + '/config.json');
    context.version = version;
    context.e2e = options.env == 'e2e';

    Object.keys(context.environments[options.env]).forEach(function (k) {
        context[k] = context.environments[options.env][k];
    });

    var userContext = {};
    try {
        userContext = require(workingDir + '/user-config.json');
        Object.keys(userContext).forEach(function (k) {
            context[k] = userContext[k];
        });
    } catch (ignored) {
    }

    context.subscription = options.subscription || userContext.subscription || context.subscription;
    context.enterprise = options.subscription == 'enterprise' || userContext.subscription == 'enterprise' || context.subscription == 'enterprise';
    context.professional = options.subscription == 'professional' || userContext.subscription == 'professional' || context.subscription == 'professional' || context.enterprise;
    context.essential = options.subscription == 'essential' || userContext.subscription == 'essential' || context.subscription == 'essential' || context.professional || context.enterprise;

    if (userContext.blog != undefined) context.blog = userContext.blog;
    else if (options.blog != undefined) context.blog = options.blog;
    if (context.blog == undefined) context.blog = context.essential;

    if (userContext.about != undefined) context.about = userContext.about;
    else if (options.about != undefined) context.about = options.about;
    if (context.about == undefined) context.about = context.essential;

    if (userContext.testimonials != undefined) context.testimonials = userContext.testimonials;
    else if (options.testimonials != undefined) context.testimonials = options.testimonials;
    if (context.testimonials == undefined) context.testimonials = context.essential;

    if (userContext.approach != undefined) context.approach = userContext.approach;
    else if (options.approach != undefined) context.approach = options.approach;
    if (context.approach == undefined) context.approach = context.essential;

    if (userContext.gallery != undefined) context.gallery = userContext.gallery;
    else if (options.gallery != undefined) context.gallery = options.gallery;
    if (context.gallery == undefined) context.gallery = context.essential;

    if (userContext.html5 != undefined) context.html5 = userContext.html5;
    else if (options.html5 != undefined) context.html5 = options.html5;
    if (context.html5 == undefined) context.html5 = false;

    if (userContext.catalog != undefined) context.catalog = userContext.catalog;
    else if (options.catalog != undefined) context.catalog = options.catalog;
    if (context.catalog == undefined) context.catalog = context.professional;

    if (userContext.shop != undefined) context.shop = userContext.shop;
    else if (options.shop != undefined) context.shop = options.shop;
    if (context.shop == undefined) context.shop = context.enterprise;

    if (userContext.paypal != undefined) context.paypal = userContext.paypal;
    else if (options.paypal != undefined) context.paypal = options.paypal;
    if (context.paypal == undefined) context.paypal = context.enterprise;

    context.metadata = require(workingDir + '/src/web/metadata.json');

    gulp.task('clean', function (cb) {
        del(['build'], cb);
    });

    gulp.task('cleanBower', function (cb) {
        del(['bower_components'], cb);
    });

    function images() {
        var images = context.images || [];
        images.push('src/web/img/**/*');
        return gulp.src(images).pipe(gulp.dest('build/dist/img'));
    }
    gulp.task('images', ['clean'], images);
    gulp.task('dirty.images', images);

    function fonts() {
        var fonts = context.fonts || [];
        fonts.push('src/web/fonts/**/*');
        return gulp.src(fonts).pipe(gulp.dest('build/dist/fonts'));
    }
    gulp.task('update.fonts', ['update'], fonts);
    gulp.task('fonts', ['clean'], fonts);
    gulp.task('dirty.fonts', fonts);

    gulp.task('compileBowerConfig', function () {
        return gulp.src('bower.json.template')
            .pipe(data(context))
            .pipe(template())
            .pipe(rename(function (path) {
                path.extname = '';
            }))
            .pipe(gulp.dest("./"));
    });

    gulp.task('update', ['clean', 'cleanBower', 'compileBowerConfig'], function () {
        return bower({cmd: 'update'}).pipe(gulp.dest('build/libs'));
    });

    function CopyBowerMailsTask() {
        return gulp.src(binartaModulesPathPrefix + '**/*.template.mail')
            .pipe(rename(function (path) {
                path.dirname = '';
                path.extname = '.template';
            }))
            .pipe(gulp.dest("build/mail/"));
    }

    gulp.task('update.copy.bower.mails', ['update'], CopyBowerMailsTask);
    gulp.task('copy.bower.mails', ['clean', 'compileBowerConfig'], CopyBowerMailsTask);

    function MailsTask() {
        return gulp.src(['src/mail/**/*.template'])
            .pipe(gulp.dest('build/mail'));
    }

    gulp.task('update.mails', ['update.copy.bower.mails'], MailsTask);
    gulp.task('mails', ['copy.bower.mails'], MailsTask);

    function MetadataSystemTask() {
        return gulp.src([binartaModulesPathPrefix + '**/metadata-system.json', 'src/web/metadata-system.json'])
            .pipe(extend('metadata-system.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata-system', ['update'], MetadataSystemTask);
    gulp.task('metadata-system', ['clean', 'compileBowerConfig'], MetadataSystemTask);
    gulp.task('dirty.metadata-system', ['compileBowerConfig'], MetadataSystemTask);

    function MetadataAppTask() {
        return gulp.src([binartaModulesPathPrefix + '**/metadata-app.json', 'src/web/metadata-app.json'])
            .pipe(extend('metadata-app.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata-app', ['update'], MetadataAppTask);
    gulp.task('metadata-app', ['clean', 'compileBowerConfig'], MetadataAppTask);
    gulp.task('dirty.metadata-app', ['compileBowerConfig'], MetadataAppTask);

    function MetadataTask() {
        return gulp.src([binartaModulesPathPrefix + '**/metadata.json', 'src/web/metadata.json'])
            .pipe(extend('metadata.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata', ['update', 'update.metadata-system', 'update.metadata-app'], MetadataTask);
    gulp.task('metadata', ['clean', 'compileBowerConfig', 'metadata-system', 'metadata-app'], MetadataTask);
    gulp.task('dirty.metadata', ['dirty.metadata-system', 'dirty.metadata-app'], MetadataTask);

    function ScriptsTask() {
        var jsSources = context.jsSources;
        glob.sync(binartaModulesPathPrefix + 'sources.json').forEach(function (src) {
            jsSources = nodeExtend(true, jsSources, require(workingDir + '/' + src));
        });
        var sources = [
            {type: 'init', predicate: true},
            {type: 'default', predicate: true},
            {type: 'html5', predicate: context.html5},
            {type: 'blog', predicate: context.blog},
            {type: 'catalog', predicate: context.catalog},
            {type: 'shop', predicate: context.shop},
            {type: 'paypal', predicate: context.paypal},
            {type: 'professional', predicate: context.professional},
            {type: 'enterprise', predicate: context.enterprise},
            {type: 'e2e', predicate: context.e2e}
        ].reduce(extractRequiredSourcesFrom(jsSources), {});
        return gulp.src(valuesForObject(sources))
            .pipe(concat('libs.js'))
            .pipe(gulpif(options.env != 'dev', uglify()))
            .pipe(gulp.dest('build/dist/scripts'));
    }

    function extractRequiredSourcesFrom(src) {
        return function (p, c) {
            if (c.predicate) Object.keys(src[c.type] || {}).forEach(function (k) {
                p[k] = src[c.type][k];
            });
            return p;
        }
    }

    function valuesForObject(obj) {
        return Object.keys(obj).reduce(function (p, c) {
            if (!fs.existsSync(obj[c]))
                throw new Error('File not found: ' + obj[c]);
            p.push(obj[c]);
            return p;
        }, []);
    }

    gulp.task('update.scripts', ['update'], ScriptsTask);
    gulp.task('scripts', ['clean', 'compileBowerConfig'], ScriptsTask);
    gulp.task('dirty.scripts', ['compileBowerConfig'], ScriptsTask);

    function CompileLessTask() {
        var autoprefix = new LessAutoprefix({browsers: ['last 2 versions']});
        var cleanCSS = new LessPluginCleanCSS({advanced: true});

        return gulp.src([binartaModulesPathPrefix + 'less/*.less', 'src/web/styles/combined.less'])
            .pipe(less({
                plugins: [autoprefix, cleanCSS, lessPluginGlob],
                paths: [path.join(__dirname, 'less', 'includes')]
            }))
            .pipe(concat('app.css'))
            .pipe(gulp.dest('build/dist/styles'));
    }

    gulp.task('update.less', ['update'], CompileLessTask);
    gulp.task('less', ['clean', 'compileBowerConfig'], CompileLessTask);
    gulp.task('dirty.less', CompileLessTask);

    function CompileWebTemplatesTask() {
        return gulp.src('src/web/**/*.template')
            .pipe(data(context))
            .pipe(template())
            .pipe(rename(function (path) {
                path.extname = '';
            }))
            .pipe(minifyInline())
            .pipe(gulp.dest('build/dist'));
    }

    gulp.task('dirty.templates', ['dirty.scripts', 'dirty.partials'], CompileWebTemplatesTask);
    gulp.task('templates', ['clean'], CompileWebTemplatesTask);

    function FtlTemplatesCopyForBackwardsCompatibility() {
        return gulp.src('build/dist/index.ftl.template')
            .pipe(rename('index.html.template'))
            .pipe(gulp.dest('build/dist/'));
    }

    gulp.task('ftl.templates', ['templates'], FtlTemplatesCopyForBackwardsCompatibility);
    gulp.task('compile.web.templates', ['dirty.templates'], FtlTemplatesCopyForBackwardsCompatibility);

    function PartialsTask() {
        return gulp.src('src/web/partials/**/*.html')
            .pipe(data(context))
            .pipe(template())
            .pipe(minifyHtml(minifyHtmlOpts))
            .pipe(templateCache('partials.js', {module: context.appName, root: 'partials/'}))
            .pipe(uglify())
            .pipe(gulp.dest('build/dist/scripts'));
    }

    gulp.task('partials', ['clean'], PartialsTask);
    gulp.task('dirty.partials', PartialsTask);

    gulp.task('update.build', ['images', 'update.fonts', 'partials', 'ftl.templates', 'update.scripts', 'update.less', 'update.metadata', 'update.mails']);
    gulp.task('build', ['images', 'fonts', 'partials', 'ftl.templates', 'scripts', 'less', 'metadata', 'mails']);

    function DeployTask() {
        return gulp.src('build/dist/**/*.template')
            .pipe(data(context))
            .pipe(template())
            .pipe(replace(/<@link/g, '<link'))
            .pipe(replace(/<\/@link>/g, ''))
            .pipe(replace(/<@script/g, '<script'))
            .pipe(replace(/<\/@script>/g, '</script>'))
            .pipe(replace(/<@application_profile>/g, ''))
            .pipe(replace(/<\/@application_profile>/g, '</script>'))
            .pipe(replace(/<@page_author>/g, ''))
            .pipe(replace(/<\/@page_author>/g, ''))
            .pipe(replace(/<@page_title>/g, ''))
            .pipe(replace(/<\/@page_title>/g, ''))
            .pipe(replace(/<@page_description>/g, ''))
            .pipe(replace(/<\/@page_description>/g, ''))
            .pipe(replace(/<@og_image>/g, ''))
            .pipe(replace(/<\/@og_image>/g, ''))
            .pipe(replace(/<@page_address>/g, ''))
            .pipe(replace(/<\/@page_address>/g, ''))
            .pipe(rename(function (path) {
                path.extname = '';
            }))
            .pipe(gulp.dest('build/dist'));
    }

    gulp.task('update.deploy', ['update.build'], DeployTask);
    gulp.task('deploy', ['clean', 'build'], DeployTask);

    gulp.task('watch', function () {
        gulp.watch('src/web/img/**/*', ['dirty.images']);
        gulp.watch('src/web/fonts/**/*', ['dirty.fonts']);
        gulp.watch('src/web/partials/**/*.html', ['dirty.partials']);
        gulp.watch(['src/web/scripts/**/*', 'bower_components/**/*.js'], ['dirty.scripts']);
        gulp.watch(['src/web/styles/**/*', 'bower_components/**/*.less'], ['dirty.less']);
        gulp.watch('src/web/metadata*.json', ['dirty.metadata']);
    });

    function ServeTask() {
        browserSync.init({
            files: './build/dist/**/*',
            server: {
                baseDir: './build/dist',
                middleware: [historyApiFallback()]
            },
            open: false,
            notify: false,
            ghostMode: false
        });
    }

    gulp.task('serve', ['deploy', 'watch'], ServeTask);
    gulp.task('default', ['update.build']);

    gulp.task('e2e.serve', ['webdriver_update', 'deploy'], ServeTask);

    gulp.task('test', ['e2e.serve'], function (cb) {
        process.on('exit', cb);

        gulp.src('test.js')
            .pipe(protractor({configFile: 'test/e2e/conf.js'}))
            .on('error', function (e) {
                throw e;
            })
            .on('end', function () {
                process.exit();
            });
    });

    gulp.task('webdriver_update', webdriver_update);
};
