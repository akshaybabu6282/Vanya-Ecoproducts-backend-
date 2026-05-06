import express from "express";
import {
  createInvoice,
  getAdminInvoiceById,
  getAdminSales,
  searchAdminInvoices
} from "../controllers/invoiceController.js";
import adminAuth from "../middleware/adminAuth.js";

const invoiceRouter = express.Router();

invoiceRouter.post("/create", createInvoice);

invoiceRouter.get("/admin/sales", adminAuth, getAdminSales);
invoiceRouter.post("/admin/sales", adminAuth, getAdminSales);

invoiceRouter.get("/admin/search", adminAuth, searchAdminInvoices);
invoiceRouter.post("/admin/search", adminAuth, searchAdminInvoices);

invoiceRouter.get("/admin/:id", adminAuth, getAdminInvoiceById);

export default invoiceRouter;
