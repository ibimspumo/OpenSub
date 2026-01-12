import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for OpenSub Electron app visual testing.
 *
 * This configuration is designed to test the redesigned UI components
 * with premium Apple-style polish, including:
 * - Micro-animations and transitions
 * - Glassmorphism effects
 * - Portrait video layout optimization
 * - Premium hover states and visual feedback
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // Increase timeout for Electron app startup
  timeout: 60000,

  // Expect configuration for visual comparisons
  expect: {
    // Threshold for visual comparison
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.05,
    },
  },

  // Run tests sequentially for Electron
  fullyParallel: false,
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Preserve output on failure for debugging
  preserveOutput: 'failures-only',

  // Screenshot configuration
  use: {
    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Capture trace on first retry
    trace: 'on-first-retry',

    // Video recording on failure
    video: 'on-first-retry',
  },

  // Project configuration for Electron
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],
})
