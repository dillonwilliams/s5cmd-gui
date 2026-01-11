import { test, expect } from '@playwright/test';

/**
 * These tests require Minio to be running locally.
 * Start Minio with: docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
 * Default credentials: minioadmin/minioadmin
 *
 * Or run via the GitHub Actions workflow which sets up Minio automatically.
 */

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || 'minioadmin';
const MINIO_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin';

test.describe('Minio Integration Tests', () => {
  test.skip(({ }, testInfo) => {
    // Skip if not running in CI or MINIO_ENDPOINT is not set
    return !process.env.CI && !process.env.MINIO_ENDPOINT;
  }, 'Skipping Minio tests - Minio not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should be able to create a profile with Minio endpoint', async ({ page }) => {
    // Open profile dialog
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    // Fill in profile details
    await page.locator('#profile-name').fill('Minio Test');
    await page.locator('#access-key-id').fill(MINIO_ACCESS_KEY);
    await page.locator('#secret-access-key').fill(MINIO_SECRET_KEY);
    await page.locator('#region').selectOption('us-east-1');
    await page.locator('#endpoint-url').fill(MINIO_ENDPOINT);

    // Save profile
    await page.locator('button.primary:has-text("Save")').click();

    // Wait for dialog to close
    await expect(page.locator('.profile-dialog')).not.toBeVisible({ timeout: 5000 });

    // Profile should now be in the dropdown
    await page.locator('.profile-button').click();
    await expect(page.locator('.profile-dropdown')).toContainText('Minio Test');
  });

  test('should be able to connect and list buckets', async ({ page }) => {
    // Create and select a profile
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    await page.locator('#profile-name').fill('Minio List Test');
    await page.locator('#access-key-id').fill(MINIO_ACCESS_KEY);
    await page.locator('#secret-access-key').fill(MINIO_SECRET_KEY);
    await page.locator('#region').selectOption('us-east-1');
    await page.locator('#endpoint-url').fill(MINIO_ENDPOINT);

    await page.locator('button.primary:has-text("Save")').click();
    await expect(page.locator('.profile-dialog')).not.toBeVisible({ timeout: 5000 });

    // Select the profile
    await page.locator('.profile-button').click();
    await page.locator('.profile-item:has-text("Minio List Test")').click();

    // Wait for buckets to load
    await page.waitForTimeout(2000);

    // Bucket selector should be enabled
    const bucketSelect = page.locator('#bucket-select');
    await expect(bucketSelect).not.toBeDisabled();

    // Should have at least one option (test-bucket created in CI)
    const options = await bucketSelect.locator('option').count();
    expect(options).toBeGreaterThan(1); // Including the placeholder option
  });

  test('should be able to test connection', async ({ page }) => {
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    await page.locator('#profile-name').fill('Minio Connection Test');
    await page.locator('#access-key-id').fill(MINIO_ACCESS_KEY);
    await page.locator('#secret-access-key').fill(MINIO_SECRET_KEY);
    await page.locator('#region').selectOption('us-east-1');
    await page.locator('#endpoint-url').fill(MINIO_ENDPOINT);

    // Click Test Connection
    await page.locator('button:has-text("Test Connection")').click();

    // Wait for toast notification
    await page.waitForTimeout(5000);

    // Should see success message in toast
    const toast = page.locator('[role="status"]');
    await expect(toast).toContainText(/Connection successful|bucket/i, { timeout: 10000 });
  });

  test('should be able to navigate into a bucket', async ({ page }) => {
    // First, set up the profile
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    await page.locator('#profile-name').fill('Minio Nav Test');
    await page.locator('#access-key-id').fill(MINIO_ACCESS_KEY);
    await page.locator('#secret-access-key').fill(MINIO_SECRET_KEY);
    await page.locator('#region').selectOption('us-east-1');
    await page.locator('#endpoint-url').fill(MINIO_ENDPOINT);

    await page.locator('button.primary:has-text("Save")').click();
    await expect(page.locator('.profile-dialog')).not.toBeVisible({ timeout: 5000 });

    // Select the profile
    await page.locator('.profile-button').click();
    await page.locator('.profile-item:has-text("Minio Nav Test")').click();

    // Wait for buckets to load
    await page.waitForTimeout(2000);

    // Select the test bucket
    await page.locator('#bucket-select').selectOption('test-bucket');

    // Wait for the file browser to appear
    await page.waitForTimeout(1000);

    // Address bar should show the bucket path
    await expect(page.locator('.address-text')).toContainText('s3://test-bucket/');

    // Status bar should show connection info
    await expect(page.locator('.connection-status')).toContainText('Minio Nav Test');
  });
});

test.describe('File Operations with Minio', () => {
  test.skip(({ }, testInfo) => {
    return !process.env.CI && !process.env.MINIO_ENDPOINT;
  }, 'Skipping Minio tests - Minio not configured');

  test('should show empty bucket message or files', async ({ page }) => {
    await page.goto('/');

    // Set up profile and navigate to bucket
    await page.locator('.profile-button').click();
    await page.locator('.add-profile').click();

    await page.locator('#profile-name').fill('Minio Files Test');
    await page.locator('#access-key-id').fill(MINIO_ACCESS_KEY);
    await page.locator('#secret-access-key').fill(MINIO_SECRET_KEY);
    await page.locator('#region').selectOption('us-east-1');
    await page.locator('#endpoint-url').fill(MINIO_ENDPOINT);

    await page.locator('button.primary:has-text("Save")').click();
    await expect(page.locator('.profile-dialog')).not.toBeVisible({ timeout: 5000 });

    await page.locator('.profile-button').click();
    await page.locator('.profile-item:has-text("Minio Files Test")').click();

    await page.waitForTimeout(2000);
    await page.locator('#bucket-select').selectOption('test-bucket');
    await page.waitForTimeout(1000);

    // The file browser should be visible
    await expect(page.locator('.chonky-chonkyRoot')).toBeVisible();

    // Status bar should show item count
    await expect(page.locator('.status-bar')).toContainText('items');
  });

  test('should be able to use search filter', async ({ page }) => {
    await page.goto('/');

    // Quick setup - we'll just test the search input works
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible();

    // Type in search
    await searchInput.fill('test*');
    await expect(searchInput).toHaveValue('test*');

    // Clear search
    await page.locator('.search-clear').click();
    await expect(searchInput).toHaveValue('');
  });

  test('keyboard shortcut Ctrl+F should focus search', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('.search-input');

    // Press Ctrl+F
    await page.keyboard.press('Control+f');

    // Search input should be focused
    await expect(searchInput).toBeFocused();
  });
});
