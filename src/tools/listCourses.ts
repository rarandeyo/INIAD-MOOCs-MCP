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

// No input needed for listing courses
const ListCoursesInputSchema = z.object({});

// Define the structure for each course found, now including id
const CourseSchema = z.object({
  id: z.string().describe('The unique identifier of the course (extracted from the URL).'),
  title: z.string().describe('The title of the course.'),
  url: z.string().url().describe('The absolute URL of the course page.'),
});

// Define the output structure
const ListCoursesOutputSchema = z.object({
  courses: z.array(CourseSchema).describe('A list of courses (id, title, URL) found on the page.'),
});

const listCoursesTool: Tool = {
  schema: {
    name: 'listCourses',
    description: 'Lists all available courses (id, title, URL) found on the main courses page (https://moocs.iniad.org/courses). Returns a JSON string representing an object with a "courses" array.',
    inputSchema: zodToJsonSchema(ListCoursesInputSchema),
  },

  capability: 'core',

  async handle(context: Context, params?: unknown): Promise<ToolResult> {
    try {
      const tab = await context.ensureTab();
      const page = tab.page;
      const coursesUrl = 'https://moocs.iniad.org/courses';
      const baseUrl = new URL(coursesUrl).origin; // Base URL for resolving relative links

      // Navigate to the main courses page if not already there
      if (page.url().split('?')[0] !== coursesUrl) { // Ignore query parameters for comparison
        console.log(`Navigating to ${coursesUrl}...`);
        await page.goto(coursesUrl, { waitUntil: 'domcontentloaded' });
      } else {
        console.log('Already on the courses page.');
      }


      console.log('Listing courses (including IDs)...');

      // Selector for course headings (assuming h4)
      const courseHeadingLocator = page.locator('h4'); // Adjust if heading level changes
      const headings = await courseHeadingLocator.all();

      const courseData = [];

      for (const heading of headings) {
        try {
          // Find the "View Course" link associated with the heading
          const viewCourseLinkLocator = heading.locator('xpath=following-sibling::a[contains(text(), "View Course")]');
          const href = await viewCourseLinkLocator.getAttribute('href');
          const title = (await heading.textContent() ?? '').trim();

          if (href && title) {
            const absoluteUrl = new URL(href, baseUrl).toString();
            // Extract ID from the last part of the URL path
            const urlParts = href.split('/');
            const id = urlParts[urlParts.length - 1] || 'unknown'; // Get last part or default

            courseData.push({ id, title, url: absoluteUrl }); // Add id to the data
          }
        } catch (error) {
          // Handle cases where a heading might not have the expected link structure
          const titleText = (await heading.textContent() ?? '').trim();
          if (titleText && titleText !== 'Other Courses') { // Avoid logging known non-course headings
            console.warn(`Could not find valid 'View Course' link for heading: "${titleText}". Skipping.`);
          }
        }
      }

      console.log(`Found ${courseData.length} courses.`);

      // Validate the output structure
      const result = ListCoursesOutputSchema.parse({ courses: courseData });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };

    } catch (error) {
      console.error('Failed to list courses:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error); // Fallback for non-Error types
      // Screenshot attempt within the catch block
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `list_courses_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to list courses: ${errorMessage}` }],
        isError: true,
      };
    }
  }
};

export default [
  listCoursesTool,
];
