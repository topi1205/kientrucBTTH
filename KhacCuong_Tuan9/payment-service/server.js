const express = require('express');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/api/payment', paymentRoutes);

app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});
