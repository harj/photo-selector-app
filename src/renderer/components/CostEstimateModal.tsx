import type { CostEstimate } from '../../shared/types';

interface CostEstimateModalProps {
  estimate: CostEstimate;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export default function CostEstimateModal({
  estimate,
  onConfirm,
  onCancel,
  isLoading,
}: CostEstimateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Confirm AI Analysis
        </h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Photos to analyze</span>
              <p className="text-lg font-semibold text-gray-900">{estimate.photoCount}</p>
            </div>
            <div>
              <span className="text-gray-500">API batches</span>
              <p className="text-lg font-semibold text-gray-900">{estimate.batchCount}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="text-gray-500 text-sm">Estimated cost</span>
            <p className="text-2xl font-bold text-indigo-600">{estimate.formattedCost}</p>
            <p className="text-xs text-gray-500 mt-1">
              Based on Claude Sonnet pricing (~$3/M input, ~$15/M output tokens)
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          This will send your photo thumbnails to Claude's API for analysis.
          The actual cost may vary slightly based on response length.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>
      </div>
    </div>
  );
}
