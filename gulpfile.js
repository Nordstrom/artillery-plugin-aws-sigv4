'use strict';

var gulp = require('gulp'),
    guppy = require('git-guppy')(gulp),
    jshint = require('gulp-jshint'),
    jscs = require('gulp-jscs'),
    jsSources = ['*.js', 'lib/*.js'];

gulp.task('default', ['lint', 'style'], function () {
});

gulp.task('pre-commit', ['lint', 'style'], function () {
});

gulp.task('lint', function() {
    return gulp.src(jsSources)
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('style', function() {
    return gulp.src(jsSources)
        .pipe(jscs())
        .pipe(jscs.reporter())
        .pipe(jscs.reporter('fail'));
});
