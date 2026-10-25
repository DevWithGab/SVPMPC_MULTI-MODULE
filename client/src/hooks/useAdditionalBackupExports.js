import { useRef, useState } from "react";
import { backupAPI } from "../services/api";
import { BACKUP_COLLECTIONS, downloadCollectionCsv } from "../utils/moduleBackup";

export default function useAdditionalBackupExports(module, existingKeys) {
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
      if (!Array.isArray(backup?.[key])) throw new Error("The export response is missing this dataset. Please try again.");
      downloadCollectionCsv(backup[key], `${module}_${key}_backup_${new Date().toISOString().split("T")[0]}.csv`);
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
    additionalExports: BACKUP_COLLECTIONS[module]
      .filter(([key]) => !existingKeys.includes(key))
      .map(([key, label]) => ({
        label,
        count: counts[key] ?? "On export",
        download: () => download(key, label),
        disabled: activeKey !== null,
        loading: activeKey === key,
      })),
    individualExportError: error,
  };
}
