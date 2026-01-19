import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS, useIpcListener } from '../hooks/useIpc';
import type { Project, Photo, UploadProgress, AnalysisProgress, CostEstimate, Settings } from '../../shared/types';
import PhotoCard from '../components/PhotoCard';
import CostEstimateModal from '../components/CostEstimateModal';

type ViewMode = 'all' | 'grouped';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id!, 10);
  const queryClient = useQueryClient();
  const { invoke } = useIpc();

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [maxScoreFilter, setMaxScoreFilter] = useState<number>(10);

  // Fetch settings to check API key status
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => invoke<Settings>(IPC_CHANNELS.SETTINGS_GET),
  });

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => invoke<Project>(IPC_CHANNELS.PROJECT_GET, projectId),
  });

  // Fetch photos
  const { data: allPhotos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['photos', projectId],
    queryFn: () => invoke<Photo[]>(IPC_CHANNELS.PHOTOS_LIST, projectId),
  });

  // Filter photos based on view mode and score range
  const hasScoreFilter = minScoreFilter > 0 || maxScoreFilter < 10;
  const filteredByScore = hasScoreFilter
    ? allPhotos.filter(p => p.score !== null && p.score >= minScoreFilter && p.score <= maxScoreFilter)
    : allPhotos;

  const photos = viewMode === 'grouped'
    ? getGroupedPhotos(filteredByScore)
    : filteredByScore;

  // Count groups
  const groupCount = new Set(allPhotos.filter(p => p.similarity_group_id).map(p => p.similarity_group_id)).size;

  // Initialize selected photos from database
  useState(() => {
    const selected = new Set(allPhotos.filter(p => p.selected).map(p => p.id));
    setSelectedPhotos(selected);
  });

  // Listen for progress updates
  useIpcListener(IPC_CHANNELS.UPLOAD_PROGRESS, useCallback((progress: unknown) => {
    setUploadProgress(progress as UploadProgress);
  }, []));

  useIpcListener(IPC_CHANNELS.ANALYZE_PROGRESS, useCallback((progress: unknown) => {
    setAnalysisProgress(progress as AnalysisProgress);
  }, []));

  // Upload photos
  const uploadPhotos = useMutation({
    mutationFn: async () => {
      const filePaths = await invoke<string[]>(IPC_CHANNELS.DIALOG_SELECT_FILES);
      if (filePaths.length === 0) return null;

      setUploadProgress({ current: 0, total: filePaths.length, filename: '' });
      return invoke(IPC_CHANNELS.PHOTOS_UPLOAD, { projectId, filePaths });
    },
    onSuccess: () => {
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
    },
    onError: () => {
      setUploadProgress(null);
    },
  });

  // Analyze photos
  const analyzePhotos = useMutation({
    mutationFn: () => invoke<number>(IPC_CHANNELS.ANALYZE_PHOTOS, projectId),
    onSuccess: () => {
      setAnalysisProgress(null);
      setShowCostModal(false);
      setAnalysisError(null);
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
    },
    onError: (error: Error) => {
      setAnalysisProgress(null);
      setAnalysisError(error.message || 'Analysis failed');
    },
  });

  // Estimate cost
  const estimateCost = useMutation({
    mutationFn: () => invoke<CostEstimate>(IPC_CHANNELS.ANALYZE_ESTIMATE_COST, projectId),
    onSuccess: (data) => {
      setCostEstimate(data);
      setShowCostModal(true);
    },
  });

  // Group similar photos
  const [groupingError, setGroupingError] = useState<string | null>(null);
  const [groupingSuccess, setGroupingSuccess] = useState<string | null>(null);
  const groupSimilar = useMutation({
    mutationFn: () => invoke<number>(IPC_CHANNELS.GROUP_SIMILAR, projectId),
    onSuccess: (groupsCreated) => {
      setGroupingError(null);
      setGroupingSuccess(groupsCreated > 0
        ? `Found ${groupsCreated} groups of similar photos`
        : 'No similar photos found');
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
      // Auto-clear success message after 5 seconds
      setTimeout(() => setGroupingSuccess(null), 5000);
    },
    onError: (error: Error) => {
      setGroupingError(error.message || 'Grouping failed');
      setGroupingSuccess(null);
    },
  });

  // Clear groups
  const clearGroups = useMutation({
    mutationFn: () => invoke(IPC_CHANNELS.GROUP_CLEAR, projectId),
    onSuccess: () => {
      setGroupingSuccess(null);
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
    },
  });

  // Update selection
  const updateSelection = useMutation({
    mutationFn: ({ photoIds, selected }: { photoIds: number[]; selected: boolean }) =>
      invoke(IPC_CHANNELS.PHOTOS_UPDATE_SELECTION, { photoIds, selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
    },
  });

  // Export selected
  const exportSelected = useMutation({
    mutationFn: () => invoke<{ count: number; skipped: number; exportPath: string }>(IPC_CHANNELS.PHOTOS_EXPORT, projectId),
    onSuccess: (data) => {
      let message = `Exported ${data.count} photos to:\n${data.exportPath}`;
      if (data.skipped > 0) {
        message += `\n\n${data.skipped} RAW/HEIC files were skipped (cannot be converted to JPEG).`;
      }
      alert(message);
    },
  });

  // Toggle photo selection
  const togglePhotoSelection = (photoId: number) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
    updateSelection.mutate({
      photoIds: [photoId],
      selected: newSelected.has(photoId),
    });
  };

  if (projectLoading || photosLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-red-600">Project not found</div>
      </div>
    );
  }

  const unscoredCount = allPhotos.filter(p => p.score === null).length;
  const selectedCount = allPhotos.filter(p => p.selected).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to Projects
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.name}</h1>
        {project.prompt && (
          <p className="text-gray-600">{project.prompt}</p>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Photos</h2>
            <p className="text-sm text-gray-500">
              {allPhotos.length} photos in project
            </p>
          </div>
          <button
            onClick={() => uploadPhotos.mutate()}
            disabled={uploadPhotos.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Select Photos
          </button>
        </div>

        {uploadProgress && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between text-sm text-blue-700 mb-1">
              <span>Uploading {uploadProgress.filename}</span>
              <span>{uploadProgress.current} / {uploadProgress.total}</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Section */}
      {allPhotos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Analysis</h2>
              <p className="text-sm text-gray-500">
                {unscoredCount > 0
                  ? `Score ${unscoredCount} photos based on quality, composition, and your prompt criteria`
                  : 'All photos scored and ready for selection'}
              </p>
            </div>
            {unscoredCount > 0 ? (
              settings?.hasApiKey ? (
                <button
                  onClick={() => {
                    setAnalysisError(null);
                    estimateCost.mutate();
                  }}
                  disabled={estimateCost.isPending || analyzePhotos.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Analyze Photos
                </button>
              ) : (
                <Link
                  to="/settings"
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add API Key to Analyze
                </Link>
              )
            ) : (
              <span className="text-green-600 font-medium">Complete</span>
            )}
          </div>

          {!settings?.hasApiKey && unscoredCount > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>API Key Required:</strong> To analyze photos with AI, add your Anthropic API key in{' '}
                <Link to="/settings" className="underline font-medium">Settings</Link>.
              </p>
            </div>
          )}

          {analysisError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {analysisError}
              </p>
            </div>
          )}

          {analysisProgress && (
            <div className="mt-4 bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-indigo-700 mb-2">{analysisProgress.message}</p>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Similarity Grouping Section */}
      {allPhotos.some(p => p.score !== null) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Similarity Grouping</h2>
              <p className="text-sm text-gray-500">
                {groupSimilar.isPending
                  ? 'Analyzing photos for visual similarity...'
                  : groupCount > 0
                    ? `${groupCount} groups of similar photos found`
                    : 'Find duplicate and similar photos to help you pick the best shot'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {groupCount > 0 && !groupSimilar.isPending && (
                <button
                  onClick={() => clearGroups.mutate()}
                  disabled={clearGroups.isPending}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Clear Groups
                </button>
              )}
              <button
                onClick={() => {
                  setGroupingError(null);
                  setGroupingSuccess(null);
                  groupSimilar.mutate();
                }}
                disabled={groupSimilar.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {groupSimilar.isPending ? 'Analyzing...' : groupCount > 0 ? 'Re-run Grouping' : 'Find Similar Photos'}
              </button>
            </div>
          </div>

          {groupingSuccess && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">
                <strong>Complete:</strong> {groupingSuccess}
              </p>
              <button
                onClick={() => setGroupingSuccess(null)}
                className="text-green-600 hover:text-green-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {groupingError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {groupingError}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Photo Grid */}
      {allPhotos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Grid Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Photos ({photos.length}{hasScoreFilter && ` of ${allPhotos.length}`})
                {selectedCount > 0 && (
                  <span className="text-gray-500 font-normal ml-2">
                    • {selectedCount} selected
                  </span>
                )}
              </h2>

              {/* View Toggle */}
              {groupCount > 0 && (
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  <button
                    onClick={() => setViewMode('all')}
                    className={`px-3 py-1 text-sm font-medium ${
                      viewMode === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Photos
                  </button>
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={`px-3 py-1 text-sm font-medium ${
                      viewMode === 'grouped'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Grouped View
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Score Range Filter - Elegant Design */}
              <div className="relative flex items-center gap-3">
                <div className="flex items-center bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
                  <span className="text-xs uppercase tracking-wide text-gray-400 mr-3">Score</span>
                  <div className="flex items-center">
                    <span className={`text-lg font-semibold w-8 text-right tabular-nums ${hasScoreFilter ? 'text-blue-600' : 'text-gray-400'}`}>
                      {minScoreFilter}
                    </span>
                    <div className="relative mx-3 w-32 h-6 flex items-center">
                      {/* Track background */}
                      <div className="absolute left-0 right-0 h-2 bg-gray-200 rounded-full" />
                      {/* Active range highlight */}
                      <div
                        className="absolute h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{
                          left: `${minScoreFilter * 10}%`,
                          width: `${(maxScoreFilter - minScoreFilter) * 10}%`
                        }}
                      />
                      {/* Min slider */}
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={minScoreFilter}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinScoreFilter(val);
                          if (val > maxScoreFilter) setMaxScoreFilter(val);
                        }}
                        className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.2)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:border-blue-700 [&::-webkit-slider-thumb]:transition-all"
                      />
                      {/* Max slider */}
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={maxScoreFilter}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMaxScoreFilter(val);
                          if (val < minScoreFilter) setMinScoreFilter(val);
                        }}
                        className="absolute w-full h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.2)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:border-indigo-700 [&::-webkit-slider-thumb]:transition-all"
                      />
                    </div>
                    <span className={`text-lg font-semibold w-8 tabular-nums ${hasScoreFilter ? 'text-blue-600' : 'text-gray-400'}`}>
                      {maxScoreFilter}
                    </span>
                  </div>
                  {hasScoreFilter && (
                    <button
                      onClick={() => { setMinScoreFilter(0); setMaxScoreFilter(10); }}
                      className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Reset filter"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons - Pill Style */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const photosToSelect = photos.filter(p => !selectedPhotos.has(p.id));
                    if (photosToSelect.length === 0) return;

                    const newSelected = new Set(selectedPhotos);
                    photosToSelect.forEach(p => newSelected.add(p.id));
                    setSelectedPhotos(newSelected);

                    // Batch update in database
                    invoke(IPC_CHANNELS.PHOTOS_UPDATE_SELECTION, {
                      photoIds: photosToSelect.map(p => p.id),
                      selected: true
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
                    });
                  }}
                  disabled={photos.length === 0}
                  className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Select All
                  <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full text-xs">{photos.length}</span>
                </button>

                {selectedCount > 0 && (
                  <button
                    onClick={() => {
                      const photosToDeselect = photos.filter(p => selectedPhotos.has(p.id));
                      if (photosToDeselect.length === 0) return;

                      const newSelected = new Set(selectedPhotos);
                      photosToDeselect.forEach(p => newSelected.delete(p.id));
                      setSelectedPhotos(newSelected);

                      // Batch update in database
                      invoke(IPC_CHANNELS.PHOTOS_UPDATE_SELECTION, {
                        photoIds: photosToDeselect.map(p => p.id),
                        selected: false
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['photos', projectId] });
                      });
                    }}
                    className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                )}

                <button
                  onClick={() => exportSelected.mutate()}
                  disabled={selectedCount === 0 || exportSelected.isPending}
                  className="inline-flex items-center gap-1.5 bg-violet-600 text-white hover:bg-violet-700 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export
                  {selectedCount > 0 && (
                    <span className="bg-violet-500 px-1.5 py-0.5 rounded-full text-xs">{selectedCount}</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {hasScoreFilter && (
            <p className="text-sm text-blue-600 mb-2">
              Showing {photos.length} photos with score {minScoreFilter} - {maxScoreFilter} (filtered from {allPhotos.length} total)
            </p>
          )}

          {viewMode === 'grouped' && (
            <p className="text-sm text-gray-500 mb-4">
              Showing best photo from each group. Click the group badge to see all similar photos.
            </p>
          )}

          {/* Photo Grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  projectId={projectId}
                  selected={selectedPhotos.has(photo.id)}
                  onToggleSelect={() => togglePhotoSelection(photo.id)}
                  showGroupBadge={viewMode === 'grouped' && (photo.similarity_group_id ?? 0) > 0}
                  groupSize={getGroupSize(allPhotos, photo)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No photos in this score range</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting the filter to {minScoreFilter} - {maxScoreFilter}
              </p>
              <button
                onClick={() => { setMinScoreFilter(0); setMaxScoreFilter(10); }}
                className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos yet</h3>
          <p className="text-gray-500">Upload photos to get started with AI analysis.</p>
        </div>
      )}

      {/* Cost Estimate Modal */}
      {showCostModal && costEstimate && (
        <CostEstimateModal
          estimate={costEstimate}
          onConfirm={() => analyzePhotos.mutate()}
          onCancel={() => setShowCostModal(false)}
          isLoading={analyzePhotos.isPending}
        />
      )}
    </div>
  );
}

// Helper: Get best photo from each group + ungrouped photos
function getGroupedPhotos(photos: Photo[]): Photo[] {
  const groupedMap = new Map<number, Photo[]>();
  const ungrouped: Photo[] = [];

  for (const photo of photos) {
    if (photo.similarity_group_id) {
      const group = groupedMap.get(photo.similarity_group_id) || [];
      group.push(photo);
      groupedMap.set(photo.similarity_group_id, group);
    } else {
      ungrouped.push(photo);
    }
  }

  // Get best from each group (highest score)
  const bestFromGroups: Photo[] = [];
  for (const group of groupedMap.values()) {
    const best = group.reduce((a, b) =>
      (a.score ?? -1) > (b.score ?? -1) ? a : b
    );
    bestFromGroups.push(best);
  }

  return [...bestFromGroups, ...ungrouped].sort((a, b) =>
    (b.score ?? -1) - (a.score ?? -1)
  );
}

// Helper: Get group size for a photo
function getGroupSize(photos: Photo[], photo: Photo): number {
  if (!photo.similarity_group_id) return 1;
  return photos.filter(p => p.similarity_group_id === photo.similarity_group_id).length;
}
