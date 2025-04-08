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
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const SelectSlideInputSchema = z.object({
  slideNumber: z.number().int().positive().describe('The slide number to navigate to (e.g., 1, 5).'),
});

const selectSlideTool: Tool = {
  schema: {
    name: 'selectSlideByNumber',
    description: 'Selects a specific slide within a lecture page using its number.',
    inputSchema: SelectSlideInputSchema,
  },

  capability: 'core',

  async handle(context: Context, params?: Record<string, any>): Promise<ToolResult> {
    let parsedParams: z.infer<typeof SelectSlideInputSchema>;
    try {
      parsedParams = SelectSlideInputSchema.parse(params);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters for selectSlideByNumber: ${error instanceof z.ZodError ? error.errors.map(e => e.message).join(', ') : error}`);
    }
    const { slideNumber } = parsedParams;
    const slideNumberString = slideNumber.toString(); // For use in locator

    try {
      const tab = await context.ensureTab();
      const page = tab.page;

      // Locate the pagination navigation element first for context
      const paginationNav = page.locator('nav[aria-label="page navigation"]');
      if (!(await paginationNav.isVisible()))
        throw new Error('Pagination navigation not found on the page.');


      // Locate the link within the pagination nav by its exact text (the slide number)
      const slideLinkLocator = paginationNav.locator(`a:text-is("${slideNumberString}")`); // Use :text-is for exact match

      console.log(`Attempting to click slide link number "${slideNumberString}"...`);
      await slideLinkLocator.waitFor({ state: 'visible', timeout: 10000 });
      await slideLinkLocator.click();

      // Wait for navigation or confirmation element if needed
      await page.waitForLoadState('domcontentloaded'); // Wait for the new page/content to load

      // Verify navigation (optional but recommended)
      const expectedUrlSuffix = `/${slideNumber.toString().padStart(2, '0')}`; // e.g., /01, /05
      await page.waitForURL(`**${expectedUrlSuffix}`, { timeout: 5000 });


      console.log(`Successfully navigated to slide number: ${slideNumberString}`);
      return {
        content: [{ type: 'text', text: `Successfully selected slide number: ${slideNumberString}` }],
      };

    } catch (error: any) {
      console.error(`Failed to select slide number "${slideNumberString}":`, error);
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `select_slide_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to select slide number "${slideNumberString}": ${error.message}` }],
        isError: true,
      };
    }
  }
};

export default [
  selectSlideTool,
];
