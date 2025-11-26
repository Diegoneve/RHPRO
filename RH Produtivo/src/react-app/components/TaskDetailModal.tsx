import { useState, useEffect } from "react";
import { X, Calendar, User, TrendingUp, MessageSquare, Clock, Paperclip, Download, Loader2 } from "lucide-react";
import type { Task, TaskUpdate, TaskAttachment } from "@/shared/types";

interface TaskUpdateWithAttachments extends TaskUpdate {
  attachments?: TaskAttachment[];
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailModal({ task, onClose, onUpdate }: TaskDetailModalProps) {
  const [status, setStatus] = useState<string>(task.status);
  const [comment, setComment] = useState("");
  const [updates, setUpdates] = useState<TaskUpdateWithAttachments[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}/updates`);
        const data = await response.json();
        setUpdates(data);
      } catch (error) {
        console.error("Failed to fetch updates:", error);
      }
    };

    fetchUpdates();
  }, [task.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      const validFiles = files.filter(file => {
        if (file.size > maxSize) {
          alert(`O arquivo "${file.name}" excede o limite de 10MB e não pode ser anexado.`);
          return false;
        }
        return true;
      });
      
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    // Validate that assignee is set if trying to move to em_andamento
    if (status === "em_andamento" && !task.assignee_id) {
      alert("Não é possível iniciar uma tarefa sem responsável atribuído. Por favor, atribua um responsável primeiro.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });

      if (response.ok) {
        // Get the last update ID to attach files
        const updatesResponse = await fetch(`/api/tasks/${task.id}/updates`);
        const updatesData = await updatesResponse.json();
        const lastUpdate = updatesData[0];

        // Upload files if any
        if (selectedFiles.length > 0 && lastUpdate) {
          for (const file of selectedFiles) {
            setUploadProgress(prev => ({ ...prev, [file.name]: true }));
            
            const formData = new FormData();
            formData.append("file", file);
            formData.append("update_id", lastUpdate.id.toString());

            const uploadResponse = await fetch(`/api/tasks/${task.id}/attachments`, {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.json();
              alert(error.error || `Erro ao anexar ${file.name}`);
            }
            
            setUploadProgress(prev => ({ ...prev, [file.name]: false }));
          }
        }

        onUpdate();
      } else {
        const error = await response.json();
        alert(error.error || "Erro ao atualizar tarefa");
      }
    } catch (error) {
      console.error("Failed to update task:", error);
      alert("Erro ao atualizar tarefa");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (attachmentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Erro ao baixar anexo");
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOverdue = task.deadline && task.status !== "concluida" && task.status !== "nao_entregue" && new Date(task.deadline) < new Date();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{task.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Descrição</h3>
              <p className="text-gray-900">{task.description}</p>
            </div>
          )}

          {task.project_name && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-indigo-600">Projeto</p>
                  <p className="text-sm font-semibold text-indigo-900">{task.project_name}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {task.assignee_name && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <User className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Responsável</p>
                  <p className="text-sm font-medium text-gray-900">{task.assignee_name}</p>
                </div>
              </div>
            )}

            {task.deadline && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Calendar className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Prazo</p>
                  <p className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                    {formatDate(task.deadline)}
                  </p>
                </div>
              </div>
            )}

            {task.importance && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Importância</p>
                  <p className="text-sm font-medium text-gray-900">{getImportanceLabel(task.importance)}</p>
                </div>
              </div>
            )}

            {task.created_at && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Clock className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Criada em</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(task.created_at)}</p>
                </div>
              </div>
            )}
          </div>

          {task.notes && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-medium text-amber-900">Observações</h3>
              </div>
              <p className="text-sm text-amber-800">{task.notes}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Atualizar Status</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Novo Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="nao_entregue">Não Entregue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comentário *
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Descreva o andamento da tarefa..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anexar Documentos (máx. 10MB por arquivo)
              </label>
              <div className="mt-2">
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-600">Clique para anexar arquivos</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Paperclip className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">({formatFileSize(file.size)})</span>
                      </div>
                      {uploadProgress[file.name] ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex-shrink-0"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? "Atualizando..." : "Atualizar Tarefa"}
            </button>
          </form>

          {updates.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Atualizações</h3>
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">{update.user_name}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(update.created_at)}</p>
                    </div>
                    {update.status_before && update.status_after && (
                      <p className="text-xs text-gray-600 mb-2">
                        Status alterado de <span className="font-semibold">{getStatusLabel(update.status_before)}</span> para{" "}
                        <span className="font-semibold">{getStatusLabel(update.status_after)}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-700">{update.comment}</p>
                    
                    {update.attachments && update.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">Anexos:</p>
                        {update.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            onClick={() => handleDownload(attachment.id, attachment.filename)}
                            className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all w-full text-left"
                          >
                            <Paperclip className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            <span className="text-sm text-gray-900 truncate flex-1">{attachment.filename}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">({formatFileSize(attachment.file_size)})</span>
                            <Download className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
