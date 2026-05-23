import mongoose from "mongoose";
import invoiceModel from "../models/invoiceModel.js";

function kolkataYmd(ts = Date.now()) {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function kolkataMidnightMs(ymd) {
  return Date.parse(`${ymd}T00:00:00+05:30`);
}

function kolkataWeekdayShort(ms) {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short"
  });
}

function startOfMondayWeekKolkata(todayStartMs) {
  let t = todayStartMs;
  for (let i = 0; i < 7; i++) {
    if (kolkataWeekdayShort(t) === "Mon") return t;
    t -= 86400000;
  }
  return todayStartMs;
}

function monthBoundsKolkata(todayYmd) {
  const [y, m] = todayYmd.split("-").map(Number);
  const ys = String(y).padStart(4, "0");
  const ms = String(m).padStart(2, "0");
  const start = Date.parse(`${ys}-${ms}-01T00:00:00+05:30`);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const nextStart = Date.parse(
    `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01T00:00:00+05:30`
  );
  return { start, end: nextStart - 1 };
}

function yearBoundsKolkata(todayYmd) {
  const y = Number(todayYmd.split("-")[0]);
  const start = Date.parse(`${y}-01-01T00:00:00+05:30`);
  const nextStart = Date.parse(`${y + 1}-01-01T00:00:00+05:30`);
  return { start, end: nextStart - 1 };
}

function dateRangeForPeriod(period) {
  const p = period === undefined || period === null ? "today" : String(period);
  if (p === "all") return null;

  const todayYmd = kolkataYmd();
  const todayStart = kolkataMidnightMs(todayYmd);
  const todayEnd = todayStart + 86400000 - 1;

  if (p === "today") return { start: todayStart, end: todayEnd };

  if (p === "week") {
    const monday = startOfMondayWeekKolkata(todayStart);
    return { start: monday, end: monday + 7 * 86400000 - 1 };
  }

  if (p === "month") return monthBoundsKolkata(todayYmd);

  if (p === "year") return yearBoundsKolkata(todayYmd);

  return { start: todayStart, end: todayEnd };
}

const getAdminSales = async (req, res) => {
  try {
    const period = req.body?.period ?? req.query?.period ?? "today";
    const range = dateRangeForPeriod(period);
    const filter = range ? { date: { $gte: range.start, $lte: range.end } } : {};

    const invoices = await invoiceModel.find(filter).sort({ date: -1 }).lean();

    const total = invoices.reduce((acc, inv) => {
      const n = Number(inv.totalAmount);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    return res.json({
      success: true,
      invoices,
      summary: {
        count: invoices.length,
        total
      }
    });
  } catch (error) {
    console.error("Error fetching invoice sales:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

const searchAdminInvoices = async (req, res) => {
  try {
    const q = String(
      req.body?.query ?? req.query?.query ?? req.query?.q ?? ""
    ).trim();
    if (!q) {
      return res.json({ success: true, invoices: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");

    const invoices = await invoiceModel
      .find({
        $or: [
          { invoiceId: rx },
          { customerName: rx },
          { flatName: rx },
          { flatNumber: rx },
          { email: rx },
          { mobile: rx }
        ]
      })
      .sort({ date: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, invoices });
  } catch (error) {
    console.error("Error searching invoices:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

const getAdminInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid invoice id" });
    }

    const invoice = await invoiceModel.findById(id).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    return res.json({ success: true, invoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

const createInvoice = async (req, res) => {
  try {
    const {
      invoiceId,
      flatName,
      flatNumber = "",
      customerName,
      mobile = "",
      email = "",
      itemsOrdered,
      totalAmount,
      discount = 0
    } = req.body;
    if (
      !invoiceId ||
      !flatName ||
      !customerName ||
      !Array.isArray(itemsOrdered) ||
      itemsOrdered.length === 0 ||
      typeof totalAmount !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid invoice payload"
      });
    }

    const normalizedItems = itemsOrdered.map((item) => {
      const normalized = {
        name: item?.name,
        quantity: Number(item?.quantity),
        price: Number(item?.price)
      };
      if (item?.originalPrice != null && item?.originalPrice !== "") {
        normalized.originalPrice = Number(item.originalPrice);
      }
      return normalized;
    });

    const hasInvalidItems = normalizedItems.some(
      (item) =>
        !item.name ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        (item.originalPrice != null &&
          (!Number.isFinite(item.originalPrice) || item.originalPrice < 0))
    );

    if (hasInvalidItems) {
      return res.status(400).json({
        success: false,
        message: "Invalid itemsOrdered data"
      });
    }

    const newInvoice = new invoiceModel({
      invoiceId,
      flatName,
      flatNumber,
      customerName,
      mobile,
      email,
      itemsOrdered: normalizedItems,
      totalAmount,
      discount
    });

    const savedInvoice = await newInvoice.save();
    return res.status(201).json({
      success: true,
      message: "Invoice saved successfully",
      invoice: savedInvoice
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Invoice ID already exists"
      });
    }

    console.error("Error saving invoice:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

export { createInvoice, getAdminInvoiceById, getAdminSales, searchAdminInvoices };
