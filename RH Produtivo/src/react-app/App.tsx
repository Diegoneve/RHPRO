import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import HomePage from "@/react-app/pages/Home";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import DashboardPage from "@/react-app/pages/Dashboard";
import TasksPage from "@/react-app/pages/Tasks";
import ProfileSetupPage from "@/react-app/pages/ProfileSetup";
import TeamPage from "@/react-app/pages/Team";
import ProjectsPage from "@/react-app/pages/Projects";
import AdminUsersPage from "@/react-app/pages/AdminUsers";
import AdminDepartmentsPage from "@/react-app/pages/AdminDepartments";
import AdminSprintsPage from "@/react-app/pages/AdminSprints";
import AdminPositionsPage from "@/react-app/pages/AdminPositions";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/setup" element={<ProfileSetupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/sprints" element={<AdminSprintsPage />} />
          <Route path="/admin/positions" element={<AdminPositionsPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
