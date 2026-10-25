import { useRef, useState } from "react";
import { backupAPI } from "../services/api";
import { BACKUP_COLLECTIONS, collectionBackup, downloadJson } from "../utils/moduleBackup";

export default function useBackupDatasetExports(module, loadedCounts = {}) {
  const [counts, setCounts] = useState({});
  const [activeKey, setActiveKey] = useState(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const download = async (key, label) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setActiveKey(key);
    setError("");
    try {
      const backup = await (module === "attendance" ? backupAPI.exportAttendance() : backupAPI.exportMortuary());
      const dataset = collectionBackup(backup, module, key);
      downloadJson(dataset, `${module}_${key}_backup_${new Date().toISOString().split("T")[0]}.json`);
      setCounts(Object.fromEntries(BACKUP_COLLECTIONS[module]
        .filter(([collection]) => Array.isArray(backup[collection]))
        .map(([collection]) => [collection, backup[collection].length])));
    } catch (cause) {
      setError(`${label}: ${cause.response?.data?.message || cause.message || "Unable to export records. Please try again."}`);
    } finally {
      inFlight.current = false;
      setActiveKey(null);
    }
  };

  return {
    datasetExports: BACKUP_COLLECTIONS[module]
      .map(([key, label]) => ({
        label,
        count: counts[key] ?? loadedCounts[key] ?? "On export",
        download: () => download(key, label),
        disabled: activeKey !== null,
        loading: activeKey === key,
      })),
    individualExportError: error,
  };
}
