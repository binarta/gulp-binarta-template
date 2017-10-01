let less = require('gulp-less'),
    LessAutoprefix = require('less-plugin-autoprefix'),
    LessPluginCleanCSS = require('less-plugin-clean-css'),
    lessPluginGlob = require('less-plugin-glob'),
    concat = require('gulp-concat'),
    deleteLines = require('gulp-delete-lines'),
    binartaModulesPathPrefix = 'bower_components/binarta*/';

module.exports = {
    init: function(context) {
        context.styleSources = undefined;
    },
    install: function (gulp, context) {
        let splitStyles = context.styleSources || false;

        if (splitStyles) {
            gulp.task('dirty.compile.less.libs', CompileLessLibsTask);
            gulp.task('update.compile.less.libs', ['update'], CompileLessLibsTask);
            gulp.task('compile.less.libs', ['clean', 'compileBowerConfig'], CompileLessLibsTask);

            gulp.task('dirty.concat.app.styles', ConcatAppStyles);
            gulp.task('concat.app.styles', ['clean'], ConcatAppStyles);
            gulp.task('update.concat.app.styles', ['update'], ConcatAppStyles);

            gulp.task('dirty.compile.less.app', ['dirty.concat.app.styles'], CompileLessAppTask);
            gulp.task('compile.less.app', ['concat.app.styles'], CompileLessAppTask);
            gulp.task('update.compile.less.app', ['update.concat.app.styles'], CompileLessAppTask);

            gulp.task('dirty.less', ['dirty.compile.less.libs', 'dirty.compile.less.app']);
            gulp.task('less', ['compile.less.libs', 'compile.less.app']);
            gulp.task('update.less', ['update.compile.less.libs', 'update.compile.less.app'])
        } else {
            gulp.task('update.less', ['update'], CompileLessCombined);
            gulp.task('less', ['clean', 'compileBowerConfig'], CompileLessCombined);
            gulp.task('dirty.less', CompileLessCombined);
        }

        function CompileLessLibsTask() {
            return CompileLessTaskFactory(context.styleSources.sources.libs.sources, 'libs.css')();

        }

        function CompileLessTaskFactory(src, out, vars = {}) {
            return function () {
                let autoprefix = new LessAutoprefix({browsers: ['last 2 versions']});
                let cleanCSS = new LessPluginCleanCSS({advanced: true});

                return gulp.src(src)
                    .pipe(less({
                        modifyVars: vars,
                        plugins: [autoprefix, cleanCSS, lessPluginGlob],
                    }))
                    .pipe(concat(out))
                    .pipe(gulp.dest('build/dist/styles'));
            }
        }

        function ConcatAppStyles() {
            return gulp.src(context.styleSources.sources.app.sources)
                .pipe(deleteLines({filters: [/@import/]}))
                .pipe(concat('app.less'))
                .pipe(gulp.dest('build/dist/styles/'));
        }

        function CompileLessAppTask() {
            return CompileLessTaskFactory('build/dist/styles/app.less', 'app.css', getDefaultLessVars())();
        }

        function CompileLessCombined() {
            return CompileLessTaskFactory([binartaModulesPathPrefix + 'less/*.less', 'src/web/styles/combined.less'], 'app.css', getDefaultLessVars())();
        }

        function getDefaultLessVars() {
            return {
                '@bin-primary-color': context.metadata.ui.primaryColor
            }
        }
    }
};



