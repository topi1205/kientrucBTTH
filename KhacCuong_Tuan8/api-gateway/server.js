const express = require("express");
const axios = require("axios");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
app.use(express.json());

// Sử dụng các route từ apiRoutes.js
app.use(apiRoutes);

app.listen(3000, () => {
  console.log("API Gateway running on port 3000");
});
