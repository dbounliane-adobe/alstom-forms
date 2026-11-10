import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const root = new URL('../../../', import.meta.url);
const origin = 'http://alstom.test';
const fixture = new URL('fixtures/alstom.html', import.meta.url);
const nav = `
  <div><p><a href="/">ALSTOM</a></p></div>
  <div><ul><li>Nos solutions<ul><li><a href="#contact">Mat\u00e9riel roulant</a></li></ul></li><li><a href="#contact">Nos services</a></li></ul></div>
  <div><p><strong><a href="#contact">Contact</a></strong></p></div>`;
const footer = '<div><p>Mobilit\u00e9 durable</p><ul><li><a href="#contact">Contact</a></li></ul></div>';
const contentTypes = {
  css: 'text/css',
  js: 'text/javascript',
  html: 'text/html',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
};

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      await route.abort();
      return;
    }
    if (url.pathname === '/nav.plain.html' || url.pathname === '/footer.plain.html') {
      await route.fulfill({
        contentType: 'text/html',
        body: url.pathname === '/nav.plain.html' ? nav : footer,
      });
      return;
    }
    if (url.pathname === '/theme-submit') {
      await route.fulfill({ json: { success: true } });
      return;
    }
    try {
      const file = url.pathname === '/' ? fixture : new URL(`.${url.pathname}`, root);
      const body = await readFile(file);
      const extension = file.pathname.split('.').pop();
      await route.fulfill({ body, contentType: contentTypes[extension] || 'application/octet-stream' });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  await page.goto(origin);
  await expect(page.locator('.form form')).toBeVisible();
  await expect(page.locator('.form form')).not.toHaveClass(/loading/);
  await expect(page.locator('header .header')).toHaveAttribute('data-block-status', 'loaded');
  await expect(page.locator('footer .footer')).toHaveAttribute('data-block-status', 'loaded');
});

test('keeps hero, cards and authored form columns readable without horizontal overflow', async ({ page }) => {
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('.hero')).toHaveAttribute('data-aue-resource', 'urn:theme:hero');
  await expect(page.locator('.cards li').first()).toHaveAttribute('data-aue-resource', 'urn:theme:card-1');
  await expect(page.locator('.form')).toHaveAttribute('data-aue-resource', 'urn:theme:form');
  await expect(page.locator('.section.contact')).toBeVisible();
  await expect(page.locator('.section.dark h2')).toHaveCSS('color', 'rgb(255, 255, 255)');

  const name = await page.locator('#contact-name').boundingBox();
  const email = await page.locator('#contact-email').boundingBox();
  if (page.viewportSize().width < 600) {
    expect(email.y).toBeGreaterThan(name.y);
    expect(email.x).toBe(name.x);
  } else {
    expect(email.y).toBe(name.y);
    expect(email.x).toBeGreaterThan(name.x + name.width);
  }
  const screenshot = test.info().outputPath('theme-preview.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await test.info().attach('theme-preview', {
    path: screenshot,
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('.hero picture').evaluate((picture) => picture.remove());
  await expect(page.locator('.hero')).toHaveCSS('background-color', 'rgb(20, 40, 70)');
  await expect(page.locator('.hero h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('preserves keyboard navigation and a usable mobile menu', async ({ page }) => {
  if (page.viewportSize().width < 900) {
    const toggle = page.locator('.nav-hamburger button');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#nav')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.nav-sections')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#nav')).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  } else {
    const dropdown = page.locator('.nav-drop');
    await dropdown.focus();
    await page.keyboard.press('Enter');
    await expect(dropdown).toHaveAttribute('aria-expanded', 'true');
    await expect(dropdown.locator('ul')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveAttribute('aria-expanded', 'false');
    await expect(dropdown).toBeFocused();
  }
  await page.locator('#contact-name').focus();
  await expect(page.locator('#contact-name')).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await expect(page.locator('#contact-email')).toBeFocused();
  await expect(page.locator('#contact-reference')).toBeDisabled();
});

test('keeps white cards and form fields readable inside dark sections', async ({ page }) => {
  await page.locator('.cards').evaluate((cards) => {
    cards.closest('.section').classList.add('dark');
    cards.querySelector('a').classList.add('secondary');
  });
  await page.locator('.form').evaluate((form) => {
    const section = form.closest('.section');
    section.classList.remove('contact');
    section.classList.add('dark');
  });
  await expect(page.locator('.cards h3').first()).toHaveCSS('color', 'rgb(20, 40, 70)');
  const link = page.locator('.cards a').first();
  await link.focus();
  await expect(link).toHaveCSS('color', 'rgb(20, 40, 70)');
  await expect(link).toHaveCSS('outline-color', 'rgb(43, 76, 238)');
  await expect(page.locator('label[for="contact-name"]')).toHaveCSS('color', 'rgb(30, 50, 70)');
  await expect(page.locator('#contact-name')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('retains worker validation, stable submit sizing and mocked submission', async ({ page }) => {
  const submit = page.locator('#contact-submit');
  const initialSize = await submit.boundingBox();
  await submit.hover();
  const hoverSize = await submit.boundingBox();
  expect(hoverSize.width).toBe(initialSize.width);
  expect(hoverSize.height).toBe(initialSize.height);
  await submit.click();
  await expect(page.locator('#contact-name').locator('..')).toHaveClass(/field-invalid/);
  await expect(page.locator('#contact-name')).toHaveCSS('border-top-color', 'rgb(199, 38, 24)');
  await page.locator('#contact-name').fill('Test');
  await page.locator('#contact-email').fill('test@example.com');
  await page.locator('#contact-message').fill('Test de formulaire');
  await page.locator('#contact-message').blur();
  const request = page.waitForRequest((req) => req.url() === `${origin}/theme-submit` && req.method() === 'POST');
  await submit.click();
  await request;
  await expect(page.locator('.form-message.success-message')).toContainText('Merci');
});
