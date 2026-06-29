import { useState, useEffect, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import WorkloadCard from "./WorkloadCard";
import WorkloadBreakdown from "./WorkloadBreakdown";
import PerformanceHistory from "./PerformanceHistory";
import { Loader2 } from "lucide-react";
import { socket } from "../../services/socket";

const WorkloadDashboard = () => {
  const { user: currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [selectedPic, setSelectedPic] = useState(null); // { userId, userName }

  const { data: workloadData, isLoading } = useQuery({
    queryKey: ["workload-current"],
    queryFn: async () => {
      const { data } = await api.get("/workload/current");
      return data.data;
    },
  });

  useEffect(() => {
    const handleWorkloadUpdate = () => {
      // Invalidate both current and history to keep UI fresh
      queryClient.invalidateQueries(["workload-current"]);
      queryClient.invalidateQueries(["workload-history"]);
      if (selectedPic) {
        queryClient.invalidateQueries([
          "workload-breakdown",
          selectedPic.userId,
        ]);
      }
    };

    socket.on("WORKLOAD_UPDATED", handleWorkloadUpdate);

    return () => {
      socket.off("WORKLOAD_UPDATED", handleWorkloadUpdate);
    };
  }, [queryClient, selectedPic]);

  return (
    <div className="flex flex-col gap-8 p-2 mx-auto max-w-7xl">
      {/* Current Workload Section */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-black text-slate-800">
            Beban Kerja Aktif
          </h2>
          <p className="mt-1 text-slate-500">
            Pantau distribusi pekerjaan yang belum mencapai status akhir
            (COMPLETED/APPROVED).
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 bg-white border rounded-xl border-slate-200">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {workloadData?.map((workload, idx) => (
              <WorkloadCard
                key={workload.user?.id || `unassigned-${idx}`}
                workload={workload}
                onClick={() => {
                  if (workload.user?.id) {
                    setSelectedPic({
                      userId: workload.user.id,
                      userName: workload.user.name,
                    });
                  }
                }}
              />
            ))}
            {workloadData?.length === 0 && (
              <div className="py-12 italic text-center bg-white border col-span-full text-slate-500 rounded-xl border-slate-200">
                Tidak ada data beban kerja.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Historical Performance Section */}
      <section>
        <PerformanceHistory currentUser={currentUser} />
      </section>

      <WorkloadBreakdown
        isOpen={!!selectedPic}
        onClose={() => setSelectedPic(null)}
        userId={selectedPic?.userId}
        userName={selectedPic?.userName}
      />
    </div>
  );
};

export default WorkloadDashboard;
