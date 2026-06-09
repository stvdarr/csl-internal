import { Client } from "../models/index.js";
import { normalizeName } from "../utils/normalize.js";

export const findOrCreateClientByName = async (name, transaction) => {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeName(cleanName);

  if (!normalizedName) {
    throw new Error("Nama klien wajib diisi");
  }

  const [client] = await Client.findOrCreate({
    where: { normalizedName },
    defaults: {
      name: cleanName,
      normalizedName,
    },
    transaction,
  });

  return client;
};
