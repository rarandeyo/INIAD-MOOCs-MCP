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

const ListSlidesInputSchema = z.object({});

const SlideLinkSchema = z.object({
  slideNumber: z.string().describe('The page number or identifier of the slide link.'),
  title: z.string().describe('The title of the slide (from the link\'s title attribute).'),
  url: z.string().url().describe('The absolute URL of the slide page.'),
});

const ListSlidesOutputSchema = z.object({
  slides: z.array(SlideLinkSchema).describe('A list of slide links (number, title, URL) found in the page navigation.'),
});

const listSlideLinksTool: Tool = {
  schema: {
    name: 'listSlideLinks',
    description: 'Lists all available slide links (slide number, title, URL) found in the page navigation of the current lecture page. Returns a JSON string representing an object with a "slides" array.',
    inputSchema: zodToJsonSchema(ListSlidesInputSchema),
  },

  capability: 'core',

  async handle(context: Context, params?: unknown): Promise<ToolResult> {
    try {
      const tab = await context.ensureTab();
      const page = tab.page;
      const baseUrl = new URL(page.url()).origin;

      console.log('Listing slide links (including titles) from page navigation...');

      const slideLinksLocator = page.locator('nav[aria-label="page navigation"] ul li a');

      const links = await slideLinksLocator.all();
      const slideData = [];
      const addedUrls = new Set<string>();

      for (const link of links) {
        const slideNumber = (await link.textContent() ?? '').trim();
        const href = await link.getAttribute('href');
        const title = (await link.getAttribute('title') ?? slideNumber).trim();
        if (href && /^\d+$/.test(slideNumber)) {
          const absoluteUrl = (href === '#') ? page.url() : new URL(href, baseUrl).toString();

          if (!addedUrls.has(absoluteUrl)) {
            slideData.push({ slideNumber, title, url: absoluteUrl });
            addedUrls.add(absoluteUrl);
          }
        }
      }

      slideData.sort((a, b) => Number.parseInt(a.slideNumber, 10) - Number.parseInt(b.slideNumber, 10));


      console.log(`Found ${slideData.length} unique slide links.`);

      const result = ListSlidesOutputSchema.parse({ slides: slideData });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };

    } catch (error) {
      console.error('Failed to list slide links:', error);
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error)
        errorMessage = error.message;
      else
        errorMessage = String(error);
      try {
        const tab = context.currentTab();
        if (tab) {
          const page = tab.page;
          const screenshotPath = `list_slides_error_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`Screenshot saved to ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      return {
        content: [{ type: 'text', text: `Failed to list slide links: ${errorMessage}` }],
        isError: true,
      };
    }
  }
};

export default [
  listSlideLinksTool,
];
