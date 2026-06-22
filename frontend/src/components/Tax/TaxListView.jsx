import { ChevronDown } from "lucide-react";
import { TASK_STATUSES } from "../../constants/taskStatus";

const TaxListView = ({ taxes, activeTab, onStatusChange }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "PAID":
      case "FILED": return "bg-blue-100 text-blue-800 border-blue-200";
      case "NOT_STARTED": return "bg-slate-100 text-slate-600 border-slate-200";
      case "BLOCKED": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
      <table className="w-full border-collapse bg-white text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4">Klien</th>
            <th className="px-6 py-4">Periode</th>
            <th className="px-6 py-4">Nominal</th>
            <th className="px-6 py-4">PIC</th>
            <th className="px-6 py-4 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {taxes.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                Data {activeTab} masih kosong.
              </td>
            </tr>
          ) : (
            taxes.map((tax) => (
              <tr key={tax.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4 font-bold text-slate-900">
                  {tax.TaxObligation?.Client?.name}
                </td>
                <td className="px-6 py-4 font-semibold text-slate-700">
                  {tax.period}
                </td>
                <td className="px-6 py-4 font-mono font-medium text-slate-700">
                  Rp {Number(tax.amount).toLocaleString("id-ID")}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 rounded-md">
                    {tax.TaxObligation?.User?.name || "No PIC"}
                  </span>
                </td>
                <td className="px-6 py-4 text-center relative">
                  <div className="relative inline-block w-32">
                    <select
                      value={tax.status}
                      onChange={(e) => onStatusChange({ id: tax.id, newStatus: e.target.value })}
                      className={`appearance-none w-full text-xs font-bold rounded-lg px-3 py-2 pr-8 outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors border shadow-sm cursor-pointer ${getStatusColor(tax.status)}`}
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaxListView;
