import { sequelize, TaxTrack } from "../models/index.js";
import { findOrCreateClientByName } from "./clientService.js";
import { normalizeName } from "../utils/normalize.js";

const BATCH_SIZE = 500;

export const backfillTaxClients = async () => {
  const legacyTaxes = await TaxTrack.findAll({
    where: { clientId: null },
    attributes: ["id", "clientName"],
  });

  if (legacyTaxes.length === 0) return 0;

  const clientMap = {};
  const uniqueNames = [
    ...new Set(
      legacyTaxes
        .map((tax) => tax.clientName)
        .filter((name) => String(name || "").trim()),
    ),
  ];

  await sequelize.transaction(async (transaction) => {
    for (const name of uniqueNames) {
      const client = await findOrCreateClientByName(name, transaction);
      clientMap[normalizeName(name)] = client;
    }
  });

  for (let i = 0; i < legacyTaxes.length; i += BATCH_SIZE) {
    const chunk = legacyTaxes.slice(i, i + BATCH_SIZE);

    await sequelize.transaction(async (transaction) => {
      await Promise.all(
        chunk.map(async (tax) => {
          const normalizedKey = normalizeName(tax.clientName);
          const client = clientMap[normalizedKey];
          if (!client) return;

          await TaxTrack.update(
            { clientId: client.id, clientName: client.name },
            { where: { id: tax.id }, transaction },
          );
        }),
      );
    });
  }

  return legacyTaxes.length;
};
