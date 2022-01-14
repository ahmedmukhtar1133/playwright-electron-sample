/* eslint-disable no-console */
const { test, expect } = require('@playwright/test');
const {
  startApp,
  loadWindow,
  pageTitles,
  closeMainWindow,
} = require('./Utils.test');

let electronApp;
// let page;

test.beforeAll(async () => {
  ({ electronApp } = await startApp());
});

test.afterAll(async () => {
  // await electronApp.close();
  await closeMainWindow(electronApp);
});

test('Verify worker window Duplicate', async () => {
  const windowState = await loadWindow(pageTitles.worker, electronApp); // get worker window state
  console.log(windowState);
  expect(windowState.isVisible).toBeFalsy(); // worker window should not be visible
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Worker...');
});

test('Verify loading window Duplicate', async () => {
  const windowState = await loadWindow(pageTitles.loading, electronApp); // get loading window state
  console.log(windowState);
  // expect(windowState.isVisible).toBeTruthy();
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Loading...');
});

test('Verify main window Duplicate', async () => {
  const windowState = await loadWindow(pageTitles.main, electronApp); // get main window state
  console.log(windowState);
  expect(windowState.isVisible).toBeTruthy();
  expect(windowState.isDevToolsOpened).toBeFalsy();
  expect(windowState.isCrashed).toBeFalsy();
  expect(windowState.title).toBe('Playwright...');
});
