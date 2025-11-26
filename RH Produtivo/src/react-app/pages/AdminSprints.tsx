import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { FolderKanban, Plus, Edit2, Loader2, ListTodo } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import TaskList from "@/react-app/components/TaskList";
import CreateTaskModal from "@/react-app/components/CreateTaskModal";
import type { Project, Task, UserProfile } from "@/shared/types";

interface ProjectWithStats extends Project {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  open_tasks: number;
  not_delivered_tasks: number;
}

export default function AdminProjects() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    status: "em_andamento",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  const fetchData = async () => {
    try {
      const [projectsResponse, profilesResponse, meResponse] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/profiles"),
        fetch("/api/users/me"),
      ]);

      const meData = await meResponse.json();
      if (!meData.profile) {
        navigate("/setup");
        return;
      }

      if (meData.profile.role !== "c-level" && meData.profile.role !== "gerencia") {
        navigate("/dashboard");
        return;
      }

      const projectsData = await projectsResponse.json();
      const profilesData = await profilesResponse.json();

      setProjects(projectsData);
      setProfiles(profilesData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, navigate]);

  const fetchProjectTasks = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await response.json();
      setProjectTasks(data);
    } catch (error) {
      console.error("Failed to fetch project tasks:", error);
    }
  };

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        start_date: project.start_date,
        end_date: project.end_date,
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        status: "em_andamento",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingProject 
        ? `/api/projects/${editingProject.id}` 
        : "/api/projects";
      const method = editingProject ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewTasks = (project: Project) => {
    setSelectedProject(project);
    fetchProjectTasks(project.id);
  };

  if (isPending || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    return status === "em_andamento" ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Em Andamento
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
        Encerrado
      </span>
    );
  };

  return (
    <DashboardLayout>
      {!selectedProject ? (
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Gestão de Projetos</h1>
              </div>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Novo Projeto
              </button>
            </div>
            <p className="text-gray-600">Gerencie os projetos e suas tarefas</p>
          </div>

          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                      {getStatusBadge(project.status)}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4" />
                        <span>
                          {new Date(project.start_date).toLocaleDateString("pt-BR")} -{" "}
                          {new Date(project.end_date).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    {project.total_tasks > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              {project.completed_tasks} concluídas
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              {project.in_progress_tasks} em andamento
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              {project.open_tasks} abertas
                            </span>
                            {project.not_delivered_tasks > 0 && (
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                {project.not_delivered_tasks} não entregues
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-indigo-600">
                            {Math.round((project.completed_tasks / project.total_tasks) * 100)}%
                          </span>
                        </div>
                        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${(project.completed_tasks / project.total_tasks) * 100}%` }}
                            className="absolute h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                          />
                          <div
                            style={{
                              width: `${(project.in_progress_tasks / project.total_tasks) * 100}%`,
                              left: `${(project.completed_tasks / project.total_tasks) * 100}%`,
                            }}
                            className="absolute h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                          />
                          <div
                            style={{
                              width: `${(project.open_tasks / project.total_tasks) * 100}%`,
                              left: `${((project.completed_tasks + project.in_progress_tasks) / project.total_tasks) * 100}%`,
                            }}
                            className="absolute h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                          />
                          <div
                            style={{
                              width: `${(project.not_delivered_tasks / project.total_tasks) * 100}%`,
                              left: `${((project.completed_tasks + project.in_progress_tasks + project.open_tasks) / project.total_tasks) * 100}%`,
                            }}
                            className="absolute h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleViewTasks(project)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <ListTodo className="w-4 h-4" />
                      Ver Tarefas
                    </button>
                    <button
                      onClick={() => handleOpenModal(project)}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
              <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum projeto encontrado</h3>
              <p className="text-gray-600">Comece criando o primeiro projeto para organizar suas tarefas.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-8">
            <button
              onClick={() => setSelectedProject(null)}
              className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center gap-2"
            >
              ← Voltar para Projetos
            </button>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{selectedProject.name}</h1>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedProject.start_date).toLocaleDateString("pt-BR")} -{" "}
                    {new Date(selectedProject.end_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Nova Tarefa
              </button>
            </div>
          </div>

          <TaskList
            tasks={projectTasks}
            onTaskUpdate={() => fetchProjectTasks(selectedProject.id)}
          />
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProject ? "Editar Projeto" : "Novo Projeto"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Projeto *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: Projeto Q1 2025"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Fim *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="em_andamento">Em Andamento</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? "Salvando..." : editingProject ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTaskModalOpen && selectedProject && (
        <CreateTaskModal
          profiles={profiles}
          projectId={selectedProject.id}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={() => {
            setIsTaskModalOpen(false);
            fetchProjectTasks(selectedProject.id);
          }}
        />
      )}
    </DashboardLayout>
  );
}
