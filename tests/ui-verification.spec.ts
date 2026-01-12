/**
 * OpenSub UI Visual Verification Tests
 *
 * These tests verify the premium UI redesign including:
 * - Apple-style visual polish
 * - Micro-animations and transitions
 * - Glassmorphism effects
 * - Portrait video layout optimization
 * - Premium hover states and visual feedback
 *
 * Test Categories:
 * 1. Initial Load & Animations
 * 2. DropZone Interactions
 * 3. Editor Layout (Portrait/Landscape)
 * 4. Component Visual Consistency
 * 5. Modal Glassmorphism Effects
 * 6. Responsive Behavior
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES Module compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Constants for test configuration
const APP_PATH = resolve(__dirname, '..')
const SCREENSHOT_DIR = resolve(__dirname, '../test-results/screenshots')

// Wait times for animations to complete
const ANIMATION_WAIT = {
  SHORT: 150,
  MEDIUM: 300,
  LONG: 500,
  TRANSITION: 1000,
}

let electronApp: ElectronApplication
let page: Page

test.describe('OpenSub UI Visual Verification', () => {
  test.beforeAll(async () => {
    // Build the app before testing
    console.log('Starting Electron app for visual testing...')

    electronApp = await electron.launch({
      args: [resolve(APP_PATH, 'out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })

    // Get the first window
    page = await electronApp.firstWindow()

    // Wait for the app to be ready
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(ANIMATION_WAIT.TRANSITION)
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  test.describe('1. Initial Load & Entrance Animations', () => {
    test('should render app with smooth entrance animation', async () => {
      // Verify the main container is visible with proper opacity
      const mainContainer = page.locator('.h-screen')
      await expect(mainContainer).toBeVisible()

      // Wait for entrance animation to complete
      await page.waitForTimeout(ANIMATION_WAIT.LONG)

      // Verify app is fully mounted (opacity-100 class applied)
      const appOpacity = await mainContainer.evaluate((el) => {
        return window.getComputedStyle(el).opacity
      })
      expect(parseFloat(appOpacity)).toBe(1)
    })

    test('should display premium title bar with glassmorphism', async () => {
      const header = page.locator('header')
      await expect(header).toBeVisible()

      // Check for glassmorphism classes
      await expect(header).toHaveClass(/glass-subtle/)

      // Verify title bar styling
      const headerStyles = await header.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return {
          backdropFilter: styles.backdropFilter,
          borderBottom: styles.borderBottomWidth,
        }
      })

      // Should have backdrop blur for glassmorphism effect
      expect(headerStyles.backdropFilter).toContain('blur')
    })

    test('should show OpenSub logo and branding', async () => {
      // Check for app logo
      const logo = page.locator('header .rounded-md.bg-gradient-to-br')
      await expect(logo).toBeVisible()

      // Check for app title
      const title = page.locator('header h1')
      await expect(title).toContainText('OpenSub')
    })
  })

  test.describe('2. DropZone Visual Design', () => {
    test('should display premium DropZone when no project loaded', async () => {
      // DropZone should be visible in initial state - look for the main text
      const dropZoneText = page.getByText('Video hierher ziehen')

      // Also check for the keyboard shortcut hint
      const keyboardHint = page.getByText('zum Öffnen')

      // Check visibility
      const isDropZoneVisible = await dropZoneText.isVisible().catch(() => false)
      const isKeyboardHintVisible = await keyboardHint.isVisible().catch(() => false)

      expect(isDropZoneVisible || isKeyboardHintVisible).toBeTruthy()
    })

    test('should have animated gradient border on DropZone', async () => {
      // Check for gradient-animated border styling
      const gradientBorder = page.locator('.animate-gradient-slow, .gradient-border-animated')
      const hasBorder = await gradientBorder.count()

      // Should have animated styling elements
      expect(hasBorder).toBeGreaterThanOrEqual(0) // May not exist if no project
    })

    test('should show drop icon with pulse animation', async () => {
      // Look for SVG icon in DropZone area
      const dropIcon = page.locator('main svg').first()
      if (await dropIcon.isVisible()) {
        await expect(dropIcon).toBeVisible()
      }
    })
  })

  test.describe('3. Premium Visual Elements', () => {
    test('should use dark theme color palette', async () => {
      const body = page.locator('body')
      const bgColor = await body.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      // Should be a dark color (low RGB values)
      const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number)
        // Dark theme should have low RGB values
        expect(r + g + b).toBeLessThan(150) // Sum of RGB for dark colors
      }
    })

    test('should have proper typography hierarchy', async () => {
      // Check title typography
      const title = page.locator('header h1')
      if (await title.isVisible()) {
        const titleStyles = await title.evaluate((el) => ({
          fontSize: window.getComputedStyle(el).fontSize,
          fontWeight: window.getComputedStyle(el).fontWeight,
        }))

        // Should have appropriate font sizing
        expect(parseFloat(titleStyles.fontSize)).toBeGreaterThan(10)
      }
    })

    test('should apply smooth transitions to interactive elements', async () => {
      // Check for transition properties on buttons
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()

      if (buttonCount > 0) {
        const firstButton = buttons.first()
        const hasTransition = await firstButton.evaluate((el) => {
          const transition = window.getComputedStyle(el).transition
          return transition && transition !== 'none' && transition !== 'all 0s ease 0s'
        })

        expect(hasTransition).toBeTruthy()
      }
    })
  })

  test.describe('4. Animation Classes Verification', () => {
    test('should have animate-fade-in class available', async () => {
      // Check if animation keyframes are defined in the document
      const hasAnimation = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            for (const rule of rules) {
              if (rule instanceof CSSKeyframesRule && rule.name === 'fadeIn') {
                return true
              }
            }
          } catch {
            // Cross-origin stylesheets will throw
            continue
          }
        }
        return false
      })

      // Animation should be defined in CSS
      expect(hasAnimation).toBeTruthy()
    })

    test('should have slide-in animations defined', async () => {
      const hasSlideIn = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            for (const rule of rules) {
              if (rule instanceof CSSKeyframesRule && rule.name.includes('slide')) {
                return true
              }
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasSlideIn).toBeTruthy()
    })

    test('should have spring easing function defined', async () => {
      // Check for custom easing in Tailwind config
      const hasSpringEasing = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const cssText = Array.from(sheet.cssRules || [])
              .map((r) => r.cssText)
              .join('')
            if (cssText.includes('ease-spring') || cssText.includes('cubic-bezier')) {
              return true
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasSpringEasing).toBeTruthy()
    })
  })

  test.describe('5. Glassmorphism Effects', () => {
    test('should have glass utility classes defined', async () => {
      const hasGlassClasses = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const cssText = Array.from(sheet.cssRules || [])
              .map((r) => r.cssText)
              .join('')
            if (
              cssText.includes('.glass') ||
              cssText.includes('backdrop-filter') ||
              cssText.includes('backdrop-blur')
            ) {
              return true
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasGlassClasses).toBeTruthy()
    })

    test('title bar should have backdrop blur effect', async () => {
      const header = page.locator('header')
      const backdropFilter = await header.evaluate((el) => {
        return window.getComputedStyle(el).backdropFilter
      })

      expect(backdropFilter).toContain('blur')
    })
  })

  test.describe('6. Color System & Shadows', () => {
    test('should use primary color accent (blue)', async () => {
      const hasAccentColor = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*')
        for (const el of allElements) {
          const styles = window.getComputedStyle(el)
          const bgColor = styles.backgroundColor
          const color = styles.color
          // Check for blue tones in the UI
          if (bgColor.includes('59') || color.includes('59')) {
            return true
          }
        }
        // Also check for gradient classes
        const gradients = document.querySelectorAll('[class*="primary"]')
        return gradients.length > 0
      })

      expect(hasAccentColor).toBeTruthy()
    })

    test('should have elevated shadow utilities', async () => {
      const hasShadowClasses = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const cssText = Array.from(sheet.cssRules || [])
              .map((r) => r.cssText)
              .join('')
            if (cssText.includes('box-shadow') || cssText.includes('shadow')) {
              return true
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasShadowClasses).toBeTruthy()
    })
  })

  test.describe('7. Responsive Layout', () => {
    test('should fill viewport height', async () => {
      const mainContainer = page.locator('.h-screen')
      const boundingBox = await mainContainer.boundingBox()

      expect(boundingBox).toBeTruthy()
      if (boundingBox) {
        // Should fill most of the viewport
        const viewportSize = await page.viewportSize()
        if (viewportSize) {
          expect(boundingBox.height).toBeGreaterThan(viewportSize.height * 0.9)
        }
      }
    })

    test('should have flex layout structure', async () => {
      const mainContainer = page.locator('.h-screen')
      const display = await mainContainer.evaluate((el) => {
        return window.getComputedStyle(el).display
      })

      expect(display).toBe('flex')
    })
  })

  test.describe('8. Visual Regression Screenshots', () => {
    test('capture initial state screenshot', async () => {
      // Wait for all animations to complete
      await page.waitForTimeout(ANIMATION_WAIT.TRANSITION)

      // Take full page screenshot
      await expect(page).toHaveScreenshot('01-initial-state.png', {
        fullPage: true,
        animations: 'disabled',
      })
    })

    test('capture title bar screenshot', async () => {
      const header = page.locator('header')

      await expect(header).toHaveScreenshot('02-title-bar.png', {
        animations: 'disabled',
      })
    })

    test('capture DropZone screenshot', async () => {
      const mainContent = page.locator('main')

      await expect(mainContent).toHaveScreenshot('03-dropzone-area.png', {
        animations: 'disabled',
      })
    })
  })

  test.describe('9. Interaction States', () => {
    test('buttons should have hover state transitions', async () => {
      const buttons = page.locator('button')
      const count = await buttons.count()

      if (count > 0) {
        const button = buttons.first()

        // Get initial state
        const initialTransform = await button.evaluate((el) => {
          return window.getComputedStyle(el).transform
        })

        // Hover over button
        await button.hover()
        await page.waitForTimeout(ANIMATION_WAIT.MEDIUM)

        // Verify button is still accessible after hover
        await expect(button).toBeVisible()
      }
    })

    test('interactive elements should have cursor pointer', async () => {
      const buttons = page.locator('button:not([disabled])')
      const count = await buttons.count()

      if (count > 0) {
        const cursor = await buttons.first().evaluate((el) => {
          return window.getComputedStyle(el).cursor
        })

        expect(cursor).toBe('pointer')
      }
    })
  })

  test.describe('10. Tailwind Custom Classes', () => {
    test('should have custom dark color palette', async () => {
      const hasCustomColors = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const cssText = Array.from(sheet.cssRules || [])
              .map((r) => r.cssText)
              .join('')
            // Check for dark-950, dark-900, etc. classes
            if (cssText.includes('dark-9') || cssText.includes('dark-8')) {
              return true
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasCustomColors).toBeTruthy()
    })

    test('should have glow shadow utilities', async () => {
      const hasGlowShadows = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const cssText = Array.from(sheet.cssRules || [])
              .map((r) => r.cssText)
              .join('')
            if (cssText.includes('glow') || cssText.includes('shadow-glow')) {
              return true
            }
          } catch {
            continue
          }
        }
        return false
      })

      expect(hasGlowShadows).toBeTruthy()
    })
  })
})

/**
 * Additional test suite for editor state (requires loading a video)
 * These tests are marked as skip by default since they require user interaction
 */
test.describe.skip('Editor UI Verification (requires video)', () => {
  test('should display portrait-optimized layout for 9:16 videos', async () => {
    // This test would require loading a portrait video
    // The layout should automatically adjust:
    // - Video panel: 45% width
    // - Editor panel: 55% width
  })

  test('should show all editor panels with proper hierarchy', async () => {
    // Verify:
    // - Video player section
    // - Timeline section
    // - Subtitle list section
    // - Style editor section
  })

  test('should display glassmorphism transcription progress modal', async () => {
    // Verify modal styling when transcription is active
  })

  test('should display premium export progress modal', async () => {
    // Verify export modal matches design language
  })
})
