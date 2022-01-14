/* eslint-disable consistent-return */
/* eslint-disable array-callback-return */
/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
const ASAR = require('asar');
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

const pageUrls = {
  worker: 'worker.html',
  loading: 'loading.html',
  main: 'index.html',
};
const pageTitles = {
  loading: 'Loading...',
  main: 'Playwright...',
  worker: 'Worker...',
};

const findLatestBuild = () => {
  // root of your project
  const rootDir = path.resolve('./');
  // directory where the builds are stored
  const outDir = path.join(rootDir, 'dist');
  // list of files in the out directory
  const builds = fs.readdirSync(outDir);
  const platforms = [
    'win32',
    'win',
    'windows',
    'darwin',
    'mac',
    'macos',
    'osx',
    'linux',
    'ubuntu',
  ];

  const latestBuild = builds
    .map((fileName) => {
      // make sure it's a directory with "-" delimited platform in its name
      const stats = fs.statSync(path.join(outDir, fileName));
      const isBuild = fileName
        .toLocaleLowerCase()
        .split('-')
        .some((part) => platforms.includes(part));
      if (stats.isDirectory() && isBuild) {
        return {
          name: fileName,
          time: fs.statSync(path.join(outDir, fileName)).mtimeMs,
        };
      }
    })
    .sort((a, b) => b.time - a.time)
    .map((file) => {
      if (file) {
        return file.name;
      }
    })[0];
  if (!latestBuild) {
    throw new Error('No build found in out directory');
  }
  return path.join(outDir, latestBuild);
};

/**
 * Given a directory containing an Electron app build,
 * return the path to the app's executable and the path to the app's main file.
 */
const parseElectronApp = (buildDir) => {
  console.log(`Parsing Electron app in ${buildDir}`);
  let platform;
  if (buildDir.endsWith('.app')) {
    buildDir = path.dirname(buildDir);
    platform = 'darwin';
  }
  if (buildDir.endsWith('.exe')) {
    buildDir = path.dirname(buildDir);
    platform = 'win32';
  }

  const baseName = path.basename(buildDir).toLowerCase();
  if (!platform) {
    // parse the directory name to figure out the platform
    if (baseName.includes('win')) {
      platform = 'win32';
    }
    if (
      baseName.includes('linux') ||
      baseName.includes('ubuntu') ||
      baseName.includes('debian')
    ) {
      platform = 'linux';
    }
    if (
      baseName.includes('darwin') ||
      baseName.includes('mac') ||
      baseName.includes('osx')
    ) {
      platform = 'darwin';
    }
  }

  if (!platform) {
    throw new Error(`Platform not found in directory name: ${baseName}`);
  }

  let arch;
  if (baseName.includes('x32') || baseName.includes('i386')) {
    arch = 'x32';
  }
  if (baseName.includes('x64')) {
    arch = 'x64';
  }
  if (baseName.includes('arm64')) {
    arch = 'arm64';
  }

  let executable;
  let main;
  let name;
  let asar;
  let resourcesDir;

  if (platform === 'darwin') {
    // MacOS Structure
    // <buildDir>/
    //   <appName>.app/
    //     Contents/
    //       MacOS/
    //        <appName> (executable)
    //       Info.plist
    //       PkgInfo
    //       Resources/
    //         electron.icns
    //         file.icns
    //         app.asar (asar bundle) - or -
    //         app
    //           package.json
    //           (your app structure)

    const list = fs.readdirSync(buildDir);
    const appBundle = list.find((fileName) => {
      return fileName.endsWith('.app');
    });

    const appDir = path.join(buildDir, appBundle, 'Contents', 'MacOS');
    const appName = fs.readdirSync(appDir)[0];
    executable = path.join(appDir, appName);

    resourcesDir = path.join(buildDir, appBundle, 'Contents', 'Resources');
    const resourcesList = fs.readdirSync(resourcesDir);
    asar = resourcesList.includes('app.asar');

    let packageJson;
    if (asar) {
      const asarPath = path.join(resourcesDir, 'app.asar');
      packageJson = JSON.parse(
        ASAR.extractFile(asarPath, 'package.json').toString('utf8')
      );
      main = path.join(asarPath, packageJson.main);
    } else {
      packageJson = JSON.parse(
        fs.readFileSync(path.join(resourcesDir, 'app', 'package.json'), 'utf8')
      );
      main = path.join(resourcesDir, 'app', packageJson.main);
    }
    name = packageJson.name;
  } else if (platform === 'win32') {
    // Windows Structure
    // <buildDir>/
    //   <appName>.exe (executable)
    //   resources/
    //     app.asar (asar bundle) - or -
    //     app
    //       package.json
    //       (your app structure)

    const list = fs.readdirSync(buildDir);
    const exe = list.find((fileName) => {
      return fileName.endsWith('.exe');
    });

    executable = path.join(buildDir, exe);

    resourcesDir = path.join(buildDir, 'resources');
    const resourcesList = fs.readdirSync(resourcesDir);
    asar = resourcesList.includes('app.asar');

    let packageJson;

    if (asar) {
      const asarPath = path.join(resourcesDir, 'app.asar');
      packageJson = JSON.parse(
        ASAR.extractFile(asarPath, 'package.json').toString('utf8')
      );
      main = path.join(asarPath, packageJson.main);
    } else {
      packageJson = JSON.parse(
        fs.readFileSync(path.join(resourcesDir, 'app', 'package.json'), 'utf8')
      );
      main = path.join(resourcesDir, 'app', packageJson.main);
    }
    name = packageJson.name;
  } else {
    /**  @todo add support for linux */
    throw new Error(`Platform not supported: ${platform}`);
  }
  return {
    executable,
    main,
    asar,
    name,
    platform,
    resourcesDir,
    arch,
  };
};

