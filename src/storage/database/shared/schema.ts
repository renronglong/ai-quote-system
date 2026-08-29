import { pgTable, text, timestamp, uuid, decimal, integer, boolean } from 'drizzle-orm/pg-core';

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  companyName: text('company_name'),
  address: text('address'),
  referralCode: text('referral_code').unique(),
  invitedBy: uuid('invited_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 用户类型定义
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;


// 供应商资料表
export const supplierProfiles = pgTable('supplier_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  phone: text('phone').notNull().unique(),
  address: text('address'),
  businessLicense: text('business_license'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 供应商产品表
export const supplierProducts = pgTable('supplier_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').references(() => supplierProfiles.id, { onDelete: 'cascade' }),
  alloyGrade: text('alloy_grade').notNull(),
  profileType: text('profile_type').notNull(),
  minWidthMm: decimal('min_width_mm'),
  maxWidthMm: decimal('max_width_mm'),
  minHeightMm: decimal('min_height_mm'),
  maxHeightMm: decimal('max_height_mm'),
  maxCircleMm: decimal('max_circle_mm'),
  minWallMm: decimal('min_wall_mm'),
  minOrderKg: decimal('min_order_kg').default('300'),
  unitPrice: decimal('unit_price').notNull(),
  priceUnit: text('price_unit').default('元/吨'),
  leadDays: integer('lead_days').default(15),
  surfaceTreatments: text('surface_treatments').array(),
  remarks: text('remarks'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SupplierProfile = typeof supplierProfiles.$inferSelect;
export type NewSupplierProfile = typeof supplierProfiles.$inferInsert;
export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type NewSupplierProduct = typeof supplierProducts.$inferInsert;


// 识图反馈表
export const recognitionFeedback = pgTable('recognition_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  recognitionId: text('recognition_id').notNull(),
  aiValues: jsonb('ai_values').default({}).notNull(),
  userConfirmedValues: jsonb('user_confirmed_values').default({}).notNull(),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 识图使用记录
export const recognitionLogs = pgTable('recognition_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  fileName: text('file_name'),
  aiResult: jsonb('ai_result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 每日识别额度
export const recognitionUsage = pgTable('recognition_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  date: date('date').default('CURRENT_DATE').notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  bonusCount: integer('bonus_count').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type RecognitionFeedback = typeof recognitionFeedback.$inferSelect;
export type RecognitionLog = typeof recognitionLogs.$inferSelect;
export type RecognitionUsage = typeof recognitionUsage.$inferSelect;
