/* @flow */
jest.setMock('../../src/util/child.js', {
  spawn: jest.fn(() => Promise.resolve('')),
});

jest.unmock('../../src/util/yarn-version.js');

import {BufferReporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';
let {spawn} = require('../../src/util/child.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;
// the mocked requests have stripped metadata, don't use it in the following tests
jest.unmock('request');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'self-update');

async function runSelfUpdate(
  args: Array<string>,
  flags: Object,
  name: string,
  checkSteps?: ?(config: Config, output: any) => ?Promise<void>,
  mockLatestVersion?: ?string,
  mockCurrentVersion?: ?string,
  mockInstallationMethod?: ?string,
): Promise<void> {
  const reporter = new BufferReporter({stdout: null, stdin: null});
  const cwd = name && path.join(fixturesLoc, name);
  const config = await Config.create({cwd}, reporter);

  if (mockLatestVersion) {
    // $FlowFixMe
    config.requestManager.request = jest.fn(() => Promise.resolve(mockLatestVersion));
  }

  if (mockCurrentVersion) {
    jest.mock('../../src/util/yarn-version.js', () => {
      const originalYarnVersion = (require: any).requireActual('../../src/util/yarn-version.js');

      return {
        ...originalYarnVersion,
        getInstallationMethod: () => mockInstallationMethod,
        version: mockCurrentVersion,
      };
    });
  }

  jest.resetModules();
  jest.clearAllMocks();

  spawn = require('../../src/util/child.js').spawn;
  const selfUpdate = require('../../src/cli/commands/self-update.js').run;

  await selfUpdate(config, reporter, flags, args);

  if (checkSteps) {
    await checkSteps(config, reporter);
  }
}

test.concurrent('do nothing when yarn is up-to-date', (): Promise<void> => {
  return runSelfUpdate(
    [],
    {},
    'local',
    (config, reporter): ?Promise<void> => {
      expect(spawn).not.toBeCalled();
    },
    '0.0.1',
    '0.0.1',
    'deb',
  );
});

test.concurrent('do nothing when the installer is not known', (): Promise<void> => {
  return runSelfUpdate(
    [],
    {},
    'local',
    (config, reporter): ?Promise<void> => {
      expect(spawn).not.toBeCalled();
    },
    '0.1.0',
    '0.0.1',
    'awesome-installer',
  );
});

test.concurrent('run correct command for `tar` installer', (): Promise<void> => {
  return runSelfUpdate(
    [],
    {},
    'local',
    (config, reporter): ?Promise<void> => {
      expect(spawn).lastCalledWith('curl -o- -L https://yarnpkg.com/install.sh | bash', [], {
        shell: true,
        stdio: 'inherit',
      });
    },
    '0.1.0',
    '0.0.1',
    'tar',
  );
});

test.concurrent('run correct command for `deb` installer', (): Promise<void> => {
  return runSelfUpdate(
    [],
    {},
    'local',
    (config, reporter): ?Promise<void> => {
      expect(spawn).lastCalledWith('sudo apt-get update && sudo apt-get install yarn', [], {
        shell: true,
        stdio: 'inherit',
      });
    },
    '0.1.0',
    '0.0.1',
    'deb',
  );
});
