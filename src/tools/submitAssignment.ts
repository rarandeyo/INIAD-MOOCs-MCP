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
// import type { Dialog } from 'playwright'; // アラート処理削除のため不要
import type { Tool, ToolResult } from './tool';
import type { Context } from '../context';

// 操作の種類を定義
const actionSchema = z.enum(['type', 'click', 'check', 'uncheck', 'select', 'upload']); // 'upload' を再度追加

// 個々の操作のスキーマ
const operationSchema = z.object({
  action: actionSchema.describe('The type of action to perform'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
  value: z.union([
    z.string(),
    z.array(z.string()),
    z.undefined(),
  ]).optional().describe('Value needed for the action (text for type, options for select, file paths for upload)'), // file paths の記述を戻す
  element: z.string().optional().describe('Human-readable element description (used for status reporting)'), // オプショナルで追加
});

// ツール全体の入力スキーマ
const submitAssignmentSchema = z.object({
  operations: z.array(operationSchema).describe('A sequence of input operations to perform'),
  submitButtonRef: z.string().describe('Exact reference for the submit button element'),
  submitButtonElement: z.string().optional().describe('Human-readable description for the submit button (used for status reporting)'),
});

const submitAssignment: Tool = {
  capability: 'core', // または 'custom' など適切なもの
  schema: {
    name: 'submit_assignment',
    description: 'Performs a sequence of form interactions (typing, clicking, checking, selecting, uploading) and clicks the submit button, based on a pre-existing page snapshot. Handles file uploads internally by clicking the trigger and waiting for the file chooser. Does not handle page navigation or confirm alerts.',
    inputSchema: zodToJsonSchema(submitAssignmentSchema),
  },

  handle: async (context: Context, params: any): Promise<ToolResult> => {
    const validatedParams = submitAssignmentSchema.parse(params);
    const tab = context.currentTab();
    const page = tab.page; // filechooser イベントのために page オブジェクトが必要

    try {
      // 既存のスナップショットを取得 (このツール自体はスナップショットを更新しない)
      const snapshot = tab.lastSnapshot();
      if (!snapshot)
        throw new Error('No snapshot available. Please run browser_snapshot first.');


      const performedActions: string[] = [];

      for (const operation of validatedParams.operations) {
        const locator = snapshot.refLocator(operation.ref);
        const elementName = operation.element || `element with ref ${operation.ref}`; // レポート用

        switch (operation.action) {
          case 'type':
            if (typeof operation.value !== 'string')
              throw new Error(`Invalid value type for 'type' action: expected string, got ${typeof operation.value}`);

            await locator.fill(operation.value);
            performedActions.push(`Typed "${operation.value}" into "${elementName}"`);
            break;
          case 'click':
            // 注意: このクリックはページ遷移を引き起こさない要素 (例: ラジオボタン、チェックボックス) を想定
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

            // 単一文字列の場合も配列に変換
            const selectValues = Array.isArray(operation.value) ? operation.value : [operation.value];
            await locator.selectOption(selectValues);
            performedActions.push(`Selected option(s) in "${elementName}"`);
            break;
          case 'upload':
            if (!operation.value || (typeof operation.value !== 'string' && !Array.isArray(operation.value)))
              throw new Error(`Invalid value type for 'upload' action: expected string or array of strings (file paths), got ${typeof operation.value}`);

            const filePaths = Array.isArray(operation.value) ? operation.value : [operation.value];
            // ファイルパスが絶対パスであることを確認 (簡易チェック) - 必要に応じて強化
            if (filePaths.some(p => !p.startsWith('/')))
              console.warn(`Potential relative path detected in file upload: ${filePaths.join(', ')}. Assuming absolute paths.`);


            // ファイル選択ダイアログを待つ Promise
            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }) // 5秒タイムアウト
                .catch(() => { throw new Error(`Timeout: File chooser did not appear for "${elementName}" within 5000ms after clicking.`); }); // ESLintエラー修正済み

            // アップロードボタンをクリックしてファイル選択ダイアログをトリガー
            await locator.click();
            performedActions.push(`Clicked upload trigger "${elementName}"`);

            // ファイル選択ダイアログが表示されたらファイルをセット
            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(filePaths);
            // Note: tab.submitFileChooser は内部で fileChooser をクリアする可能性があるため、ここでは直接 fileChooser.setFiles を使用

            performedActions.push(`Selected file(s) for "${elementName}": ${filePaths.join(', ')}`);
            break;
          default:
            // actionSchemaで網羅されているはずだが念のため
            throw new Error(`Unsupported action: ${operation.action}`);
        }
      }

      // --- 提出ボタンクリック処理 ---
      const submitButtonName = validatedParams.submitButtonElement || `Submit button (ref: ${validatedParams.submitButtonRef})`;
      const submitLocator = snapshot.refLocator(validatedParams.submitButtonRef);
      await submitLocator.click();
      performedActions.push(`Clicked "${submitButtonName}"`);

      // 完了メッセージ (入力操作 + 提出ボタンクリック)
      const inputActions = performedActions.slice(0, -1); // 提出ボタンクリックを除いた入力操作
      const submitAction = performedActions[performedActions.length - 1]; // 提出ボタンクリック操作
      const statusMessage = `Successfully performed ${inputActions.length} input operations and clicked the submit button:\n- ${inputActions.join('\n- ')}\n- ${submitAction}`;
      return {
        content: [{ type: 'text', text: statusMessage }],
      };

    } catch (error: any) {
      console.error('Error during submit_assignment:', error);
      // エラーメッセージを返す
      return {
        content: [{ type: 'text', text: `Error during assignment submission: ${error.message}` }],
        isError: true,
      };
    }
  },
};

export default [submitAssignment]; // 配列としてエクスポート
