import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 用户类型定义
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
