import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { ListTodo, Plus, Loader2 } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import TaskList from "@/react-app/components/TaskList";
import CreateTaskModal from "@/react-app/components/CreateTaskModal";
import type { Task, UserProfile } from "@/shared/types";

export default function Tasks() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "aberta" | "em_andamento" | "concluida" | "nao_entregue">("all");

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksResponse, profilesResponse, meResponse] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/profiles"),
          fetch("/api/users/me"),
        ]);

        const tasksData = await tasksResponse.json();
        const profilesData = await profilesResponse.json();
        const meData = await meResponse.json();

        if (!meData.profile) {
          navigate("/setup");
          return;
        }

        setTasks(tasksData);
        setProfiles(profilesData);
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

  const filteredTasks = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <ListTodo className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Tarefas</h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Nova Tarefa
          </button>
        </div>
        <p className="text-gray-600">Gerencie todas as suas atividades</p>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            filter === "all"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Todas ({tasks.length})
        </button>
        <button
          onClick={() => setFilter("aberta")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            filter === "aberta"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Abertas ({tasks.filter(t => t.status === "aberta").length})
        </button>
        <button
          onClick={() => setFilter("em_andamento")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            filter === "em_andamento"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Em Andamento ({tasks.filter(t => t.status === "em_andamento").length})
        </button>
        <button
          onClick={() => setFilter("concluida")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            filter === "concluida"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Concluídas ({tasks.filter(t => t.status === "concluida").length})
        </button>
        <button
          onClick={() => setFilter("nao_entregue")}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            filter === "nao_entregue"
              ? "bg-indigo-600 text-white shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Não Entregues ({tasks.filter(t => t.status === "nao_entregue").length})
        </button>
      </div>

      <TaskList tasks={filteredTasks} onTaskUpdate={fetchTasks} />

      {isModalOpen && (
        <CreateTaskModal
          profiles={profiles}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchTasks();
          }}
        />
      )}
    </DashboardLayout>
  );
}
