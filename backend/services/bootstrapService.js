import { TaxTrack } from "../models/index.js";
import { findOrCreateClientByName } from "./clientService.js";

export const backfillTaxClients = async () => {
  const legacyTaxes = await TaxTrack.findAll({
    where: { clientId: null },
  });

  for (const tax of legacyTaxes) {
    const client = await findOrCreateClientByName(tax.clientName);
    tax.clientId = client.id;
    tax.clientName = client.name;
    await tax.save();
  }

  return legacyTaxes.length;
};
