const ERROR = 2;
const IGNORE = 0;
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [ERROR, 'always', 100],
        'scope-case': [IGNORE],
        'subject-case': [IGNORE],
        'type-enum': [
            ERROR,
            'always',
            [
                'feat',
                'fix',
                'docs',
                'style',
                'refactor',
                'perf',
                'test',
                'build',
                'ci',
                'chore',
                'revert',
            ],
        ],
    },
};
