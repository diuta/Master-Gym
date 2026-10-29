import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  decimal,
  index,
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

// One row only (id = 1): the kasir never types a visit price.
export const visitPrice = pgTable(
  "visit_price",
  {
    id: integer("id").primaryKey().default(1),
    price: decimal("price", { precision: 14, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [check("visit_price_single_row", sql`${t.id} = 1`)],
);

export const trainers = pgTable("trainers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ptPrograms = pgTable("pt_programs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  sessions: integer("sessions").notNull(),
  price: decimal("price", { precision: 14, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ptPurchases = pgTable("pt_purchases", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => members.id),
  ptProgramId: bigint("pt_program_id", { mode: "number" })
    .notNull()
    .references(() => ptPrograms.id),
  // Copied from the program at purchase time so later program edits don't rewrite history.
  programName: varchar("program_name", { length: 100 }).notNull(),
  sessions: integer("sessions").notNull(),
  price: decimal("price", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Walk-in without membership; createdAt is the check-in time.
export const visits = pgTable(
  "visits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    price: decimal("price", { precision: 14, scale: 2 }).notNull(),
    lockerNo: varchar("locker_no", { length: 20 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("visits_created_at_idx").on(t.createdAt)],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    memberId: bigint("member_id", { mode: "number" })
      .notNull()
      .references(() => members.id),
    lockerNo: varchar("locker_no", { length: 20 }),
    // Set when the member used a PT session on this visit.
    trainerId: bigint("trainer_id", { mode: "number" }).references(() => trainers.id),
    checkedInAt: timestamp("checked_in_at").notNull().defaultNow(),
  },
  (t) => [
    index("check_ins_checked_in_at_idx").on(t.checkedInAt),
    index("check_ins_member_id_idx").on(t.memberId),
  ],
);

export const payments = pgTable(
"payments",
{
  id: bigserial("id", { mode: "number" }).primaryKey(),
  // Each link is nullable; the check below requires exactly one per payment.
  membershipId: bigint("membership_id", { mode: "number" }).references(
    () => memberships.id,
  ),
  visitId: bigint("visit_id", { mode: "number" }).references(() => visits.id),
  ptPurchaseId: bigint("pt_purchase_id", { mode: "number" }).references(
    () => ptPurchases.id,
  ),
  method: paymentMethodEnum("method").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
},
(t) => [
  check(
    "payments_one_link",
    sql`num_nonnulls(${t.membershipId}, ${t.visitId}, ${t.ptPurchaseId}) = 1`,
  ),
]);
