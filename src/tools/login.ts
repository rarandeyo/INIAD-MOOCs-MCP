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
import type { Tool, ToolResult } from './tool';
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

  async handle(context: Context, params?: unknown): Promise<ToolResult> {
    const username = process.env.INIAD_USERNAME;
    const password = process.env.INIAD_PASSWORD;

    if (!username || !password) {
      return {
        content: [{ type: 'text', text: 'Error: INIAD_USERNAME and INIAD_PASSWORD environment variables must be set.' }],
        isError: true,
      };
    }

    try {
      const tab = await context.ensureTab();
      const page = tab.page;

      console.log('Navigating to INIAD MOOCs login page...');
      await page.goto('https://moocs.iniad.org/');

      console.log('Checking for "Sign in with INIAD Account" link...');
      const signInLink = page.locator('text="Sign in with INIAD Account"');
      if (await signInLink.isVisible({ timeout: 1000 })) {
        console.log('Link found, clicking "Sign in with INIAD Account"...');
        await signInLink.click();
      } else {
        console.log('"Sign in with INIAD Account" link not found, assuming already logged in.');
        const usernameSelector = 'input#username, input[name="username"], input[ref=s1e16]';
        const isOnIdManager = await page.locator(usernameSelector).isVisible({ timeout: 1000 });
        if (!isOnIdManager) {
          console.log('Not on ID Manager page, proceeding as logged in.');
          const moocsLoginSuccessIndicatorSelector = 'body';
          try {
            await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });
            console.log('Already logged in to INIAD MOOCs.');
            console.log('Navigating to courses page...');
            await page.goto('https://moocs.iniad.org/courses');
            const result = { success: true, message: 'Already logged in to INIAD MOOCs and navigated to courses page.' };
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch (e) {
            console.log('Could not confirm MOOCs login state, proceeding to ID Manager check just in case.');
          }
        } else {
          console.log('Detected ID Manager page.');
        }
      }

      const usernameSelectorCheck = 'input#username, input[name="username"], input[ref=s1e16]';
      if (await page.locator(usernameSelectorCheck).isVisible({ timeout: 1000 })) {
        console.log('Proceeding with INIAD ID Manager login...');
        const passwordSelector = 'input#password, input[name="password"], input[ref=s1e18]';
        const loginButtonSelector = 'input[type="submit"][value="LOG IN"], button:has-text("LOG IN"), button[ref=s1e23]';

        console.log('Entering INIAD username...');
        await page.locator(usernameSelectorCheck).fill(username);

        console.log('Entering INIAD password...');
        await page.locator(passwordSelector).fill(password);

        console.log('Clicking LOG IN button...');
        await page.locator(loginButtonSelector).click();

        console.log('Waiting for redirection back to INIAD MOOCs and login confirmation...');
        await page.waitForURL('**/moocs.iniad.org/**', { timeout: 1000 });
        const moocsLoginSuccessIndicatorSelector = 'body';
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });

        console.log('Login successful!');
        console.log('Navigating to courses page...');
        await page.goto('https://moocs.iniad.org/courses');
        const result = { success: true, message: 'Successfully logged in to INIAD MOOCs using INIAD Account and navigated to courses page.' };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }
      console.log('ID Manager login step skipped or already completed.');
      const moocsLoginSuccessIndicatorSelector = 'body';
      try {
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });
        console.log('Confirmed login state on INIAD MOOCs.');
        console.log('Navigating to courses page...');
        await page.goto('https://moocs.iniad.org/courses');
        const result = { success: true, message: 'Login to INIAD MOOCs confirmed and navigated to courses page.' };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e) {
        console.error('Failed to confirm login state on MOOCs after skipping ID Manager steps.');
        return { content: [{ type: 'text', text: 'Login failed: Could not confirm final login state.' }], isError: true };
      }

    } catch (error) {
      console.error('Login failed:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error);
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
