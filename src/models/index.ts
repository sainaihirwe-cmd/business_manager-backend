import { Schema, model, Types } from "mongoose";
const ref: Record<string, any> = {
  business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
};
export const Business = model(
  "Business",
  new Schema(
    {
      name: { type: String, required: true },
      phone: String,
      email: String,
      address: String,
      currency: { type: String, default: "USD" },
      logo: String,
    },
    { timestamps: true },
  ),
);
export const User = model(
  "User",
  new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true },
      business: {
        type: Schema.Types.ObjectId,
        ref: "Business",
        required: true,
      },
      role: { type: String, default: "owner" },
    },
    { timestamps: true },
  ),
);
export const Category = model(
  "Category",
  new Schema(
    { ...ref, name: { type: String, required: true } },
    { timestamps: true },
  ),
);
export const Product = model(
  "Product",
  new Schema(
    {
      ...ref,
      name: { type: String, required: true },
      description: String,
      category: { type: Schema.Types.ObjectId, ref: "Category" },
      buyingPrice: { type: Number, min: 0, required: true },
      sellingPrice: { type: Number, min: 0, required: true },
      stockQuantity: { type: Number, min: 0, default: 0 },
      minimumStockLevel: { type: Number, min: 0, default: 5 },
      supplier: String,
      imageUrl: String,
    },
    { timestamps: true },
  ),
);
export const Customer = model(
  "Customer",
  new Schema(
    {
      ...ref,
      name: { type: String, required: true },
      phone: String,
      email: String,
      address: String,
      notes: String,
    },
    { timestamps: true },
  ),
);
const saleItem = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, min: 1, required: true },
    buyingPrice: Number,
    sellingPrice: Number,
    profit: Number,
  },
  { _id: false },
);
export const Sale = model(
  "Sale",
  new Schema(
    {
      ...ref,
      customer: { type: Schema.Types.ObjectId, ref: "Customer" },
      items: { type: [saleItem], required: true },
      subtotal: Number,
      total: Number,
      profit: Number,
      paymentMethod: {
        type: String,
        enum: ["cash", "card", "transfer", "other"],
        default: "cash",
      },
      saleDate: { type: Date, default: Date.now },
    },
    { timestamps: true },
  ),
);
export const Expense = model(
  "Expense",
  new Schema(
    {
      ...ref,
      amount: { type: Number, min: 0, required: true },
      category: { type: String, required: true },
      product: { type: Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, min: 1 },
      description: String,
      paymentMethod: { type: String, default: "cash" },
      date: { type: Date, default: Date.now },
    },
    { timestamps: true },
  ),
);
export const InventoryTransaction = model(
  "InventoryTransaction",
  new Schema(
    {
      ...ref,
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      type: {
        type: String,
        enum: ["stock-in", "stock-out", "stock-adjustment"],
        required: true,
      },
      quantity: { type: Number, required: true },
      previousQuantity: Number,
      newQuantity: Number,
      note: String,
      date: { type: Date, default: Date.now },
    },
    { timestamps: true },
  ),
);
export type Id = Types.ObjectId;
