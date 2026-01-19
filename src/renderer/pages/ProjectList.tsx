import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from '../hooks/useIpc';
import type { ProjectWithStats } from '../../shared/types';

export default function ProjectList() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  const queryClient = useQueryClient();
  const { invoke } = useIpc();

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<ProjectWithStats[]>(IPC_CHANNELS.PROJECT_LIST),
  });

  // Create project
  const createProject = useMutation({
    mutationFn: (data: { name: string; prompt?: string }) =>
      invoke(IPC_CHANNELS.PROJECT_CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowNewProject(false);
      setNewProjectName('');
      setNewProjectPrompt('');
    },
  });

  // Delete project
  const deleteProject = useMutation({
    mutationFn: (id: number) => invoke(IPC_CHANNELS.PROJECT_DELETE, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowNewProject(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          New Project
        </button>
      </div>

      {/* New Project Form */}
      {showNewProject && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Hawaii Vacation 2024"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Evaluation Prompt (optional)
              </label>
              <textarea
                value={newProjectPrompt}
                onChange={(e) => setNewProjectPrompt(e.target.value)}
                placeholder="e.g., Prioritize candid moments and photos with all family members"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName('');
                  setNewProjectPrompt('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createProject.mutate({
                    name: newProjectName,
                    prompt: newProjectPrompt || undefined,
                  })
                }
                disabled={!newProjectName || createProject.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first project to start organizing and analyzing your photos.
          </p>
          <button
            onClick={() => setShowNewProject(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group"
            >
              <Link to={`/projects/${project.id}`} className="block p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {project.name}
                </h3>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <span>{project.photo_count} photos</span>
                  {project.selected_count > 0 && (
                    <span className="text-green-600">{project.selected_count} selected</span>
                  )}
                </div>

                {project.prompt && (
                  <p className="text-sm text-gray-600 line-clamp-2">{project.prompt}</p>
                )}

                {project.scored_count > 0 && project.photo_count > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Analyzed</span>
                      <span>
                        {project.scored_count} / {project.photo_count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(project.scored_count / project.photo_count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </Link>

              <div className="px-6 pb-4 flex justify-end">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                      deleteProject.mutate(project.id);
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
