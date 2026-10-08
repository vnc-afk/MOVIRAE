import { expect, test } from "@playwright/test";

test.describe("public navigation", () => {
  test("renders the home page and navigates to Discover", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Track films you've watched." })).toBeVisible();
    await page.getByRole("link", { name: "See all" }).click();

    await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByRole("heading", { name: "Smart Discover" })).toBeVisible();
  });

  test("exposes the login form without requiring credentials", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fdiscover");

    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
    await expect(page.getByPlaceholder("Email address")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toHaveAttribute("type", "password");
  });
});

test.describe("authentication protection", () => {
  test("returns an empty watchlist for an unauthenticated request", async ({ request }) => {
    const response = await request.get("/api/watchlist");

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ value: [] });
  });
});
