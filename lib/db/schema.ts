import {
  bigint,
  bigserial,
  boolean,
  date,
  decimal,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["superadmin", "kasir"]);

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const genderEnum = pgEnum("gender", ["male", "female"]);
export const memberCategoryEnum = pgEnum("member_category", [
  "pelajar",
  "mahasiswa",
  "umum",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "qris",
  "transfer",
  "debit",
]);

export const memberNoSeq = pgSequence("member_no_seq");

// Monthly base price per category; a membership costs this × package months.
export const categoryPrices = pgTable("category_prices", {
  category: memberCategoryEnum("category").primaryKey(),
  pricePerMonth: decimal("price_per_month", { precision: 14, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const packages = pgTable("packages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  months: integer("months").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const members = pgTable("members", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  memberNo: varchar("member_no", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  birthDate: date("birth_date", { mode: "string" }),
  gender: genderEnum("gender").notNull(),
  category: memberCategoryEnum("category").notNull(),
  photoPath: varchar("photo_path", { length: 255 }).notNull(),
  qrToken: varchar("qr_token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => members.id),
  packageId: bigint("package_id", { mode: "number" })
    .notNull()
    .references(() => packages.id),
  // Copied from the package at purchase time so later package edits don't rewrite history.
  packageName: varchar("package_name", { length: 100 }).notNull(),
  months: integer("months").notNull(),
  category: memberCategoryEnum("category").notNull(),
  price: decimal("price", { precision: 14, scale: 2 }).notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  // Nullable: later days add other link columns (PT purchases, sales) to this table.
  membershipId: bigint("membership_id", { mode: "number" }).references(
    () => memberships.id,
  ),
  method: paymentMethodEnum("method").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});
