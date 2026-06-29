import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from "lucide-react";
import api from "../../services/api";

const fetchReminders = async () => {
  const { data } = await api.get("/tax/reminders");
  return data.data;
};

const TaxReminderBanner = ({ onNavigateToCell }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["tax-reminders"],
    queryFn: fetchReminders,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return null;
  
  const upcoming = reminders?.upcoming || [];
  const overdue = reminders?.overdue || [];
  
  if (upcoming.length === 0 && overdue.length === 0) return null;

  return (
    <div className="bg-white border shadow-sm rounded-xl border-slate-200 overflow-hidden mb-6">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Pengingat Jatuh Tempo Pajak
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Anda memiliki <span className="text-red-500 font-bold">{overdue.length} terlambat</span> dan <span className="text-amber-600 font-bold">{upcoming.length} mendekati</span> jatuh tempo.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {overdue.length > 0 && (
              <span className="px-2.5 py-1 text-xs font-bold text-white bg-red-500 rounded-full">
                {overdue.length} Terlambat
              </span>
            )}
            {upcoming.length > 0 && (
              <span className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-100 rounded-full">
                {upcoming.length} Mendekati
              </span>
            )}
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          
          {overdue.length > 0 && (
            <div className="mb-6">
              <h4 className="flex items-center gap-2 mb-3 text-xs font-bold text-red-600 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" /> Terlambat
              </h4>
              <div className="grid gap-2">
                {overdue.map((item) => (
                  <ReminderCard key={item.id} item={item} onNavigate={onNavigateToCell} isOverdue={true} />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 mb-3 text-xs font-bold text-amber-600 uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Mendekati Jatuh Tempo
              </h4>
              <div className="grid gap-2">
                {upcoming.map((item) => (
                  <ReminderCard key={item.id} item={item} onNavigate={onNavigateToCell} isOverdue={false} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-[10px] text-slate-400 text-center italic">
            * Tanggal jatuh tempo adalah estimasi internal. Selalu verifikasi dengan ketentuan DJP/Pemda terbaru.
          </div>
        </div>
      )}
    </div>
  );
};

const ReminderCard = ({ item, onNavigate, isOverdue }) => {
  const dateStr = new Date(item.dueDate).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });

  return (
    <div 
      onClick={() => onNavigate(item.taxType, item.obligationId, item.period)}
      className={`p-3 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-all flex items-center justify-between group
        ${isOverdue ? 'border-red-200 hover:border-red-400' : 'border-amber-200 hover:border-amber-400'}`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-slate-800 text-sm">{item.clientName}</span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded">
            {item.taxType}
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 rounded">
            {item.period}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
            Jatuh Tempo: {dateStr}
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">PIC: {item.picName || "Unassigned"}</span>
        </div>
        {item.needsReview && (
          <div className="mt-1 text-[10px] text-red-500 font-semibold italic flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Tanggal due-date pajak ini perlu direview manual
          </div>
        )}
      </div>
      <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
        <ExternalLink className="w-4 h-4" />
      </div>
    </div>
  );
}

export default TaxReminderBanner;
