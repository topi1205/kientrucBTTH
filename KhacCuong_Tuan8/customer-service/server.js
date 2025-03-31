const express = require("express");
const mongoose = require("mongoose");
const customerRoutes = require("./routes/customerRoutes");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://customer-db:27017/customer-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use("/api", customerRoutes);

app.listen(3003, () => {
  console.log("Customer Service running on port 3003");
});
