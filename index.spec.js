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

    describe('escapeHtml', () => {
        it('does not alter a string with no special characters', () => {
            const linter = new PoLinter();
            expect(linter.escapeHtml('hello world')).toBe('hello world');
        });

        it('escapes all special HTML characters', () => {
            const linter = new PoLinter();
            const unsafe = '<script>alert("XSS & Injection \'FAIL\'")</script>';
            const expected =
            '&lt;script&gt;alert(&quot;XSS &amp; Injection &#039;FAIL&#039;&quot;)&lt;/script&gt;';
            expect(linter.escapeHtml(unsafe)).toBe(expected);
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
                expect(core.summary.addHeading).toHaveBeenCalledWith('✅ No Duplicate `msgid`s Found');
                expect(core.summary.write).toHaveBeenCalled();
                expect(core.info).toHaveBeenCalledWith('No duplicate msgids found.');
            });

            it('reportNoFilesFound generates a GitHub Actions summary', async () => {
                const linter = new PoLinter();
                await linter.reportNoFilesFound();
                expect(core.info).toHaveBeenCalledWith('No .po files found.');
                expect(core.summary.addHeading).toHaveBeenCalledWith('No `.po` files found');
                expect(core.summary.write).toHaveBeenCalled();
            });

            it('reportFatalError sets failed and generates a GitHub Actions summary', async () => {
                const linter = new PoLinter();
                const error = new Error('test error');
                error.stack = 'stack trace';
                await linter.reportFatalError(error);
                expect(core.setFailed).toHaveBeenCalledWith('test error');
                expect(core.summary.addHeading).toHaveBeenCalledWith('❗ Error');
                expect(core.summary.addCodeBlock).toHaveBeenCalledWith(
                    'stack trace',
                    'javascript'
                );
                expect(core.summary.write).toHaveBeenCalled();
            });

            it('reportFailure sets failed and generates a detailed GitHub Actions summary', async () => {
                const linter = new PoLinter();
                const duplicates = new Map([
                    ['file1.po', new Set(['msgid1', 'msgid2'])],
                    ['file2.po', new Set(['msgid3'])],
                ]);
                await linter.reportFailure(duplicates);
                expect(core.setFailed).toHaveBeenCalledWith(
                    'Duplicate msgids found in one or more .po files.'
                );
                expect(core.summary.addHeading).toHaveBeenCalledWith(
                    "❌ Found duplicate msgid's in 2 file(s)",
                    2
                );
                expect(core.summary.addDetails).toHaveBeenCalledTimes(2);
                expect(core.summary.addDetails).toHaveBeenCalledWith(
                    '`file1.po` (2 duplicates)',
                    `<ul><li><pre><code>${linter.escapeHtml(
                        'msgid1'
                    )}</code></pre></li><li><pre><code>${linter.escapeHtml(
                        'msgid2'
                    )}</code></pre></li></ul>`
                );
                expect(core.summary.write).toHaveBeenCalled();
            });
        });

        describe('without GITHUB_ACTIONS', () => {
            beforeEach(() => {
                delete process.env.GITHUB_ACTIONS;
            });

            it('reportSuccess logs to console', async () => {
                const linter = new PoLinter();
                await linter.reportSuccess();
                expect(console.log).toHaveBeenCalledWith('✅ No duplicate msgids found.');
            });

            it('reportNoFilesFound logs to console', async () => {
                const linter = new PoLinter();
                await linter.reportNoFilesFound();
                expect(console.log).toHaveBeenCalledWith('No .po files found.');
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
                    "❌ Found duplicate msgid's in 1 file(s)"
                );
                expect(process.exit).toHaveBeenCalledWith(1);
            });
        });
    });

    describe('main', () => {
        it('reports no files found when glob returns no files', async () => {
            process.env.GITHUB_ACTIONS = 'true';
            const linter = new PoLinter();
            glob.create.mockResolvedValue({
                glob: jest.fn().mockResolvedValue([]),
            });

            await linter.main();
            expect(core.info).toHaveBeenCalledWith('No .po files found.');
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
                'Duplicate msgid found in file1.po: "id1"'
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
