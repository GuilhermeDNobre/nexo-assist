import type { Database } from "../client";
import { users } from "../schema";

export const SEED_USER_IDS = {
  anaSouza: "56c03382-e439-4bf5-b5b0-d03a2d0bb881",
  carlaMendes: "1c531617-b564-4993-a4b9-37cdd65b5212",
  brunoTavares: "064a7227-2942-4c90-984d-91b7c2d2d581",
  diegoRamos: "c56eed5e-6256-4268-b2be-9cad83dfde40",
  elisaMoreira: "5bcbd464-e5d0-4494-bf4f-3e709e1dafb0",
  rafaelLima: "84379ba7-3287-494c-ae31-20501ed4fceb",
  julianaCosta: "bfcfffcc-c2a6-420c-9230-ed7a4ac798d7",
} as const;

const SEED_USERS = [
  {
    id: SEED_USER_IDS.anaSouza,
    email: "ana.souza@nexo.com.br",
    name: "Ana Souza",
    role: "employee" as const,
    analystLevel: null,
    deviceOs: "Windows 11",
  },
  {
    id: SEED_USER_IDS.carlaMendes,
    email: "carla.mendes@nexo.com.br",
    name: "Carla Mendes",
    role: "employee" as const,
    analystLevel: null,
    deviceOs: "Windows 11",
  },
  {
    id: SEED_USER_IDS.brunoTavares,
    email: "bruno.tavares@nexo.com.br",
    name: "Bruno Tavares",
    role: "employee" as const,
    analystLevel: null,
    deviceOs: "Windows 10",
  },
  {
    id: SEED_USER_IDS.diegoRamos,
    email: "diego.ramos@nexo.com.br",
    name: "Diego Ramos",
    role: "employee" as const,
    analystLevel: null,
    deviceOs: "Windows 10",
  },
  {
    id: SEED_USER_IDS.elisaMoreira,
    email: "elisa.moreira@nexo.com.br",
    name: "Elisa Moreira",
    role: "employee" as const,
    analystLevel: null,
    deviceOs: "macOS 14",
  },
  {
    id: SEED_USER_IDS.rafaelLima,
    email: "rafael.lima@nexo.com.br",
    name: "Rafael Lima",
    role: "analyst" as const,
    analystLevel: "N2" as const,
    deviceOs: null,
  },
  {
    id: SEED_USER_IDS.julianaCosta,
    email: "juliana.costa@nexo.com.br",
    name: "Juliana Costa",
    role: "analyst" as const,
    analystLevel: "N1" as const,
    deviceOs: null,
  },
];

export async function seedUsers(database: Database): Promise<void> {
  await database.insert(users).values(SEED_USERS).onConflictDoNothing();
}
