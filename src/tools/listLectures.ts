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

const ListLecturesInputSchema = z.object({});

const LectureLinkSchema = z.object({
  id: z.string().describe('The unique identifier of the lecture (extracted from the URL).'),
  title: z.string().describe('The display text/title of the lecture link.'),
  url: z.string().url().describe('The absolute URL of the lecture page.'),
});

const ListLecturesOutputSchema = z.object({
  lectures: z.array(LectureLinkSchema).describe('A list of lectures found in the sidebar.'),
});

const listLectureLinksTool: Tool = {
  schema: {
    name: 'listLectureLinks',
    description: 'Lists all available lecture links (ID, title, URL) found in the sidebar of the current course page. Returns a JSON string representing an object with a "lectures" array.',
    inputSchema: zodToJsonSchema(ListLecturesInputSchema),
  },

  capability: 'core',

  async handle(context: Context, params?: unknown): Promise<ToolResult> {
    try {
      const tab = await context.ensureTab();
      const page = tab.page;
      const baseUrl = new URL(page.url()).origin;

      console.log('Listing lecture links from sidebar...');

      const lectureLinksLocator = page.locator('aside.main-sidebar ul.sidebar-menu li.treeview ul.treeview-menu li a');

      let links = await lectureLinksLocator.all();

      if (links.length === 0) {
        console.log('No lecture links found initially with the specified selector. Checking if sidebar needs toggling...');
        const sidebarToggleButton = page.locator('nav.navbar a.sidebar-toggle');
        const bookmarkLink = page.locator('aside.main-sidebar a[href="/courses/bookmarks"]');
        if (await sidebarToggleButton.isVisible() && !(await bookmarkLink.isVisible({ timeout: 500 }))) {
          console.log('Sidebar seems closed, attempting to toggle...');
          await sidebarToggleButton.click();
          await page.waitForTimeout(500);
          links = await lectureLinksLocator.all();
          console.log(`Found ${links.length} links after toggling sidebar.`);
        } else {
          console.log('Sidebar already seems open or toggle button not found.');
        }
      }


      const lectureData = [];
      for (const link of links) {
        const href = await link.getAttribute('href');
        const title = (await link.textContent() ?? '').trim();

        if (href) {
          const absoluteUrl = new URL(href, baseUrl).toString();
          const urlParts = href.split('/');
          const id = urlParts[urlParts.length - 1] || 'unknown';

          lectureData.push({ id, title, url: absoluteUrl });
        }
      }

      console.log(`Found ${lectureData.length} lecture links in total.`);

      const result = ListLecturesOutputSchema.parse({ lectures: lectureData });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };

    } catch (error) {
      console.error('Failed to list lecture links:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error);
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `list_lectures_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to list lecture links: ${errorMessage}` }],
        isError: true,
      };
    }
  }
};

export default [
  listLectureLinksTool,
];
