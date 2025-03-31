const express = require("express");
const axios = require("axios");

const router = express.Router();

// Chuyển tiếp yêu cầu đến Product Service
router.use("/products", async (req, res) => {
  const response = await axios({
    method: req.method,
    url: `http://product-service:3001/api/products${req.url}`, // Thay localhost thành product-service
    data: req.body,
  });
  res.status(response.status).json(response.data);
});

// Chuyển tiếp yêu cầu đến Order Service
router.use("/orders", async (req, res) => {
  const response = await axios({
    method: req.method,
    url: `http://order-service:3002/api/orders${req.url}`, // Thay localhost thành order-service
    data: req.body,
  });
  res.status(response.status).json(response.data);
});

// Chuyển tiếp yêu cầu đến Customer Service
router.use("/customers", async (req, res) => {
  const response = await axios({
    method: req.method,
    url: `http://customer-service:3003/api/customers${req.url}`, // Thay localhost thành customer-service
    data: req.body,
  });
  res.status(response.status).json(response.data);
});

module.exports = router;
