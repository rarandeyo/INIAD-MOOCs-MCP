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
import zodToJsonSchema from 'zod-to-json-schema';
import type { Tool, ToolResult } from './tool';
import type { Context } from '../context';

const actionSchema = z.enum(['type', 'click', 'check', 'uncheck', 'select', 'upload']);

const operationSchema = z.object({
  action: actionSchema.describe('The type of action to perform'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
  value: z.union([
    z.string(),
    z.array(z.string()),
    z.undefined(),
  ]).optional().describe('Value needed for the action (text for type, options for select, file paths for upload). IMPORTANT: File paths for upload MUST be absolute paths.'),
  element: z.string().optional().describe('Human-readable element description (used for status reporting)'), // オプショナルで追加
});

const submitAssignmentSchema = z.object({
  operations: z.array(operationSchema).describe('A sequence of input operations to perform'),
  submitButtonRef: z.string().describe('Exact reference for the submit button element'),
  submitButtonElement: z.string().optional().describe('Human-readable description for the submit button (used for status reporting)'),
});

const submitAssignment: Tool = {
  capability: 'core',
  schema: {
    name: 'submit_assignment',
    description: 'Specifically designed for submitting assignments on platforms like INIAD MOOCs. Performs a sequence of form interactions (typing, file uploads, etc.) and clicks the final submit button, based on a pre-existing page snapshot. Use this tool for submitting assignments instead of individual click/type/upload actions. Handles file uploads internally. Does not handle page navigation or confirm alerts.',
    inputSchema: zodToJsonSchema(submitAssignmentSchema),
  },

  handle: async (context: Context, params: any): Promise<ToolResult> => {
    const validatedParams = submitAssignmentSchema.parse(params);
    const tab = context.currentTab();
    const page = tab.page;

    try {
      const snapshot = tab.lastSnapshot();
      if (!snapshot)
        throw new Error('No snapshot available. Please run browser_snapshot first.');


      const performedActions: string[] = [];

      for (const operation of validatedParams.operations) {
        const locator = snapshot.refLocator(operation.ref);
        const elementName = operation.element || `element with ref ${operation.ref}`;

        switch (operation.action) {
          case 'type':
            if (typeof operation.value !== 'string')
              throw new Error(`Invalid value type for 'type' action: expected string, got ${typeof operation.value}`);

            await locator.fill(operation.value);
            performedActions.push(`Typed "${operation.value}" into "${elementName}"`);
            break;
          case 'click':
            await locator.click();
            performedActions.push(`Clicked "${elementName}"`);
            break;
          case 'check':
            await locator.check();
            performedActions.push(`Checked "${elementName}"`);
            break;
          case 'uncheck':
            await locator.uncheck();
            performedActions.push(`Unchecked "${elementName}"`);
            break;
          case 'select':
            if (!Array.isArray(operation.value) && typeof operation.value !== 'string')
              throw new Error(`Invalid value type for 'select' action: expected string or array of strings, got ${typeof operation.value}`);

            const selectValues = Array.isArray(operation.value) ? operation.value : [operation.value];
            await locator.selectOption(selectValues);
            performedActions.push(`Selected option(s) in "${elementName}"`);
            break;
          case 'upload':
            if (!operation.value || (typeof operation.value !== 'string' && !Array.isArray(operation.value)))
              throw new Error(`Invalid value type for 'upload' action: expected string or array of strings (file paths), got ${typeof operation.value}`);

            const filePaths = Array.isArray(operation.value) ? operation.value : [operation.value];
            if (filePaths.some(p => !p.startsWith('/')))
              console.warn(`Potential relative path detected in file upload: ${filePaths.join(', ')}. Assuming absolute paths.`);


            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 })
                .catch(() => { throw new Error(`Timeout: File chooser did not appear for "${elementName}" within 5000ms after clicking.`); });

            await locator.click();
            performedActions.push(`Clicked upload trigger "${elementName}"`);

            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(filePaths);


            performedActions.push(`Selected file(s) for "${elementName}": ${filePaths.join(', ')}`);
            break;
          default:
            throw new Error(`Unsupported action: ${operation.action}`);
        }
      }

      const submitButtonName = validatedParams.submitButtonElement || `Submit button (ref: ${validatedParams.submitButtonRef})`;
      const submitLocator = snapshot.refLocator(validatedParams.submitButtonRef);
      await submitLocator.click();
      performedActions.push(`Clicked "${submitButtonName}"`);

      // Wait for dialog to appear using browser_wait
      await page.waitForTimeout(1000);

      // Automatically handle dialog that may appear after clicking submit
      let dialogErrorDetected = false;
      const pendingDialog: any = (tab as any).pendingDialog;
      if (pendingDialog) {
        try {
          const dialogMessage = pendingDialog.message();

          // Expected messages (Japanese and English lines may be separated by newline)
          const expectedJP = 'すべての回答を保存しました。';
          const expectedEN = 'All your answers have been saved.';

          const normalizedMessage = dialogMessage.trim();

          if (!normalizedMessage.includes(expectedJP) && !normalizedMessage.includes(expectedEN)) {
            dialogErrorDetected = true;
            performedActions.push(`Unexpected dialog message detected: "${dialogMessage}"`);
          }

          await pendingDialog.accept();
          performedActions.push(`Dialog "${pendingDialog.type()}" with message "${dialogMessage}" accepted automatically`);
        } catch (dialogError) {
          dialogErrorDetected = true;
          performedActions.push(`Failed to automatically handle dialog: ${dialogError}`);
        } finally {
          (tab as any).pendingDialog = undefined;
        }
      } else {
        // No dialog appeared; treat as error
        dialogErrorDetected = true;
        performedActions.push('Error: No confirmation dialog appeared after clicking submit');
      }

      const inputActionCount = validatedParams.operations.length;
      const statusMessage = `Successfully performed ${inputActionCount} input operations, clicked the submit button, and handled any dialogs if present:\n- ${performedActions.join('\n- ')}`;
      return {
        content: [{ type: 'text', text: statusMessage }],
        isError: dialogErrorDetected,
      };

    } catch (error: any) {
      console.error('Error during submit_assignment:', error);
      return {
        content: [{ type: 'text', text: `Error during assignment submission: ${error.message}` }],
        isError: true,
      };
    }
  },
};

export default [
  submitAssignment
];
