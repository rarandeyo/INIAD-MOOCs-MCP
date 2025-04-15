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
import listCoursesTools from './listCourses';
const listCoursesTool = listCoursesTools[0];

const LoginInputSchema = z.object({});

const loginTool: Tool = {
  schema: {
    name: 'loginToIniadMoocsWithIniadAccount',
    description: 'Logs in to the INIAD MOOCs website (https://moocs.iniad.org/) via INIAD ID Manager using the INIAD account specified in the INIAD_USERNAME and INIAD_PASSWORD environment variables, navigates to the courses page, and returns the list of courses.',
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

      await page.goto('https://moocs.iniad.org/');

      const signInLink = page.locator('text="Sign in with INIAD Account"');
      if (await signInLink.isVisible({ timeout: 1000 })) {
        await signInLink.click();
      } else {
        const usernameSelector = 'input#username, input[name="username"], input[ref=s1e16]';
        const isOnIdManager = await page.locator(usernameSelector).isVisible({ timeout: 1000 });
        if (!isOnIdManager) {
          const moocsLoginSuccessIndicatorSelector = 'body';
          try {
            await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 1000 });
            await page.goto('https://moocs.iniad.org/courses');
            return listCoursesTool.handle(context);
          } catch (e) {}
        }
      }

      const usernameSelectorCheck = 'input#username, input[name="username"], input[ref=s1e16]';
      if (await page.locator(usernameSelectorCheck).isVisible({ timeout: 1000 })) {
        const passwordSelector = 'input#password, input[name="password"], input[ref=s1e18]';
        const loginButtonSelector = 'input[type="submit"][value="LOG IN"], button:has-text("LOG IN"), button[ref=s1e23]';

        await page.locator(usernameSelectorCheck).fill(username);
        await page.locator(passwordSelector).fill(password);
        await page.locator(loginButtonSelector).click();
        await page.waitForURL('**/moocs.iniad.org/**', { timeout: 5000 });
        const moocsLoginSuccessIndicatorSelector = 'body';
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 5000 });
        await page.goto('https://moocs.iniad.org/courses');
        return listCoursesTool.handle(context);
      }
      const moocsLoginSuccessIndicatorSelector = 'body';
      try {
        await page.waitForSelector(moocsLoginSuccessIndicatorSelector, { state: 'visible', timeout: 5000 });
        await page.goto('https://moocs.iniad.org/courses');
        return listCoursesTool.handle(context);
      } catch (e) {
        return { content: [{ type: 'text', text: 'Login failed: Could not confirm final login state.' }], isError: true };
      }

    } catch (error) {
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
