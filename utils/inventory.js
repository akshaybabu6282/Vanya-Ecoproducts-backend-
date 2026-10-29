import mongoose from "mongoose";
import productModel from "../models/productModel.js";

export class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
  }
}

function resolveProductId(item) {
  return item?.productId || item?._id || item?.id;
}

function productKey(item) {
  const productId = resolveProductId(item);
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    return `id:${String(productId)}`;
  }
  const name = String(item?.name || "").trim();
  return name ? `name:${name}` : null;
}

function aggregateQuantities(items = []) {
  const totals = new Map();

  for (const item of items) {
    const key = productKey(item);
    const quantity = Number(item?.quantity);
    if (!key || !Number.isFinite(quantity) || quantity <= 0) continue;

    const existing = totals.get(key) || {
      productId: resolveProductId(item),
      name: item.name,
      quantity: 0,
    };
    existing.quantity += quantity;
    totals.set(key, existing);
  }

  return [...totals.values()];
}

async function findProduct(item) {
  const productId = resolveProductId(item);
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    const byId = await productModel.findById(productId);
    if (byId) return byId;
  }

  const name = String(item.name || "").trim();
  if (!name) return null;

  return productModel.findOne({ name });
}

async function applyDelta(item, delta) {
  if (!delta) return null;

  const product = await findProduct(item);
  if (!product) {
    throw new InventoryError(
      `Product not found for billed item "${item.name || item.productId}"`
    );
  }

  if (delta < 0) {
    const needed = Math.abs(delta);
    const updated = await productModel.findOneAndUpdate(
      { _id: product._id, itemCount: { $gte: needed } },
      { $inc: { itemCount: delta } },
      { new: true }
    );
    if (!updated) {
      throw new InventoryError(
        `Insufficient stock for "${product.name}". Available: ${product.itemCount}, requested: ${needed}`
      );
    }
    return { productId: updated._id, name: updated.name, itemCount: updated.itemCount };
  }

  const updated = await productModel.findByIdAndUpdate(
    product._id,
    { $inc: { itemCount: delta } },
    { new: true }
  );
  return { productId: updated._id, name: updated.name, itemCount: updated.itemCount };
}

export async function deductStockForItems(items) {
  const aggregated = aggregateQuantities(items);
  const applied = [];

  try {
    const results = [];
    for (const item of aggregated) {
      const result = await applyDelta(item, -item.quantity);
      applied.push({ item, delta: -item.quantity });
      if (result) results.push(result);
    }
    return results;
  } catch (error) {
    for (const { item, delta } of applied.reverse()) {
      await applyDelta(item, -delta);
    }
    throw error;
  }
}

export async function restoreStockForItems(items) {
  const aggregated = aggregateQuantities(items);
  const results = [];
  for (const item of aggregated) {
    const result = await applyDelta(item, item.quantity);
    if (result) results.push(result);
  }
  return results;
}

export async function adjustStockForInvoiceChange(previousItems, nextItems) {
  await restoreStockForItems(previousItems);
  try {
    return await deductStockForItems(nextItems);
  } catch (error) {
    await deductStockForItems(previousItems);
    throw error;
  }
}