const getRendererPage = async (
  electronApp,
  desiredWindow = pageUrls.main,
  timeout = 50_000
) => {
  const deadline = Date.now() + timeout;

  for (; Date.now() < deadline; ) {
    // eslint-disable-next-line no-restricted-syntax
    for (const page of electronApp.windows()) {
      console.log('Found Windows => ', electronApp.windows().length);
      if (page.url().includes(desiredWindow)) {
        // eslint-disable-next-line no-await-in-loop
        console.log('Returning Desired Page => ', await page.title());
        return page;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`Repeato did not open the main window within ${timeout}ms`);
};

const attemptStart = async (timeout = 50_000) => {
  const appArgs = { args: ['src/main/main.js'] };
  let appInfo;

  if (process.env.TEST_BUILD === 'true') {
    const latestBuild = findLatestBuild(); // find the latest build in the out directory
    appInfo = parseElectronApp(latestBuild); // parse the directory and find paths and other info
    appArgs.args = [appInfo.main];
    appArgs.executablePath = appInfo.executable;
  }

  const electronApp = await electron.launch({ ...appArgs });
  const page = await getRendererPage(electronApp, pageUrls.main, timeout); // waitFor main window
  return { electronApp, page };
};

const startApp = async () => {
  // this is an attempted workaround for an issue with playwright not always getting the main window
  // eslint-disable-next-line no-plusplus
  for (let i = 0; ; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await attemptStart();
    } catch (error) {
      if (i === 4) {
        throw error;
      }
    }
  }
};

const loadWindow = async (windowToCheck, electronApp) => {
  const windowState = await electronApp.evaluate(
    async ({ BrowserWindow }, checkWindow) => {
      const selectedWindow = BrowserWindow.getAllWindows().filter(
        (w) => w.getTitle() === checkWindow
      )[0];

      const getState = () => ({
        isVisible: selectedWindow.isVisible(),
        id: selectedWindow.id,
        title: selectedWindow.getTitle(),
        isDevToolsOpened: selectedWindow.webContents.isDevToolsOpened(),
        isCrashed: selectedWindow.webContents.isCrashed(),
      });

      return new Promise((resolve) => {
        if (
          selectedWindow.isVisible() ||
          selectedWindow.getTitle() === 'Worker...'
        ) {
          resolve(getState());
        } else {
          selectedWindow.once('ready-to-show', () =>
            setTimeout(() => resolve(getState()), 1000)
          );
        }
        setTimeout(() => resolve(getState()), 2000); // quick fix - sometimes promise never resolves
      });
    },
    windowToCheck
  );
  return windowState;
};

const closeMainWindow = async (electronApp) => {
  const electronAppParams = { mainElectronWindow: pageTitles.main };
  await electronApp.evaluate(
    async ({ BrowserWindow }, { mainElectronWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().filter(
        (w) => w.getTitle() === mainElectronWindow
      )[0];
      await mainWindow?.webContents.send('app-close'); // mainWindow can be null, in some tests cases we triggers app-close event before tests finishes
    },
    electronAppParams
  );
};

module.exports = { startApp, loadWindow, pageTitles, closeMainWindow };
