/**
 * macOS Notarization Script for electron-builder
 *
 * This script runs after code signing (afterSign hook) to notarize
 * the app with Apple for Gatekeeper approval.
 *
 * Required environment variables:
 * - APPLE_ID: Your Apple Developer account email
 * - APPLE_APP_SPECIFIC_PASSWORD: App-specific password from appleid.apple.com
 * - APPLE_TEAM_ID: Your Apple Developer Team ID
 *
 * If these are not set, notarization is skipped (useful for local dev builds).
 */

const path = require('path')

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization - not macOS')
    return
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization - credentials not configured')
    console.log('  Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID to enable')
    return
  }

  // Get app path
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log(`Notarizing ${appPath}...`)
  console.log(`  Apple ID: ${appleId}`)
  console.log(`  Team ID: ${teamId}`)

  // Dynamic import for ESM package
  const { notarize } = await import('@electron/notarize')

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId
    })
    console.log('Notarization complete!')
  } catch (error) {
    console.error('Notarization failed:', error.message)
    throw error
  }
}
