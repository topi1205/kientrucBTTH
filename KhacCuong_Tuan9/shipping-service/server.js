const express = require("express");
const shippingRoutes = require("./routes/shippingRoutes");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use("/api/shipping", shippingRoutes);

app.listen(PORT, () => {
  console.log(`Shipping Service running on port ${PORT}`);
});
