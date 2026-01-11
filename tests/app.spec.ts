import { test, expect } from '@playwright/test';

test.describe('S5cmd GUI Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display welcome screen on initial load', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('S5cmd GUI');
    await expect(page.locator('.welcome-message')).toBeVisible();
  });

  test('should have profile selector in header', async ({ page }) => {
    const profileButton = page.locator('.profile-button');
    await expect(profileButton).toBeVisible();
    await expect(profileButton).toContainText('Select Profile');
  });

  test('should open profile dropdown when clicked', async ({ page }) => {
    const profileButton = page.locator('.profile-button');
    await profileButton.click();

    const dropdown = page.locator('.profile-dropdown');
    await expect(dropdown).toBeVisible();

    // Should have "Add Profile" option
    await expect(page.locator('.add-profile')).toContainText('Add Profile');
  });

  test('should open profile dialog when Add Profile is clicked', async ({ page }) => {
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    const dialog = page.locator('.profile-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toContainText('Add Profile');
  });

  test('should show form fields for Access Key authentication', async ({ page }) => {
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    // Check for Access Key fields
    await expect(page.locator('#access-key-id')).toBeVisible();
    await expect(page.locator('#secret-access-key')).toBeVisible();
    await expect(page.locator('#session-token')).toBeVisible();
  });

  test('should switch to SSO fields when SSO is selected', async ({ page }) => {
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    // Select SSO auth type
    await page.locator('#auth-type').selectOption('sso');

    // Check for SSO fields
    await expect(page.locator('#sso-start-url')).toBeVisible();
    await expect(page.locator('#sso-region')).toBeVisible();
    await expect(page.locator('#sso-account-id')).toBeVisible();
    await expect(page.locator('#sso-role-name')).toBeVisible();

    // Access key fields should not be visible
    await expect(page.locator('#access-key-id')).not.toBeVisible();
  });

  test('should have settings button in header', async ({ page }) => {
    const settingsButton = page.locator('.icon-button[title="Settings (Ctrl+,)"]');
    await expect(settingsButton).toBeVisible();
  });

  test('should open settings dialog when settings button is clicked', async ({ page }) => {
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();

    const dialog = page.locator('.settings-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toContainText('Settings');
  });

  test('should have General and Advanced tabs in settings', async ({ page }) => {
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();

    const generalTab = page.locator('.settings-tabs button:has-text("General")');
    const advancedTab = page.locator('.settings-tabs button:has-text("Advanced")');

    await expect(generalTab).toBeVisible();
    await expect(advancedTab).toBeVisible();
  });

  test('should switch between settings tabs', async ({ page }) => {
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();

    // Click Advanced tab
    await page.locator('.settings-tabs button:has-text("Advanced")').click();

    // Should show s5cmd path field
    await expect(page.locator('label:has-text("s5cmd Binary Path")')).toBeVisible();
  });

  test('should have logs button in header', async ({ page }) => {
    const logsButton = page.locator('.icon-button[title="View Logs"]');
    await expect(logsButton).toBeVisible();
  });

  test('should open logs dialog when logs button is clicked', async ({ page }) => {
    await page.locator('.icon-button[title="View Logs"]').click();

    const dialog = page.locator('.logs-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toContainText('Application Logs');
  });

  test('should have navigation buttons', async ({ page }) => {
    await expect(page.locator('.nav-button[title="Back (Alt+Left)"]')).toBeVisible();
    await expect(page.locator('.nav-button[title="Forward (Alt+Right)"]')).toBeVisible();
    await expect(page.locator('.nav-button[title="Up (Backspace)"]')).toBeVisible();
  });

  test('navigation buttons should be disabled when no bucket selected', async ({ page }) => {
    await expect(page.locator('.nav-button[title="Back (Alt+Left)"]')).toBeDisabled();
    await expect(page.locator('.nav-button[title="Forward (Alt+Right)"]')).toBeDisabled();
    await expect(page.locator('.nav-button[title="Up (Backspace)"]')).toBeDisabled();
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /Search files/);
  });

  test('should have address bar showing no location', async ({ page }) => {
    const addressBar = page.locator('.address-text');
    await expect(addressBar).toContainText('No location selected');
  });

  test('should have bucket selector disabled without profile', async ({ page }) => {
    const bucketSelect = page.locator('#bucket-select');
    await expect(bucketSelect).toBeDisabled();
  });

  test('should show welcome features list', async ({ page }) => {
    const features = page.locator('.welcome-features li');
    await expect(features).toHaveCount(6);
    await expect(page.locator('.welcome-features')).toContainText('Blazing fast transfers');
    await expect(page.locator('.welcome-features')).toContainText('AWS SSO support');
  });

  test('keyboard shortcut Ctrl+P should toggle profile dropdown', async ({ page }) => {
    // Profile dropdown should not be visible initially
    await expect(page.locator('.profile-dropdown')).not.toBeVisible();

    // Press Ctrl+P
    await page.keyboard.press('Control+p');

    // Dropdown should appear
    await expect(page.locator('.profile-dropdown')).toBeVisible();

    // Press Ctrl+P again
    await page.keyboard.press('Control+p');

    // Dropdown should be hidden
    await expect(page.locator('.profile-dropdown')).not.toBeVisible();
  });

  test('keyboard shortcut Ctrl+, should open settings', async ({ page }) => {
    await page.keyboard.press('Control+,');
    await expect(page.locator('.settings-dialog')).toBeVisible();
  });
});

