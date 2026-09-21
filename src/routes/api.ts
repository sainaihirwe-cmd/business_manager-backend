import { Response, Router } from "express";
import { body, validationResult } from "express-validator";
import { AuthRequest } from "../middleware/auth";
import {
  Business,
  Category,
  Customer,
  Expense,
  InventoryTransaction,
  Product,
  Sale,
} from "../models";
const router = Router();
const fail = (res: Response) => {
  const e = validationResult(res.req);
  return (
    !e.isEmpty() && res.status(400).json({ message: "Invalid request data" })
  );
};
const own = (req: AuthRequest) => ({ business: req.user!.businessId });
router.get("/dashboard", async (req: AuthRequest, res) => {
  const businessId = req.user!.businessId;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [sales, expenses, products, customers] = await Promise.all([
    Sale.find({ business: businessId, saleDate: { $gte: start } }),
    Expense.find({ business: businessId, date: { $gte: start } }),
    Product.find({ business: businessId }),
    Customer.countDocuments({ business: businessId }),
  ]);
  const todaySales = sales.reduce((n, s) => n + (s.total || 0), 0);
  const todayExpenses = expenses.reduce((n, e) => n + e.amount, 0);
  res.json({
    todaySales,
    todayExpenses,
    todayProfit: sales.reduce((n, s) => n + (s.profit || 0), 0) - todayExpenses,
    totalProducts: products.length,
    lowStock: products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStockLevel,
    ).length,
    outOfStock: products.filter((p) => p.stockQuantity === 0).length,
    totalCustomers: customers,
  });
});
router.get("/products", async (req: AuthRequest, res: Response) =>
  res.json(
    await Product.find(own(req)).populate("category").sort({ createdAt: -1 }),
  ),
);
router.post(
  "/products",
  [
    body("name").trim().notEmpty(),
    body("buyingPrice").isFloat({ min: 0 }),
    body("sellingPrice").isFloat({ min: 0 }),
    body("stockQuantity").isFloat({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response) => {
    if (fail(res)) return;
    res.status(201).json(await Product.create({ ...req.body, ...own(req) }));
  },
);
router.put("/products/:id", async (req: AuthRequest, res: Response) =>
  res.json(
    await Product.findOneAndUpdate(
      { _id: req.params.id, ...own(req) },
      req.body,
      { new: true, runValidators: true },
    ),
  ),
);
router.delete("/products/:id", async (req: AuthRequest, res: Response) => {
  await Product.deleteOne({ _id: req.params.id, ...own(req) });
  res.status(204).send();
});
router.get("/customers", async (req: AuthRequest, res: Response) =>
  res.json(await Customer.find(own(req)).sort({ name: 1 })),
);
router.post(
  "/customers",
  [body("name").trim().notEmpty()],
  async (req: AuthRequest, res: Response) => {
    if (fail(res)) return;
    res.status(201).json(await Customer.create({ ...req.body, ...own(req) }));
  },
);
router.put("/customers/:id", async (req: AuthRequest, res: Response) =>
  res.json(
    await Customer.findOneAndUpdate(
      { _id: req.params.id, ...own(req) },
      req.body,
      { new: true, runValidators: true },
    ),
  ),
);
router.delete("/customers/:id", async (req: AuthRequest, res: Response) => {
  await Customer.deleteOne({ _id: req.params.id, ...own(req) });
  res.status(204).send();
});
router.get("/expenses", async (req: AuthRequest, res: Response) =>
  res.json(
    await Expense.find(own(req))
      .populate("product", "name stockQuantity")
      .sort({ date: -1 }),
  ),
);
router.post(
  "/expenses",
  [
    body("amount").isFloat({ min: 0 }),
    body("category").trim().notEmpty(),
    body("quantity").optional().isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res: Response) => {
    if (fail(res)) return;
    if (!req.body.product) {
      return res
        .status(201)
        .json(await Expense.create({ ...req.body, ...own(req) }));
    }
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({ message: "Quantity must be a whole number greater than zero" });
    }
    let product: any;
    try {
      product = await Product.findOneAndUpdate(
        {
          _id: req.body.product,
          ...own(req),
          stockQuantity: { $gte: quantity },
        },
        { $inc: { stockQuantity: -quantity } },
        { new: false },
      );
      if (!product) {
        const exists = await Product.exists({
          _id: req.body.product,
          ...own(req),
        });
        throw new Error(
          exists
            ? "Insufficient stock for this expense"
            : "Product not found",
        );
      }
      const remainingStock = product.stockQuantity - quantity;
      const expense = await Expense.create({
        ...req.body,
        ...own(req),
        quantity,
      });
      await InventoryTransaction.create({
        ...own(req),
        product: product._id,
        type: "stock-out",
        quantity,
        previousQuantity: product.stockQuantity,
        newQuantity: remainingStock,
        note: `Expense: ${req.body.category}`,
      });
      res.status(201).json({ expense, remainingStock });
    } catch (error: any) {
      if (product) {
        await Product.updateOne(
          { _id: product._id, ...own(req) },
          { $inc: { stockQuantity: quantity } },
        );
      }
      res.status(400).json({
        message: error.message || "Could not record expense",
      });
    }
  },
);
router.put("/expenses/:id", async (req: AuthRequest, res: Response) =>
  res.json(
    await Expense.findOneAndUpdate(
      { _id: req.params.id, ...own(req) },
      req.body,
      { new: true, runValidators: true },
    ),
  ),
);
router.delete("/expenses/:id", async (req: AuthRequest, res: Response) => {
  await Expense.deleteOne({ _id: req.params.id, ...own(req) });
  res.status(204).send();
});
router.get("/sales", async (req: AuthRequest, res) =>
  res.json(
    await Sale.find(own(req))
      .populate("customer")
      .populate("items.product")
      .sort({ saleDate: -1 })
      .limit(100),
  ),
);
router.post("/sales", async (req: AuthRequest, res) => {
  const requestedItems = req.body.items || [];
  if (!requestedItems.length) {
    return res.status(400).json({ message: "Add at least one product" });
  }
  const changed: Array<{ id: any; quantity: number }> = [];
  try {
    let subtotal = 0;
    let profit = 0;
    const items: any[] = [];
    for (const input of requestedItems) {
      const quantity = Number(input.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Invalid sale quantity");
      const product = await Product.findOneAndUpdate(
        { _id: input.product, ...own(req), stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { new: false },
      );
      if (!product) throw new Error("Insufficient stock or invalid product");
      changed.push({ id: product._id, quantity });
      const line = product.sellingPrice * quantity;
      const lineProfit = (product.sellingPrice - product.buyingPrice) * quantity;
      subtotal += line;
      profit += lineProfit;
      items.push({ product: product._id, quantity, buyingPrice: product.buyingPrice, sellingPrice: product.sellingPrice, profit: lineProfit });
    }
    const sale = await Sale.create({ ...own(req), customer: req.body.customer || undefined, items, subtotal, total: subtotal, profit, paymentMethod: req.body.paymentMethod || "cash" });
    await InventoryTransaction.insertMany(items.map((item: any) => ({ ...own(req), product: item.product, type: "stock-out", quantity: item.quantity, note: "Sale" })));
    res.status(201).json(sale);
  } catch (error: any) {
    for (const item of changed) await Product.updateOne({ _id: item.id, ...own(req) }, { $inc: { stockQuantity: item.quantity } });
    res
      .status(400)
      .json({ message: error.message || "Could not complete sale" });
  }
});
router.get("/inventory", async (req: AuthRequest, res) =>
  res.json(await Product.find(own(req)).sort({ stockQuantity: 1 })),
);
router.post("/inventory/:productId", async (req: AuthRequest, res) => {
  const p = await Product.findOne({ _id: req.params.productId, ...own(req) });
  if (!p) return res.status(404).json({ message: "Product not found" });
  const previous = p.stockQuantity;
  const next =
    req.body.type === "stock-in"
      ? previous + Number(req.body.quantity)
      : Number(req.body.quantity);
  if (next < 0)
    return res.status(400).json({ message: "Stock cannot be negative" });
  p.stockQuantity = next;
  await p.save();
  res
    .status(201)
    .json(
      await InventoryTransaction.create({
        ...own(req),
        product: p._id,
        type: req.body.type,
        quantity: Number(req.body.quantity),
        previousQuantity: previous,
        newQuantity: next,
        note: req.body.note,
      }),
    );
});
router.get("/reports", async (req: AuthRequest, res) => {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const [sales, expenses] = await Promise.all([
    Sale.find({ ...own(req), saleDate: { $gte: from } }),
    Expense.find({ ...own(req), date: { $gte: from } }),
  ]);
  res.json({
    sales,
    expenses,
    summary: {
      sales: sales.reduce((n, s) => n + (s.total || 0), 0),
      expenses: expenses.reduce((n, e) => n + e.amount, 0),
      profit:
        sales.reduce((n, s) => n + (s.profit || 0), 0) -
        expenses.reduce((n, e) => n + e.amount, 0),
    },
  });
});
router.get("/business", async (req: AuthRequest, res) =>
  res.json(await Business.findById(req.user!.businessId)),
);
router.put("/business", async (req: AuthRequest, res) =>
  res.json(
    await Business.findByIdAndUpdate(req.user!.businessId, req.body, {
      new: true,
      runValidators: true,
    }),
  ),
);
export default router;
