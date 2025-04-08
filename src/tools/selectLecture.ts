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

const SelectLectureInputSchema = z.object({
  lectureId: z.string().regex(/^cs\d+-\d+|cs\d+-intro$/, 'Lecture ID must be in the format csX-XX or csX-intro (e.g., cs3-00, cs3-intro)').describe('The ID of the lecture to select (e.g., "cs3-00", "cs3-intro").'),
});

const selectLectureTool: Tool = {
  schema: {
    name: 'selectLectureById',
    description: 'Selects a specific lecture within a course page using its ID (e.g., "cs3-00"). Ensures the sidebar and lecture list are expanded if necessary.',
    inputSchema: SelectLectureInputSchema,
  },

  capability: 'core',

  async handle(context: Context, params?: Record<string, any>): Promise<ToolResult> {
    let parsedParams: z.infer<typeof SelectLectureInputSchema>;
    try {
      parsedParams = SelectLectureInputSchema.parse(params);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters for selectLectureById: ${error instanceof z.ZodError ? error.errors.map(e => e.message).join(', ') : error}`);
    }
    const { lectureId } = parsedParams;

    try {
      const tab = await context.ensureTab();
      const page = tab.page;

      // --- Ensure sidebar and lecture list are visible ---
      const sidebarToggleButton = page.locator('button:has-text("Toggle navigation")'); // More robust selector
      const csLectureListLink = page.locator('a:has-text("CS3講義")'); // Assuming "CS3講義" is consistent, adjust if needed
      // Use href attribute selector for robustness
      const lectureLinkLocator = page.locator(`a[href$="/${lectureId}"]`); // Select link whose href ends with "/lectureId"

      // 1. Check if the lecture link is already visible. If so, click it directly.
      //    Need to use waitFor with a short timeout for isVisible check as element might appear after interactions.
      try {
        await lectureLinkLocator.waitFor({ state: 'visible', timeout: 1000 }); // Short timeout for initial check
        console.log(`Lecture link "${lectureId}" is already visible. Clicking...`);
        await lectureLinkLocator.click();
      } catch (e) {
        // Link not immediately visible, proceed with expansion logic
        console.log(`Lecture link "${lectureId}" not immediately visible. Checking sidebar/list expansion...`);

        // 2. Check if the sidebar toggle button exists and click if needed
        if (await sidebarToggleButton.isVisible() && !(await csLectureListLink.isVisible({ timeout: 500 }))) { // Check if list link is hidden
          console.log('Sidebar might be closed. Clicking toggle button...');
          await sidebarToggleButton.click();
          await page.waitForTimeout(500); // Short pause for sidebar animation
        }

        // 3. Check if the CS lecture list link is visible and click if needed to expand
        //    Also check if the target lecture link is *still* not visible after potential sidebar toggle
        if (await csLectureListLink.isVisible() && !(await lectureLinkLocator.isVisible({ timeout: 500 }))) {
          // Check if the list is already expanded by looking for a known child link (e.g., cs3-intro) using href
          const isExpanded = await page.locator('a[href$="/cs3-intro"]').isVisible({ timeout: 500 });
          if (!isExpanded) {
            console.log('CS lecture list is not expanded. Clicking to expand...');
            await csLectureListLink.click();
            await page.waitForTimeout(500); // Short pause for list expansion
          } else {
            console.log('CS lecture list seems already expanded.');
          }
        }

        // 4. Now try clicking the specific lecture link again after potential expansions
        console.log(`Attempting to click lecture link "${lectureId}" after potential expansions...`);
        await lectureLinkLocator.waitFor({ state: 'visible', timeout: 10000 });
        await lectureLinkLocator.click();
      }


      // Wait for navigation or confirmation element if needed
      await page.waitForLoadState('domcontentloaded'); // Wait for the new page/content to load

      console.log(`Successfully navigated to lecture: ${lectureId}`);
      return {
        content: [{ type: 'text', text: `Successfully selected lecture: ${lectureId}` }],
      };

    } catch (error: any) {
      console.error(`Failed to select lecture "${lectureId}":`, error);
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `select_lecture_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to select lecture "${lectureId}": ${error.message}` }],
        isError: true,
      };
    }
  }
};

export default [
  selectLectureTool,
];
