import { sql, type SQL } from "drizzle-orm";
import { customType, index, jsonb, pgSchema, text, uuid } from "drizzle-orm/pg-core";

const kbSchema = pgSchema("kb");

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const articles = kbSchema.table(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    appliesTo: jsonb("applies_to").$type<Record<string, unknown>>().notNull().default({}),
    search: tsvector("search")
      .notNull()
      .generatedAlwaysAs((): SQL => sql`to_tsvector('portuguese', "title" || ' ' || "body")`),
  },
  (t) => [index("articles_search_idx").using("gin", t.search)],
);
