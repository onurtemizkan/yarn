/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import * as yarnVersion from '../../util/yarn-version.js';
import * as constants from '../../constants.js';
import * as child from '../../util/child.js';

const invariant = require('invariant');
const semver = require('semver');

const {version, getInstallationMethod, getUpdateCommand, getUpdateInstaller} = yarnVersion;

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export function setFlags(commander: Object) {}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  let latestVersion = await config.requestManager.request({
    url: constants.SELF_UPDATE_VERSION_URL,
  });

  invariant(typeof latestVersion === 'string', 'expected string');
  latestVersion = latestVersion.trim();

  if (!semver.valid(latestVersion)) {
    reporter.error(reporter.lang('yarnInvalidVersion'));
    return;
  }

  if (semver.gt(latestVersion, version)) {
    const installationMethod = await getInstallationMethod();
    const command = getUpdateCommand(installationMethod);
    const installer = await getUpdateInstaller(installationMethod);

    if (installer) {
      reporter.log(installer);
    } else if (command) {
      await child.spawn(command, [], {shell: true, stdio: 'inherit'});
    }
  } else {
    reporter.log(reporter.lang('yarnUpToDate'));
  }
}
