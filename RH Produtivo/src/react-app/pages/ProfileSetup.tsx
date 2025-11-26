import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { UserCircle } from "lucide-react";
import type { UserRole, Department, Position } from "@/shared/types";

export default function ProfileSetup() {
  const { fetchUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("analista");
  const [positionId, setPositionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const response = await fetch("/api/users/me");
        const data = await response.json();
        setIsFirstUser(data.isFirstUser);
        
        const deptResponse = await fetch("/api/departments");
        const deptData = await deptResponse.json();
        setDepartments(deptData);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    checkFirstUser();
  }, []);

  useEffect(() => {
    const fetchPositions = async () => {
      if (!role) return;
      
      try {
        const response = await fetch(`/api/positions/by-role/${role}`);
        const data = await response.json();
        setPositions(data);
        setPositionId(""); // Reset position when role changes
      } catch (error) {
        console.error("Failed to fetch positions:", error);
      }
    };

    fetchPositions();
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          role,
          position_id: positionId ? parseInt(positionId) : null,
          department_id: parseInt(departmentId)
        }),
      });

      if (response.ok) {
        await fetchUser();
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to create profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <UserCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configure seu Perfil</h1>
            <p className="text-sm text-gray-600">
              {isFirstUser ? "Como primeiro usuário, você será automaticamente admin" : "Complete suas informações para começar"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="Digite seu nome"
            />
          </div>

          {!isFirstUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nível
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isFirstUser && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm font-medium text-purple-700">
                Como primeiro usuário, você receberá automaticamente o nível de C-Level
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cargo
            </label>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              disabled={!role || positions.length === 0}
            >
              <option value="">Selecione um cargo...</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
            {!isFirstUser && positions.length === 0 && role && (
              <p className="text-xs text-gray-500 mt-1">
                Nenhum cargo cadastrado para este nível
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            >
              <option value="">Selecione um departamento...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? "Salvando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
