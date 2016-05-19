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
    path = require('path'),
    cssimport = require('gulp-cssimport'),
    autoprefixer = require('gulp-autoprefixer'),
    livereload = require('gulp-livereload'),
    gulpif = require('gulp-if'),
    csso = require('gulp-csso'),
    mainBowerFiles = require('main-bower-files'),
    filter = require('gulp-filter'),
    extend = require('gulp-extend'),
    nodeExtend = require('node.extend'),
    minifyHtml = require('gulp-minify-html'),
    minifyInline = require('gulp-minify-inline'),
    templateCache = require('gulp-angular-templatecache'),
    serve = require('gulp-serve'),
    fs = require('fs'),
    workingDir = process.cwd();

module.exports = function(gulp) {
    var knownOptions = {
        string: 'env',
        boolean: 'catalog',
        boolean: 'blog',
        boolean: 'shop',
        boolean: 'paypal',
        boolean: 'skipBower',
        string: 'port',
        default: {
            env: process.env.NODE_ENV || 'dev',
            catalog: false,
            blog: true,
            shop: false,
            skipBower: false,
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

    context.catalog = context.catalog || options.catalog;
    context.blog = context.blog || options.blog;
    context.shop = context.shop || options.shop;
    context.paypal = context.paypal || options.paypal;

    try {
        var userContext = require(workingDir + '/user-config.json');
        Object.keys(userContext).forEach(function (k) {
            context[k] = userContext[k];
        });
    } catch (ignored) {
    }

    context.metadata = require(workingDir + '/src/web/metadata.json');

    gulp.task('clean', function (cb) {
        del(['build'], cb);
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

    gulp.task('update', ['clean'], function () {
        if (options.skipBower) return;
        return bower({cmd: 'update'}).pipe(gulp.dest('build/libs'));
    });

    function CopyBowerMailsTask() {
        return gulp.src(mainBowerFiles())
            .pipe(filter('**/*.template.mail'))
            .pipe(rename(function (path) {
                path.extname = '.template';
            }))
            .pipe(gulp.dest("build/mail/"));
    }

    gulp.task('update.copy.bower.mails', ['update'], CopyBowerMailsTask);
    gulp.task('copy.bower.mails', ['clean'], CopyBowerMailsTask);

    function MailsTask() {
        return gulp.src(['src/mail/**/*.template'])
            .pipe(gulp.dest('build/mail'));
    }
    gulp.task('update.mails', ['update.copy.bower.mails'], MailsTask);
    gulp.task('mails', ['copy.bower.mails'], MailsTask);

    function MetadataSystemTask() {
        return gulp.src(mainBowerFiles().concat(context.sources))
            .pipe(filter('**/metadata-system.json'))
            .pipe(extend('metadata-system.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata-system', ['update'], MetadataSystemTask);
    gulp.task('metadata-system', ['clean'], MetadataSystemTask);
    gulp.task('dirty.metadata-system', MetadataSystemTask);

    function MetadataAppTask() {
        return gulp.src(mainBowerFiles().concat(context.sources))
            .pipe(filter('**/metadata-app.json'))
            .pipe(extend('metadata-app.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata-app', ['update'], MetadataAppTask);
    gulp.task('metadata-app', ['clean'], MetadataAppTask);
    gulp.task('dirty.metadata-app', MetadataAppTask);

    function MetadataTask() {
        return gulp.src(mainBowerFiles().concat(context.sources))
            .pipe(filter('**/metadata.json'))
            .pipe(extend('metadata.json'))
            .pipe(gulp.dest("build/dist/"));
    }

    gulp.task('update.metadata', ['update', 'update.metadata-system', 'update.metadata-app'], MetadataTask);
    gulp.task('metadata', ['clean', 'metadata-system', 'metadata-app'], MetadataTask);
    gulp.task('livereload.metadata', ['dirty.metadata-system', 'dirty.metadata-app'], function () {
        return MetadataTask().pipe(livereload());
    });

    function ScriptsTask() {
        var jsSources = context.jsSources;
        mainBowerFiles('**/sources.json').forEach(function (src) {
            jsSources = nodeExtend(true, jsSources, require(src));
        });
        var sources = [
            {type:'default', predicate:true},
            {type:'blog', predicate:context.blog},
            {type:'catalog', predicate:context.catalog},
            {type:'shop', predicate:context.shop},
            {type:'paypal', predicate:context.paypal}
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
    gulp.task('scripts', ['clean'], ScriptsTask);
    gulp.task('dirty.scripts', ScriptsTask);
    gulp.task('livereload.scripts', function () {
        return ScriptsTask().pipe(livereload());
    });

    function CompileLessTask() {
        return gulp.src('src/web/styles/combined.less')
            .pipe(less({paths: [path.join(__dirname, 'update.less', 'includes')]}))
            .pipe(cssimport())
            .pipe(autoprefixer({
                browsers: ['last 2 versions'],
                cascade: false
            }))
            .pipe(csso())
            .pipe(rename("app.css"))
            .pipe(gulp.dest('build/dist/styles'));
    }
    gulp.task('update.less', ['update'], CompileLessTask);
    gulp.task('less', ['clean'], CompileLessTask);
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