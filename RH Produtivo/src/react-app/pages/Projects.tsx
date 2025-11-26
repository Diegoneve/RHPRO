import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { FolderKanban, Loader2 } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import type { Project } from "@/shared/types";

interface ProjectWithStats extends Project {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  open_tasks: number;
  not_delivered_tasks: number;
}

export default function Projects() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  const fetchData = async () => {
    try {
      const [projectsResponse, meResponse] = await Promise.all([
        fetch("/api/projects/user"),
        fetch("/api/users/me"),
      ]);

      const meData = await meResponse.json();
      if (!meData.profile) {
        navigate("/setup");
        return;
      }

      const projectsData = await projectsResponse.json();
      setProjects(projectsData);
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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Projetos</h1>
        </div>
        <p className="text-gray-600">Visualize os projetos em que você está envolvido</p>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
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
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
          <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum projeto encontrado</h3>
          <p className="text-gray-600">Você ainda não está vinculado a nenhum projeto.</p>
        </div>
      )}
    </DashboardLayout>
  );
}
