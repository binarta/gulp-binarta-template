var template = require('gulp-template'),
    data = require('gulp-data'),
    rename = require('gulp-rename'),
    del = require('del'),
    version = new Date().getTime(),
    minimist = require('minimist'),
    bower = require('gulp-bower'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    less = require('gulp-less'),
    LessAutoprefix = require('less-plugin-autoprefix'),
    LessPluginCleanCSS = require('less-plugin-clean-css'),
    path = require('path'),
    livereload = require('gulp-livereload'),
    gulpif = require('gulp-if'),
    mainBowerFiles = require('main-bower-files'),
    gulpMainBowerFiles = require('gulp-main-bower-files'),
    streamqueue = require('streamqueue'),
    filter = require('gulp-filter'),
    extend = require('gulp-extend'),
    nodeExtend = require('node.extend'),
    minifyHtml = require('gulp-minify-html'),
    minifyInline = require('gulp-minify-inline'),
    templateCache = require('gulp-angular-templatecache'),
    serve = require('gulp-serve'),
    fs = require('fs'),
    glob = require('glob'),
    workingDir = process.cwd(),
    binartaModulesPathPrefix = 'bower_components/binarta*/';

module.exports = function(gulp) {
    var knownOptions = {
        string: 'env',
        boolean: 'catalog',
        boolean: 'blog',
        boolean: 'shop',
        boolean: 'paypal',
        string: 'subscription',
        string: 'port',
        default: {
            env: process.env.NODE_ENV || 'dev',
            port: 3000
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
    context.version = options.env == 'dev' ? 0 : version;

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

    if (userContext.blog != undefined) context.blog = userContext.blog;
    else if (options.blog != undefined) context.blog = options.blog;
    if (context.blog == undefined) context.blog = true;

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

    gulp.task('images', ['clean'], function () {
        return gulp.src(['src/web/img/**/*'])
            .pipe(gulp.dest('build/dist/img'));
    });

    gulp.task('fonts', ['clean'], function () {
        return gulp.src(['src/web/fonts/**/*'])
            .pipe(gulp.dest('build/dist/fonts'));
    });

    gulp.task('sources', ['images', 'fonts']);

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
    gulp.task('livereload.metadata', ['dirty.metadata-system', 'dirty.metadata-app'], function () {
        return MetadataTask().pipe(livereload());
    });

    function ScriptsTask() {
        var jsSources = context.jsSources;
        glob.sync(binartaModulesPathPrefix + 'sources.json').forEach(function (src) {
            jsSources = nodeExtend(true, jsSources, require(workingDir + '/' + src));
        });
        var sources = [
            {type:'init', predicate:true},
            {type:'default', predicate:true},
            {type:'blog', predicate:context.blog},
            {type:'catalog', predicate:context.catalog},
            {type:'shop', predicate:context.shop},
            {type:'paypal', predicate:context.paypal},
            {type:'professional', predicate:context.professional},
            {type:'enterprise', predicate:context.enterprise}
        ].reduce(extractRequiredSourcesFrom(jsSources), {});
        return gulp.src(valuesForObject(sources))
            .pipe(concat('libs.js'))
            .pipe(gulpif(options.env != 'dev', uglify()))
            .pipe(gulp.dest('build/dist/scripts'));
    }

    function extractRequiredSourcesFrom(src) {
        return function(p,c) {
            if (c.predicate) Object.keys(src[c.type] || {}).forEach(function(k) {
                p[k] = src[c.type][k];
            });
            return p;
        }
    }

    function valuesForObject(obj) {
        return Object.keys(obj).reduce(function(p,c) {
            if (!fs.existsSync(obj[c]))
                throw new Error('File not found: ' + obj[c]);
            p.push(obj[c]);
            return p;
        }, []);
    }

    gulp.task('update.scripts', ['update'], ScriptsTask);
    gulp.task('scripts', ['clean', 'compileBowerConfig'], ScriptsTask);
    gulp.task('dirty.scripts', ['compileBowerConfig'], ScriptsTask);
    gulp.task('livereload.scripts', function () {
        return ScriptsTask().pipe(livereload());
    });

    function CompileLessTask() {
        var autoprefix = new LessAutoprefix({ browsers: ['last 2 versions'] });
        var cleanCSS = new LessPluginCleanCSS({advanced: true});

        return streamqueue({ objectMode: true },
            gulp.src('bower.json').pipe(gulpMainBowerFiles('**/bower_components/binarta.**/less/*.less')),
            gulp.src('src/web/styles/combined.less')
        )
            .pipe(less({
                plugins: [autoprefix, cleanCSS],
                paths: [path.join(__dirname, 'less', 'includes')]
            }))
            .pipe(concat('app.css'))
            .pipe(gulp.dest('build/dist/styles'));
    }
    gulp.task('update.less', ['update'], CompileLessTask);
    gulp.task('less', ['clean', 'compileBowerConfig'], CompileLessTask);
    gulp.task('livereload.less', function () {
        return CompileLessTask().pipe(livereload());
    });

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
    gulp.task('compile.web.templates', ['dirty.scripts', 'dirty.partials'], CompileWebTemplatesTask);
    gulp.task('templates', ['clean'], CompileWebTemplatesTask);

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
    gulp.task('livereload.partials', function () {
        return PartialsTask().pipe(livereload());
    });

    gulp.task('update.build', ['sources', 'partials', 'templates', 'update.scripts', 'update.less', 'update.metadata', 'update.mails']);
    gulp.task('build', ['sources', 'partials', 'templates', 'scripts', 'less', 'metadata', 'mails']);

    function DeployTask() {
        return gulp.src('build/dist/**/*.template')
            .pipe(data(context))
            .pipe(template())
            .pipe(rename(function (path) {
                path.extname = '';
            }))
            .pipe(gulp.dest('build/dist'));
    }
    gulp.task('update.deploy', ['update.build'], DeployTask);
    gulp.task('deploy', ['clean', 'build'], DeployTask);

    function WatchTask() {
        livereload.listen();

        gulp.watch('src/web/styles/**/*.less', ['livereload.less']);
        gulp.watch('src/web/partials/**/*.html', ['livereload.partials']);
        gulp.watch('src/web/scripts/**/*.js', ['livereload.scripts']);
        gulp.watch('src/web/metadata*.json', ['livereload.metadata']);
    }
    gulp.task('update.watch', ['update.deploy'], WatchTask);
    gulp.task('watch', ['deploy'], WatchTask);

    function ServeTask() {
        return serve({
            root:['build/dist'],
            port: options.port
        });
    }
    gulp.task('update.serve', ['update.watch'], ServeTask());
    gulp.task('serve', ['watch'], ServeTask());

    gulp.task('default', ['update.build']);
};