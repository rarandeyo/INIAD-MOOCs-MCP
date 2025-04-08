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
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'; // Import McpError and ErrorCode

const SelectCourseInputSchema = z.object({
  courseName: z.string().describe('The exact name of the course to select as it appears on the page.'),
});

const selectCourseTool: Tool = {
  schema: {
    name: 'selectCourseByName',
    description: 'Selects a course on the INIAD MOOCs page by its exact name.',
    inputSchema: SelectCourseInputSchema,
  },

  capability: 'core',

  // Adjust handle signature and add schema parsing
  async handle(context: Context, params?: Record<string, any>): Promise<ToolResult> {
    let parsedParams: z.infer<typeof SelectCourseInputSchema>;
    try {
      parsedParams = SelectCourseInputSchema.parse(params);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters for selectCourseByName');
    }
    const { courseName } = parsedParams;


    try {
      const tab = await context.ensureTab();
      const page = tab.page;

      // Find the heading with the exact course name
      const courseHeadingLocator = page.locator(`h4:has-text("${courseName}")`);
      await courseHeadingLocator.waitFor({ state: 'visible', timeout: 10000 });

      // Find the "View Course" link associated with that heading.
      const viewCourseLinkLocator = courseHeadingLocator.locator('xpath=following-sibling::a[contains(text(), "View Course")] | ancestor::li//a[contains(text(), "View Course")]');

      console.log(`Clicking "View Course" for "${courseName}"...`);
      await viewCourseLinkLocator.waitFor({ state: 'visible', timeout: 5000 });
      await viewCourseLinkLocator.click();

      // Wait for navigation or confirmation element if needed
      await page.waitForLoadState('domcontentloaded'); // Wait for the new page/content to load

      console.log(`Successfully navigated to course: ${courseName}`);
      return {
        content: [{ type: 'text', text: `Successfully selected course: ${courseName}` }],
      };

    } catch (error: any) {
      console.error(`Failed to select course "${courseName}":`, error);
      try {
        // Get page for screenshot
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `select_course_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to select course "${courseName}": ${error.message}` }],
        isError: true,
      };
    }
  }
};

export default [
  selectCourseTool,
];
