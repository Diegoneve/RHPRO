import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { LayoutDashboard, ListTodo, Users, LogOut, UserCog, Building, Calendar, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import AssistantChat from "@/react-app/components/AssistantChat";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/users/me");
        const data = await response.json();
        setUserProfile(data.profile);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isAdmin = userProfile?.role === "c-level" || userProfile?.role === "gerencia";
  const isLeader = userProfile?.role === "c-level" || userProfile?.role === "gerencia" || 
                   userProfile?.role === "coordenacao" || userProfile?.role === "supervisao";
  const isOperational = userProfile?.role === "analista" || userProfile?.role === "assistente" || 
                        userProfile?.role === "auxiliar" || userProfile?.role === "estagiario";

  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: ListTodo, label: "Tarefas", path: "/tasks" },
  ];

  const leaderNavItems = [
    { icon: Users, label: "Equipe", path: "/team" },
  ];

  const operationalNavItems = [
    { icon: Calendar, label: "Projetos", path: "/projects" },
  ];

  const navItems = [
    ...baseNavItems,
    ...(isLeader ? leaderNavItems : []),
    ...(isOperational ? operationalNavItems : []),
  ];

  const adminItems = [
    { icon: UserCog, label: "Usuários", path: "/admin/users" },
    { icon: Building, label: "Departamentos", path: "/admin/departments" },
    { icon: Briefcase, label: "Cargos", path: "/admin/positions" },
    { icon: Calendar, label: "Projetos", path: "/admin/sprints" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <nav className="bg-white/70 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                RH Produtivo
              </h1>
              <div className="hidden md:flex items-center gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = window.location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        isActive
                          ? "bg-indigo-100 text-indigo-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
                
                {isAdmin && (
                  <>
                    <div className="w-px h-6 bg-gray-300 mx-2" />
                    {adminItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = window.location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? "bg-purple-100 text-purple-700"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.google_user_data?.name || user?.email}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <AssistantChat />

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isActive ? "text-indigo-600" : "text-gray-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          
          {isAdmin && adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isActive ? "text-purple-600" : "text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
