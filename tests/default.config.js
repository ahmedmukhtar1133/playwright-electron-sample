const path = require('path');

const config = {
  testDir: './',
  // globalTimeout: 600000, // Maximum time the whole test suite can run,
  // timeout: 100000, // Timeout for each test
  maxFailures: 2,
  workers: 5,
  expect: {
    toMatchSnapshot: { threshold: 0.2 },
  },
  use: {
    screenshot: 'only-on-failure',
  },
};

module.exports = config;
