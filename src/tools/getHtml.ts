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
// McpError and ErrorCode removed as they are not used in this specific tool

const GetHtmlInputSchema = z.object({}); // No input needed

const getPageHtmlTool: Tool = {
  schema: {
    name: 'getPageHtml',
    description: 'Gets the full HTML source code of the current page.',
    inputSchema: zodToJsonSchema(GetHtmlInputSchema),
  },

  capability: 'core', // Or another appropriate capability

  async handle(context: Context, params?: unknown): Promise<ToolResult> {
    try {
      const tab = await context.ensureTab(); // Ensure there is an active tab
      const page = tab.page;

      console.log('Getting page HTML content...');
      const htmlContent = await page.content();

      // Return the HTML content as text
      return {
        content: [{ type: 'text', text: htmlContent }],
      };

    } catch (error) {
      console.error('Failed to get page HTML:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error); // Fallback for non-Error types
      // Attempt to take screenshot on error
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `get_html_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      // Return error message
      return {
        content: [{ type: 'text', text: `Failed to get page HTML: ${errorMessage}` }],
        isError: true,
      };
    }
  }
};

export default [
  getPageHtmlTool,
];
