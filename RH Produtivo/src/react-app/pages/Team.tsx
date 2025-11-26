import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Users, TrendingUp, Loader2 } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import type { UserProfile } from "@/shared/types";

interface TeamStats {
  assignee_id: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  open_tasks: number;
  overdue_tasks: number;
}

export default function Team() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<TeamStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meResponse = await fetch("/api/users/me");
        const meData = await meResponse.json();

        if (!meData.profile) {
          navigate("/setup");
          return;
        }

        const analyticsResponse = await fetch("/api/analytics/team");
        const analyticsData = await analyticsResponse.json();

        setTeamMembers(analyticsData.team || []);
        setStats(analyticsData.stats || []);
      } catch (error) {
        console.error("Failed to fetch team data:", error);
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

  const getStatsForMember = (memberId: number) => {
    return stats.find(s => s.assignee_id === memberId);
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      "c-level": "C-Level",
      "gerencia": "Gerência",
      "coordenacao": "Coordenação",
      "supervisao": "Supervisão",
      "analista": "Analista",
      "assistente": "Assistente",
      "auxiliar": "Auxiliar",
      "estagiario": "Estagiário",
    };
    return roleMap[role] || role;
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Equipe</h1>
        </div>
        <p className="text-gray-600">Acompanhe o desempenho da sua equipe</p>
      </div>

      {teamMembers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum membro na equipe</h3>
          <p className="text-gray-600">
            Você ainda não tem colaboradores diretos cadastrados no sistema.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {teamMembers.map((member) => {
            const memberStats = getStatsForMember(member.id);
            const completionRate = memberStats && memberStats.total_tasks > 0
              ? Math.round((memberStats.completed_tasks / memberStats.total_tasks) * 100)
              : 0;

            return (
              <div key={member.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{getRoleLabel(member.role)}</span>
                      {member.department_name && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-600">{member.department_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-xl">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span className="text-lg font-bold text-indigo-600">{completionRate}%</span>
                  </div>
                </div>

                {memberStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-2xl font-bold text-gray-900">{memberStats.total_tasks}</p>
                      <p className="text-xs text-gray-600 mt-1">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <p className="text-2xl font-bold text-green-600">{memberStats.completed_tasks}</p>
                      <p className="text-xs text-gray-600 mt-1">Concluídas</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-xl">
                      <p className="text-2xl font-bold text-amber-600">{memberStats.in_progress_tasks}</p>
                      <p className="text-xs text-gray-600 mt-1">Em Andamento</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <p className="text-2xl font-bold text-blue-600">{memberStats.open_tasks}</p>
                      <p className="text-xs text-gray-600 mt-1">Abertas</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-xl">
                      <p className="text-2xl font-bold text-red-600">{memberStats.overdue_tasks}</p>
                      <p className="text-xs text-gray-600 mt-1">Atrasadas</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhuma tarefa atribuída</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
