import { useState } from "react";
import { Calendar, User, TrendingUp, MessageSquare } from "lucide-react";
import TaskDetailModal from "@/react-app/components/TaskDetailModal";
import type { Task } from "@/shared/types";

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: () => void;
}

export default function TaskList({ tasks, onTaskUpdate }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aberta":
        return "bg-blue-100 text-blue-700";
      case "em_andamento":
        return "bg-amber-100 text-amber-700";
      case "concluida":
        return "bg-green-100 text-green-700";
      case "nao_entregue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aberta":
        return "Aberta";
      case "em_andamento":
        return "Em Andamento";
      case "concluida":
        return "Concluída";
      case "nao_entregue":
        return "Não Entregue";
      default:
        return status;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "alta":
        return "bg-red-100 text-red-700";
      case "media":
        return "bg-yellow-100 text-yellow-700";
      case "baixa":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getImportanceLabel = (importance: string) => {
    switch (importance) {
      case "alta":
        return "Alta";
      case "media":
        return "Média";
      case "baixa":
        return "Baixa";
      default:
        return importance;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
        <p className="text-gray-500">Nenhuma tarefa encontrada</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {tasks.map((task) => {
          const isOverdue = task.deadline && task.status !== "concluida" && task.status !== "nao_entregue" && new Date(task.deadline) < new Date();
          
          return (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                  )}
                </div>
                {task.importance && (
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full ml-4 ${getImportanceColor(task.importance)}`}>
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs font-semibold">{getImportanceLabel(task.importance)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-600">
                {task.assignee_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{task.assignee_name}</span>
                  </div>
                )}
                {task.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                      {formatDate(task.deadline)}
                      {isOverdue && " (Atrasada)"}
                    </span>
                  </div>
                )}
                {task.notes && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Observações</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            setSelectedTask(null);
            onTaskUpdate();
          }}
        />
      )}
    </>
  );
}
