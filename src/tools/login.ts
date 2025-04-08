/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Context } from '../context';
import type { Tool, ToolResult } from './tool'; // Import ToolResult
import { z } from 'zod';

const LoginInputSchema = z.object({});

const loginTool: Tool = {
  schema: {
    name: 'loginToIniadMoocsWithIniadAccount',
    description: 'Logs in to the INIAD MOOCs website (https://moocs.iniad.org/) via INIAD ID Manager using the INIAD account specified in the INIAD_USERNAME and INIAD_PASSWORD environment variables. Returns a success message as text.',
    inputSchema: LoginInputSchema,
  },

  capability: 'core',

  // Adjust handle signature to match SDK expectations
  async handle(context: Context, params?: Record<string, any>): Promise<ToolResult> {
    // Ensure environment variables are set
    // Use INIAD credentials from environment variables
    const username = process.env.INIAD_USERNAME;
    const password = process.env.INIAD_PASSWORD;

    if (!username || !password) {
      return {
        content: [{ type: 'text', text: 'Error: INIAD_USERNAME and INIAD_PASSWORD environment variables must be set.' }],
        isError: true,
      };
    }

    try {
      // Use context.ensureTab() to get the current tab/page
      const tab = await context.ensureTab();
      const page = tab.page;

      console.log('Navigating to INIAD MOOCs login page...');
      await page.goto('https://moocs.iniad.org/');

      console.log('Clicking "Sign in with INIAD Account"...');
      // Wait for the link to be visible before clicking
      const signInLink = page.locator('text="Sign in with INIAD Account"');
      await signInLink.waitFor({ state: 'visible', timeout: 10000 });
      await signInLink.click();

      // --- INIAD ID Manager Login Flow ---
      console.log('Waiting for INIAD ID Manager page...');
      // Wait for the username field to appear on the ID Manager page
      // Combine common selectors with the previously observed ref selector for robustness
      const usernameSelector = 'input#username, input[name="username"], input[ref=s1e16]';
      const passwordSelector = 'input#password, input[name="password"], input[ref=s1e18]';
      const loginButtonSelector = 'input[type="submit"][value="LOG IN"], button:has-text("LOG IN"), button[ref=s1e23]';
      // Selector indicating successful login back on MOOCs (e.g., user profile element)
      // FIXME: Replace with a reliable selector on moocs.iniad.org after successful login
      const moocsLoginSuccessIndicatorSelector = 'body'; // Placeholder - needs a specific selector

      await page.waitForSelector(usernameSelector, { state: 'visible', timeout: 15000 });
      console.log('Entering INIAD username...');
      await page.locator(usernameSelector).fill(username); // Use 'username' variable

      console.log('Entering INIAD password...');
      await page.locator(passwordSelector).fill(password); // Use 'password' variable

      console.log('Clicking LOG IN button...');
      await page.locator(loginButtonSelector).click();

      console.log('Waiting for redirection back to INIAD MOOCs and login confirmation...');
      // Wait for navigation back to moocs.iniad.org OR a specific element indicating success
      await page.waitForURL('**/moocs.iniad.org/**', { timeout: 20000 });
      // Additionally, wait for a specific element that appears only after successful login on MOOCs
      await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 10000 });

      console.log('Login successful!');
      // Return success message as text content
      const result = { success: true, message: 'Successfully logged in to INIAD MOOCs using INIAD Account.' };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };

    } catch (error: any) {
      console.error('Login failed:', error);
      try {
        // Get page for screenshot
        const tab = context.currentTab(); // Get current tab, might not exist if initial nav failed
        if (tab) {
          const page = tab.page;
          const screenshotPath = `login_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Login failed: ${error.message}` }],
        isError: true,
      };
    }
  }
};

export default [
  loginTool,
];
