import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { Photo } from '../../shared/types';

export default function PhotoDetail() {
  const { projectId, photoId } = useParams<{ projectId: string; photoId: string }>();
  const queryClient = useQueryClient();
  const { invoke } = useIpc();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isOriginal, setIsOriginal] = useState(true);

  // Fetch photo
  const { data: photo, isLoading } = useQuery({
    queryKey: ['photo', photoId],
    queryFn: () => invoke<Photo>(IPC_CHANNELS.PHOTO_GET, parseInt(photoId!, 10)),
  });

  // Load image
  useEffect(() => {
    if (!photo) return;

    // Try to load original first
    invoke<string | null>(IPC_CHANNELS.PHOTO_ORIGINAL, photo.id).then((original) => {
      if (original) {
        setImageSrc(original);
        setIsOriginal(true);
      } else {
        // Fall back to thumbnail for RAW files
        invoke<string | null>(IPC_CHANNELS.PHOTO_THUMBNAIL, photo.id).then((thumb) => {
          setImageSrc(thumb);
          setIsOriginal(false);
        });
      }
    });
  }, [photo, invoke]);

  // Delete photo
  const deletePhoto = useMutation({
    mutationFn: () => invoke(IPC_CHANNELS.PHOTOS_DELETE, parseInt(photoId!, 10)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      window.history.back();
    },
  });

  // Get group size
  const { data: groupPhotos = [] } = useQuery({
    queryKey: ['photoGroup', photoId],
    queryFn: () => invoke<Photo[]>(IPC_CHANNELS.PHOTO_GROUP, parseInt(photoId!, 10)),
    enabled: !!photo?.similarity_group_id,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-red-600">Photo not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <div className="mb-6 flex justify-between items-center">
        <Link
          to={`/projects/${projectId}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to Project
        </Link>

        {photo.similarity_group_id && groupPhotos.length > 1 && (
          <Link
            to={`/projects/${projectId}/photos/${photoId}/group`}
            className="text-purple-600 hover:text-purple-800 font-medium"
          >
            View {groupPhotos.length} similar photos →
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Photo Display */}
        <div
          className="bg-gray-900 flex items-center justify-center p-4 relative"
          style={{ minHeight: '60vh' }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={photo.original_filename}
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="text-gray-400 text-lg">Loading image...</div>
          )}

          {!isOriginal && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                Showing thumbnail (original is RAW format)
              </span>
            </div>
          )}
        </div>

        {/* Photo Details */}
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            {/* Score */}
            <div>
              {photo.score !== null ? (
                <>
                  <div className="flex items-center space-x-3">
                    <span className="text-4xl font-bold text-gray-900">{photo.score}</span>
                    <span className="text-2xl text-gray-500">/ 10</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">AI Score</p>
                </>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                  Not yet analyzed
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {photo.similarity_group_id && groupPhotos.length > 1 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  Part of group ({groupPhotos.length} photos)
                </span>
              )}

              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this photo?')) {
                    deletePhoto.mutate();
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                Delete Photo
              </button>
            </div>
          </div>

          {/* AI Comment */}
          {photo.ai_comment && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Analysis</h3>
              <p className="text-gray-700 leading-relaxed">{photo.ai_comment}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Details</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Filename</dt>
                <dd className="text-gray-900">{photo.original_filename}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Uploaded</dt>
                <dd className="text-gray-900">
                  {new Date(photo.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              {photo.file_size && (
                <div>
                  <dt className="text-gray-500">File Size</dt>
                  <dd className="text-gray-900">
                    {(photo.file_size / 1024 / 1024).toFixed(2)} MB
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Selected for Export</dt>
                <dd className="text-gray-900">{photo.selected ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
