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

import type { Resource } from './resource';

export const console: Resource = {
  schema: {
    uri: 'browser://console',
    name: 'Page console',
    mimeType: 'text/plain',
  },

  read: async (context, uri) => {
    const messages = await context.currentTab().console();
    const log = messages.map(message => `[${message.type().toUpperCase()}] ${message.text()}`).join('\n');
    return [{
      uri,
      mimeType: 'text/plain',
      text: log
    }];
  },
};
