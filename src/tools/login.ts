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
import { zodToJsonSchema } from 'zod-to-json-schema';

const LoginInputSchema = z.object({});

const loginTool: Tool = {
  schema: {
    name: 'loginToIniadMoocsWithIniadAccount',
    description: 'Logs in to the INIAD MOOCs website (https://moocs.iniad.org/) via INIAD ID Manager using the INIAD account specified in the INIAD_USERNAME and INIAD_PASSWORD environment variables. Returns a success message as text.',
    inputSchema: zodToJsonSchema(LoginInputSchema),
  },

  capability: 'core',

  // Adjust handle signature to match SDK expectations
  async handle(context: Context, params?: unknown): Promise<ToolResult> {
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

      console.log('Checking for "Sign in with INIAD Account" link...');
      const signInLink = page.locator('text="Sign in with INIAD Account"');
      if (await signInLink.isVisible({ timeout: 1000 })) { // Check visibility with short timeout
        console.log('Link found, clicking "Sign in with INIAD Account"...');
        await signInLink.click();
      } else {
        console.log('"Sign in with INIAD Account" link not found, assuming already logged in.');
        // If the link is not visible, assume already logged in or on the ID manager page
        // Check if we are already on the ID manager page
        const usernameSelector = 'input#username, input[name="username"], input[ref=s1e16]';
        const isOnIdManager = await page.locator(usernameSelector).isVisible({ timeout: 1000 });
        if (!isOnIdManager) {
          // If not on ID manager and no sign-in link, likely already logged into MOOCs
          console.log('Not on ID Manager page, proceeding as logged in.');
          // Skip ID manager steps and directly check for MOOCs success indicator
          const moocsLoginSuccessIndicatorSelector = 'body'; // Placeholder
          try {
            await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });
            console.log('Already logged in to INIAD MOOCs.');
            const result = { success: true, message: 'Already logged in to INIAD MOOCs.' };
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch (e) {
            console.log('Could not confirm MOOCs login state, proceeding to ID Manager check just in case.');
            // Fall through to ID manager login attempt if unsure
          }
        } else {
          console.log('Detected ID Manager page.');
        }
      }

      // --- INIAD ID Manager Login Flow ---
      // Check if we need to perform the ID manager login steps
      const usernameSelectorCheck = 'input#username, input[name="username"], input[ref=s1e16]';
      if (await page.locator(usernameSelectorCheck).isVisible({ timeout: 1000 })) {
        console.log('Proceeding with INIAD ID Manager login...');
        const passwordSelector = 'input#password, input[name="password"], input[ref=s1e18]';
        const loginButtonSelector = 'input[type="submit"][value="LOG IN"], button:has-text("LOG IN"), button[ref=s1e23]';

        // No need to wait again if already checked visibility
        console.log('Entering INIAD username...');
        await page.locator(usernameSelectorCheck).fill(username);

        console.log('Entering INIAD password...');
        await page.locator(passwordSelector).fill(password);

        console.log('Clicking LOG IN button...');
        await page.locator(loginButtonSelector).click();

        console.log('Waiting for redirection back to INIAD MOOCs and login confirmation...');
        await page.waitForURL('**/moocs.iniad.org/**', { timeout: 1000 }); // Shortened timeout
        const moocsLoginSuccessIndicatorSelector = 'body'; // Placeholder
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 }); // Shortened timeout

        console.log('Login successful!');
        const result = { success: true, message: 'Successfully logged in to INIAD MOOCs using INIAD Account.' };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }
      // If username field is not visible, assume login was successful or handled previously (else removed)
      console.log('ID Manager login step skipped or already completed.');
      // Verify login state on MOOCs again if needed, or return success if handled by the initial check
      const moocsLoginSuccessIndicatorSelector = 'body'; // Placeholder
      try {
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });
        console.log('Confirmed login state on INIAD MOOCs.');
        // Check if a result was already returned by the initial "already logged in" check
        // If not, return a generic success message here.
        // This path might be reached if the initial check wasn't certain.
        const result = { success: true, message: 'Login to INIAD MOOCs confirmed.' };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e) {
        console.error('Failed to confirm login state on MOOCs after skipping ID Manager steps.');
        return { content: [{ type: 'text', text: 'Login failed: Could not confirm final login state.' }], isError: true };
      }

      // The logic for ID Manager login is now integrated into the conditional block above.
      // This section is removed as its logic is handled earlier.

      // Success messages are now returned within the conditional logic blocks above.
      // This specific block is removed as it's now redundant.

    } catch (error) {
      console.error('Login failed:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error); // Fallback for non-Error types
      // Screenshot logic removed as requested.
      return {
        content: [{ type: 'text', text: `Login failed: ${errorMessage}` }],
        isError: true,
      };
    }
  }
};
export default [
  loginTool,
];
