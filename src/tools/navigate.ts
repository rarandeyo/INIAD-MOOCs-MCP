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

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Context } from '../context';
import type { ToolFactory, ToolResult } from './tool';
import listCoursesTool from './listCourses';
import listLectureLinksTool from './listLectures';
import listSlideLinksTool from './listSlides';
const navigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});

const navigate: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },
  handle: async (context: Context, params: unknown): Promise<ToolResult> => {
    const validatedParams = navigateSchema.parse(params);
    const currentTab = await context.ensureTab();
    const targetUrl = validatedParams.url;
    console.log(`Navigating to ${targetUrl}, capture snapshot: ${captureSnapshot}`);

    const navigateResult = await currentTab.run(async tab => {
      await tab.navigate(targetUrl);
    }, {
      status: `Navigated to ${targetUrl}`,
      captureSnapshot: captureSnapshot,
    });

    const currentUrl = currentTab.page.url();
    const additionalContent: ToolResult['content'] = [];

    try {
      const coursesRegex = new RegExp('^https://moocs\\.iniad\\.org/courses/?$');
      const coursePageRegex = new RegExp('^https://moocs\\.iniad\\.org/courses/\\d{4}/[A-Z0-9]+/?$');
      const lectureOrSlidePageRegex = new RegExp('^https://moocs\\.iniad\\.org/courses/\\d{4}/[A-Z0-9]+/[A-Za-z0-9_-]+/?(\\d+)?/?$');

      type AutoFetchedListContent = {
        type: 'autoFetchedList';
        sourceTool: 'listCourses' | 'listLectures' | 'listSlides';
        data: ToolResult['content'];
        isError?: boolean;
      };

      if (coursesRegex.test(currentUrl)) {
        console.log('Detected courses page, attempting to list courses...');
        const coursesResult = await listCoursesTool[0].handle(context);
        const listContent: AutoFetchedListContent = {
          type: 'autoFetchedList',
          sourceTool: 'listCourses',
          data: coursesResult.content || [],
          isError: coursesResult.isError,
        };
        additionalContent.push({ type: 'text', text: JSON.stringify(listContent) });
        if (!coursesResult.isError)
          console.log('Successfully listed courses.');
        else
          console.warn('Failed to list courses or result was error.');

      } else if (coursePageRegex.test(currentUrl)) {
        console.log('Detected course page, attempting to list lectures...');
        const lecturesResult = await listLectureLinksTool[0].handle(context);
        const listContent: AutoFetchedListContent = {
          type: 'autoFetchedList',
          sourceTool: 'listLectures',
          data: lecturesResult.content || [],
          isError: lecturesResult.isError,
        };
        additionalContent.push({ type: 'text', text: JSON.stringify(listContent) });
        if (!lecturesResult.isError)
          console.log('Successfully listed lectures.');
        else
          console.warn('Failed to list lectures or result was error.');

      } else if (lectureOrSlidePageRegex.test(currentUrl)) {
        console.log('Detected lecture/slide page, attempting to list slides...');
        const slidesResult = await listSlideLinksTool[0].handle(context);
        const listContent: AutoFetchedListContent = {
          type: 'autoFetchedList',
          sourceTool: 'listSlides',
          data: slidesResult.content || [],
          isError: slidesResult.isError,
        };
        additionalContent.push({ type: 'text', text: JSON.stringify(listContent) });
        if (!slidesResult.isError)
          console.log('Successfully listed slides.');
        else
          console.warn('Failed to list slides or result was error.');
      }
    } catch (error) {
      console.error('Error during automatic list fetching after navigation:', error);
      additionalContent.push({ type: 'text', text: `Error fetching lists after navigation: ${error instanceof Error ? error.message : String(error)}` } as any);
    }

    const finalContent = additionalContent.concat(navigateResult.content || []);

    return {
      ...navigateResult,
      content: finalContent,
    };
  },
});

const goBackSchema = z.object({});

const goBack: ToolFactory = snapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_back',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
  },
  handle: async context => {
    return await context.currentTab().runAndWait(async tab => {
      await tab.page.goBack();
    }, {
      status: 'Navigated back',
      captureSnapshot: snapshot,
    });
  },
});

const goForwardSchema = z.object({});

const goForward: ToolFactory = snapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_forward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
  },
  handle: async context => {
    return await context.currentTab().runAndWait(async tab => {
      await tab.page.goForward();
    }, {
      status: 'Navigated forward',
      captureSnapshot: snapshot,
    });
  },
});

export default (captureSnapshot: boolean) => [
  navigate(captureSnapshot),
  goBack(captureSnapshot),
  goForward(captureSnapshot),
];
