import { expect, test } from "@playwright/test";

test("login page renders the secure sign in shell", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /secure sign in/i })).toBeVisible();
  await expect(page.getByText(/SHAKED Finance OS/i)).toBeVisible();
});
