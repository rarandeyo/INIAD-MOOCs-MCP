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

import { Tool, ToolResult } from './tool';
import { Context } from '../context';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const handleDialogSchema = z.object({
  accept: z.boolean().describe('Whether to accept the dialog.'),
  promptText: z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
});

const handleDialog: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_handle_dialog',
    description: 'Handle a dialog',
    inputSchema: zodToJsonSchema(handleDialogSchema, { '$refStrategy': 'none' }),
  },
  handle: async (context: Context, params?: Record<string, any>): Promise<ToolResult> => {
    const { accept, promptText } = handleDialogSchema.parse(params || {});

    const tab = context.currentTab();
    const dialog = (tab as any).pendingDialog;

    if (!dialog) {
      return {
        content: [{ type: 'text', text: 'No dialog visible' }],
        isError: true,
      };
    }

    try {
      if (accept)
        await dialog.accept(promptText);
      else
        await dialog.dismiss();

      (tab as any).pendingDialog = undefined;

      const message = dialog.message();
      return {
        content: [{ type: 'text', text: `Dialog "${dialog.type()}" with message "${message}" ${accept ? 'accepted' : 'dismissed'}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to handle dialog: ${error}` }],
        isError: true,
      };
    }
  },
};

export default [handleDialog];
