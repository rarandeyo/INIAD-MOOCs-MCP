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
import type { Dialog } from 'playwright';
import type { Tool, ToolResult } from './tool';
import type { Context } from '../context';

const confirmSubmissionAlertSchema = z.object({
  expected_text: z.string().describe('The text expected to be present in the alert dialog (partial match)'),
  timeout: z.number().optional().default(5000).describe('Maximum time to wait for the alert in milliseconds (default: 5000)'),
});

const confirmSubmissionAlert: Tool = {
  capability: 'core', // Or other appropriate capability
  schema: {
    name: 'confirm_submission_alert',
    description: 'Waits for an alert dialog, confirms its text content (partial match), and accepts it.',
    inputSchema: zodToJsonSchema(confirmSubmissionAlertSchema),
  },

  handle: async (context: Context, params: any): Promise<ToolResult> => {
    const validatedParams = confirmSubmissionAlertSchema.parse(params);
    const tab = context.currentTab();
    const page = tab.page;

    let dialogOccurred = false;
    let confirmationResult: ToolResult | null = null;

    const dialogPromise = new Promise<ToolResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove listener to prevent memory leaks if timeout occurs before dialog
        page.removeListener('dialog', dialogHandler);
        reject(new Error(`Timeout: Alert dialog did not appear within ${validatedParams.timeout}ms.`));
      }, validatedParams.timeout);

      const dialogHandler = async (dialog: Dialog) => {
        dialogOccurred = true;
        clearTimeout(timer); // Clear the timeout timer as dialog appeared
        page.removeListener('dialog', dialogHandler); // Remove listener after handling

        const message = dialog.message();
        if (message.includes(validatedParams.expected_text)) {
          await dialog.accept();
          resolve({
            content: [{ type: 'text', text: `Confirmed and accepted alert dialog with text: "${message}"` }],
          });
        } else {
          // Dismiss the dialog even if text doesn't match to avoid blocking
          await dialog.dismiss();
          reject(new Error(`Alert dialog text mismatch. Expected to include: "${validatedParams.expected_text}", but got: "${message}"`));
        }
      };

      page.once('dialog', dialogHandler);
    });

    try {
      confirmationResult = await dialogPromise;
      return confirmationResult;
    } catch (error: any) {
      console.error('Error during confirm_submission_alert:', error);
      // Ensure dialogOccurred flag is checked if error wasn't from the promise rejection logic itself
      if (!dialogOccurred && error.message.startsWith('Timeout')) {
        // Timeout specific error
        return { content: [{ type: 'text', text: error.message }], isError: true };
      } else if (error.message.startsWith('Alert dialog text mismatch')) {
        // Text mismatch specific error
        return { content: [{ type: 'text', text: error.message }], isError: true };
      }
      // Generic error
      return { content: [{ type: 'text', text: `Error confirming submission alert: ${error.message}` }], isError: true };
    }
  },
};

export default [confirmSubmissionAlert];
