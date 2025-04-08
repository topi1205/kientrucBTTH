const express = require("express");
const router = express.Router();

// Thêm log chi tiết và xử lý lỗi trong các API
router.post("/pay", (req, res) => {
  try {
    const { amount, user } = req.body;

    console.log("Received payment request:", { amount, user });

    // Logic xử lý thanh toán
    if (!amount || amount <= 0) {
      return res.status(400).send({ message: "Invalid payment amount" });
    }

    res.status(200).send({ message: "Payment successful" });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

router.get("/status", (req, res) => {
  try {
    console.log("Received status check request");
    res.status(200).send({ status: "Paid" });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

// Thêm endpoint /health để kiểm tra trạng thái của service
router.get("/health", (req, res) => {
  res.status(200).send({ status: "Payment Service is healthy" });
});

module.exports = router;
