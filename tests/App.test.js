const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

let electronApp;

const mainThreadWindows = { loading: 1, main: 2, worker: 3 };

const startApp = async () => {
  const electronApp = await electron.launch({ args: ['src/main/main.js'] });

  // getting only fired once for main window here
  // it's behavior is differnt from machine to machine
  // using promise on purpose here becuase waitForEvent behavior is not consistent
  // sometimes waitForEvent works on my mac and on windows same issue get fired only once
  const promise = new Promise((resolve) => {
    electronApp.on('window', (w) =>
      w.title().then((title) => {
        console.log('title', title);
        // if (title === 'Playwright...') resolve();
      })
    );
  });

  await promise; // will make sure main window is ready
  const loading = await electronApp.windows()[0].title();
  const main = await electronApp.windows()[1]?.title();
  const worker = await electronApp.windows()[2]?.title();

  console.log('electronApp', loading, main, worker);
  return electronApp;
};

const loadWindow = async (windowToCheck, electronApp) => {
  const windowState = await electronApp.evaluate(
    async ({ BrowserWindow }, windowToCheck) => {
      const selectedWindow = BrowserWindow.fromId(windowToCheck);

      const getState = () => ({
        isVisible: selectedWindow.isVisible(),
        id: selectedWindow.id,
        title: selectedWindow.getTitle(),
        isDevToolsOpened: selectedWindow.webContents.isDevToolsOpened(),
        isCrashed: selectedWindow.webContents.isCrashed(),
      });

      return new Promise((resolve) => {
        if (selectedWindow.isVisible()) {
          resolve(getState());
        } else {
          selectedWindow.once('ready-to-show', () =>
            setTimeout(() => resolve(getState()), 1000)
          );
        }
      });
    },
    windowToCheck
  );
  return windowState;
};

test.beforeAll(async () => {
  electronApp = await startApp();
});

test.afterAll(async () => {
  await electronApp.close();
});

test('Verify worker window', async () => {
  const windowState = await loadWindow(mainThreadWindows.worker, electronApp); // get worker window state
  console.log(windowState);
  expect(windowState.isVisible).toBeFalsy(); // worker window should not be visible
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Worker...');
});

test('Verify loading window', async () => {
  const windowState = await loadWindow(mainThreadWindows.loading, electronApp); // get loading window state
  console.log(windowState);
  expect(windowState.isVisible).toBeTruthy();
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Loading...');
});

test('Verify main window', async () => {
  const windowState = await loadWindow(mainThreadWindows.main, electronApp); // get main window state
  console.log(windowState);
  expect(windowState.isVisible).toBeTruthy();
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Playwright...');
});
