import React from "react";
import { User, Briefcase } from "lucide-react";

const getCapacityColor = (capacity) => {
  switch (capacity) {
    case "Low":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Normal":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "High":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Overloaded":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const WorkloadCard = ({ workload, onClick }) => {
  const { user, totalActive, taxCount, todoCount, capacity } = workload;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-4 group"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
            {user ? <User size={20} /> : <Briefcase size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
              {user ? user.name : "Belum di-assign"}
            </h3>
            <p className="text-xs text-slate-500">
              {user ? user.role : "No PIC"}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${getCapacityColor(
            capacity
          )}`}
        >
          {capacity}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center py-2">
        <div className="text-4xl font-black text-slate-800">{totalActive}</div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
          Tugas Aktif
        </div>
      </div>

      <div className="flex gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
        <div className="flex-1 text-center border-r border-slate-200 last:border-0">
          <span className="block font-bold text-slate-800">{taxCount}</span>
          Tax
        </div>
        <div className="flex-1 text-center">
          <span className="block font-bold text-slate-800">{todoCount}</span>
          ToDo
        </div>
      </div>
    </div>
  );
};

export default WorkloadCard;
