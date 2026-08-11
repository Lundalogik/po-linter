jest.mock('@actions/glob');
jest.mock('pofile', () => ({
    load: jest.fn(),
}));

describe('po-linter', () => {
    let originalGitHubActions;
    let core, glob, pofile, PoLinter;

    beforeEach(() => {
        originalGitHubActions = process.env.GITHUB_ACTIONS;
        jest.resetModules();

        jest.mock('@actions/core', () => ({
            info: jest.fn(),
            error: jest.fn(),
            setFailed: jest.fn(),
            summary: {
                addHeading: jest.fn().mockReturnThis(),
                addRaw: jest.fn().mockReturnThis(),
                addSeparator: jest.fn().mockReturnThis(),
                addDetails: jest.fn().mockReturnThis(),
                addCodeBlock: jest.fn().mockReturnThis(),
                write: jest.fn().mockResolvedValue(),
            },
        }));

        core = require('@actions/core');
        glob = require('@actions/glob');
        pofile = require('pofile');
        PoLinter = require('./index');

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.GITHUB_ACTIONS = originalGitHubActions;
        jest.restoreAllMocks();
    });

    const ATTRIBUTION_HTML =
        '<sub>Reported by <a href="https://github.com/Lundalogik/po-linter">po-linter</a></sub>';

    // Every `core.summary` method that appends to the summary. `write` is
    // excluded, since it flushes the buffer rather than adding to it.
    const SUMMARY_CONTENT_METHODS = [
        'addHeading',
        'addRaw',
        'addSeparator',
        'addDetails',
        'addCodeBlock',
    ];

    // The attribution is a footer, so asserting that it was added is not
    // enough: it also has to be the last thing added.
    function expectAttributionAddedLast() {
        expect(core.summary.addRaw).toHaveBeenLastCalledWith(ATTRIBUTION_HTML);

        const attributionCall =
            core.summary.addRaw.mock.invocationCallOrder.at(-1);
        const callsAfterAttribution = SUMMARY_CONTENT_METHODS.flatMap(
            (method) => core.summary[method].mock.invocationCallOrder,
        ).filter((call) => call > attributionCall);

        expect(callsAfterAttribution).toEqual([]);
    }

    describe('escapeHtml', () => {
        let escapeHtml;
        beforeEach(() => {
            escapeHtml = require('./constants').escapeHtml;
        });

        it('does not alter a string with no special characters', () => {
            expect(escapeHtml('hello world')).toBe('hello world');
        });

        it('escapes all special HTML characters', () => {
            const unsafe = '<script>alert("XSS & Injection \'FAIL\'")</script>';
            const expected =
                '&lt;script&gt;alert(&quot;XSS &amp; Injection &#039;FAIL&#039;&quot;)&lt;/script&gt;';
            expect(escapeHtml(unsafe)).toBe(expected);
        });

        it('coerces input that is not a string', () => {
            expect(escapeHtml(42)).toBe('42');
            // `undefined` is the value that actually reaches this function
            // when a thrown value has no `stack` or `message`, so it is worth
            // asserting explicitly.
            // eslint-disable-next-line unicorn/no-useless-undefined
            expect(escapeHtml(undefined)).toBe('undefined');
        });
    });

    describe('reporters', () => {
        describe('with GITHUB_ACTIONS', () => {
            beforeEach(() => {
                process.env.GITHUB_ACTIONS = 'true';
            });

            it('reportSuccess generates a GitHub Actions summary', async () => {
                const linter = new PoLinter();
                await linter.reportSuccess();
                expect(core.summary.addHeading).toHaveBeenCalledWith(
                    '✅ No Duplicate <code>msgid</code>s Found',
                    2,
                );
                expect(core.summary.addRaw).toHaveBeenCalledWith(
                    'All <code>.po</code> files were checked and no duplicate <code>msgid</code>s were found.',
                );
                expect(core.summary.write).toHaveBeenCalled();
                expect(core.info).toHaveBeenCalledWith(
                    'No duplicate msgids found.',
                );
            });

            it('reportSuccess adds the po-linter attribution last', async () => {
                const linter = new PoLinter();
                await linter.reportSuccess();
                expectAttributionAddedLast();
            });

            it('reportNoFilesFound logs without generating a GitHub Actions summary', async () => {
                const linter = new PoLinter();
                await linter.reportNoFilesFound();
                expect(core.info).toHaveBeenCalledWith(
                    'No .po files found, nothing to check.',
                );
                expect(core.summary.addHeading).not.toHaveBeenCalled();
                expect(core.summary.addRaw).not.toHaveBeenCalled();
                expect(core.summary.write).not.toHaveBeenCalled();
            });

            it('reportFatalError sets failed and generates a GitHub Actions summary', async () => {
                const linter = new PoLinter();
                const error = new Error('test error');
                error.stack = 'stack trace';
                await linter.reportFatalError(error);
                expect(core.setFailed).toHaveBeenCalledWith('test error');
                expect(core.summary.addHeading).toHaveBeenCalledWith(
                    '❗ Error',
                    2,
                );
                expect(core.summary.addRaw).toHaveBeenCalledWith(
                    'An unexpected error occurred while checking for duplicate <code>msgid</code>s.',
                );
                expect(core.summary.addCodeBlock).toHaveBeenCalledWith(
                    'stack trace',
                    'javascript',
                );
                expect(core.summary.write).toHaveBeenCalled();
            });

            it('reportFatalError escapes HTML in the stack trace', async () => {
                const linter = new PoLinter();
                const error = new Error('test error');
                error.stack = 'Error: cannot read <config>';
                await linter.reportFatalError(error);
                expect(core.summary.addCodeBlock).toHaveBeenCalledWith(
                    'Error: cannot read &lt;config&gt;',
                    'javascript',
                );
            });

            it('reportFatalError falls back to the escaped error message', async () => {
                const linter = new PoLinter();
                const error = new Error('cannot read <config>');
                error.stack = undefined;
                await linter.reportFatalError(error);
                expect(core.summary.addCodeBlock).toHaveBeenCalledWith(
                    'cannot read &lt;config&gt;',
                    'javascript',
                );
            });

            it('reportFatalError reports a thrown value that is not an Error', async () => {
                const linter = new PoLinter();
                await linter.reportFatalError('boom: a thrown string');
                expect(core.setFailed).toHaveBeenCalledWith(
                    'boom: a thrown string',
                );
                expect(core.summary.addCodeBlock).toHaveBeenCalledWith(
                    'boom: a thrown string',
                    'javascript',
                );
                expect(core.summary.write).toHaveBeenCalled();
            });

            it('reportFatalError adds the po-linter attribution last', async () => {
                const linter = new PoLinter();
                await linter.reportFatalError(new Error('test error'));
                expectAttributionAddedLast();
            });

            it('reportFailure sets failed and generates a detailed GitHub Actions summary', async () => {
                const linter = new PoLinter();
                const { escapeHtml } = require('./constants');
                const duplicates = new Map([
                    ['file1.po', new Set(['msgid1', 'msgid2'])],
                    ['file2.po', new Set(['msgid3'])],
                ]);
                await linter.reportFailure(duplicates);
                expect(core.setFailed).toHaveBeenCalledWith(
                    'Duplicate msgids found in one or more .po files.',
                );
                expect(core.summary.addHeading).toHaveBeenCalledWith(
                    "❌ Found duplicate msgid's in 2 file(s)",
                    2,
                );
                expect(core.summary.addRaw).toHaveBeenCalledWith(
                    'The following files contain duplicate <code>msgid</code> entries. This can cause issues with translations. Please resolve them.',
                );
                expect(core.summary.addDetails).toHaveBeenCalledTimes(2);
                expect(core.summary.addDetails).toHaveBeenCalledWith(
                    '<code>file1.po</code> (2 duplicates)',
                    `<ul><li><pre><code>${escapeHtml(
                        'msgid1',
                    )}</code></pre></li><li><pre><code>${escapeHtml(
                        'msgid2',
                    )}</code></pre></li></ul>`,
                );
                expect(core.summary.write).toHaveBeenCalled();
            });

            it('reportFailure escapes HTML in file names', async () => {
                const linter = new PoLinter();
                const duplicates = new Map([
                    ['<script>.po', new Set(['msgid1'])],
                ]);
                await linter.reportFailure(duplicates);
                expect(core.summary.addDetails).toHaveBeenCalledWith(
                    '<code>&lt;script&gt;.po</code> (1 duplicates)',
                    expect.any(String),
                );
            });

            it('reportFailure adds the po-linter attribution last', async () => {
                const linter = new PoLinter();
                const duplicates = new Map([['file1.po', new Set(['msgid1'])]]);
                await linter.reportFailure(duplicates);
                expectAttributionAddedLast();
            });
        });

        describe('without GITHUB_ACTIONS', () => {
            beforeEach(() => {
                delete process.env.GITHUB_ACTIONS;
            });

            it('reportSuccess logs to console', async () => {
                const linter = new PoLinter();
                await linter.reportSuccess();
                expect(console.log).toHaveBeenCalledWith(
                    '✅ No duplicate msgids found.',
                );
            });

            it('reportNoFilesFound logs to console', async () => {
                const linter = new PoLinter();
                await linter.reportNoFilesFound();
                expect(console.log).toHaveBeenCalledWith(
                    'No .po files found, nothing to check.',
                );
            });

            it('reportFatalError logs to console and exits', async () => {
                const linter = new PoLinter();
                const error = new Error('test error');
                await linter.reportFatalError(error);
                expect(console.error).toHaveBeenCalledWith('❗ Error');
                expect(console.error).toHaveBeenCalledWith(error);
                expect(process.exit).toHaveBeenCalledWith(1);
            });

            it('reportFailure logs to console and exits', async () => {
                const linter = new PoLinter();
                const duplicates = new Map([['file1.po', new Set(['msgid1'])]]);
                await linter.reportFailure(duplicates);
                expect(console.error).toHaveBeenCalledWith(
                    "❌ Found duplicate msgid's in 1 file(s)",
                );
                expect(process.exit).toHaveBeenCalledWith(1);
            });
        });
    });

    describe('main', () => {
        it('creates a globber with the correct patterns', async () => {
            const linter = new PoLinter();
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue([]),
            });
            const expectedPatterns = [
                '**/*.po',
                '!**/.git/**',
                '!**/.github/**',
                '!**/.venv/**',
                '!**/node_modules/**',
            ].join('\n');

            await linter.main();

            expect(glob.create).toHaveBeenCalledWith(expectedPatterns);
        });

        it('reports no files found when glob returns no files', async () => {
            process.env.GITHUB_ACTIONS = 'true';
            const linter = new PoLinter();
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue([]),
            });

            await linter.main();
            expect(core.info).toHaveBeenCalledWith(
                'No .po files found, nothing to check.',
            );
        });

        it('reports success when no duplicates are found', async () => {
            const linter = new PoLinter();
            const reportSuccessSpy = jest.spyOn(linter, 'reportSuccess');
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue(['file1.po']),
            });

            pofile.load.mockImplementation((file, callback) => {
                callback(undefined, {
                    items: [
                        { msgid: 'id1', msgstr: 'str1' },
                        { msgid: 'id2', msgstr: 'str2' },
                    ],
                });
            });

            await linter.main();

            expect(reportSuccessSpy).toHaveBeenCalled();
        });

        it('reports failure when duplicates are found', async () => {
            process.env.GITHUB_ACTIONS = 'true';
            const linter = new PoLinter();
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue(['file1.po']),
            });
            pofile.load.mockImplementation((file, callback) => {
                callback(undefined, {
                    items: [
                        { msgid: 'id1', msgstr: 'str1' },
                        { msgid: 'id1', msgstr: 'str2' },
                    ],
                });
            });

            await linter.main();

            expect(core.setFailed).toHaveBeenCalled();
            expect(core.error).toHaveBeenCalledWith(
                'Duplicate msgid found in file1.po: "id1"',
            );
        });

        it('handles errors during glob creation', async () => {
            delete process.env.GITHUB_ACTIONS;
            const linter = new PoLinter();
            const error = new Error('glob error');
            glob.create.mockRejectedValue(error);
            await linter.main();
            expect(console.error).toHaveBeenCalledWith('❗ Error');
            expect(console.error).toHaveBeenCalledWith(error);
        });

        it('handles a non-Error thrown during glob creation', async () => {
            process.env.GITHUB_ACTIONS = 'true';
            const linter = new PoLinter();
            glob.create.mockRejectedValue('boom: a thrown string');

            await linter.main();

            expect(core.setFailed).toHaveBeenCalledWith(
                'boom: a thrown string',
            );
            expect(core.summary.write).toHaveBeenCalled();
        });

        it('handles errors during pofile loading', async () => {
            delete process.env.GITHUB_ACTIONS;
            const linter = new PoLinter();
            const error = new Error('pofile error');
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue(['file1.po']),
            });
            pofile.load.mockImplementation((file, callback) => {
                callback(error);
            });

            await linter.main();

            expect(console.error).toHaveBeenCalledWith('❗ Error');
            expect(console.error).toHaveBeenCalledWith(error);
        });
    });
});
