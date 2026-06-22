import { useQuery } from "@tanstack/react-query";
import { X, Building2, UserCircle, Briefcase, FileText } from "lucide-react";
import api from "../../services/api";

const ClientTaxOverviewModal = ({ isOpen, onClose, clientId, clientName }) => {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["tax-clients", clientId],
    queryFn: async () => {
      const { data } = await api.get("/tax/clients");
      return data.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  // If specific client selected, filter. Otherwise show all (or adapt as needed).
  // Assuming the user clicked a specific client name, we filter:
  const clientData = clients.find(c => c.name === clientName || c.id === clientId);

  const getMappedTaxTypes = (obligations) => {
    return obligations.map(obl => {
      const completedPeriods = obl.TaxPeriods?.filter(p => p.status === 'COMPLETED').length || 0;
      const totalPeriods = obl.TaxPeriods?.length || 0;
      const pendingPeriods = totalPeriods - completedPeriods;
      return {
        taxType: obl.taxType,
        frequency: obl.frequency,
        pic: obl.User?.name || 'No PIC',
        completedPeriods,
        pendingPeriods,
        totalPeriods
      };
    });
  };

  const mappedTaxTypes = clientData ? getMappedTaxTypes(clientData.obligations) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Overview Pajak Klien
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
          {isLoading ? (
            <div className="flex justify-center p-10 text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
          ) : !clientData ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-xl shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Tidak ada data obligasi pajak untuk klien ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <UserCircle className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">{clientData.name}</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" /> Total {mappedTaxTypes.length} Jenis Pajak Aktif
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mappedTaxTypes.map((tax) => (
                  <div key={tax.taxType} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          {tax.taxType}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {tax.frequency}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 uppercase">
                        PIC: {tax.pic.split(" ")[0]}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Selesai</div>
                        <div className="text-sm font-black text-emerald-600">{tax.completedPeriods}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Tertunda</div>
                        <div className="text-sm font-black text-amber-500">{tax.pendingPeriods}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Total</div>
                        <div className="text-sm font-black text-slate-700">{tax.totalPeriods}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientTaxOverviewModal;
