import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { ApiKeyValidationResult } from '../../shared/types';

export default function Setup() {
  const [step, setStep] = useState(1);
  const [storagePath, setStoragePath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invoke } = useIpc();

  // Select storage folder
  const selectFolder = async () => {
    const result = await invoke<string | null>(IPC_CHANNELS.SETTINGS_SET_STORAGE_PATH);
    if (result) {
      setStoragePath(result);
    }
  };

  // Validate and save API key
  const saveApiKey = useMutation({
    mutationFn: async () => {
      const result = await invoke<ApiKeyValidationResult>(
        IPC_CHANNELS.SETTINGS_SET_API_KEY,
        apiKey
      );
      if (!result.success) {
        throw new Error(result.error || 'Invalid API key');
      }
      return result;
    },
    onSuccess: () => {
      setError('');
      setStep(3);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Complete setup
  const completeSetup = useMutation({
    mutationFn: () => invoke<boolean>(IPC_CHANNELS.SETTINGS_COMPLETE_SETUP),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['isConfigured'] });
      navigate('/');
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      s < step ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Welcome & Storage */}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Photo Selector
            </h1>
            <p className="text-gray-600 mb-6">
              Let's get you set up. First, choose where to store your photos and projects.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={storagePath || '~/PhotoSelector (default)'}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                />
                <button
                  onClick={selectFolder}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Browse
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                This is where your photos, thumbnails, and exports will be saved.
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Continue
            </button>
          </>
        )}

        {/* Step 2: API Key */}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Connect to Claude
            </h1>
            <p className="text-gray-600 mb-6">
              Enter your Anthropic API key to enable AI photo analysis.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                placeholder="sk-ant-..."
                className={`w-full border rounded-lg px-3 py-2 ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}

              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Get an API key from Anthropic Console →
              </a>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => saveApiKey.mutate()}
                disabled={!apiKey || saveApiKey.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveApiKey.isPending ? 'Validating...' : 'Validate & Continue'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                You're All Set!
              </h1>
              <p className="text-gray-600">
                Photo Selector is ready to use. Create your first project to get started.
              </p>
            </div>

            <button
              onClick={() => completeSetup.mutate()}
              disabled={completeSetup.isPending}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Start Using Photo Selector
            </button>
          </>
        )}
      </div>
    </div>
  );
}
