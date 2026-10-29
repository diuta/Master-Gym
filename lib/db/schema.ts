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

export const productCategories = pgTable("product_categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  categoryId: bigint("category_id", { mode: "number" })
    .notNull()
    .references(() => productCategories.id),
  unit: varchar("unit", { length: 20 }).notNull(),
  salePrice: decimal("sale_price", { precision: 14, scale: 2 }).notNull(),
  minStock: integer("min_stock").notNull().default(5),
  // Moving average of purchase cost; sales snapshot it into sale_items.unit_cost.
  avgCost: decimal("avg_cost", { precision: 14, scale: 4 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "initial",
  "purchase",
  "sale",
  "purchase_cancel",
  "sale_cancel",
]);
export const transactionStatusEnum = pgEnum("transaction_status", ["success", "cancelled"]);

export const saleNoSeq = pgSequence("sale_no_seq");
export const purchaseNoSeq = pgSequence("purchase_no_seq");

export const sales = pgTable(
  "sales",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    invoiceNo: varchar("invoice_no", { length: 20 }).notNull().unique(),
    buyerName: varchar("buyer_name", { length: 100 }),
    date: date("date", { mode: "string" }).notNull(),
    notes: varchar("notes", { length: 255 }),
    total: decimal("total", { precision: 14, scale: 2 }).notNull(),
    status: transactionStatusEnum("status").notNull().default("success"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("sales_date_idx").on(t.date)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    saleId: bigint("sale_id", { mode: "number" })
      .notNull()
      .references(() => sales.id),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id),
    // Name/unit/cost copied at sale time so later product edits don't rewrite history.
    productName: varchar("product_name", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    qty: integer("qty").notNull(),
    unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
    unitCost: decimal("unit_cost", { precision: 14, scale: 4 }).notNull(),
    lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [index("sale_items_sale_id_idx").on(t.saleId)],
);

export const purchases = pgTable(
  "purchases",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    invoiceNo: varchar("invoice_no", { length: 20 }).notNull().unique(),
    supplierId: bigint("supplier_id", { mode: "number" })
      .notNull()
      .references(() => suppliers.id),
    supplierName: varchar("supplier_name", { length: 100 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    notes: varchar("notes", { length: 255 }),
    total: decimal("total", { precision: 14, scale: 2 }).notNull(),
    status: transactionStatusEnum("status").notNull().default("success"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("purchases_date_idx").on(t.date)],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    purchaseId: bigint("purchase_id", { mode: "number" })
      .notNull()
      .references(() => purchases.id),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id),
    productName: varchar("product_name", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    qty: integer("qty").notNull(),
    unitCost: decimal("unit_cost", { precision: 14, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [index("purchase_items_purchase_id_idx").on(t.purchaseId)],
);

// Stock is never stored: it is sum(qty_delta) over this ledger.
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id),
    qtyDelta: integer("qty_delta").notNull(),
    type: stockMovementTypeEnum("type").notNull(),
    saleItemId: bigint("sale_item_id", { mode: "number" }).references(() => saleItems.id),
    purchaseItemId: bigint("purchase_item_id", { mode: "number" }).references(
      () => purchaseItems.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("stock_movements_product_id_idx").on(t.productId)],
);

export const expenseCategories = pgTable("expense_categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    categoryId: bigint("category_id", { mode: "number" })
      .notNull()
      .references(() => expenseCategories.id),
    categoryName: varchar("category_name", { length: 100 }).notNull(),
    description: varchar("description", { length: 200 }).notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("expenses_date_idx").on(t.date)],
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
    saleId: bigint("sale_id", { mode: "number" }).references(() => sales.id),
    purchaseId: bigint("purchase_id", { mode: "number" }).references(() => purchases.id),
    method: paymentMethodEnum("method").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "payments_exactly_one_link",
      sql`num_nonnulls(${t.membershipId}, ${t.visitId}, ${t.ptPurchaseId}, ${t.saleId}, ${t.purchaseId}) = 1`,
    ),
    index("payments_sale_id_idx").on(t.saleId),
    index("payments_purchase_id_idx").on(t.purchaseId),
  ],
);
