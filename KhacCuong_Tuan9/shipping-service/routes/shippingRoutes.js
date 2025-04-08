const express = require('express');
const router = express.Router();

// API để gửi yêu cầu giao hàng
router.post('/', (req, res) => {
  const { orderId, address } = req.body;
  // Logic xử lý giao hàng
  res.status(200).send({ message: 'Shipping started' });
});

// API để kiểm tra trạng thái giao hàng
router.get('/status', (req, res) => {
  res.status(200).send({ status: 'Shipped' });
});

module.exports = router;
