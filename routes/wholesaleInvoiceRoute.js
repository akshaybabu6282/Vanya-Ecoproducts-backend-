import express from "express";
import { createWholesaleInvoice } from "../controllers/wholesaleInvoiceController.js";

const wholesaleInvoiceRouter = express.Router();

wholesaleInvoiceRouter.post("/create", createWholesaleInvoice);

export default wholesaleInvoiceRouter;
