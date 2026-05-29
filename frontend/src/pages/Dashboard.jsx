import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { motion } from "framer-motion";
import TaxTracker from "../components/Tax/TaxTracker";
import ToDoList from "../components/ToDoList";
import HistoryLogViewer from "../components/HistoryLogViewer";
import { LogOut, LayoutDashboard, CheckSquare, History } from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("TAX");

  const tabs = [
    { id: "TAX", label: "Tracking Pajak", icon: LayoutDashboard },
    { id: "TODO", label: "To-Do List", icon: CheckSquare },
    { id: "HISTORY", label: "Audit Log", icon: History },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 font-sans text-slate-800"
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-200">
              C
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Catat Susun Lapor
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-900">{user?.name || "User"}</span>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">{user?.role}</span>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-8 shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-out
                  ${isActive 
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="mt-4">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "TAX" && <TaxTracker />}
            {activeTab === "TODO" && <ToDoList />}
            {activeTab === "HISTORY" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Jejak Rekam Sistem</h3>
                  <p className="text-sm text-slate-500">
                    Memantau semua perubahan status yang dilakukan oleh staf dan atasan.
                  </p>
                </div>
                <HistoryLogViewer />
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
};

export default Dashboard;
