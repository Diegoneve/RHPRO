import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { LayoutDashboard, CheckCircle, Clock, AlertCircle, TrendingUp, Loader2, Calendar, Filter } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import type { Task, Project } from "@/shared/types";

export default function Dashboard() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodicity, setPeriodicity] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/users/me");
        const data = await response.json();
        
        if (!data.profile) {
          navigate("/setup");
          return;
        }

        const [tasksResponse, projectsResponse] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/projects/active"),
        ]);
        
        const tasksData = await tasksResponse.json();
        const projectsData = await projectsResponse.json();
        
        setTasks(tasksData);
        setActiveProjects(projectsData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

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

  const getFilteredTasks = () => {
    let filtered = tasks;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = tasks.filter(t => {
        if (!t.created_at) return false;
        const taskDate = new Date(t.created_at);
        return taskDate >= start && taskDate <= end;
      });
    } else {
      const now = new Date();
      let startPeriod = new Date();

      if (periodicity === "daily") {
        startPeriod.setHours(0, 0, 0, 0);
      } else if (periodicity === "weekly") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startPeriod = new Date(now.setDate(diff));
        startPeriod.setHours(0, 0, 0, 0);
      } else if (periodicity === "monthly") {
        startPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      filtered = tasks.filter(t => {
        if (!t.created_at) return false;
        const taskDate = new Date(t.created_at);
        return taskDate >= startPeriod;
      });
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === "concluida").length;
  const inProgressTasks = filteredTasks.filter(t => t.status === "em_andamento").length;
  const notDeliveredTasks = filteredTasks.filter(t => t.status === "nao_entregue").length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const upcomingTasks = tasks
    .filter(t => t.status !== "concluida" && t.status !== "nao_entregue" && t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <p className="text-gray-600">Visão geral da sua produtividade</p>
      </div>

      {activeProjects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Projetos Ativos</h2>
          <div className="grid gap-4">
            {activeProjects.map((project) => (
              <div key={project.id} className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80 mb-1">Projeto em Andamento</p>
                      <h2 className="text-2xl font-bold">{project.name}</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white/80 mb-1">Período</p>
                    <p className="text-lg font-semibold">
                      {new Date(project.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - {new Date(project.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros de Progresso</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periodicidade</label>
            <select
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as "daily" | "weekly" | "monthly")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            >
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{totalTasks}</span>
          </div>
          <p className="text-sm font-medium text-gray-600">Total de Tarefas</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{completedTasks}</span>
          </div>
          <p className="text-sm font-medium text-gray-600">Concluídas</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{inProgressTasks}</span>
          </div>
          <p className="text-sm font-medium text-gray-600">Em Andamento</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{notDeliveredTasks}</span>
          </div>
          <p className="text-sm font-medium text-gray-600">Não Entregues</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Taxa de Conclusão</h2>
          </div>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-100">
                  Progresso
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-indigo-600">
                  {completionRate}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-indigo-100">
              <div
                style={{ width: `${completionRate}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Você concluiu <span className="font-semibold text-gray-900">{completedTasks}</span> de{" "}
            <span className="font-semibold text-gray-900">{totalTasks}</span> tarefas
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Próximos Prazos</h2>
          </div>
          <div className="space-y-3">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nenhuma tarefa com prazo próximo</p>
            ) : (
              upcomingTasks.map((task) => {
                const deadline = new Date(task.deadline!);
                const isOverdue = deadline < new Date();
                const daysUntil = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {isOverdue ? "Atrasado" : daysUntil === 0 ? "Hoje" : daysUntil === 1 ? "Amanhã" : `${daysUntil} dias`}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${isOverdue ? "bg-red-500" : "bg-amber-500"}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
