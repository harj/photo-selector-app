import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { Photo, Project } from '../../shared/types';

export default function SimilarGroup() {
  const { projectId, photoId } = useParams<{ projectId: string; photoId: string }>();
  const { invoke } = useIpc();

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => invoke<Project>(IPC_CHANNELS.PROJECT_GET, parseInt(projectId!, 10)),
  });

  // Fetch group photos
  const { data: groupPhotos = [], isLoading } = useQuery({
    queryKey: ['photoGroup', photoId],
    queryFn: () => invoke<Photo[]>(IPC_CHANNELS.PHOTO_GROUP, parseInt(photoId!, 10)),
  });

  // Determine best photo in group
  const bestPhoto = groupPhotos.length > 0
    ? groupPhotos.reduce((a, b) => (a.score ?? -1) > (b.score ?? -1) ? a : b)
    : null;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          to={`/projects/${projectId}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to Project
        </Link>
      </div>

      {/* Group Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Similar Photos
          <span className="text-gray-500 font-normal ml-2">
            ({groupPhotos.length} photos)
          </span>
        </h1>
        <p className="text-gray-600 mt-2">
          These photos were identified as similar by AI. The best photo in the group is highlighted.
        </p>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {groupPhotos.map((photo) => (
          <GroupPhotoCard
            key={photo.id}
            photo={photo}
            projectId={parseInt(projectId!, 10)}
            isBest={photo.id === bestPhoto?.id}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex space-x-4">
          {bestPhoto && (
            <Link
              to={`/projects/${projectId}/photos/${bestPhoto.id}`}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md"
            >
              View Best Photo
            </Link>
          )}
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md"
          >
            Back to All Photos
          </Link>
        </div>
      </div>
    </div>
  );
}

function GroupPhotoCard({
  photo,
  projectId,
  isBest,
}: {
  photo: Photo;
  projectId: number;
  isBest: boolean;
}) {
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const { invoke } = useIpc();

  useEffect(() => {
    invoke<string | null>(IPC_CHANNELS.PHOTO_THUMBNAIL, photo.id).then(setThumbnailSrc);
  }, [photo.id, invoke]);

  return (
    <div className={`relative ${isBest ? 'ring-4 ring-green-500 rounded-lg' : ''}`}>
      {/* Clickable thumbnail */}
      <Link to={`/projects/${projectId}/photos/${photo.id}`} className="block">
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
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
        </div>
      </Link>

      {/* Best in Group Badge */}
      {isBest && (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
          Best in Group
        </div>
      )}

      {/* Photo Info */}
      <div className="mt-3">
        {photo.score !== null && (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
              {photo.score}/10
            </span>
            {photo.selected ? (
              <span className="text-green-600 text-sm">Selected</span>
            ) : null}
          </div>
        )}
        {photo.ai_comment && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-3">{photo.ai_comment}</p>
        )}
      </div>
    </div>
  );
}
