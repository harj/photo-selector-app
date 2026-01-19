import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { Photo } from '../../shared/types';

interface PhotoCardProps {
  photo: Photo;
  projectId: number;
  selected: boolean;
  onToggleSelect: () => void;
  showGroupBadge?: boolean;
  groupSize?: number;
}

export default function PhotoCard({
  photo,
  projectId,
  selected,
  onToggleSelect,
  showGroupBadge = false,
  groupSize = 1,
}: PhotoCardProps) {
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const { invoke } = useIpc();

  // Load thumbnail
  useEffect(() => {
    invoke<string | null>(IPC_CHANNELS.PHOTO_THUMBNAIL, photo.id).then(setThumbnailSrc);
  }, [photo.id, invoke]);

  return (
    <div className="relative group">
      {/* Clickable thumbnail */}
      <Link
        to={`/projects/${projectId}/photos/${photo.id}`}
        className="block"
      >
        <div
          className={`aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all relative ${
            showGroupBadge && groupSize > 1 ? 'ring-4 ring-purple-400' : ''
          }`}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={photo.original_filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}

          {/* Group indicator overlay */}
          {showGroupBadge && groupSize > 1 && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-8 pb-2 px-2">
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center space-x-1.5 text-white text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{groupSize} similar</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* View group link */}
      {showGroupBadge && groupSize > 1 && (
        <Link
          to={`/projects/${projectId}/photos/${photo.id}/group`}
          className="absolute top-2 left-2 bg-white/90 hover:bg-white text-purple-700 text-xs px-2 py-1 rounded-md font-medium shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <span>View all</span>
        </Link>
      )}

      {/* Info */}
      <div className="mt-2">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Select</span>
        </label>

        {photo.score !== null && (
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              Score: {photo.score}/10
            </span>
          </div>
        )}

        {photo.ai_comment && (
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">{photo.ai_comment}</p>
        )}
      </div>
    </div>
  );
}
