import { useEffect, useState, useMemo, useContext } from "react";
import {
  STATUS_HOTKEYS,
  STATUS_LABELS,
  VALID_TRANSITIONS,
} from "../../constants/taskStatus";
import { AuthContext } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import {
  User as UserIcon,
  Loader2,
  Check,
  X,
  LayoutDashboard,
} from "lucide-react";
import ClientTaxOverviewModal from "./ClientTaxOverviewModal";

const TaxMatrixView = ({ taxes, obligations, activeTab, onStatusChange }) => {
  const { user: currentUser } = useContext(AuthContext);
  const isAdmin = currentUser?.role === "Admin";
  const queryClient = useQueryClient();

  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [editingPic, setEditingPic] = useState(null); // { obligationId }
  const [overviewClient, setOverviewClient] = useState(null); // { clientId, clientName }

  // Fetch staff list for dropdown (only if admin)
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await api.get("/auth/staff");
      return data.data;
    },
    enabled: isAdmin,
  });

  const parsePeriod = (p) => {
    const yearMatch = p.match(/\d{4}/);
    const year = yearMatch ? Number.parseInt(yearMatch[0]) : 0;

    let month = 0;
    let quarter = 0;
    const mStr = p.toUpperCase();

    if (mStr.includes("- 1") || mStr.includes("Q1")) quarter = 1;
    else if (mStr.includes("- 2") || mStr.includes("Q2")) quarter = 2;
    else if (mStr.includes("- 3") || mStr.includes("Q3")) quarter = 3;
    else if (mStr.includes("- 4") || mStr.includes("Q4")) quarter = 4;
    else if (mStr.includes("JAN")) month = 1;
    else if (mStr.includes("FEB")) month = 2;
    else if (mStr.includes("MAR")) month = 3;
    else if (mStr.includes("APR")) month = 4;
    else if (mStr.includes("MEI") || mStr.includes("MAY")) month = 5;
    else if (mStr.includes("JUN")) month = 6;
    else if (mStr.includes("JUL")) month = 7;
    else if (mStr.includes("AGU") || mStr.includes("AUG")) month = 8;
    else if (mStr.includes("SEP")) month = 9;
    else if (mStr.includes("OKT") || mStr.includes("OCT")) month = 10;
    else if (mStr.includes("NOV")) month = 11;
    else if (mStr.includes("DES") || mStr.includes("DEC")) month = 12;

    return { year, quarter, month };
  };

  const { uniquePeriods, matrixData, obligationKeys } = useMemo(() => {
    let periods = [...new Set(taxes.map((t) => t.period))].sort((a, b) => {
      const dateA = parsePeriod(a);
      const dateB = parsePeriod(b);
      if (dateA.year !== dateB.year) return dateA.year - dateB.year;
      if (dateA.quarter !== dateB.quarter) return dateA.quarter - dateB.quarter;
      return dateA.month - dateB.month;
    });

    // Fallback if no periods exist but obligations do
    if (periods.length === 0) {
      if (activeTab === "1771 BADAN" || activeTab === "1770 OP") {
        periods = ["TAHUNAN"];
      } else {
        periods = [
          "JAN",
          "FEB",
          "MAR",
          "APR",
          "MEI",
          "JUN",
          "JUL",
          "AGU",
          "SEP",
          "OKT",
          "NOV",
          "DES",
        ];
      }
    }

    // First build period map by obligationId
    const periodMap = {};
    taxes.forEach((tax) => {
      const obligationId = tax.TaxObligation.id;
      if (!periodMap[obligationId]) periodMap[obligationId] = {};
      periodMap[obligationId][tax.period] = {
        id: tax.id,
        status: tax.status,
      };
    });

    // Now build matrix from obligations
    const mData = {};
    obligations.forEach((obligation) => {
      const clientName = obligation.Client?.name;
      if (!clientName) return;
      mData[obligation.id] = {
        obligationId: obligation.id,
        clientName,
        clientId: obligation.clientId,
        pic: obligation.User?.name || "No PIC",
        picId: obligation.pic_id,
        data: periodMap[obligation.id] || {},
      };
    });

    // Sort obligations by client name
    const sortedObligationKeys = Object.keys(mData).sort((a, b) => {
      return mData[a].clientName.localeCompare(mData[b].clientName);
    });

    return {
      uniquePeriods: periods,
      matrixData: mData,
      obligationKeys: sortedObligationKeys,
    };
  }, [taxes, obligations]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (obligationKeys.length === 0) return;
      if (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA"
      )
        return;

      let { row, col } = activeCell;
      let handled = false;

      if (e.key === "ArrowUp") {
        row = Math.max(0, row - 1);
        handled = true;
      } else if (e.key === "ArrowDown") {
        row = Math.min(obligationKeys.length - 1, row + 1);
        handled = true;
      } else if (e.key === "ArrowLeft") {
        col = Math.max(0, col - 1);
        handled = true;
      } else if (e.key === "ArrowRight") {
        col = Math.min(uniquePeriods.length - 1, col + 1);
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        setActiveCell({ row, col });
        return;
      }

      const currentObligationId = obligationKeys[activeCell.row];
      const currentPeriod = uniquePeriods[activeCell.col];
      if (currentObligationId && currentPeriod) {
        const cellData = matrixData[currentObligationId].data[currentPeriod];
        if (cellData) {
          const key = e.key.toLowerCase();
          const hotkeys = STATUS_HOTKEYS;
          if (hotkeys[key] && cellData.status !== hotkeys[key]) {
            onStatusChange({ id: cellData.id, newStatus: hotkeys[key] });
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCell, matrixData, obligationKeys, uniquePeriods, onStatusChange]);

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500 text-white border-emerald-600";
      case "PAID":
      case "FILED":
        return "bg-blue-600 text-white border-blue-700";
      case "NOT_STARTED":
        return "bg-slate-50 text-slate-400 border-slate-200 shadow-none";
      case "BLOCKED":
        return "bg-red-500 text-white border-red-600";
      default:
        return "bg-amber-400 text-amber-900 border-amber-500";
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-3 text-[11px] font-semibold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm inline-flex items-center gap-4 w-fit">
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            Arrows
          </span>{" "}
          Navigasi
        </span>
        <span className="w-px h-4 bg-slate-300"></span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            O
          </span>{" "}
          Selesai
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            B
          </span>{" "}
          Dibayar
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            K
          </span>{" "}
          Tunggu Klien
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            T
          </span>{" "}
          TTD
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300">
            R
          </span>{" "}
          Review
        </span>
      </div>

      <div className="pb-6 overflow-x-auto bg-white border shadow-sm border-slate-200 rounded-xl custom-scrollbar">
        <table className="w-full text-xs text-left bg-white border-collapse select-none">
          <thead className="font-bold tracking-wider uppercase bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 sticky left-0 bg-slate-50 z-30 min-w-[200px] border-b border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                Nama Klien
              </th>
              <th className="px-3 py-3 border-b border-r border-slate-200 text-center w-[70px]">
                PIC
              </th>
              {uniquePeriods.map((period) => (
                <th
                  key={period}
                  className="px-2 py-3 text-center border-b border-r border-slate-200 min-w-[90px] text-[10px] text-slate-500"
                >
                  {period.replace(" ", "\n")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {obligationKeys.length === 0 ? (
              <tr>
                <td
                  colSpan={uniquePeriods.length + 2}
                  className="px-6 py-16 font-medium text-center text-slate-400"
                >
                  Matriks {activeTab} Kosong. Silakan Upload Excel Laporan
                  Bulanan.
                </td>
              </tr>
            ) : (
              obligationKeys.map((obligationId, rowIndex) => {
                const obligationInfo = matrixData[obligationId];
                return (
                  <tr
                    key={obligationId}
                    className="transition-colors hover:bg-slate-50/50 group"
                  >
                    <td
                      className="sticky left-0 z-20 transition-colors bg-white group-hover:bg-slate-50"
                      onClick={() =>
                        setOverviewClient({
                          clientId: obligationInfo.clientId,
                          clientName: obligationInfo.clientName,
                        })
                      }
                    >
                      <div className="px-4 py-2 flex items-center h-full gap-2 font-bold text-slate-800 whitespace-nowrap cursor-pointer hover:text-blue-600 transition-colors shadow-[1px_0_0_0_#e2e8f0] border-r border-slate-200">
                        {obligationInfo.clientName}
                        <LayoutDashboard className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-r border-slate-100">
                      {isAdmin ? (
                        <div className="relative flex justify-center">
                          {editingPic?.obligationId ===
                          obligationInfo.obligationId ? (
                            <div className="absolute z-50 top-0 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[150px]">
                              <select
                                className="w-full text-[10px] p-1 border rounded mb-2"
                                defaultValue={obligationInfo.picId || ""}
                                onChange={async (e) => {
                                  const toUserId = e.target.value;
                                  if (toUserId) {
                                    await api.put(
                                      `/tax/obligations/${obligationInfo.obligationId}/assign`,
                                      {
                                        toUserId,
                                        reason: "Change from matrix row",
                                      },
                                    );
                                    queryClient.invalidateQueries(["taxes"]);
                                    queryClient.invalidateQueries([
                                      "tax-obligations",
                                    ]);
                                    setEditingPic(null);
                                  }
                                }}
                              >
                                <option value="">Pilih PIC...</option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => setEditingPic(null)}
                                className="w-full text-[9px] text-red-500 font-bold hover:underline"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setEditingPic({
                                  obligationId: obligationInfo.obligationId,
                                })
                              }
                              className="uppercase font-bold text-blue-600 text-[10px] bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors border border-blue-100"
                            >
                              {obligationInfo.pic.split(" ")[0]}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="uppercase font-bold text-slate-500 text-[10px] bg-slate-100 px-2 py-1 rounded">
                          {obligationInfo.pic.split(" ")[0]}
                        </span>
                      )}
                    </td>
                    {uniquePeriods.map((period, colIndex) => {
                      const cellData = obligationInfo.data[period];
                      const isActive =
                        activeCell.row === rowIndex &&
                        activeCell.col === colIndex;

                      return (
                        <td
                          key={period}
                          onClick={() =>
                            setActiveCell({ row: rowIndex, col: colIndex })
                          }
                          onDoubleClick={() => {
                            if (cellData && cellData.status !== "COMPLETED") {
                              const allowed =
                                VALID_TRANSITIONS[cellData.status] || [];
                              if (allowed.includes("COMPLETED")) {
                                onStatusChange({
                                  id: cellData.id,
                                  newStatus: "COMPLETED",
                                });
                              }
                            }
                          }}
                          className={`p-1 border-r border-slate-100 cursor-cell relative transition-all duration-75 group/cell
                            ${isActive ? "bg-blue-50 z-10 shadow-[inset_0_0_0_2px_#3b82f6]" : ""}
                          `}
                        >
                          {cellData ? (
                            <div className="relative">
                              <div
                                className={`w-full py-1.5 font-bold rounded-md text-center border shadow-sm text-[10px] tracking-wide ${getStatusColor(cellData.status)}`}
                              >
                                {STATUS_LABELS[cellData.status] ||
                                  cellData.status}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full py-1.5 text-center text-slate-300 font-bold">
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ClientTaxOverviewModal
        isOpen={!!overviewClient}
        onClose={() => setOverviewClient(null)}
        clientId={overviewClient?.clientId}
        clientName={overviewClient?.clientName}
      />
    </div>
  );
};

export default TaxMatrixView;