test.describe('Profile Management', () => {
  test('should validate required fields when saving profile', async ({ page }) => {
    await page.goto('/');
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    // Try to save without filling required fields
    await page.locator('button.primary:has-text("Save")').click();

    // Should show error (via toast)
    // Note: In actual implementation, you might need to check for toast notification
  });

  test('should close dialog when Cancel is clicked', async ({ page }) => {
    await page.goto('/');
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    await expect(page.locator('.profile-dialog')).toBeVisible();

    await page.locator('button:has-text("Cancel")').click();

    await expect(page.locator('.profile-dialog')).not.toBeVisible();
  });
});

test.describe('Settings Dialog', () => {
  test('should have all general settings fields', async ({ page }) => {
    await page.goto('/');
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();

    await expect(page.locator('label:has-text("Default Download Location")')).toBeVisible();
    await expect(page.locator('label:has-text("Concurrent Operations")')).toBeVisible();
    await expect(page.locator('label:has-text("Show hidden files")')).toBeVisible();
    await expect(page.locator('label:has-text("Confirm before delete")')).toBeVisible();
    await expect(page.locator('label:has-text("Single click to open")')).toBeVisible();
  });

  test('should have all advanced settings fields', async ({ page }) => {
    await page.goto('/');
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();
    await page.locator('.settings-tabs button:has-text("Advanced")').click();

    await expect(page.locator('label:has-text("s5cmd Binary Path")')).toBeVisible();
    await expect(page.locator('label:has-text("Max Retries")')).toBeVisible();
    await expect(page.locator('label:has-text("Timeout")')).toBeVisible();
    await expect(page.locator('label:has-text("Log Level")')).toBeVisible();
  });

  test('should close settings when close button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.locator('.icon-button[title="Settings (Ctrl+,)"]').click();

    await expect(page.locator('.settings-dialog')).toBeVisible();

    await page.locator('.settings-dialog .close-button').click();

    await expect(page.locator('.settings-dialog')).not.toBeVisible();
  });
});

test.describe('Logs Dialog', () => {
  test('should have action buttons', async ({ page }) => {
    await page.goto('/');
    await page.locator('.icon-button[title="View Logs"]').click();

    await expect(page.locator('button:has-text("Clear Logs")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Logs")')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
    await expect(page.locator('button:has-text("Close")')).toBeVisible();
  });

  test('should close logs dialog when Close is clicked', async ({ page }) => {
    await page.goto('/');
    await page.locator('.icon-button[title="View Logs"]').click();

    await expect(page.locator('.logs-dialog')).toBeVisible();

    await page.locator('.logs-dialog button:has-text("Close")').click();

    await expect(page.locator('.logs-dialog')).not.toBeVisible();
  });
});
