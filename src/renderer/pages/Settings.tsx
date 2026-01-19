import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { Settings as SettingsType, PromptTemplate, ApiKeyValidationResult } from '../../shared/types';

export default function Settings() {
  const queryClient = useQueryClient();
  const { invoke } = useIpc();

  const [newApiKey, setNewApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => invoke<SettingsType>(IPC_CHANNELS.SETTINGS_GET),
  });

  // Change storage path
  const changeStoragePath = useMutation({
    mutationFn: () => invoke<string | null>(IPC_CHANNELS.SETTINGS_SET_STORAGE_PATH),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Update API key
  const updateApiKey = useMutation({
    mutationFn: async () => {
      const result = await invoke<ApiKeyValidationResult>(
        IPC_CHANNELS.SETTINGS_SET_API_KEY,
        newApiKey
      );
      if (!result.success) {
        throw new Error(result.error || 'Invalid API key');
      }
      return result;
    },
    onSuccess: () => {
      setNewApiKey('');
      setShowApiKeyForm(false);
      setApiKeyError('');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => {
      setApiKeyError(err.message);
    },
  });

  // Save prompt template
  const saveTemplate = useMutation({
    mutationFn: (template: { id?: number; name: string; prompt: string }) =>
      invoke(IPC_CHANNELS.SETTINGS_SAVE_PROMPT_TEMPLATE, template),
    onSuccess: () => {
      setEditingTemplate(null);
      setNewTemplateName('');
      setNewTemplatePrompt('');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Delete prompt template
  const deleteTemplate = useMutation({
    mutationFn: (id: number) => invoke(IPC_CHANNELS.SETTINGS_DELETE_PROMPT_TEMPLATE, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  if (isLoading || !settings) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Storage Location */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Storage Location</h2>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={settings.storagePath}
            readOnly
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
          />
          <button
            onClick={() => changeStoragePath.mutate()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Change
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          This is where your projects, photos, and database are stored.
        </p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Claude API Key</h2>

        {!showApiKeyForm ? (
          <div className="flex items-center justify-between">
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  settings.hasApiKey
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {settings.hasApiKey ? 'Configured' : 'Not configured'}
              </span>
              {settings.hasApiKey && (
                <span className="ml-3 text-sm text-gray-500">sk-ant-•••••••</span>
              )}
            </div>
            <button
              onClick={() => setShowApiKeyForm(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {settings.hasApiKey ? 'Update' : 'Add API Key'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => {
                  setNewApiKey(e.target.value);
                  setApiKeyError('');
                }}
                placeholder="sk-ant-..."
                className={`w-full border rounded-lg px-3 py-2 ${
                  apiKeyError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {apiKeyError && <p className="text-red-600 text-sm mt-1">{apiKeyError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApiKeyForm(false);
                  setNewApiKey('');
                  setApiKeyError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => updateApiKey.mutate()}
                disabled={!newApiKey || updateApiKey.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {updateApiKey.isPending ? 'Validating...' : 'Save API Key'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Templates */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Templates</h2>
          <button
            onClick={() => setEditingTemplate({ id: 0, name: '', prompt: '', is_preset: 0, created_at: '' })}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            + Add Template
          </button>
        </div>

        {/* Template Form */}
        {editingTemplate && editingTemplate.id === 0 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-3">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <textarea
                value={newTemplatePrompt}
                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                placeholder="Evaluation criteria..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setNewTemplateName('');
                    setNewTemplatePrompt('');
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    saveTemplate.mutate({ name: newTemplateName, prompt: newTemplatePrompt })
                  }
                  disabled={!newTemplateName || !newTemplatePrompt}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="space-y-3">
          {settings.promptTemplates.map((template) => (
            <div
              key={template.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {template.name}
                    {template.is_preset ? (
                      <span className="ml-2 text-xs text-gray-500">(preset)</span>
                    ) : null}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{template.prompt}</p>
                </div>
                {!template.is_preset && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this template?')) {
                        deleteTemplate.mutate(template.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Photo Selector v1.0.0</p>
        <p className="mt-1">AI-powered photo selection tool</p>
      </div>
    </div>
  );
}
