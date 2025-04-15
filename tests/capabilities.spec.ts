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

import { test, expect } from './fixtures';

test('test snapshot tool list', async ({ client }) => {
  const { tools } = await client.listTools();
  expect(new Set(tools.map(t => t.name))).toEqual(new Set([
    'browser_close',
    'browser_wait',
    'browser_navigate',
    'browser_navigate_back',
    'browser_navigate_forward',
    'browser_snapshot',
    'browser_tab_list',
    'browser_tab_new',
    'browser_tab_select',
    'browser_tab_close',
    'loginToIniadMoocsWithIniadAccount',
    'listLectureLinks',
    'listSlideLinks',
    'listCourses',
    'submit_assignment',
  ]));
});

test('test vision tool list', async ({ visionClient }) => {
  const { tools: visionTools } = await visionClient.listTools();
  expect(new Set(visionTools.map(t => t.name))).toEqual(new Set([
    'browser_close',
    'browser_wait',
    'browser_navigate',
    'browser_navigate_back',
    'browser_navigate_forward',
    'browser_tab_list',
    'browser_tab_new',
    'browser_tab_select',
    'browser_tab_close',
    'loginToIniadMoocsWithIniadAccount',
    'listLectureLinks',
    'listSlideLinks',
    'listCourses',
  ]));
});

test('test resources list', async ({ client }) => {
  const { resources } = await client.listResources();
  expect(resources).toEqual([
    expect.objectContaining({
      uri: 'browser://console',
      mimeType: 'text/plain',
    }),
  ]);
});

test('test capabilities', async ({ startClient }) => {
  const client = await startClient({
    args: ['--caps="core"'],
  });
  const { tools } = await client.listTools();
  const toolNames = tools.map(t => t.name);
  expect(toolNames).not.toContain('browser_tab_list');
  expect(toolNames).not.toContain('browser_tab_new');
  expect(toolNames).not.toContain('browser_tab_select');
  expect(toolNames).not.toContain('browser_tab_close');
  expect(toolNames).not.toContain('browser_wait');
  expect(toolNames).not.toContain('browser_navigate_back');
  expect(toolNames).not.toContain('browser_navigate_forward');
});
