import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Users, Plus, Edit2, Loader2 } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import type { UserProfile, UserRole, Department, Position } from "@/shared/types";

export default function AdminUsers() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    mocha_user_id: "",
    name: "",
    role: "analista" as UserRole,
    position: "",
    department_id: "",
    manager_id: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  const fetchData = async () => {
    try {
      const [usersResponse, deptResponse, profilesResponse, meResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/departments"),
        fetch("/api/profiles"),
        fetch("/api/users/me"),
      ]);

      if (usersResponse.status === 403) {
        navigate("/dashboard");
        return;
      }

      const meData = await meResponse.json();
      if (!meData.profile) {
        navigate("/setup");
        return;
      }

      const usersData = await usersResponse.json();
      const deptData = await deptResponse.json();
      const profilesData = await profilesResponse.json();

      setUsers(usersData);
      setDepartments(deptData);
      setManagers(profilesData.filter((p: UserProfile) => 
        ["c-level", "gerencia", "coordenacao", "supervisao"].includes(p.role)
      ));
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

  useEffect(() => {
    const fetchPositionsByRole = async () => {
      if (formData.role) {
        try {
          const response = await fetch(`/api/positions/by-role/${formData.role}`);
          const data = await response.json();
          setPositions(data);
        } catch (error) {
          console.error("Failed to fetch positions:", error);
        }
      }
    };

    if (isModalOpen) {
      fetchPositionsByRole();
    }
  }, [formData.role, isModalOpen]);

  const roles: { value: UserRole; label: string }[] = [
    { value: "c-level", label: "C-Level" },
    { value: "gerencia", label: "Gerência" },
    { value: "coordenacao", label: "Coordenação" },
    { value: "supervisao", label: "Supervisão" },
    { value: "analista", label: "Analista" },
    { value: "assistente", label: "Assistente" },
    { value: "auxiliar", label: "Auxiliar" },
    { value: "estagiario", label: "Estagiário" },
  ];

  const getRoleLabel = (role: string) => {
    const roleObj = roles.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  };

  const handleOpenModal = async (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        mocha_user_id: user.mocha_user_id,
        name: user.name,
        role: user.role,
        position: user.position || "",
        department_id: user.department_id?.toString() || "",
        manager_id: user.manager_id?.toString() || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        mocha_user_id: "",
        name: "",
        role: "analista",
        position: "",
        department_id: "",
        manager_id: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingUser && { mocha_user_id: formData.mocha_user_id }),
          name: formData.name,
          role: formData.role,
          position: formData.position || null,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          manager_id: formData.manager_id ? parseInt(formData.manager_id) : null,
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPending || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Novo Usuário
          </button>
        </div>
        <p className="text-gray-600">Gerencie todos os usuários do sistema</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Nome</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Nível</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Cargo</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Departamento</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Gestor</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Criado em</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.mocha_user_id}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{user.position || "-"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{user.department_name || "-"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{user.manager_name || "-"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum usuário encontrado</h3>
            <p className="text-gray-600">Comece criando o primeiro usuário do sistema.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
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
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Digite o nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nível *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargo
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Selecione um cargo...</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.name}>
                      {pos.name}
                    </option>
                  ))}
                </select>
                {positions.length === 0 && formData.role && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum cargo cadastrado para este nível. Cadastre cargos em "Gestão de Cargos".
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento *
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Selecione...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gestor Direto
                </label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Selecione...</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} - {getRoleLabel(manager.role)}
                    </option>
                  ))}
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
                  {isSubmitting ? "Salvando..." : editingUser ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
